package io.citypulse.workspace.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.citypulse.identity.TenantContext;
import io.citypulse.workspace.domain.WorkspaceModels.*;
import io.citypulse.workspace.infrastructure.WorkspaceRepository;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class WorkspaceService {

    private final WorkspaceRepository db;
    private final TenantContext identity;
    private final ObjectMapper json;
    private final String aiUrl;
    private final String aiToken;
    private final HttpClient client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(3))
        .build();

    public WorkspaceService(
        WorkspaceRepository db,
        TenantContext identity,
        ObjectMapper json,
        @Value("${AI_BASE_URL:http://localhost:8000}") String aiUrl,
        @Value("${AI_SERVICE_TOKEN:${LOCAL_API_TOKEN:}}") String aiToken
    ) {
        this.db = db;
        this.identity = identity;
        this.json = json;
        this.aiUrl = aiUrl;
        this.aiToken = aiToken;
    }

    private MapSqlParameterSource params() {
        return new MapSqlParameterSource("tenant", identity.tenantId()).addValue(
            "subject",
            identity.subject()
        );
    }

    public String encode(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid payload");
        }
    }

    public static String digest(String text) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))
            );
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void requireCity(UUID city) {
        if (
            db
                .query(
                    "SELECT city_id FROM tenant_city WHERE tenant_id=:tenant AND city_id=:city",
                    params().addValue("city", city)
                )
                .isEmpty()
        ) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "City not found");
    }

    private void requireSource(UUID source) {
        if (
            db
                .query(
                    "SELECT id FROM source_metadata WHERE tenant_id=:tenant AND id=:id",
                    params().addValue("id", source)
                )
                .isEmpty()
        ) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Source not found");
    }

    private void requireBusiness(UUID business) {
        if (
            db
                .query(
                    "SELECT id FROM business WHERE tenant_id=:tenant AND id=:id",
                    params().addValue("id", business)
                )
                .isEmpty()
        ) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found");
    }

    private void requireZone(UUID zone, UUID city) {
        if (
            db
                .query(
                    "SELECT z.id FROM zone z JOIN tenant_city tc ON tc.city_id=z.city_id WHERE tc.tenant_id=:tenant AND z.id=:zone AND z.city_id=:city",
                    params().addValue("zone", zone).addValue("city", city)
                )
                .isEmpty()
        ) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Zone not found");
    }

    public void audit(String action, String type, UUID id) {
        db.update(
            "INSERT INTO audit_event(id,tenant_id,actor_subject,action,resource_type,resource_id,metadata) VALUES(:id,:tenant,:subject,:action,:type,:resource,'{}')",
            params()
                .addValue("id", UUID.randomUUID())
                .addValue("action", action)
                .addValue("type", type)
                .addValue("resource", id)
        );
    }

    public Map<String, Object> idempotent(
        String operation,
        String key,
        Object request,
        Supplier<Map<String, Object>> action
    ) {
        if (
            key == null || !key.matches("[A-Za-z0-9._:-]{8,100}")
        ) throw new IllegalArgumentException("Idempotency-Key must contain 8..100 safe characters");
        String hash = digest(encode(request));
        var p = params()
            .addValue("operation", operation)
            .addValue("key", key)
            .addValue("hash", hash);
        db.query(
            "SELECT pg_advisory_xact_lock(hashtextextended(:lock,0))",
            p.addValue(
                "lock",
                identity.tenantId() + ":" + identity.subject() + ":" + operation + ":" + key
            )
        );
        var prior = db.query(
            "SELECT request_digest,result::text AS result FROM operation_receipt WHERE tenant_id=:tenant AND subject=:subject AND operation=:operation AND idempotency_key=:key",
            p
        );
        if (!prior.isEmpty()) {
            if (
                !hash.equals(prior.getFirst().get("request_digest"))
            ) throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Idempotency key reused with a different request"
            );
            try {
                return json.readValue(
                    (String) prior.getFirst().get("result"),
                    new TypeReference<>() {}
                );
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }
        var result = action.get();
        db.update(
            "INSERT INTO operation_receipt(tenant_id,subject,operation,idempotency_key,request_digest,result) VALUES(:tenant,:subject,:operation,:key,:hash,CAST(:result AS jsonb))",
            p.addValue("result", encode(result))
        );
        return result;
    }

    public List<Map<String, Object>> tenant() {
        return db.query("SELECT id,name,created_at FROM tenant WHERE id=:tenant", params());
    }

    public Map<String, Object> renameTenant(NameInput input) {
        db.update(
            "UPDATE tenant SET name=:name WHERE id=:tenant",
            params().addValue("name", input.name())
        );
        audit("UPDATE", "tenant", identity.tenantId());
        return Map.of("id", identity.tenantId(), "name", input.name());
    }

    public List<Map<String, Object>> organizations(int page, int size) {
        return db.query(
            "SELECT id,name,created_at FROM organization WHERE tenant_id=:tenant ORDER BY name,id LIMIT :size OFFSET :offset",
            paging(page, size)
        );
    }

    public Map<String, Object> createOrganization(NameInput in) {
        UUID id = UUID.randomUUID();
        db.update(
            "INSERT INTO organization(id,tenant_id,name) VALUES(:id,:tenant,:name)",
            params().addValue("id", id).addValue("name", in.name())
        );
        audit("CREATE", "organization", id);
        return Map.of("id", id, "name", in.name());
    }

    private MapSqlParameterSource paging(int page, int size) {
        if (page < 0 || page > 100000 || size < 1 || size > 100) throw new IllegalArgumentException(
            "page 0..100000; size 1..100"
        );
        return params()
            .addValue("size", size)
            .addValue("offset", page * size);
    }

    public Map<String, Object> createCity(CityInput in) {
        ZoneId.of(in.timezone());
        UUID id = UUID.randomUUID();
        var p = params()
            .addValue("id", id)
            .addValue("name", in.name())
            .addValue("country", in.countryCode())
            .addValue("timezone", in.timezone())
            .addValue("geo", in.boundaryGeoJson());
        db.update(
            "INSERT INTO city(id,name,country_code,timezone,boundary) VALUES(:id,:name,:country,:timezone,ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geo),4326)))",
            p
        );
        db.update("INSERT INTO tenant_city(tenant_id,city_id) VALUES(:tenant,:id)", p);
        audit("CREATE", "city", id);
        return Map.of("id", id);
    }

    public Map<String, Object> createZone(ZoneInput in) {
        requireCity(in.cityId());
        UUID id = UUID.randomUUID();
        db.update(
            "INSERT INTO zone(id,city_id,name,boundary) VALUES(:id,:city,:name,ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geo),4326)))",
            params()
                .addValue("id", id)
                .addValue("city", in.cityId())
                .addValue("name", in.name())
                .addValue("geo", in.boundaryGeoJson())
        );
        audit("CREATE", "zone", id);
        return Map.of("id", id);
    }

    public List<Map<String, Object>> zones(UUID city) {
        requireCity(city);
        return db.query(
            "SELECT z.id,z.name,ST_AsGeoJSON(z.boundary)::json AS boundary FROM zone z JOIN tenant_city tc ON tc.city_id=z.city_id WHERE tc.tenant_id=:tenant AND z.city_id=:city ORDER BY z.name,z.id LIMIT 100",
            params().addValue("city", city)
        );
    }

    public Map<String, Object> createArea(AreaInput in) {
        requireCity(in.cityId());
        UUID id = UUID.randomUUID();
        var p = params()
            .addValue("id", id)
            .addValue("city", in.cityId())
            .addValue("parent", in.parentId())
            .addValue("kind", in.kind())
            .addValue("name", in.name())
            .addValue("geo", in.boundaryGeoJson());
        if (
            in.parentId() != null &&
            db
                .query(
                    "SELECT id FROM geographic_area WHERE tenant_id=:tenant AND id=:parent AND city_id=:city AND ST_Covers(boundary,ST_SetSRID(ST_GeomFromGeoJSON(:geo),4326))",
                    p
                )
                .isEmpty()
        ) throw new IllegalArgumentException("Parent must belong to this city and cover the child");
        if (
            db
                .query(
                    "SELECT c.id FROM city c JOIN tenant_city tc ON tc.city_id=c.id WHERE tc.tenant_id=:tenant AND c.id=:city AND ST_Covers(c.boundary,ST_SetSRID(ST_GeomFromGeoJSON(:geo),4326))",
                    p
                )
                .isEmpty()
        ) throw new IllegalArgumentException("Area must be inside its city");
        db.update(
            "INSERT INTO geographic_area(id,tenant_id,city_id,parent_id,kind,name,boundary) VALUES(:id,:tenant,:city,:parent,:kind,:name,ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geo),4326)))",
            p
        );
        audit("CREATE", "area", id);
        return Map.of("id", id);
    }

    public List<Map<String, Object>> areas(UUID city, String kind, int page, int size) {
        requireCity(city);
        return db.query(
            "SELECT id,city_id,parent_id,kind,name,ST_AsGeoJSON(boundary) AS boundary FROM geographic_area WHERE tenant_id=:tenant AND city_id=:city AND (:kind IS NULL OR kind=:kind) ORDER BY name,id LIMIT :size OFFSET :offset",
            paging(page, size).addValue("city", city).addValue("kind", kind)
        );
    }

    public Map<String, Object> createBusiness(BusinessInput in) {
        requireCity(in.cityId());
        requireZone(in.zoneId(), in.cityId());
        UUID id = UUID.randomUUID();
        db.update(
            "INSERT INTO business(id,tenant_id,city_id,zone_id,name,category,location) VALUES(:id,:tenant,:city,:zone,:name,:category,ST_SetSRID(ST_MakePoint(:lon,:lat),4326))",
            params()
                .addValue("id", id)
                .addValue("city", in.cityId())
                .addValue("zone", in.zoneId())
                .addValue("name", in.name())
                .addValue("category", in.category())
                .addValue("lon", in.longitude())
                .addValue("lat", in.latitude())
        );
        audit("CREATE", "business", id);
        return Map.of("id", id);
    }

    public List<Map<String, Object>> businesses(String search, String sort, int page, int size) {
        String order = switch (sort) {
            case "name" -> "name,id";
            case "createdAt" -> "created_at DESC,id";
            default -> throw new IllegalArgumentException("Sort must be name or createdAt");
        };
        return db.query(
            "SELECT id,city_id,zone_id,name,category,ST_X(location) AS longitude,ST_Y(location) AS latitude FROM business WHERE tenant_id=:tenant AND name ILIKE :search ORDER BY " +
                order +
                " LIMIT :size OFFSET :offset",
            paging(page, size).addValue("search", "%" + search + "%")
        );
    }

    public Map<String, Object> createSource(SourceInput in) {
        UUID id = UUID.randomUUID();
        db.update(
            "INSERT INTO source_metadata(id,tenant_id,provider,dataset_name,source_uri,license_reference,classification,schema_version,update_frequency,data_mode,timezone,currency,source_schema) VALUES(:id,:tenant,:provider,:dataset,:uri,:license,:classification,1,:frequency,:mode,:tz,:currency,CAST(:schema AS jsonb))",
            params()
                .addValue("id", id)
                .addValue("provider", in.provider())
                .addValue("dataset", in.datasetName())
                .addValue("uri", in.sourceUri())
                .addValue("license", in.licenseReference())
                .addValue("classification", in.classification())
                .addValue(
                    "frequency",
                    in.updateFrequency() == null ? "unspecified" : in.updateFrequency()
                )
                .addValue("mode", in.dataMode() == null ? "historical" : in.dataMode())
                .addValue("tz", in.timezone() == null ? "UTC" : ZoneId.of(in.timezone()).getId())
                .addValue("currency", in.currency() == null ? "XXX" : in.currency())
                .addValue(
                    "schema",
                    encode(in.schema() == null ? Map.of("version", 1) : in.schema())
                )
        );
        audit("CREATE", "source", id);
        return Map.of("id", id);
    }

    public List<Map<String, Object>> sources(int page, int size) {
        return db.query(
            "SELECT id,provider,dataset_name,source_uri,license_reference,classification,schema_version,update_frequency,quality_status,data_mode,timezone,currency,source_schema::text AS schema FROM source_metadata WHERE tenant_id=:tenant ORDER BY provider,id LIMIT :size OFFSET :offset",
            paging(page, size)
        );
    }

    public Map<String, Object> createObservation(ObservationInput in) {
        requireCity(in.cityId());
        requireZone(in.zoneId(), in.cityId());
        requireSource(in.sourceId());
        if (in.businessId() != null) requireBusiness(in.businessId());
        if (!in.periodEnd().isAfter(in.observedAt())) throw new IllegalArgumentException(
            "periodEnd must be after observedAt"
        );
        UUID id = UUID.randomUUID();
        db.update(
            "INSERT INTO observation(id,tenant_id,city_id,zone_id,business_id,source_id,external_id,kind,commodity,quantity,unit,observed_at,period_end,provenance,payload_sha256,quality_score) VALUES(:id,:tenant,:city,:zone,:business,:source,:external,:kind,:commodity,:quantity,:unit,:time,:end,CAST(:provenance AS jsonb),:digest,:quality)",
            params()
                .addValue("id", id)
                .addValue("city", in.cityId())
                .addValue("zone", in.zoneId())
                .addValue("business", in.businessId())
                .addValue("source", in.sourceId())
                .addValue("external", in.externalId())
                .addValue("kind", in.kind())
                .addValue("commodity", in.commodity())
                .addValue("quantity", in.quantity())
                .addValue("unit", in.unit())
                .addValue("time", java.sql.Timestamp.from(in.observedAt()))
                .addValue("end", java.sql.Timestamp.from(in.periodEnd()))
                .addValue("digest", digest(encode(in)))
                .addValue(
                    "provenance",
                    encode(
                        in.provenance() == null
                            ? Map.of("submittedBy", identity.subject())
                            : in.provenance()
                    )
                )
                .addValue(
                    "quality",
                    in.qualityScore() == null ? java.math.BigDecimal.ONE : in.qualityScore()
                )
        );
        audit("CREATE", "observation", id);
        return Map.of("id", id);
    }

    public Map<String, Object> createInventory(InventoryInput in) {
        requireBusiness(in.businessId());
        requireSource(in.sourceId());
        UUID id = UUID.randomUUID();
        db.update(
            "INSERT INTO inventory(id,tenant_id,business_id,source_id,external_id,commodity,quantity,unit,recorded_at,provenance) VALUES(:id,:tenant,:business,:source,:external,:commodity,:quantity,:unit,:time,'{}')",
            params()
                .addValue("id", id)
                .addValue("business", in.businessId())
                .addValue("source", in.sourceId())
                .addValue("external", in.externalId())
                .addValue("commodity", in.commodity())
                .addValue("quantity", in.quantity())
                .addValue("unit", in.unit())
                .addValue("time", java.sql.Timestamp.from(in.recordedAt()))
        );
        audit("CREATE", "inventory", id);
        return Map.of("id", id);
    }

    public List<Map<String, Object>> inventories(int page, int size) {
        return db.query(
            "SELECT id,business_id,commodity,quantity,unit,recorded_at FROM inventory WHERE tenant_id=:tenant ORDER BY recorded_at DESC,id LIMIT :size OFFSET :offset",
            paging(page, size)
        );
    }

    private MapSqlParameterSource window(
        UUID city,
        String commodity,
        String unit,
        Instant from,
        Instant to
    ) {
        requireCity(city);
        if (
            !to.isAfter(from) || Duration.between(from, to).toDays() > 366
        ) throw new IllegalArgumentException("Use a positive window of at most 366 days");
        return params()
            .addValue("city", city)
            .addValue("commodity", commodity)
            .addValue("unit", unit)
            .addValue("from", java.sql.Timestamp.from(from))
            .addValue("to", java.sql.Timestamp.from(to));
    }

    public List<Map<String, Object>> history(
        UUID city,
        String commodity,
        String unit,
        Instant from,
        Instant to,
        int page,
        int size
    ) {
        var p = window(city, commodity, unit, from, to)
            .addValue("size", paging(page, size).getValue("size"))
            .addValue("offset", page * size);
        return db.query(
            "SELECT id,zone_id,kind,quantity,unit,commodity,observed_at,period_end,source_id,payload_sha256 FROM observation WHERE tenant_id=:tenant AND city_id=:city AND commodity=:commodity AND unit=:unit AND observed_at>=:from AND observed_at<:to ORDER BY observed_at DESC,id LIMIT :size OFFSET :offset",
            p
        );
    }

    public List<Map<String, Object>> imbalance(
        UUID city,
        String commodity,
        String unit,
        Instant from,
        Instant to
    ) {
        return db.query(
            "SELECT o.zone_id,z.name,sm.data_mode,extract(epoch from (o.period_end-o.observed_at)) AS interval_seconds,SUM(CASE WHEN kind='demand' THEN quantity ELSE 0 END) AS demand,SUM(CASE WHEN kind='supply' THEN quantity ELSE 0 END) AS supply,SUM(CASE WHEN kind='demand' THEN quantity ELSE -quantity END) AS gap,COUNT(*) AS observations FROM observation o JOIN zone z ON z.id=o.zone_id JOIN source_metadata sm ON sm.id=o.source_id AND sm.tenant_id=o.tenant_id WHERE o.tenant_id=:tenant AND o.city_id=:city AND o.commodity=:commodity AND o.unit=:unit AND o.observed_at>=:from AND o.observed_at<:to GROUP BY o.zone_id,z.name,sm.data_mode,interval_seconds ORDER BY gap DESC,o.zone_id LIMIT 100",
            window(city, commodity, unit, from, to)
        );
    }

    public List<Map<String, Object>> opportunities(
        UUID city,
        String commodity,
        String unit,
        Instant from,
        Instant to
    ) {
        return imbalance(city, commodity, unit, from, to)
            .stream()
            .map(row -> {
                var result = new LinkedHashMap<>(row);
                double demand = ((Number) row.get("demand")).doubleValue(),
                    gap = ((Number) row.get("gap")).doubleValue();
                result.put(
                    "score",
                    demand > 0 ? Math.round((Math.max(0, gap) / demand) * 10000.0) / 100.0 : 0
                );
                result.put("method", "positive-gap-share-v1; heuristic, not investment advice");
                return (Map<String, Object>) result;
            })
            .toList();
    }

    public Map<String, Object> optimize(OptimizationInput in) {
        var rows = imbalance(in.cityId(), in.commodity(), in.unit(), in.from(), in.to());
        if (
            rows
                .stream()
                .map(r -> r.get("data_mode") + ":" + r.get("interval_seconds"))
                .distinct()
                .count() > 1
        ) throw new IllegalArgumentException(
            "Allocation requires one source mode and interval duration"
        );
        double total = rows
                .stream()
                .mapToDouble(r -> Math.max(0, ((Number) r.get("gap")).doubleValue()))
                .sum(),
            used = Math.min(total, in.budget());
        var result = rows
            .stream()
            .map(r ->
                Map.of(
                    "zoneId",
                    r.get("zone_id"),
                    "allocation",
                    total > 0
                        ? (used * Math.max(0, ((Number) r.get("gap")).doubleValue())) / total
                        : 0
                )
            )
            .toList();
        UUID id = UUID.randomUUID();
        audit("SCENARIO", "optimization", id);
        return Map.of(
            "id",
            id,
            "method",
            "proportional-gap-v1",
            "allocated",
            used,
            "unallocated",
            in.budget() - used,
            "allocations",
            result,
            "dispatched",
            false
        );
    }

    public Map<String, Object> forecast(ForecastInput in) {
        try {
            var request = HttpRequest.newBuilder(URI.create(aiUrl + "/api/v1/forecasts"))
                .timeout(Duration.ofSeconds(8))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + aiToken)
                .POST(
                    HttpRequest.BodyPublishers.ofString(
                        encode(
                            Map.of(
                                "values",
                                in.values(),
                                "horizon",
                                in.horizon(),
                                "interval_minutes",
                                in.intervalMinutes()
                            )
                        )
                    )
                )
                .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "AI service rejected the request"
            );
            Map<String, Object> result = json.readValue(response.body(), new TypeReference<>() {});
            UUID id = UUID.randomUUID();
            db.update(
                "INSERT INTO forecast_result(id,tenant_id,request,result) VALUES(:id,:tenant,CAST(:request AS jsonb),CAST(:result AS jsonb))",
                params()
                    .addValue("id", id)
                    .addValue("request", encode(in))
                    .addValue("result", encode(result))
            );
            audit("CREATE", "forecast", id);
            return Map.of("id", id, "result", result);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Forecast interrupted"
            );
        } catch (Exception e) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Forecast service unavailable"
            );
        }
    }

    public List<Map<String, Object>> forecasts(int page, int size) {
        return db.query(
            "SELECT id,result::text AS result,created_at FROM forecast_result WHERE tenant_id=:tenant ORDER BY created_at DESC,id LIMIT :size OFFSET :offset",
            paging(page, size)
        );
    }

    public Map<String, Object> verification(VerificationInput in) {
        UUID id = UUID.randomUUID();
        String hash = digest(in.payload());
        db.update(
            "INSERT INTO verification_request(id,tenant_id,digest,status) VALUES(:id,:tenant,:digest,'DIGEST_RECORDED')",
            params().addValue("id", id).addValue("digest", hash)
        );
        audit("CREATE", "verification", id);
        return Map.of("id", id, "digest", hash, "status", "DIGEST_RECORDED", "onChain", false);
    }

    public List<Map<String, Object>> verifications(int page, int size) {
        return db.query(
            "SELECT id,digest,status,created_at,chain_id,contract_version,transaction_hash,verified_at FROM verification_request WHERE tenant_id=:tenant ORDER BY created_at DESC,id LIMIT :size OFFSET :offset",
            paging(page, size)
        );
    }

    public List<Map<String, Object>> notifications(int page, int size) {
        return db.query(
            "SELECT id,title,message,read_at,created_at FROM notification WHERE tenant_id=:tenant AND recipient_subject=:subject ORDER BY created_at DESC,id LIMIT :size OFFSET :offset",
            paging(page, size)
        );
    }

    public Map<String, Object> notify(NotificationInput in) {
        UUID id = UUID.randomUUID();
        db.update(
            "INSERT INTO notification(id,tenant_id,recipient_subject,title,message) VALUES(:id,:tenant,:recipient,:title,:message)",
            params()
                .addValue("id", id)
                .addValue("recipient", in.recipientSubject())
                .addValue("title", in.title())
                .addValue("message", in.message())
        );
        audit("CREATE", "notification", id);
        return Map.of("id", id);
    }

    public Map<String, Object> readNotification(UUID id) {
        if (
            db.update(
                "UPDATE notification SET read_at=COALESCE(read_at,now()) WHERE tenant_id=:tenant AND recipient_subject=:subject AND id=:id",
                params().addValue("id", id)
            ) != 1
        ) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found");
        return Map.of("id", id, "read", true);
    }

    public List<Map<String, Object>> auditLog(int page, int size) {
        return db.query(
            "SELECT id,actor_subject,action,resource_type,resource_id,occurred_at FROM audit_event WHERE tenant_id=:tenant ORDER BY occurred_at DESC,id LIMIT :size OFFSET :offset",
            paging(page, size)
        );
    }

    public List<Map<String, Object>> configuration() {
        return db.query(
            "SELECT configuration::text AS configuration,updated_at FROM admin_configuration WHERE tenant_id=:tenant",
            params()
        );
    }

    public Map<String, Object> configure(Map<String, Object> input) {
        String value = encode(input);
        if (
            value.length() > 10000 ||
            !Set.of("displayName", "reportTimezone").containsAll(input.keySet())
        ) throw new IllegalArgumentException(
            "Only displayName and reportTimezone are supported; no secrets"
        );
        if (input.containsKey("reportTimezone")) ZoneId.of(
            String.valueOf(input.get("reportTimezone"))
        );
        db.update(
            "INSERT INTO admin_configuration(tenant_id,configuration) VALUES(:tenant,CAST(:config AS jsonb)) ON CONFLICT(tenant_id) DO UPDATE SET configuration=EXCLUDED.configuration,updated_at=now()",
            params().addValue("config", value)
        );
        audit("UPDATE", "configuration", identity.tenantId());
        return input;
    }
}
