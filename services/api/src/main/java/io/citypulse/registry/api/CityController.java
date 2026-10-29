package io.citypulse.registry.api;

import io.citypulse.registry.application.CityService;
import io.citypulse.registry.domain.City;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/cities")
public class CityController {

    private final CityService service;

    public CityController(CityService service) {
        this.service = service;
    }

    @GetMapping
    public CityPage list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return new CityPage(service.list(page, size), page, size);
    }

    public record CityPage(List<City> items, int page, int size) {}
}
