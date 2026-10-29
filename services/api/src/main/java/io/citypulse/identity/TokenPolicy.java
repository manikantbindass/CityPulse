package io.citypulse.identity;

import java.time.*;
import java.util.UUID;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.Jwt;

/** Require bounded access-token lifetime, signed tenant and optional provider ACR. */
public class TokenPolicy implements OAuth2TokenValidator<Jwt> {

    private final String acr;

    public TokenPolicy(String acr) {
        this.acr = acr;
    }

    public OAuth2TokenValidatorResult validate(Jwt token) {
        try {
            UUID.fromString(token.getClaimAsString("tenant_id"));
            if (
                token.getSubject() == null ||
                token.getSubject().length() > 200 ||
                token.getIssuedAt() == null ||
                token.getExpiresAt() == null ||
                !token.getExpiresAt().isAfter(token.getIssuedAt()) ||
                Duration.between(token.getIssuedAt(), token.getExpiresAt()).getSeconds() > 3600 ||
                token.getIssuedAt().isAfter(Instant.now().plusSeconds(60)) ||
                (!acr.isBlank() && !acr.equals(token.getClaimAsString("acr")))
            ) throw new IllegalArgumentException();
            return OAuth2TokenValidatorResult.success();
        } catch (RuntimeException e) {
            return OAuth2TokenValidatorResult.failure(
                new OAuth2Error(
                    "invalid_token",
                    "Token identity, lifetime or required assurance is invalid",
                    null
                )
            );
        }
    }
}
