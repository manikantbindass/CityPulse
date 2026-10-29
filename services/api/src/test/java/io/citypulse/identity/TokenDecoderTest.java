package io.citypulse.identity;

import static org.junit.jupiter.api.Assertions.*;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.*;
import java.security.*;
import java.security.interfaces.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;

class TokenDecoderTest {

    @Test
    void signedAccessTokenRequiresIssuerAudienceTenantExpiryAndAuthenticity() throws Exception {
        var generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        var keys = generator.generateKeyPair();
        var decoder = NimbusJwtDecoder.withPublicKey((RSAPublicKey) keys.getPublic()).build();
        decoder.setJwtValidator(
            new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer("https://idp.example.test"),
                new JwtClaimValidator<List<String>>(
                    "aud",
                    aud -> aud != null && aud.contains("citypulse-api")
                ),
                new TokenPolicy("mfa")
            )
        );
        String valid = sign(keys, "https://idp.example.test", "citypulse-api", 300);
        assertEquals("analyst", decoder.decode(valid).getSubject());
        assertThrows(JwtException.class, () ->
            decoder.decode(sign(keys, "https://attacker.invalid", "citypulse-api", 300))
        );
        assertThrows(JwtException.class, () ->
            decoder.decode(sign(keys, "https://idp.example.test", "another-api", 300))
        );
        assertThrows(JwtException.class, () ->
            decoder.decode(sign(keys, "https://idp.example.test", "citypulse-api", -300))
        );
        var attacker = generator.generateKeyPair();
        assertThrows(JwtException.class, () ->
            decoder.decode(sign(attacker, "https://idp.example.test", "citypulse-api", 300))
        );
    }

    private String sign(KeyPair keys, String issuer, String audience, int lifetime)
        throws Exception {
        var claims = new JWTClaimsSet.Builder()
            .issuer(issuer)
            .audience(audience)
            .subject("analyst")
            .issueTime(Date.from(Instant.now().minusSeconds(600)))
            .expirationTime(Date.from(Instant.now().plusSeconds(lifetime)))
            .claim("tenant_id", "00000000-0000-0000-0000-000000000001")
            .claim("acr", "mfa")
            .build();
        var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims);
        jwt.sign(new RSASSASigner((RSAPrivateKey) keys.getPrivate()));
        return jwt.serialize();
    }
}
