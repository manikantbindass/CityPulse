// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {DatasetAttestationRegistry} from "./DatasetAttestationRegistry.sol";

/// @notice Read-only independent proof checking; no caller can mutate evidence.
contract VerificationRecord {
    string public constant VERSION = "1.0.0";
    DatasetAttestationRegistry public immutable registry;
    error InvalidRegistry();
    constructor(DatasetAttestationRegistry target) {
        if (address(target) == address(0)) revert InvalidRegistry();
        registry = target;
    }
    function verify(bytes32 attestationId, bytes32 expectedHash) external view returns (bool valid, address submitter, uint64 timestamp, uint8 kind) {
        bytes32 hash;
        (submitter, hash, , timestamp, kind) = registry.attestations(attestationId);
        valid = submitter != address(0) && expectedHash != bytes32(0) && hash == expectedHash;
    }
}
