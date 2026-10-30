package io.citypulse.workspace.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.citypulse.identity.TenantContext;
import io.citypulse.workspace.infrastructure.WorkspaceRepository;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ChainReceiptService {

    private final ObjectMapper json;
    private final WorkspaceRepository db;
    private final TenantContext tenant;
    private final WorkspaceService operations;
    private final String rpc, address, topic, version;
    private final long chainId;
    private final HttpClient client = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(Duration.ofSeconds(3))
        .build();

    public ChainReceiptService(
        ObjectMapper json,
        WorkspaceRepository db,
        TenantContext tenant,
        WorkspaceService operations,
        @Value("${BLOCKCHAIN_RPC_URL:}") String rpc,
        @Value("${ATTESTATION_CONTRACT_ADDRESS:}") String address,
        @Value("${ATTESTATION_EVENT_TOPIC:}") String topic,
        @Value("${BLOCKCHAIN_CHAIN_ID:31337}") long chainId,
        @Value("${ATTESTATION_CONTRACT_VERSION:1.0.0}") String version
    ) {
        this.json = json;
        this.db = db;
        this.tenant = tenant;
        this.operations = operations;
        this.rpc = rpc;
        this.address = address;
        this.topic = topic;
        this.chainId = chainId;
        this.version = version;
    }

    private JsonNode call(String method, Object... parameters) {
        if (
            rpc.isBlank() ||
            !address.matches("0x[0-9a-fA-F]{40}") ||
            !topic.matches("0x[0-9a-fA-F]{64}")
        ) throw new ResponseStatusException(
            HttpStatus.SERVICE_UNAVAILABLE,
            "Chain verification is not configured"
        );
        try {
            var request = HttpRequest.newBuilder(URI.create(rpc))
                .timeout(Duration.ofSeconds(5))
                .header("Content-Type", "application/json")
                .POST(
                    HttpRequest.BodyPublishers.ofString(
                        json.writeValueAsString(
                            Map.of(
                                "jsonrpc",
                                "2.0",
                                "id",
                                1,
                                "method",
                                method,
                                "params",
                                parameters
                            )
                        )
                    )
                )
                .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new IllegalStateException();
            var value = json.readTree(response.body());
            if (value.has("error")) throw new IllegalStateException();
            if (!value.has("result")) throw new IllegalStateException();
            return value.get("result");
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "RPC interrupted");
        } catch (Exception error) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Chain RPC unavailable"
            );
        }
    }

    @Transactional
    public Map<String, Object> verify(UUID id, String transactionHash, String attestationId) {
        var p = new MapSqlParameterSource("tenant", tenant.tenantId()).addValue("id", id);
        var rows = db.query(
            "SELECT digest FROM verification_request WHERE tenant_id=:tenant AND id=:id FOR UPDATE",
            p
        );
        if (rows.isEmpty()) throw new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Verification request not found"
        );
        String expected = "0x" + rows.getFirst().get("digest");
        if (
            Long.parseUnsignedLong(call("eth_chainId").asText().substring(2), 16) != chainId
        ) throw new ResponseStatusException(HttpStatus.CONFLICT, "RPC network mismatch");
        var receipt = call("eth_getTransactionReceipt", transactionHash);
        if (receipt == null || receipt.isNull()) throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "Transaction not yet mined or not found"
        );
        if (!"0x1".equals(receipt.path("status").asText())) throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "Transaction failed"
        );
        boolean matches = false;
        for (var log : receipt.path("logs")) {
            var topics = log.path("topics");
            if (
                address.equalsIgnoreCase(log.path("address").asText()) &&
                topics.size() == 4 &&
                topic.equalsIgnoreCase(topics.get(0).asText()) &&
                attestationId.equalsIgnoreCase(topics.get(1).asText()) &&
                expected.equalsIgnoreCase(topics.get(3).asText())
            ) matches = true;
        }
        if (!matches) throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "Receipt does not prove this digest at the configured registry"
        );
        var block = call("eth_getBlockByNumber", receipt.path("blockNumber").asText(), false);
        if (
            !receipt.path("blockHash").asText().equalsIgnoreCase(block.path("hash").asText())
        ) throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "Receipt block is no longer canonical"
        );
        long number = Long.parseUnsignedLong(receipt.path("blockNumber").asText().substring(2), 16);
        db.update(
            "UPDATE verification_request SET status='CHAIN_CONFIRMED',chain_id=:chain,contract_address=:contract,contract_version=:version,transaction_hash=:tx,block_hash=:block,block_number=:number,attestation_id=:attestation,verified_at=now() WHERE tenant_id=:tenant AND id=:id",
            p
                .addValue("chain", chainId)
                .addValue("contract", address)
                .addValue("version", version)
                .addValue("tx", transactionHash)
                .addValue("block", receipt.path("blockHash").asText())
                .addValue("number", number)
                .addValue("attestation", attestationId)
        );
        operations.audit("VERIFY_RECEIPT", "verification", id);
        return Map.of(
            "id",
            id,
            "status",
            "CHAIN_CONFIRMED",
            "chainId",
            chainId,
            "contract",
            address,
            "transactionHash",
            transactionHash,
            "blockNumber",
            number,
            "contractVersion",
            version,
            "confirmationPolicy",
            "mined and canonical at verification time; public chains require stronger finality policy"
        );
    }
}
