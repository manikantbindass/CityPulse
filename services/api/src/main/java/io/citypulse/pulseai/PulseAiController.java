package io.citypulse.pulseai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/pulseai")
@PreAuthorize("hasAuthority('SCOPE_analytics:read') and hasAuthority('SCOPE_data:read')")
public class PulseAiController {

    private final PulseAiService service;

    public PulseAiController(PulseAiService service) {
        this.service = service;
    }

    public record Question(
        @NotBlank @Size(max = 2000) String question,
        @NotNull UUID cityId,
        @NotNull Instant from,
        @NotNull Instant to,
        @NotBlank @Pattern(regexp = "[a-zA-Z0-9 _-]{1,80}") String commodity,
        @NotNull @Pattern(regexp = "count|kg|litre|kwh|trip") String unit,
        UUID forecastId,
        @Pattern(regexp = "[a-zA-Z0-9 _-]{1,80}") String comparisonCommodity
    ) {}

    @PostMapping("/sessions")
    public Map<String, Object> create() {
        return service.create();
    }

    @GetMapping("/cities")
    @PreAuthorize(
        "hasAuthority('SCOPE_registry:read') and hasAuthority('SCOPE_analytics:read') and hasAuthority('SCOPE_data:read')"
    )
    public Object cities() {
        return service.cities();
    }

    @GetMapping("/sessions")
    public Object list() {
        return service.list();
    }

    @GetMapping("/sessions/{id}")
    public Object history(@PathVariable UUID id) {
        return service.history(id);
    }

    @DeleteMapping("/sessions/{id}")
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    @PostMapping("/sessions/{id}/messages")
    public PulseAiAnswer ask(@PathVariable UUID id, @Valid @RequestBody Question question) {
        return service.ask(id, question);
    }
}
