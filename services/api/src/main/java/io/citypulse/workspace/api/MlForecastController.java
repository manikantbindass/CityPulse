package io.citypulse.workspace.api;

import io.citypulse.workspace.application.MlForecastService;
import io.citypulse.workspace.application.WorkspaceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/forecast-jobs")
public class MlForecastController {

    private final MlForecastService models;
    private final WorkspaceService operations;

    public MlForecastController(MlForecastService models, WorkspaceService operations) {
        this.models = models;
        this.operations = operations;
    }

    public record Point(
        @NotNull Instant time,
        @NotNull @DecimalMin("0") @DecimalMax("1000000000000") Double demand,
        @DecimalMin("0") @DecimalMax("1000000000000") Double supply
    ) {}

    public record Input(
        @NotNull @Pattern(regexp = "[a-z0-9-]{1,60}") String city,
        @NotNull @Pattern(regexp = "[a-z0-9-]{1,60}") String district,
        @NotNull @Pattern(regexp = "[a-z0-9-]{1,60}") String category,
        @NotNull @Size(min = 14, max = 10000) List<@Valid Point> observations,
        @Min(1) @Max(90) int horizon,
        @NotNull @Pattern(regexp = "synthetic|historical|live") String dataMode
    ) {}

    @PostMapping
    @PreAuthorize("hasAuthority('SCOPE_analytics:write')")
    public Map<String, Object> create(
        @RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody Input input
    ) {
        return operations.idempotent("ml-forecast", key, input, () -> models.create(input));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SCOPE_analytics:read')")
    public Map<String, Object> get(@PathVariable UUID id) {
        return models.retrieve(id);
    }
}
