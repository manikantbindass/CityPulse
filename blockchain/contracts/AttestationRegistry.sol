// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/// @notice Local prototype: proves who submitted a digest, never that data is true.
contract AttestationRegistry {
    mapping(address => mapping(bytes32 => uint256)) public attestedAt;
    event Attested(address indexed submitter, bytes32 indexed digest, uint256 timestamp);
    error EmptyDigest();
    error AlreadyAttested();

    function attest(bytes32 digest) external {
        if (digest == bytes32(0)) revert EmptyDigest();
        if (attestedAt[msg.sender][digest] != 0) revert AlreadyAttested();
        attestedAt[msg.sender][digest] = block.timestamp;
        emit Attested(msg.sender, digest, block.timestamp);
    }
}
