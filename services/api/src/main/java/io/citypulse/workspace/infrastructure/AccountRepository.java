package io.citypulse.workspace.infrastructure;

import io.citypulse.workspace.domain.Account;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountRepository extends JpaRepository<Account, UUID> {
    Page<Account> findByTenantId(UUID tenantId, Pageable pageable);
    Optional<Account> findByIdAndTenantId(UUID id, UUID tenantId);
    Optional<Account> findByTenantIdAndSubject(UUID tenantId, String subject);
}
