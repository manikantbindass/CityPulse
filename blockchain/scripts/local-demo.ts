import { network } from 'hardhat';
import fs from 'node:fs/promises';
import path from 'node:path';

const { ethers } = await network.create();
const [admin] = await ethers.getSigners();
const { chainId } = await ethers.provider.getNetwork();
if (chainId !== 31337n)
  throw new Error('This synthetic demonstration is restricted to local chain 31337.');
const sources = await ethers.deployContract('AuthorizedSourceRegistry', [admin.address]);
await sources.waitForDeployment();
const datasets = await ethers.deployContract('DatasetAttestationRegistry', [
  admin.address,
  await sources.getAddress(),
]);
await datasets.waitForDeployment();
const verifier = await ethers.deployContract('VerificationRecord', [await datasets.getAddress()]);
await verifier.waitForDeployment();
await (
  await sources.register(
    admin.address,
    ethers.id('synthetic-organization'),
    ethers.id('synthetic-public-metadata-v1'),
  )
).wait();
const output = path.resolve('../.data/blockchain');
await fs.mkdir(output, { recursive: true });
const report = 'dataset,district,demand,supply\nSYNTHETIC,central,100,88\n';
await fs.writeFile(path.join(output, 'sample-report.csv'), report);
const contentHash = ethers.sha256(ethers.toUtf8Bytes(report));
const reference = 'urn:citypulse:local:sample-report.csv';
const referenceHash = ethers.sha256(ethers.toUtf8Bytes(reference));
const eventId = ethers.id('synthetic-report-1');
const gasEstimate = await datasets.attest.estimateGas(eventId, contentHash, referenceHash, 5);
const tx = await datasets.attest(eventId, contentHash, referenceHash, 5, {
  gasLimit: (gasEstimate * 12n) / 10n,
});
const receipt = await tx.wait();
if (!receipt || receipt.status !== 1) throw new Error('Transaction did not succeed.');
const id = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'address', 'address', 'bytes32'],
    [chainId, await datasets.getAddress(), admin.address, eventId],
  ),
);
const proof = await verifier.verify(id, contentHash);
const tampered = await verifier.verify(id, ethers.sha256(ethers.toUtf8Bytes(report + 'tampered')));
const result = {
  local: true,
  ephemeral: process.env.CITYPULSE_EPHEMERAL_DEMO === '1',
  synthetic: true,
  contractVersion: '1.0.0',
  chainId: Number(chainId),
  contracts: {
    AuthorizedSourceRegistry: await sources.getAddress(),
    DatasetAttestationRegistry: await datasets.getAddress(),
    VerificationRecord: await verifier.getAddress(),
  },
  attestationId: id,
  eventId,
  contentHash,
  offchainReference: reference,
  referenceHash,
  submitter: admin.address,
  gasEstimate: gasEstimate.toString(),
  gasUsed: receipt.gasUsed.toString(),
  transactionHash: receipt.hash,
  blockNumber: receipt.blockNumber,
  blockHash: receipt.blockHash,
  verified: proof.valid,
  tamperedVerified: tampered.valid,
  eventTopic: ethers.id('DatasetAttested(bytes32,address,bytes32,bytes32,uint8,bytes32,uint64)'),
  rpc: process.env.CITYPULSE_EPHEMERAL_DEMO === '1' ? null : 'http://127.0.0.1:8545',
};
await fs.writeFile(path.join(output, 'local-demo-result.json'), JSON.stringify(result, null, 2));
await fs.writeFile(path.join(output, 'deployment.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (process.env.CITYPULSE_API_URL && process.env.LOCAL_API_TOKEN) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LOCAL_API_TOKEN}`,
    'Idempotency-Key': ethers.id(`receipt-${receipt.hash}`).slice(2),
  };
  const created = await fetch(`${process.env.CITYPULSE_API_URL}/api/v1/verifications`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ payload: report }),
  });
  if (!created.ok)
    throw new Error(
      `Backend digest creation failed: HTTP ${created.status}; chain transaction remains recorded.`,
    );
  const digestReceipt = (await created.json()) as { id: string };
  const tracked = await fetch(
    `${process.env.CITYPULSE_API_URL}/api/v1/verifications/${digestReceipt.id}/receipt`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ transactionHash: receipt.hash, attestationId: id }),
    },
  );
  if (!tracked.ok)
    throw new Error(
      `Backend RPC receipt validation failed: HTTP ${tracked.status}. No backend confirmation claimed.`,
    );
  console.log('Backend independently verified receipt:', await tracked.json());
}
