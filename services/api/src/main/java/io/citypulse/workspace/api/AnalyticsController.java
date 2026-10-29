package io.citypulse.workspace.api;

import io.citypulse.workspace.application.AnalyticsService;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

    private final AnalyticsService service;

    public AnalyticsController(AnalyticsService service) {
        this.service = service;
    }

    @GetMapping("/metrics")
    @PreAuthorize("hasAuthority('SCOPE_analytics:read')")
    public Map<String, Object> metrics(
        @RequestParam UUID cityId,
        @RequestParam String commodity,
        @RequestParam String unit,
        @RequestParam Instant from,
        @RequestParam Instant to
    ) {
        return service.metrics(cityId, commodity, unit, from, to);
    }
}
