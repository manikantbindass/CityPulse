package io.citypulse.registry;

import io.citypulse.registry.application.CityService;
import io.citypulse.registry.domain.City;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CityServiceTest {
    @Test
    void rejectsUnboundedQueriesBeforeAccessingRepository() {
        var service = new CityService((offset, size) -> { throw new AssertionError("Must not query"); });
        assertThrows(IllegalArgumentException.class, () -> service.list(-1, 20));
        assertThrows(IllegalArgumentException.class, () -> service.list(0, 101));
        assertThrows(IllegalArgumentException.class, () -> service.list(100001, 20));
    }

    @Test
    void usesStablePagination() {
        var city = new City(UUID.randomUUID(), "Demo City", "IN", "Asia/Kolkata");
        var service = new CityService((offset, size) -> {
            assertEquals(40, offset);
            assertEquals(20, size);
            return List.of(city);
        });
        assertEquals(List.of(city), service.list(2, 20));
    }
}
