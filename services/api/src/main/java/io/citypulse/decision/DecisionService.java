package io.citypulse.decision;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import io.citypulse.identity.TenantContext;
import io.citypulse.workspace.application.WorkspaceService;
import io.citypulse.workspace.infrastructure.WorkspaceRepository;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.Semaphore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DecisionService {

    private final WorkspaceRepository db;
    private final TenantContext identity;
    private final WorkspaceService operations;
    private final ObjectMapper json;
    private final String url, token;
    private final Semaphore computing = new Semaphore(2);
    private final HttpClient client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(2))
        .build();

    public DecisionService(
        WorkspaceRepository db,
        TenantContext identity,
        WorkspaceService operations,
        ObjectMapper json,
        @Value("${AI_BASE_URL:http://localhost:8000}") String url,
        @Value("${AI_SERVICE_TOKEN:${LOCAL_API_TOKEN:}}") String token
    ) {
        this.db = db;
        this.identity = identity;
        this.operations = operations;
        this.json = json;
        this.url = url;
        this.token = token;
    }

    private MapSqlParameterSource params() {
        return new MapSqlParameterSource("tenant", identity.tenantId()).addValue(
            "actor",
            identity.subject()
        );
    }

    private String encode(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid JSON");
        }
    }

    private JsonNode decode(String value) {
        try {
            return json.readTree(value);
        } catch (Exception e) {
            throw new IllegalStateException("Stored decision JSON invalid");
        }
    }

    private ResponseStatusException missing() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Decision record not found");
    }

    private ObjectNode owned(String table, UUID id) {
        // Table is selected only by this fixed allowlist, never by client/model input.
        if (
            !Set.of("decision_snapshot", "decision_network").contains(table)
        ) throw new IllegalArgumentException();
        var rows = db.query(
            "SELECT payload::text AS payload FROM " +
                table +
                " WHERE id=:id AND tenant_id=:tenant AND actor_subject=:actor",
            params().addValue("id", id)
        );
        if (rows.isEmpty()) throw missing();
        return (ObjectNode) decode(rows.getFirst().get("payload").toString());
    }

    private ObjectNode prepare(ObjectNode original) {
        ObjectNode input = original.deepCopy();
        ZoneId.of(input.path("timeZone").asText());
        String origin = input.path("origin").asText("synthetic");
        if (origin.equals("authorized-snapshot")) {
            var snapshot = owned(
                "decision_snapshot",
                UUID.fromString(input.path("snapshotId").asText())
            );
            Map<String, JsonNode> assumptions = new HashMap<>();
            for (var d : input.path("districts")) assumptions.put(d.path("id").asText(), d);
            ArrayNode districts = (ArrayNode) snapshot.path("districts").deepCopy();
            for (var d : districts) {
                var selected = assumptions.get(d.path("id").asText());
                if (selected != null) for (String field : List.of(
                    "risk",
                    "priority",
                    "minimumCoverage",
                    "receivingCapacity",
                    "accessibility",
                    "businessesPerKm2"
                ))
                    if (selected.has(field)) ((ObjectNode) d).set(field, selected.get(field));
            }
            Map<String, JsonNode> costs = new HashMap<>();
            for (var stock : input.path("stocks"))
                costs.put(stock.path("id").asText(), stock.path("unitCost"));
            ArrayNode stocks = (ArrayNode) snapshot.path("stocks").deepCopy();
            for (var stock : stocks)
                ((ObjectNode) stock).set(
                    "unitCost",
                    costs.getOrDefault(stock.path("id").asText(), NullNode.instance)
                );
            input.set("districts", districts);
            input.set("stocks", stocks);
            for (String field : List.of("unit", "periodStart", "periodEnd", "dataMode"))
                input.set(field, snapshot.get(field));
        } else if (Set.of("synthetic", "manual-assumptions").contains(origin)) {
            if (input.hasNonNull("snapshotId")) throw new IllegalArgumentException(
                "Snapshot origin required"
            );
            input.put("origin", origin);
            input.put("dataMode", origin.equals("synthetic") ? "synthetic" : "assumed");
            for (String field : List.of("districts", "stocks"))
                for (var row : input.path(field)) {
                    if (row instanceof ObjectNode object) object.set(
                        "evidence",
                        json.valueToTree(List.of(origin + ":operator-supplied"))
                    );
                }
        } else throw new IllegalArgumentException("Invalid origin");
        if (input.hasNonNull("networkId")) {
            var network = owned(
                "decision_network",
                UUID.fromString(input.path("networkId").asText())
            );
            input.set("lanes", network.path("lanes"));
            if (
                !origin.equals("synthetic") && network.path("dataMode").asText().equals("synthetic")
            ) throw new IllegalArgumentException("Synthetic network cannot be presented as real");
        }
        return input;
    }

    private ObjectNode compute(ObjectNode input) {
        if (!computing.tryAcquire()) throw new ResponseStatusException(
            HttpStatus.TOO_MANY_REQUESTS,
            "Decision workers busy; retry later"
        );
        try {
            var request = HttpRequest.newBuilder(URI.create(url + "/v1/decisions/evaluate"))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .header("X-Tenant-ID", identity.tenantId().toString())
                .POST(HttpRequest.BodyPublishers.ofString(encode(input)))
                .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 422) throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Scenario schema rejected: check finite quantities, time zones, periods, unique IDs, endpoints and weights against the published JSON schema"
            );
            if (response.statusCode() != 200) throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Decision engine unavailable; no allocation substituted"
            );
            return (ObjectNode) decode(response.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Decision interrupted"
            );
        } catch (java.io.IOException e) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Decision engine unavailable; no allocation substituted"
            );
        } finally {
            computing.release();
        }
    }

    @Transactional
    public Map<String, Object> run(String key, ObjectNode original) {
        return operations.idempotent("decision-v1", key, original, () -> {
            ObjectNode result = compute(prepare(original));
            UUID id = UUID.randomUUID();
            db.update(
                "INSERT INTO decision_scenario(id,tenant_id,actor_subject,name,input,result,input_sha256,result_sha256,engine_version) VALUES(:id,:tenant,:actor,:name,CAST(:input AS jsonb),CAST(:result AS jsonb),:inputHash,:resultHash,:version)",
                params()
                    .addValue("id", id)
                    .addValue("name", result.path("canonicalInput").path("name").asText())
                    .addValue("input", encode(result.path("canonicalInput")))
                    .addValue("result", encode(result))
                    .addValue("inputHash", result.path("inputFingerprint").asText())
                    .addValue("resultHash", result.path("resultFingerprint").asText())
                    .addValue("version", result.path("engineVersion").asText())
            );
            operations.audit("DECISION_SAVED", "decision_scenario", id);
            return Map.of("id", id, "result", result, "persisted", true);
        });
    }

    public Object list(int page) {
        if (page < 0 || page > 10000) throw new IllegalArgumentException("Page outside range");
        return db.query(
            "SELECT id,name,engine_version,input_sha256,result_sha256,created_at FROM decision_scenario WHERE tenant_id=:tenant AND actor_subject=:actor ORDER BY created_at DESC,id LIMIT 20 OFFSET :offset",
            params().addValue("offset", page * 20)
        );
    }

    public ObjectNode get(UUID id) {
        var rows = db.query(
            "SELECT id,input::text AS input,result::text AS result,created_at FROM decision_scenario WHERE tenant_id=:tenant AND actor_subject=:actor AND id=:id",
            params().addValue("id", id)
        );
        if (rows.isEmpty()) throw missing();
        var row = rows.getFirst();
        var response = json
            .createObjectNode()
            .put("id", id.toString())
            .put("createdAt", row.get("created_at").toString())
            .put("persisted", true);
        JsonNode input = decode(row.get("input").toString());
        response.set("input", input);
        if (input.hasNonNull("snapshotId")) response.set(
            "snapshot",
            owned("decision_snapshot", UUID.fromString(input.path("snapshotId").asText()))
        );
        if (input.hasNonNull("networkId")) response.set(
            "network",
            owned("decision_network", UUID.fromString(input.path("networkId").asText()))
        );
        response.set("result", decode(row.get("result").toString()));
        return response;
    }

    @Transactional
    public Object reproduce(UUID id, String key) {
        var previous = get(id);
        var current = run(key, (ObjectNode) previous.path("input"));
        var result = json.valueToTree(current).path("result");
        return Map.of(
            "parentId",
            id,
            "saved",
            current,
            "sameInput",
            previous
                .path("result")
                .path("inputFingerprint")
                .equals(result.path("inputFingerprint")),
            "sameResult",
            previous
                .path("result")
                .path("resultFingerprint")
                .equals(result.path("resultFingerprint")),
            "note",
            "Exact hashes require the same engine and solver version; numerical output also requires tolerance-based review."
        );
    }

    @Transactional
    public Object network(DecisionController.Network input) {
        var rows = db.query(
            "SELECT id,data_mode,license_reference,quality_status FROM source_metadata WHERE tenant_id=:tenant AND id=:source",
            params().addValue("source", input.sourceId())
        );
        if (rows.isEmpty()) throw missing();
        var source = rows.getFirst();
        String license = source.get("license_reference").toString();
        if (
            license.isBlank() ||
            Set.of("unspecified", "unknown", "none").contains(license.toLowerCase(Locale.ROOT))
        ) throw new IllegalArgumentException("Licensed network source required");
        var payload = json
            .createObjectNode()
            .put("sourceId", input.sourceId().toString())
            .put("dataMode", source.get("data_mode").toString())
            .put("license", license)
            .put("qualityStatus", source.get("quality_status").toString())
            .put(
                "verification",
                "Provider-supplied direct lanes; not independently verified road routes"
            );
        payload.set("lanes", json.valueToTree(input.lanes()));
        UUID id = UUID.randomUUID();
        db.update(
            "INSERT INTO decision_network(id,tenant_id,actor_subject,source_id,payload) VALUES(:id,:tenant,:actor,:source,CAST(:payload AS jsonb))",
            params()
                .addValue("id", id)
                .addValue("source", input.sourceId())
                .addValue("payload", encode(payload))
        );
        operations.audit("NETWORK_REGISTERED", "decision_network", id);
        return Map.of("id", id, "network", payload);
    }

    @Transactional
    public Object snapshot(DecisionController.Snapshot in) {
        long seconds = Duration.between(in.from(), in.to()).getSeconds();
        if (seconds <= 0 || seconds > 366L * 86400) throw new IllegalArgumentException(
            "Snapshot interval outside bounds"
        );
        var p = params()
            .addValue("cities", in.cityIds())
            .addValue("categories", in.categories())
            .addValue("unit", in.unit())
            .addValue("from", java.sql.Timestamp.from(in.from()))
            .addValue("to", java.sql.Timestamp.from(in.to()))
            .addValue("seconds", seconds);
        var cities = db.query(
            "SELECT c.id,c.name,c.timezone FROM city c JOIN tenant_city tc ON tc.city_id=c.id WHERE tc.tenant_id=:tenant AND c.id IN (:cities)",
            p
        );
        if (cities.size() != new HashSet<>(in.cityIds()).size()) throw missing();
        var rows = db.query(
            "WITH intervals AS (SELECT o.zone_id,o.city_id,o.commodity,o.observed_at,o.period_end,s.data_mode,EXTRACT(epoch FROM o.period_end-o.observed_at) AS duration,count(*) FILTER(WHERE o.kind='demand') dc,count(*) FILTER(WHERE o.kind='supply') sc,sum(o.quantity) FILTER(WHERE o.kind='demand') demand,sum(o.quantity) FILTER(WHERE o.kind='supply') supply,array_agg(o.id::text) records FROM observation o JOIN source_metadata s ON s.id=o.source_id AND s.tenant_id=o.tenant_id WHERE o.tenant_id=:tenant AND o.city_id IN (:cities) AND o.commodity IN (:categories) AND o.unit=:unit AND o.observed_at>=:from AND o.period_end<=:to GROUP BY o.zone_id,o.city_id,o.commodity,o.observed_at,o.period_end,s.data_mode) SELECT i.zone_id,i.city_id,i.commodity,i.data_mode,i.duration,z.name,ST_Y(ST_PointOnSurface(z.boundary)) latitude,ST_X(ST_PointOnSurface(z.boundary)) longitude,count(*) intervals,CASE WHEN min(dc)>0 AND count(*)*duration=:seconds AND bool_and(mod(EXTRACT(epoch FROM i.observed_at-CAST(:from AS timestamptz)),duration)=0) THEN sum(demand) END demand,CASE WHEN min(sc)>0 AND count(*)*duration=:seconds AND bool_and(mod(EXTRACT(epoch FROM i.observed_at-CAST(:from AS timestamptz)),duration)=0) THEN sum(supply) END supply,jsonb_agg(records)::text evidence FROM intervals i JOIN zone z ON z.id=i.zone_id GROUP BY i.zone_id,i.city_id,i.commodity,i.data_mode,i.duration,z.name,z.boundary ORDER BY i.zone_id,i.commodity LIMIT 31",
            p
        );
        if (rows.size() > 30) throw new IllegalArgumentException(
            "Narrow the snapshot to at most 30 district/category groups"
        );
        if (rows.isEmpty()) throw new ResponseStatusException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            "No authorized observations in this interval"
        );
        if (
            rows
                .stream()
                .map(r -> r.get("data_mode") + ":" + r.get("duration"))
                .distinct()
                .count() != 1
        ) throw new IllegalArgumentException(
            "Snapshot requires one data mode and interval duration"
        );
        ArrayNode districts = json.createArrayNode();
        Map<String, String> districtIds = new HashMap<>();
        for (var row : rows) {
            String districtId = UUID.nameUUIDFromBytes(
                (row.get("zone_id") + ":" + row.get("commodity")).getBytes(
                    java.nio.charset.StandardCharsets.UTF_8
                )
            ).toString();
            districtIds.put(row.get("zone_id") + ":" + row.get("commodity"), districtId);
            var district = json
                .createObjectNode()
                .put("id", districtId)
                .put("city", row.get("city_id").toString())
                .put("name", row.get("name").toString())
                .put("category", row.get("commodity").toString());
            district.set("demand", json.valueToTree(row.get("demand")));
            district.set("availability", json.valueToTree(row.get("supply")));
            district.set("latitude", json.valueToTree(row.get("latitude")));
            district.set("longitude", json.valueToTree(row.get("longitude")));
            ArrayNode evidence = json.createArrayNode();
            for (var group : decode(row.get("evidence").toString()))
                for (var ref : group)
                    if (evidence.size() < 100) evidence.add("observation:" + ref.asText());
            district.set("evidence", evidence);
            districts.add(district);
        }
        // Inventory is latest per business/category/unit, never inferred from supply surplus.
        var inventory = db.query(
            "SELECT DISTINCT ON (i.business_id,i.commodity,i.unit) i.id,i.business_id,i.commodity,i.quantity,b.name FROM inventory i JOIN business b ON b.id=i.business_id AND b.tenant_id=i.tenant_id WHERE i.tenant_id=:tenant AND b.city_id IN (:cities) AND i.commodity IN (:categories) AND i.unit=:unit AND i.recorded_at<=:to AND i.recorded_at>=:from ORDER BY i.business_id,i.commodity,i.unit,i.recorded_at DESC,i.id LIMIT 11",
            p
        );
        if (inventory.size() > 10) throw new IllegalArgumentException(
            "Narrow the snapshot to at most 10 inventory sources"
        );
        ArrayNode stocks = json.createArrayNode();
        for (var row : inventory) {
            var stock = json
                .createObjectNode()
                .put("id", row.get("id").toString())
                .put("name", row.get("name").toString())
                .put("category", row.get("commodity").toString());
            stock.set("quantity", json.valueToTree(row.get("quantity")));
            stock.putNull("unitCost");
            stock.set("evidence", json.valueToTree(List.of("inventory:" + row.get("id"))));
            stocks.add(stock);
        }
        if (in.forecastId() != null) {
            var forecasts = db.query(
                "SELECT result::text AS result FROM forecast_result WHERE tenant_id=:tenant AND id=:forecast",
                p.addValue("forecast", in.forecastId())
            );
            if (forecasts.isEmpty()) throw missing();
            var forecast = decode(forecasts.getFirst().get("result").toString());
            if (in.forecastDistrictId() == null) throw new IllegalArgumentException(
                "Explicit registry zone assignment required for forecast"
            );
            String key = in.forecastDistrictId() + ":" + forecast.path("category").asText();
            String assigned = districtIds.get(key);
            if (
                assigned == null ||
                !forecast
                    .path("dataMode")
                    .asText()
                    .equals(rows.getFirst().get("data_mode").toString())
            ) throw new IllegalArgumentException(
                "Forecast category, district and data mode must match snapshot"
            );
            double total = 0;
            int count = 0;
            for (var point : forecast.path("predictions")) {
                Instant time = Instant.parse(point.path("time").asText());
                if (
                    !time.isBefore(in.from()) &&
                    time.plus(Duration.ofDays(1)).compareTo(in.to()) <= 0
                ) {
                    total += point.path("demand").asDouble();
                    count++;
                }
            }
            if (count * 86400L != seconds) throw new IllegalArgumentException(
                "Forecast must cover the entire selected daily horizon"
            );
            for (var d : districts)
                if (d.path("id").asText().equals(assigned)) {
                    ((ObjectNode) d).put("forecastDemand", total);
                    ((ArrayNode) d.path("evidence")).add(
                        "forecast:" + in.forecastId() + ":operator-mapped-zone-and-units"
                    );
                }
        }
        var payload = json
            .createObjectNode()
            .put("unit", in.unit())
            .put("periodStart", in.from().toString())
            .put("periodEnd", in.to().toString())
            .put("dataMode", rows.getFirst().get("data_mode").toString())
            .put(
                "coverageRule",
                "Missing intervals or missing sides stay unknown; counts do not establish independent source completeness"
            );
        payload.set("districts", districts);
        payload.set("stocks", stocks);
        payload.set("cities", json.valueToTree(cities));
        UUID id = UUID.randomUUID();
        db.update(
            "INSERT INTO decision_snapshot(id,tenant_id,actor_subject,payload) VALUES(:id,:tenant,:actor,CAST(:payload AS jsonb))",
            params().addValue("id", id).addValue("payload", encode(payload))
        );
        operations.audit("SNAPSHOT_CREATED", "decision_snapshot", id);
        return Map.of("id", id, "snapshot", payload);
    }
}
