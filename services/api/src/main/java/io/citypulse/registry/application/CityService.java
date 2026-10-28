package io.citypulse.registry.application;

import io.citypulse.registry.domain.City;
import io.citypulse.registry.domain.CityRepository;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class CityService {
    private final CityRepository repository;

    public CityService(CityRepository repository) {
        this.repository = repository;
    }

    public List<City> list(int page, int size) {
        if (page < 0 || page > 100000 || size < 1 || size > 100) {
            throw new IllegalArgumentException("page must be 0..100000 and size must be 1..100");
        }
        return repository.findPage(Math.multiplyExact(page, size), size);
    }
}
