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

    public ConversationRetention(WorkspaceRepository db) {
        this.db = db;
    }

    /** System maintenance across tenants; no content is read or returned. Cascades messages. */
    @Scheduled(fixedDelayString = "${citypulse.pulseai.retention-ms:3600000}")
    public void purgeExpired() {
        db.update(
            "DELETE FROM pulseai_session WHERE expires_at<=now()",
            new MapSqlParameterSource()
        );
    }
}
