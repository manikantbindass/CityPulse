package io.citypulse.workspace.infrastructure;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** SQL stays in a parameterized adapter; callers must supply a tenant predicate. */
@Repository
public class WorkspaceRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public WorkspaceRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> query(String sql, MapSqlParameterSource parameters) {
        return jdbc.queryForList(sql, parameters);
    }

    public int update(String sql, MapSqlParameterSource parameters) {
        return jdbc.update(sql, parameters);
    }
}
