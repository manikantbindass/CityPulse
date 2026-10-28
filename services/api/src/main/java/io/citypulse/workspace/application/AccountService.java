package io.citypulse.workspace.application;

import io.citypulse.identity.TenantContext;
import io.citypulse.workspace.domain.Account;
import io.citypulse.workspace.domain.WorkspaceModels.*;
import io.citypulse.workspace.infrastructure.AccountRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class AccountService {

    private final AccountRepository accounts;
    private final TenantContext tenant;
    private final WorkspaceService operations;

    public AccountService(
        AccountRepository accounts,
        TenantContext tenant,
        WorkspaceService operations
    ) {
        this.accounts = accounts;
        this.tenant = tenant;
        this.operations = operations;
    }

    public Page<Account> list(int page, int size) {
        if (page < 0 || page > 100000 || size < 1 || size > 100) throw new IllegalArgumentException(
            "page 0..100000; size 1..100"
        );
        return accounts.findByTenantId(
            tenant.tenantId(),
            PageRequest.of(page, size, Sort.by("displayName", "id"))
        );
    }

    public Map<String, Object> create(AccountInput in) {
        var account = accounts.saveAndFlush(
            new Account(tenant.tenantId(), in.subject(), in.displayName(), in.role())
        );
        operations.audit("CREATE", "account", account.id);
        return Map.of("id", account.id);
    }

    public Account change(UUID id, RoleInput in) {
        var account = accounts
            .findByIdAndTenantId(id, tenant.tenantId())
            .orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found")
            );
        if (
            account.subject.equals(tenant.subject()) && !in.enabled()
        ) throw new IllegalArgumentException("Cannot disable your own membership");
        account.role = in.role();
        account.enabled = in.enabled();
        operations.audit("UPDATE_ROLE", "account", id);
        return accounts.save(account);
    }
}
