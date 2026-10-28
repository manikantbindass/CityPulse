package io.citypulse.registry.domain;

import java.util.List;

public interface CityRepository {
    List<City> findPage(int offset, int size);
}
