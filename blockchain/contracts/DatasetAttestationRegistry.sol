// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AuthorizedSourceRegistry} from "./AuthorizedSourceRegistry.sol";

/// @notice Append-only digests; off-chain references must never contain secrets.
contract DatasetAttestationRegistry is AccessControlDefaultAdminRules, Pausable {
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    string public constant VERSION = "1.0.0";
    AuthorizedSourceRegistry public immutable sourceRegistry;
    struct Attestation { address submitter; bytes32 contentHash; bytes32 referenceHash; uint64 timestamp; uint8 kind; }
    mapping(bytes32 => Attestation) public attestations;
    mapping(address => mapping(bytes32 => bool)) public usedEventIds;
    event DatasetAttested(bytes32 indexed attestationId, address indexed submitter, bytes32 indexed contentHash, bytes32 eventId, uint8 kind, bytes32 referenceHash, uint64 timestamp);
    error InvalidAttestation();
    error UnauthorizedSource();
    error DuplicateEvent();

    constructor(address administrator, AuthorizedSourceRegistry sources) AccessControlDefaultAdminRules(1 days, administrator) {
        if (address(sources) == address(0)) revert InvalidAttestation();
        sourceRegistry = sources;
        _grantRole(ATTESTER_ROLE, administrator);
        _grantRole(PAUSER_ROLE, administrator);
    }

    /// kind: 1 dataset, 2 supply observation, 3 audit, 4 approved allocation, 5 report.
    function attest(bytes32 eventId, bytes32 contentHash, bytes32 referenceHash, uint8 kind) external onlyRole(ATTESTER_ROLE) whenNotPaused returns (bytes32 id) {
        if (!sourceRegistry.isAuthorized(msg.sender)) revert UnauthorizedSource();
        if (eventId == bytes32(0) || contentHash == bytes32(0) || referenceHash == bytes32(0) || kind < 1 || kind > 5) revert InvalidAttestation();
        if (usedEventIds[msg.sender][eventId]) revert DuplicateEvent();
        // Chain and contract domain separation prevents cross-deployment ID ambiguity.
        id = keccak256(abi.encode(block.chainid, address(this), msg.sender, eventId));
        usedEventIds[msg.sender][eventId] = true;
        attestations[id] = Attestation(msg.sender, contentHash, referenceHash, uint64(block.timestamp), kind);
        emit DatasetAttested(id, msg.sender, contentHash, eventId, kind, referenceHash, uint64(block.timestamp));
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
