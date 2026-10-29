package io.citypulse.workspace.api;

import io.citypulse.workspace.application.ChainReceiptService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/verifications")
public class ChainReceiptController {

    private final ChainReceiptService receipts;

    public ChainReceiptController(ChainReceiptService receipts) {
        this.receipts = receipts;
    }

    public record ReceiptInput(
        @NotNull @Pattern(regexp = "0x[0-9a-fA-F]{64}") String transactionHash,
        @NotNull @Pattern(regexp = "0x[0-9a-fA-F]{64}") String attestationId
    ) {}

    @PostMapping("/{id}/receipt")
    @PreAuthorize("hasAuthority('SCOPE_data:write')")
    public Map<String, Object> verify(
        @PathVariable UUID id,
        @Valid @RequestBody ReceiptInput input
    ) {
        return receipts.verify(id, input.transactionHash(), input.attestationId());
    }
}
