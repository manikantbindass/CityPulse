package io.citypulse.identity;

import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/security")
public class SecurityController {

    private final TenantContext tenant;

    public SecurityController(TenantContext tenant) {
        this.tenant = tenant;
    }

    @GetMapping("/me")
    public Object me(Authentication authentication) {
        return Map.of(
            "tenantId",
            tenant.tenantId(),
            "subject",
            tenant.subject(),
            "permissions",
            authentication
                .getAuthorities()
                .stream()
                .map(a -> a.getAuthority().replaceFirst("^SCOPE_", ""))
                .toList()
        );
    }
}
