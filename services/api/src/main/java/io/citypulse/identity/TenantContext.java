package io.citypulse.identity;

import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

@Component
public class TenantContext {
    public static final UUID LOCAL_TENANT = UUID.fromString("00000000-0000-0000-0000-000000000001");

    public UUID tenantId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwt) {
            try { return UUID.fromString(jwt.getToken().getClaimAsString("tenant_id")); }
            catch (RuntimeException error) { throw new AccessDeniedException("A valid tenant_id claim is required"); }
        }
        if (auth != null && "local-developer".equals(auth.getName()) && auth.isAuthenticated()) return LOCAL_TENANT;
        throw new AccessDeniedException("Tenant identity required");
    }

    public String subject() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) throw new AccessDeniedException("Authentication required");
        return auth.getName();
    }
}
