package io.citypulse.workspace.domain;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class WorkspaceModels {
    private WorkspaceModels() {}
    public record NameInput(@NotBlank @Size(max=120) String name) {}
    public record AccountInput(@NotBlank @Size(max=200) String subject, @NotBlank @Size(max=120) String displayName, @NotNull Account.Role role) {}
    public record RoleInput(@NotNull Account.Role role, boolean enabled) {}
    public record CityInput(@NotBlank @Size(max=200) String name,@NotNull @Pattern(regexp="[A-Z]{2}") String countryCode,@NotBlank String timezone,@NotBlank @Size(max=200000) String boundaryGeoJson) {}
    public record AreaInput(@NotNull UUID cityId,UUID parentId,@NotNull @Pattern(regexp="REGION|DISTRICT|NEIGHBORHOOD") String kind,@NotBlank @Size(max=120) String name,@NotBlank @Size(max=200000) String boundaryGeoJson) {}
    public record ZoneInput(@NotNull UUID cityId,@NotBlank @Size(max=120) String name,@NotBlank @Size(max=200000) String boundaryGeoJson) {}
    public record BusinessInput(@NotNull UUID cityId,@NotNull UUID zoneId,@NotBlank @Size(max=120) String name,@NotBlank @Size(max=80) String category,@NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,@NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude) {}
    public record SourceInput(@NotBlank @Size(max=120) String provider,@NotBlank @Size(max=120) String datasetName,@NotBlank @Size(max=500) String sourceUri,@NotBlank @Size(max=300) String licenseReference,@NotNull @Pattern(regexp="public|internal|restricted") String classification, String updateFrequency, @Pattern(regexp="synthetic|historical|live") String dataMode, String timezone, @Pattern(regexp="[A-Z]{3}") String currency, Map<String,Object> schema) {}
    public record ObservationInput(@NotNull UUID cityId,@NotNull UUID zoneId,UUID businessId,@NotNull UUID sourceId,@NotBlank @Size(max=100) String externalId,@NotNull @Pattern(regexp="supply|demand") String kind,@NotBlank @Size(max=80) String commodity,@NotNull @DecimalMin("0") @DecimalMax("99999999999999") BigDecimal quantity,@NotNull @Pattern(regexp="count|kg|litre|kwh|trip") String unit,@NotNull Instant observedAt,@NotNull Instant periodEnd, Map<String,Object> provenance, @DecimalMin("0") @DecimalMax("1") BigDecimal qualityScore) {}
    public record InventoryInput(@NotNull UUID businessId,@NotNull UUID sourceId,@NotBlank @Size(max=100) String externalId,@NotBlank @Size(max=80) String commodity,@NotNull @DecimalMin("0") @DecimalMax("99999999999999") BigDecimal quantity,@NotNull @Pattern(regexp="count|kg|litre|kwh|trip") String unit,@NotNull Instant recordedAt) {}
    public record ForecastInput(@NotNull @Size(min=3,max=10000) List<@NotNull @DecimalMin("0") @DecimalMax("1000000000000") Double> values,@Min(1) @Max(168) int horizon,@Min(1) @Max(1440) int intervalMinutes) {}
    public record OptimizationInput(@NotNull UUID cityId,@NotBlank String commodity,@NotNull @Pattern(regexp="count|kg|litre|kwh|trip") String unit,@NotNull Instant from,@NotNull Instant to,@DecimalMin("0") @DecimalMax("1000000000000") double budget) {}
    public record VerificationInput(@NotBlank @Size(max=100000) String payload) {}
    public record NotificationInput(@NotBlank @Size(max=200) String recipientSubject,@NotBlank @Size(max=160) String title,@NotBlank @Size(max=1000) String message) {}
}
