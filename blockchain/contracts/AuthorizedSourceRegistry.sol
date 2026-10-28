// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";

/// @notice Administrative identity binding. It does not certify real-world truth.
contract AuthorizedSourceRegistry is AccessControlDefaultAdminRules {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    string public constant VERSION = "1.0.0";
    struct Source { bytes32 organizationId; bytes32 metadataHash; bool active; }
    mapping(address => Source) public sources;
    event SourceRegistered(address indexed source, bytes32 indexed organizationId, bytes32 metadataHash);
    event SourceStatusChanged(address indexed source, bool active);
    error InvalidSource();
    error SourceExists();
    error UnknownSource();

    constructor(address administrator) AccessControlDefaultAdminRules(1 days, administrator) {
        _grantRole(REGISTRAR_ROLE, administrator);
    }

    function register(address source, bytes32 organizationId, bytes32 metadataHash) external onlyRole(REGISTRAR_ROLE) {
        if (source == address(0) || organizationId == bytes32(0) || metadataHash == bytes32(0)) revert InvalidSource();
        if (sources[source].organizationId != bytes32(0)) revert SourceExists();
        sources[source] = Source(organizationId, metadataHash, true);
        emit SourceRegistered(source, organizationId, metadataHash);
    }

    function setActive(address source, bool active) external onlyRole(REGISTRAR_ROLE) {
        if (sources[source].organizationId == bytes32(0)) revert UnknownSource();
        sources[source].active = active;
        emit SourceStatusChanged(source, active);
    }

    function isAuthorized(address source) external view returns (bool) { return sources[source].active; }
}
