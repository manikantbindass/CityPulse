package io.citypulse.identity;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class TokenPolicyTest {

    private Jwt token(String tenant, long lifetime, String acr) {
        return Jwt.withTokenValue("unit")
            .header("alg", "RS256")
            .subject("analyst")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(lifetime))
            .claim("tenant_id", tenant)
            .claim("acr", acr)
            .build();
    }

    @Test
    void rejectsMissingTenantOverlongTokensAndWrongAssurance() {
        assertTrue(new TokenPolicy("").validate(token("not-a-tenant", 300, "low")).hasErrors());
        assertTrue(
            new TokenPolicy("")
                .validate(token("00000000-0000-0000-0000-000000000001", 7200, "low"))
                .hasErrors()
        );
        assertTrue(
            new TokenPolicy("mfa")
                .validate(token("00000000-0000-0000-0000-000000000001", 300, "low"))
                .hasErrors()
        );
        assertFalse(
            new TokenPolicy("mfa")
                .validate(token("00000000-0000-0000-0000-000000000001", 300, "mfa"))
                .hasErrors()
        );
    }
}
