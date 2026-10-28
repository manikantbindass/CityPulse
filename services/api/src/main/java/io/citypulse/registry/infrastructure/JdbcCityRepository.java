package io.citypulse.registry.infrastructure;

import io.citypulse.registry.domain.City;
import io.citypulse.registry.domain.CityRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import io.citypulse.identity.TenantContext;
import org.springframework.cache.annotation.Cacheable;

@Repository
public class JdbcCityRepository implements CityRepository {
    private final JdbcTemplate jdbc;
    private final TenantContext tenant;

    public JdbcCityRepository(JdbcTemplate jdbc, TenantContext tenant) {
        this.jdbc = jdbc;
        this.tenant = tenant;
    }

    @Override
    @Cacheable(value="cities", key="@tenantContext.tenantId().toString() + ':' + #offset + ':' + #size")
    public List<City> findPage(int offset, int size) {
        return jdbc.query("SELECT c.id, c.name, c.country_code, c.timezone FROM city c JOIN tenant_city tc ON tc.city_id=c.id WHERE tc.tenant_id=? ORDER BY c.name, c.id LIMIT ? OFFSET ?",
                (rs, row) -> new City(rs.getObject("id", UUID.class), rs.getString("name"),
                        rs.getString("country_code"), rs.getString("timezone")), tenant.tenantId(), size, offset);
    }
}
