import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { network } from 'hardhat';

describe('Role-controlled verification modules', async () => {
  const { ethers } = await network.create();
  async function fixture() {
    const [admin, source, attacker] = await ethers.getSigners();
    const sources = await ethers.deployContract('AuthorizedSourceRegistry', [admin.address]);
    const datasets = await ethers.deployContract('DatasetAttestationRegistry', [
      admin.address,
      await sources.getAddress(),
    ]);
    const verifier = await ethers.deployContract('VerificationRecord', [
      await datasets.getAddress(),
    ]);
    await (
      await sources.register(
        source.address,
        ethers.id('synthetic-org'),
        ethers.id('public-metadata-v1'),
      )
    ).wait();
    await (await datasets.grantRole(await datasets.ATTESTER_ROLE(), source.address)).wait();
    return { admin, source, attacker, sources, datasets, verifier };
  }
  it('checks source authorization and independent content proof', async () => {
    const { source, datasets, verifier } = await fixture();
    const event = ethers.id('report-1');
    const hash = ethers.sha256(ethers.toUtf8Bytes('SYNTHETIC,report\n1,42\n'));
    const transaction = await datasets.connect(source).getFunction('attest')(
      event,
      hash,
      ethers.sha256(ethers.toUtf8Bytes('urn:citypulse:local:report-1')),
      5,
    );
    const receipt = await transaction.wait();
    assert.equal(receipt?.status, 1);
    const { chainId } = await ethers.provider.getNetwork();
    const id = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'address', 'address', 'bytes32'],
        [chainId, await datasets.getAddress(), source.address, event],
      ),
    );
    const proof = await verifier.verify(id, hash);
    assert.equal(proof.valid, true);
    assert.equal(proof.submitter, source.address);
    assert.equal((await verifier.verify(id, ethers.id('tampered'))).valid, false);
    assert.equal((await verifier.verify(ethers.ZeroHash, hash)).valid, false);
    assert.equal((await verifier.verify(id, ethers.ZeroHash)).valid, false);
  });
  it('rejects malicious callers, replay, invalid fields and revoked sources', async () => {
    const { source, attacker, sources, datasets } = await fixture();
    const event = ethers.id('observation-1');
    const hash = ethers.id('content');
    const ref = ethers.id('reference');
    await assert.rejects(
      sources.connect(attacker).getFunction('register')(attacker.address, hash, ref),
    );
    await assert.rejects(datasets.connect(attacker).getFunction('attest')(event, hash, ref, 2));
    await assert.rejects(
      datasets.connect(source).getFunction('attest')(ethers.ZeroHash, hash, ref, 2),
    );
    await assert.rejects(
      datasets.connect(source).getFunction('attest')(event, ethers.ZeroHash, ref, 2),
    );
    await assert.rejects(datasets.connect(source).getFunction('attest')(event, hash, ref, 0));
    await (await datasets.connect(source).getFunction('attest')(event, hash, ref, 2)).wait();
    await assert.rejects(datasets.connect(source).getFunction('attest')(event, hash, ref, 2));
    await (await sources.setActive(source.address, false)).wait();
    await assert.rejects(
      datasets.connect(source).getFunction('attest')(ethers.id('next'), hash, ref, 2),
    );
  });
  it('supports emergency pause without erasing historical records', async () => {
    const { attacker, source, datasets } = await fixture();
    await assert.rejects(datasets.connect(attacker).getFunction('pause')());
    await (await datasets.pause()).wait();
    await assert.rejects(
      datasets.connect(source).getFunction('attest')(
        ethers.id('allocation'),
        ethers.id('content'),
        ethers.id('approved-reference'),
        4,
      ),
    );
    await (await datasets.unpause()).wait();
    await (
      await datasets.connect(source).getFunction('attest')(
        ethers.id('allocation'),
        ethers.id('content'),
        ethers.id('approved-reference'),
        4,
      )
    ).wait();
  });
});
