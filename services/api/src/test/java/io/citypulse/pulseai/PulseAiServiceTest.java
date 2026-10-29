package io.citypulse.pulseai;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.citypulse.identity.TenantContext;
import io.citypulse.workspace.infrastructure.WorkspaceRepository;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.web.server.ResponseStatusException;

class PulseAiServiceTest {

    @Test
    void historyDoesNotQueryMessagesWithoutOwnership() {
        var db = mock(WorkspaceRepository.class);
        var identity = mock(TenantContext.class);
        UUID tenant = UUID.randomUUID();
        when(identity.tenantId()).thenReturn(tenant);
        when(identity.subject()).thenReturn("alice");
        when(db.query(anyString(), any())).thenReturn(List.of());
        var service = new PulseAiService(
            db,
            identity,
            new ObjectMapper(),
            "http://localhost:1",
            ""
        );
        assertThrows(ResponseStatusException.class, () -> service.history(UUID.randomUUID()));
        var sql = ArgumentCaptor.forClass(String.class);
        var params = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(db).query(sql.capture(), params.capture());
        assertTrue(sql.getValue().contains("tenant_id=:tenant AND actor_subject=:actor"));
        assertEquals(tenant, params.getValue().getValue("tenant"));
        assertEquals("alice", params.getValue().getValue("actor"));
        verifyNoMoreInteractions(db);
    }

    @Test
    void redactCommonSensitivePatterns() {
        assertEquals(
            "Contact [email removed] with [credential removed]",
            PulseAiService.redact("Contact person@example.org with Bearer secret-token")
        );
    }

    @Test
    void docsAreAllowlistedAndFingerprinted() {
        var docs = DocumentationTool.retrieve("Explain forecast uncertainty and source provenance");
        assertFalse(docs.isEmpty());
        assertTrue(docs.getFirst().get("sha256").toString().matches("[a-f0-9]{64}"));
        assertTrue(DocumentationTool.retrieve("../../credentials").isEmpty());
    }

    @Test
    void gapUsesMeasuredQuantitiesAndNeverMissingZero() {
        assertTrue(EvidenceAnalytics.compare(null, java.math.BigDecimal.TEN).contains("unknown"));
        assertTrue(
            EvidenceAnalytics.compare(java.math.BigDecimal.TEN, java.math.BigDecimal.ZERO).contains(
                "undefined"
            )
        );
        assertTrue(
            EvidenceAnalytics.compare(
                new java.math.BigDecimal("30"),
                new java.math.BigDecimal("20")
            ).contains("1.5000")
        );
        assertTrue(
            EvidenceAnalytics.compare(
                new java.math.BigDecimal("10"),
                new java.math.BigDecimal("20")
            ).contains("Reported surplus")
        );
    }
}
