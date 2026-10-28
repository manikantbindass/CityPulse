package io.citypulse.workspace.application;

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

@Service
public class MlForecastService {

    private final WorkspaceRepository db;
    private final TenantContext tenant;
    private final ObjectMapper json;
    private final String url;
    private final String token;
    private final HttpClient client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(3))
        .build();

    public MlForecastService(
        WorkspaceRepository db,
        TenantContext tenant,
        ObjectMapper json,
        @Value("${AI_BASE_URL:http://localhost:8000}") String url,
        @Value("${AI_SERVICE_TOKEN:${LOCAL_API_TOKEN:}}") String token
    ) {
        this.db = db;
        this.tenant = tenant;
        this.json = json;
        this.url = url;
        this.token = token;
    }

    @Transactional
    public Map<String, Object> create(Object input) {
        try {
            var request = HttpRequest.newBuilder(URI.create(url + "/v1/forecasts"))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + token)
                .header("X-Tenant-ID", tenant.tenantId().toString())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(input)))
                .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new ResponseStatusException(
                response.statusCode() == 422 ? HttpStatus.BAD_REQUEST : HttpStatus.BAD_GATEWAY,
                "AI forecast request rejected"
            );
            Map<String, Object> result = json.readValue(response.body(), new TypeReference<>() {});
            UUID id = UUID.fromString(String.valueOf(result.get("id")));
            var p = new MapSqlParameterSource("tenant", tenant.tenantId())
                .addValue("id", id)
                .addValue("request", json.writeValueAsString(input))
                .addValue("result", response.body());
            db.update(
                "INSERT INTO forecast_result(id,tenant_id,request,result) VALUES(:id,:tenant,CAST(:request AS jsonb),CAST(:result AS jsonb))",
                p
            );
            return result;
        } catch (ResponseStatusException error) {
            throw error;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Forecast interrupted"
            );
        } catch (Exception error) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Forecast service unavailable; no result fabricated"
            );
        }
    }

    public Map<String, Object> retrieve(UUID id) {
        var rows = db.query(
            "SELECT result::text AS result FROM forecast_result WHERE id=:id AND tenant_id=:tenant",
            new MapSqlParameterSource("id", id).addValue("tenant", tenant.tenantId())
        );
        if (rows.isEmpty()) throw new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Forecast not found"
        );
        try {
            return json.readValue((String) rows.getFirst().get("result"), new TypeReference<>() {});
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }
}
