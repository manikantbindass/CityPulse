package io.citypulse.decision;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/decisions")
@PreAuthorize("hasAuthority('SCOPE_analytics:read') and hasAuthority('SCOPE_data:read')")
public class DecisionController {

    private final DecisionService service;

    public DecisionController(DecisionService service) {
        this.service = service;
    }

    public record Run(@NotNull ObjectNode scenario) {}

    public record Snapshot(
        @NotNull @Size(min = 1, max = 5) List<UUID> cityIds,
        @NotNull
        @Size(min = 1, max = 3)
        List<@Pattern(regexp = "[A-Za-z0-9_-]{1,80}") String> categories,
        @NotNull @Pattern(regexp = "count|kg|litre|kwh|trip") String unit,
        @NotNull Instant from,
        @NotNull Instant to,
        UUID forecastId,
        UUID forecastDistrictId
    ) {}

    public record Network(
        @NotNull UUID sourceId,
        @NotNull @Size(min = 1, max = 300) List<@Valid Lane> lanes
    ) {}

    public record Lane(
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,80}") String sourceId,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,80}") String districtId,
        @PositiveOrZero @Max(10000000) double unitCost,
        @PositiveOrZero @Max(10000000) double capacity,
        @PositiveOrZero @Max(10000000) double travelMinutes
    ) {}

    @PostMapping("/scenarios")
    @PreAuthorize(
        "hasAuthority('SCOPE_analytics:read') and hasAuthority('SCOPE_analytics:write') and hasAuthority('SCOPE_data:read')"
    )
    public Object run(@RequestHeader("Idempotency-Key") String key, @Valid @RequestBody Run input) {
        return service.run(key, input.scenario());
    }

    @GetMapping("/scenarios")
    public Object list(@RequestParam(defaultValue = "0") @Min(0) int page) {
        return service.list(page);
    }

    @GetMapping("/scenarios/{id}")
    public Object get(@PathVariable UUID id) {
        return service.get(id);
    }

    @GetMapping("/scenarios/{id}/export")
    public ResponseEntity<Object> export(@PathVariable UUID id) {
        return ResponseEntity.ok()
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=citypulse-scenario-" + id + ".json"
            )
            .body(service.get(id));
    }

    @PostMapping("/scenarios/{id}/reproduce")
    @PreAuthorize(
        "hasAuthority('SCOPE_analytics:read') and hasAuthority('SCOPE_analytics:write') and hasAuthority('SCOPE_data:read')"
    )
    public Object reproduce(@PathVariable UUID id, @RequestHeader("Idempotency-Key") String key) {
        return service.reproduce(id, key);
    }

    @PostMapping("/snapshots")
    @PreAuthorize(
        "hasAuthority('SCOPE_analytics:read') and hasAuthority('SCOPE_analytics:write') and hasAuthority('SCOPE_data:read') and hasAuthority('SCOPE_registry:read')"
    )
    public Object snapshot(@Valid @RequestBody Snapshot input) {
        return service.snapshot(input);
    }

    @PostMapping("/networks")
    @PreAuthorize(
        "hasAuthority('SCOPE_data:read') and hasAuthority('SCOPE_analytics:read') and hasAuthority('SCOPE_data:write') and hasAuthority('SCOPE_analytics:write')"
    )
    public Object network(@Valid @RequestBody Network input) {
        return service.network(input);
    }
}
