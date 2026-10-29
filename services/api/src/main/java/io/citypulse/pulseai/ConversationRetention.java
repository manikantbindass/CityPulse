package io.citypulse.pulseai;

import io.citypulse.workspace.infrastructure.WorkspaceRepository;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
public class ConversationRetention {

    private final WorkspaceRepository db;

    @org.springframework.beans.factory.annotation.Value("${SECURITY_SCENARIO_RETENTION_DAYS:90}")
    private int scenarioDays;

    @org.springframework.beans.factory.annotation.Value("${SECURITY_SNAPSHOT_RETENTION_DAYS:30}")
    private int snapshotDays;

    public ConversationRetention(WorkspaceRepository db) {
        this.db = db;
    }

    /** System maintenance across tenants; no content is read or returned. Cascades messages. */
    @Scheduled(fixedDelayString = "${citypulse.pulseai.retention-ms:3600000}")
    public void purgeExpired() {
        if (
            scenarioDays < 1 || scenarioDays > 3650 || snapshotDays < 1 || snapshotDays > 3650
        ) throw new IllegalArgumentException("Retention must be 1..3650 days");
        db.update(
            "DELETE FROM decision_scenario WHERE created_at<now()-make_interval(days => :days)",
            new MapSqlParameterSource("days", scenarioDays)
        );
        db.update(
            "DELETE FROM decision_snapshot WHERE created_at<now()-make_interval(days => :days) AND NOT EXISTS(SELECT 1 FROM decision_scenario s WHERE s.input->>'snapshotId'=decision_snapshot.id::text)",
            new MapSqlParameterSource("days", snapshotDays)
        );
        db.update(
            "DELETE FROM pulseai_session WHERE expires_at<=now()",
            new MapSqlParameterSource()
        );
    }
}
