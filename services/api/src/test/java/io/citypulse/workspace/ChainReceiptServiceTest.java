package io.citypulse.workspace;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.citypulse.identity.TenantContext;
import io.citypulse.workspace.application.ChainReceiptService;
import io.citypulse.workspace.application.WorkspaceService;
import io.citypulse.workspace.infrastructure.WorkspaceRepository;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.web.server.ResponseStatusException;

class ChainReceiptServiceTest {

    private HttpServer server;
    private final ObjectMapper json = new ObjectMapper();
    private final String contract = "0x" + "1".repeat(40),
        topic = "0x" + "2".repeat(64),
        digest = "3".repeat(64),
        attestation = "0x" + "4".repeat(64),
        transaction = "0x" + "5".repeat(64),
        block = "0x" + "6".repeat(64);
    private String chain = "0x7a69";
    private String eventDigest;
    private WorkspaceRepository repository;
    private WorkspaceService audit;
    private ChainReceiptService service;

    @BeforeEach
    void setup() throws Exception {
        eventDigest = "0x" + digest;
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            var input = json.readTree(exchange.getRequestBody());
            Object result = switch (input.path("method").asText()) {
                case "eth_chainId" -> chain;
                case "eth_getBlockByNumber" -> Map.of("hash", block);
                case "eth_getTransactionReceipt" -> Map.of(
                    "status",
                    "0x1",
                    "blockHash",
                    block,
                    "blockNumber",
                    "0x10",
                    "logs",
                    List.of(
                        Map.of(
                            "address",
                            contract,
                            "topics",
                            List.of(topic, attestation, "0x" + "0".repeat(64), eventDigest)
                        )
                    )
                );
                default -> throw new IllegalStateException();
            };
            byte[] bytes = json
                .writeValueAsString(Map.of("jsonrpc", "2.0", "id", 1, "result", result))
                .getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        repository = mock(WorkspaceRepository.class);
        audit = mock(WorkspaceService.class);
        var tenant = mock(TenantContext.class);
        when(tenant.tenantId()).thenReturn(TenantContext.LOCAL_TENANT);
        when(repository.query(anyString(), any())).thenReturn(List.of(Map.of("digest", digest)));
        service = new ChainReceiptService(
            json,
            repository,
            tenant,
            audit,
            "http://127.0.0.1:" + server.getAddress().getPort(),
            contract,
            topic,
            31337,
            "1.0.0"
        );
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void acceptsOnlyMatchingCanonicalReceipt() {
        UUID id = UUID.randomUUID();
        var result = service.verify(id, transaction, attestation);
        assertEquals("CHAIN_CONFIRMED", result.get("status"));
        verify(repository).update(contains("status='CHAIN_CONFIRMED'"), any());
        verify(audit).audit("VERIFY_RECEIPT", "verification", id);
    }

    @Test
    void rejectsNetworkMismatch() {
        chain = "0x1";
        assertThrows(ResponseStatusException.class, () ->
            service.verify(UUID.randomUUID(), transaction, attestation)
        );
        verify(repository, never()).update(anyString(), any());
    }

    @Test
    void rejectsDigestMismatch() {
        eventDigest = "0x" + "a".repeat(64);
        assertThrows(ResponseStatusException.class, () ->
            service.verify(UUID.randomUUID(), transaction, attestation)
        );
        verify(repository, never()).update(anyString(), any());
    }
}
