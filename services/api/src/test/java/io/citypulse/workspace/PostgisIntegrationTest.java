package io.citypulse.workspace;

import static org.junit.jupiter.api.Assertions.*;

import java.sql.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class PostgisIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres")
    );

    @BeforeAll
    static void migrate() {
        Flyway.configure()
            .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
            .locations("classpath:db/migration", "classpath:db/local")
            .load()
            .migrate();
    }

    @Test
    void constraintsAndTenantQueriesProtectData() throws Exception {
        try (
            var connection = DriverManager.getConnection(
                postgres.getJdbcUrl(),
                postgres.getUsername(),
                postgres.getPassword()
            );
            var statement = connection.createStatement()
        ) {
            try (
                var result = statement.executeQuery(
                    "SELECT count(*) FROM observation WHERE tenant_id='00000000-0000-0000-0000-000000000002'"
                )
            ) {
                result.next();
                assertEquals(0, result.getInt(1));
            }
            try (
                var result = statement.executeQuery(
                    "SELECT count(*) FROM observation WHERE tenant_id='00000000-0000-0000-0000-000000000001'"
                )
            ) {
                result.next();
                assertEquals(3, result.getInt(1));
            }
            assertThrows(SQLException.class, () ->
                statement.execute("UPDATE observation SET quantity=-1")
            );
            assertThrows(SQLException.class, () ->
                statement.execute("UPDATE business SET location=ST_SetSRID(ST_MakePoint(0,0),4326)")
            );
            assertThrows(SQLException.class, () ->
                statement.execute("INSERT INTO observation SELECT * FROM observation LIMIT 1")
            );
        }
    }
}
