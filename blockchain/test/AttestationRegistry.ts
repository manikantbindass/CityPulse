import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { network } from 'hardhat';

describe('AttestationRegistry', async () => {
  const { ethers } = await network.connect();

  it('records a submitter digest and rejects duplicates and empty values', async () => {
    const registry = await ethers.deployContract('AttestationRegistry');
    const [owner, other] = await ethers.getSigners();
    const digest = ethers.sha256(ethers.toUtf8Bytes('synthetic-observation-v1'));
    await (await registry.attest(digest)).wait();
    assert.ok((await registry.attestedAt(owner.address, digest)) > 0n);
    await assert.rejects(registry.attest(digest));
    await assert.rejects(registry.attest(ethers.ZeroHash));
    await (await registry.connect(other).getFunction('attest')(digest)).wait();
    assert.ok((await registry.attestedAt(other.address, digest)) > 0n);
  });
});
