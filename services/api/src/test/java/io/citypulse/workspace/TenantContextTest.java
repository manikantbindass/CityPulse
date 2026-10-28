package io.citypulse.workspace;

import io.citypulse.identity.TenantContext;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import static org.junit.jupiter.api.Assertions.*;

class TenantContextTest {
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    @Test void requiresSignedTenantClaim(){var jwt=Jwt.withTokenValue("test").header("alg","RS256").subject("external-user").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));assertThrows(org.springframework.security.access.AccessDeniedException.class,()->new TenantContext().tenantId());}
    @Test void extractsTenantFromJwt(){UUID id=UUID.randomUUID();var jwt=Jwt.withTokenValue("test").header("alg","RS256").subject("external-user").claim("tenant_id",id.toString()).build();SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));assertEquals(id,new TenantContext().tenantId());}
    @Test void sha256HasStableUtf8Semantics(){assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",io.citypulse.workspace.application.WorkspaceService.digest("abc"));}
}
