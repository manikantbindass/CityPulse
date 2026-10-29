package io.citypulse.pulseai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.citypulse.identity.TenantContext;
import io.citypulse.workspace.infrastructure.WorkspaceRepository;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Fixed read-only tools. Provider may select IDs, never generate factual output or SQL. */
@Service
public class PulseAiService {

    private final WorkspaceRepository db;
    private final TenantContext identity;
    private final ObjectMapper json;
    private final String aiUrl, token;
    private final HttpClient client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(2))
        .build();

    public PulseAiService(
        WorkspaceRepository db,
        TenantContext identity,
        ObjectMapper json,
        @Value("${AI_BASE_URL:http://localhost:8000}") String aiUrl,
        @Value("${AI_SERVICE_TOKEN:${LOCAL_API_TOKEN:}}") String token
    ) {
        this.db = db;
        this.identity = identity;
        this.json = json;
        this.aiUrl = aiUrl;
        this.token = token;
    }

    private MapSqlParameterSource params() {
        return new MapSqlParameterSource("tenant", identity.tenantId()).addValue(
            "actor",
            identity.subject()
        );
    }

    public List<Map<String, Object>> cities() {
        return db.query(
            "SELECT c.id,c.name,c.country_code,c.timezone FROM city c JOIN tenant_city tc ON tc.city_id=c.id WHERE tc.tenant_id=:tenant ORDER BY c.name,c.id LIMIT 100",
            params()
        );
    }

    @Transactional
    public Map<String, Object> create() {
        db.update(
            "DELETE FROM pulseai_session WHERE tenant_id=:tenant AND actor_subject=:actor AND expires_at<=now()",
            params()
        );
        if (list().size() >= 30) throw new ResponseStatusException(
            HttpStatus.TOO_MANY_REQUESTS,
            "Delete an old conversation first"
        );
        UUID id = UUID.randomUUID();
        db.update(
            "INSERT INTO pulseai_session(id,tenant_id,actor_subject) VALUES(:id,:tenant,:actor)",
            params().addValue("id", id)
        );
        return Map.of("id", id);
    }

    public List<Map<String, Object>> list() {
        return db.query(
            "SELECT id,created_at,expires_at FROM pulseai_session WHERE tenant_id=:tenant AND actor_subject=:actor AND expires_at>now() ORDER BY created_at DESC LIMIT 30",
            params()
        );
    }

    private void own(UUID id, boolean lock) {
        if (
            db
                .query(
                    "SELECT id FROM pulseai_session WHERE id=:id AND tenant_id=:tenant AND actor_subject=:actor AND expires_at>now()" +
                        (lock ? " FOR UPDATE" : ""),
                    params().addValue("id", id)
                )
                .isEmpty()
        ) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found");
    }

    public Object history(UUID id) {
        own(id, false);
        return db.query(
            "SELECT id,question,answer::text AS answer,created_at FROM pulseai_message WHERE session_id=:id ORDER BY created_at,id LIMIT 20",
            params().addValue("id", id)
        );
    }

    @Transactional
    public void delete(UUID id) {
        own(id, true);
        db.update(
            "DELETE FROM pulseai_session WHERE id=:id AND tenant_id=:tenant AND actor_subject=:actor",
            params().addValue("id", id)
        );
    }

    static String redact(String value) {
        return value
            .replaceAll("[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}", "[email removed]")
            .replaceAll("(?i)(bearer\\s+|sk-)[A-Za-z0-9._-]+", "[credential removed]");
    }

    @Transactional
    public PulseAiAnswer ask(UUID id, PulseAiController.Question input) {
        own(id, true);
        if (
            !input.from().isBefore(input.to()) ||
            Duration.between(input.from(), input.to()).toDays() > 366
        ) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Select a positive window of at most 366 days"
        );
        var p = params()
            .addValue("id", id)
            .addValue("city", input.cityId())
            .addValue("from", java.sql.Timestamp.from(input.from()))
            .addValue("to", java.sql.Timestamp.from(input.to()))
            .addValue("commodity", input.commodity())
            .addValue(
                "comparison",
                input.comparisonCommodity() == null
                    ? input.commodity()
                    : input.comparisonCommodity()
            )
            .addValue("unit", input.unit());
        if (
            db.query("SELECT id FROM pulseai_message WHERE session_id=:id LIMIT 20", p).size() >= 20
        ) throw new ResponseStatusException(
            HttpStatus.TOO_MANY_REQUESTS,
            "Conversation limit reached"
        );
        if (
            db
                .query(
                    "SELECT c.id FROM city c JOIN tenant_city tc ON tc.city_id=c.id WHERE tc.tenant_id=:tenant AND c.id=:city",
                    p
                )
                .isEmpty()
        ) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "City not found");
        // Group only identical intervals, source mode and units. Missing supply is unknown.
        var rows = db.query(
            "SELECT o.zone_id,z.name,o.commodity,o.observed_at,o.period_end,s.data_mode,count(*) FILTER(WHERE o.kind='demand') AS demand_count,count(*) FILTER(WHERE o.kind='supply') AS supply_count,sum(o.quantity) FILTER(WHERE o.kind='demand') AS demand,sum(o.quantity) FILTER(WHERE o.kind='supply') AS supply,array_agg(o.id ORDER BY o.id)::text AS records FROM observation o JOIN zone z ON z.id=o.zone_id JOIN source_metadata s ON s.id=o.source_id AND s.tenant_id=o.tenant_id WHERE o.tenant_id=:tenant AND o.city_id=:city AND o.commodity IN (:commodity,:comparison) AND o.unit=:unit AND o.observed_at>=:from AND o.period_end<=:to GROUP BY o.zone_id,z.name,o.commodity,o.observed_at,o.period_end,s.data_mode ORDER BY o.observed_at DESC,z.name LIMIT 12",
            p
        );
        var facts = new ArrayList<Map<String, Object>>();
        for (var row : rows) {
            boolean paired =
                ((Number) row.get("demand_count")).longValue() > 0 &&
                ((Number) row.get("supply_count")).longValue() > 0;
            String text = String.format(
                Locale.ROOT,
                "%s · %s · %s to %s · %s: demand %s, supply %s %s. %s",
                row.get("name"),
                row.get("commodity"),
                row.get("observed_at"),
                row.get("period_end"),
                row.get("data_mode"),
                row.get("demand"),
                row.get("supply"),
                input.unit(),
                EvidenceAnalytics.compare(
                    paired ? new java.math.BigDecimal(row.get("demand").toString()) : null,
                    paired ? new java.math.BigDecimal(row.get("supply").toString()) : null
                )
            );
            facts.add(
                Map.of(
                    "id",
                    "S" + (facts.size() + 1),
                    "text",
                    redact(text),
                    "evidence",
                    Map.of(
                        "type",
                        "observation",
                        "recordIds",
                        Arrays.asList(
                            row
                                .get("records")
                                .toString()
                                .replace("{", "")
                                .replace("}", "")
                                .split(",")
                        ),
                        "cityId",
                        input.cityId(),
                        "from",
                        input.from(),
                        "to",
                        input.to()
                    )
                )
            );
        }
        var sources = db.query(
            "SELECT DISTINCT s.id,s.license_reference,s.data_mode,s.quality_status,s.timezone FROM source_metadata s JOIN observation o ON o.source_id=s.id AND o.tenant_id=s.tenant_id WHERE s.tenant_id=:tenant AND o.city_id=:city AND o.commodity IN (:commodity,:comparison) AND o.unit=:unit AND o.observed_at>=:from AND o.period_end<=:to ORDER BY s.id LIMIT 6",
            p
        );
        for (var s : sources)
            facts.add(
                Map.of(
                    "id",
                    "S" + (facts.size() + 1),
                    "text",
                    redact(
                        "Source " +
                            s.get("id") +
                            ": " +
                            s.get("data_mode") +
                            ", license " +
                            s.get("license_reference") +
                            ", quality " +
                            s.get("quality_status") +
                            ", timezone " +
                            s.get("timezone")
                    ),
                    "evidence",
                    Map.of("type", "source_metadata", "recordId", s.get("id"))
                )
            );
        if (input.forecastId() != null) {
            var forecasts = db.query(
                "SELECT id,result::text AS result FROM forecast_result WHERE tenant_id=:tenant AND id=:forecast",
                p.addValue("forecast", input.forecastId())
            );
            if (forecasts.isEmpty()) throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Forecast not found"
            );
            try {
                var forecast = json.readTree(forecasts.getFirst().get("result").toString());
                var first = forecast.path("predictions").path(0);
                if (first.path("demand").isNumber()) {
                    String prediction =
                        "First selected forecast point " +
                        first.path("time").asText() +
                        ": predicted demand " +
                        first.path("demand") +
                        ", lower " +
                        first.path("lower") +
                        ", upper " +
                        first.path("upper") +
                        " in the forecast dataset units (not inferred from current filters). Null bounds mean intervals are unavailable; model intervals do not guarantee future coverage.";
                    facts.add(
                        Map.of(
                            "id",
                            "S" + (facts.size() + 1),
                            "text",
                            redact(prediction),
                            "evidence",
                            Map.of("type", "forecast_result", "recordId", input.forecastId())
                        )
                    );
                }

                String description =
                    "Selected forecast " +
                    input.forecastId() +
                    ": model " +
                    forecast.path("model").asText("unknown") +
                    ", version " +
                    forecast.path("modelVersion").asText("unknown") +
                    ", data mode " +
                    forecast.path("dataMode").asText("unknown") +
                    ". Interval method: " +
                    forecast.path("intervalMethod").asText("unavailable") +
                    ". Original segment: " +
                    forecast.path("city").asText() +
                    " / " +
                    forecast.path("district").asText() +
                    " / " +
                    forecast.path("category").asText() +
                    ". This segment is not automatically matched to the selected registry city.";
                facts.add(
                    Map.of(
                        "id",
                        "S" + (facts.size() + 1),
                        "text",
                        redact(description.substring(0, Math.min(950, description.length()))),
                        "evidence",
                        Map.of(
                            "type",
                            "forecast_result",
                            "recordId",
                            input.forecastId(),
                            "trainingFingerprint",
                            forecast.path("trainingFingerprint").asText("unavailable")
                        )
                    )
                );
            } catch (java.io.IOException error) {
                throw new IllegalStateException(error);
            }
            // Keep arbitrary stored JSON out of claims; expose actual forecast through its protected endpoint.
            facts.add(
                Map.of(
                    "id",
                    "S" + (facts.size() + 1),
                    "text",
                    "Selected forecast is available for inspection. Its original city/district labels must be checked before comparison; intervals are model estimates, not guarantees.",
                    "evidence",
                    Map.of(
                        "type",
                        "forecast_result",
                        "recordId",
                        input.forecastId(),
                        "href",
                        "/api/v1/forecast-jobs/" + input.forecastId()
                    )
                )
            );
        }
        String question = redact(input.question());
        var selection = choose(question, facts);
        @SuppressWarnings("unchecked")
        var selected = (List<String>) selection.get("statementIds");
        var answer = new LinkedHashMap<String, Object>();
        answer.put("sessionId", id);
        answer.put(
            "statements",
            facts
                .stream()
                .filter(f -> selected.contains(f.get("id")))
                .toList()
        );
        answer.put("provider", selection.get("provider"));
        answer.put("notice", selection.get("reason"));
        answer.put(
            "limitations",
            List.of(
                "At most 12 interval groups are shown; this is not a whole-city ranking.",
                "No matched records means unknown, never zero. No causal or investment conclusion is established.",
                "Questions are not SQL. Change explicit filters to retrieve different data. Inventory is not interchangeable with supply flow."
            )
        );
        answer.put("empty", facts.isEmpty());
        answer.put(
            "suggestedConfiguration",
            Map.of(
                "chart",
                "line",
                "cityId",
                input.cityId(),
                "commodities",
                input.comparisonCommodity() == null
                    ? List.of(input.commodity())
                    : List.of(input.commodity(), input.comparisonCommodity()),
                "unit",
                input.unit(),
                "from",
                input.from().toString(),
                "to",
                input.to().toString(),
                "seriesBy",
                List.of("zone", "commodity", "sourceMode", "intervalDuration"),
                "missingValues",
                "gaps; never fill missing observations with zero"
            )
        );
        answer.put("documents", DocumentationTool.retrieve(question));
        answer.put(
            "followUps",
            List.of(
                "Explain source provenance",
                "Compare the observed intervals",
                "What data is missing for allocation planning?"
            )
        );
        answer.put(
            "views",
            List.of(
                Map.of("label", "Explore geography", "href", "/explorer"),
                Map.of("label", "Forecast workspace", "href", "/predictions")
            )
        );
        try {
            db.update(
                "INSERT INTO pulseai_message(id,session_id,question,answer) VALUES(:message,:id,:question,CAST(:answer AS jsonb))",
                p
                    .addValue("message", UUID.randomUUID())
                    .addValue("question", question)
                    .addValue("answer", json.writeValueAsString(answer))
            );
        } catch (java.io.IOException error) {
            throw new IllegalStateException(error);
        }
        return json.convertValue(answer, PulseAiAnswer.class);
    }

    private Map<String, Object> choose(String question, List<Map<String, Object>> facts) {
        List<String> ids = facts
            .stream()
            .map(f -> f.get("id").toString())
            .toList();
        Map<String, Object> fallback = Map.of(
            "statementIds",
            ids,
            "provider",
            "evidence-fallback",
            "reason",
            "Verified records; optional model unavailable or disabled"
        );
        if (facts.isEmpty()) return fallback;
        try {
            var body = Map.of(
                "question",
                question,
                "statements",
                facts
                    .stream()
                    .map(f -> Map.of("id", f.get("id"), "text", f.get("text")))
                    .toList()
            );
            var request = HttpRequest.newBuilder(URI.create(aiUrl + "/v1/pulseai/select"))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + token)
                .header("X-Tenant-ID", identity.tenantId().toString())
                .header("X-Actor-ID", identity.subject())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .build();
            var response = client.send(
                io.citypulse.operations.TraceHeaders.propagated(request),
                HttpResponse.BodyHandlers.ofString()
            );
            if (response.statusCode() != 200) return fallback;
            Map<String, Object> result = json.readValue(response.body(), new TypeReference<>() {});
            if (
                !(result.get("statementIds") instanceof List<?> chosen) ||
                chosen.isEmpty() ||
                !ids.containsAll(chosen)
            ) return fallback;
            return Map.of(
                "statementIds",
                result.get("statementIds"),
                "provider",
                "openai-compatible".equals(result.get("provider"))
                    ? "openai-compatible"
                    : "evidence-fallback",
                "reason",
                switch (String.valueOf(result.get("reason"))) {
                    case
                        "Provider disabled",
                        "Provider price ceiling not configured",
                        "Provider configuration incomplete",
                        "Daily request/token budget or context limit reached",
                        "Provider unavailable or invalid selection",
                        "Validated evidence selection" -> result.get("reason");
                    default -> "Evidence IDs validated by API";
                }
            );
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return fallback;
        } catch (Exception error) {
            return fallback;
        }
    }
}
