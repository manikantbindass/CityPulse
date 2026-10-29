package io.citypulse.workspace.domain;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "user_account")
public class Account {

    @Id
    public UUID id;

    @Column(name = "tenant_id", nullable = false)
    public UUID tenantId;

    @Column(nullable = false)
    public String subject;

    @Column(name = "display_name", nullable = false)
    public String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public Role role;

    @Column(nullable = false)
    public boolean enabled = true;

    public enum Role {
        ADMIN,
        ANALYST,
        PLANNER,
        BUSINESS_OWNER,
        PROVIDER,
        CITIZEN,
    }

    protected Account() {}

    public Account(UUID tenantId, String subject, String displayName, Role role) {
        this.id = UUID.randomUUID();
        this.tenantId = tenantId;
        this.subject = subject;
        this.displayName = displayName;
        this.role = role;
    }
}
