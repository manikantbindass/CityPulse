package io.citypulse.decision;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.citypulse.identity.TenantContext;
import io.citypulse.workspace.application.WorkspaceService;
import io.citypulse.workspace.infrastructure.WorkspaceRepository;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.web.server.ResponseStatusException;

class DecisionServiceTest {

    @Test
    void foreignOrMissingScenarioNeverReturnsAnyResult() {
        var db = mock(WorkspaceRepository.class);
        var identity = mock(TenantContext.class);
        UUID tenant = UUID.randomUUID();
        when(identity.tenantId()).thenReturn(tenant);
        when(identity.subject()).thenReturn("owner");
        when(db.query(anyString(), any())).thenReturn(List.of());
        var service = new DecisionService(
            db,
            identity,
            mock(WorkspaceService.class),
            new ObjectMapper(),
            "http://localhost:1",
            ""
        );
        assertThrows(ResponseStatusException.class, () -> service.get(UUID.randomUUID()));
        var sql = ArgumentCaptor.forClass(String.class);
        var params = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(db).query(sql.capture(), params.capture());
        assertTrue(sql.getValue().contains("tenant_id=:tenant AND actor_subject=:actor"));
        assertEquals(tenant, params.getValue().getValue("tenant"));
        assertEquals("owner", params.getValue().getValue("actor"));
        verifyNoMoreInteractions(db);
    }

    @Test
    void paginationIsBoundedBeforeAnyDatabaseAccess() {
        var db = mock(WorkspaceRepository.class);
        var service = new DecisionService(
            db,
            mock(TenantContext.class),
            mock(WorkspaceService.class),
            new ObjectMapper(),
            "http://localhost:1",
            ""
        );
        assertThrows(IllegalArgumentException.class, () -> service.list(-1));
        assertThrows(IllegalArgumentException.class, () -> service.list(10001));
        verifyNoInteractions(db);
    }
}
