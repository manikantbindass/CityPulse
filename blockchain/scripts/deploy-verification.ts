import { network } from 'hardhat';
import fs from 'node:fs/promises';
import path from 'node:path';

const { ethers } = await network.create();
const [signer] = await ethers.getSigners();
const { chainId } = await ethers.provider.getNetwork();
const isLocal = chainId === 31337n;
if (!isLocal && !process.env.CONTRACT_ADMIN_ADDRESS)
  throw new Error(
    'Public testnet requires explicit CONTRACT_ADMIN_ADDRESS; use a trusted multisig administrator.',
  );
const administrator = process.env.CONTRACT_ADMIN_ADDRESS ?? signer.address;
const sources = await ethers.deployContract('AuthorizedSourceRegistry', [administrator]);
await sources.waitForDeployment();
const datasets = await ethers.deployContract('DatasetAttestationRegistry', [
  administrator,
  await sources.getAddress(),
]);
await datasets.waitForDeployment();
const verifier = await ethers.deployContract('VerificationRecord', [await datasets.getAddress()]);
await verifier.waitForDeployment();
const deployments = {
  version: '1.0.0',
  chainId: Number(chainId),
  local: isLocal,
  administrator,
  contracts: {
    AuthorizedSourceRegistry: await sources.getAddress(),
    DatasetAttestationRegistry: await datasets.getAddress(),
    VerificationRecord: await verifier.getAddress(),
  },
  transactions: {
    sourceRegistry: sources.deploymentTransaction()?.hash,
    datasetRegistry: datasets.deploymentTransaction()?.hash,
    verifier: verifier.deploymentTransaction()?.hash,
  },
};
const output = path.resolve(process.env.DEPLOYMENT_OUTPUT ?? '../.data/blockchain/deployment.json');
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(deployments, null, 2));
console.log(JSON.stringify(deployments, null, 2));
