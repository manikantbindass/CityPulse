package io.citypulse.operations;

import org.flywaydb.core.Flyway;

/** Operator-only one-shot job; never receives web traffic or seeds production fixtures. */
public final class Migrate {

    private Migrate() {}

    public static void main(String[] args) {
        Flyway.configure()
            .dataSource(
                required("DATABASE_URL"),
                required("MIGRATION_USER"),
                required("MIGRATION_PASSWORD")
            )
            .locations("classpath:db/migration", "classpath:db/callback")
            .load()
            .migrate();
    }

    private static String required(String key) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) throw new IllegalStateException(
            "Missing migration configuration: " + key
        );
        return value;
    }
}
