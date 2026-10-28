import { network } from 'hardhat';

const { ethers } = await network.connect();
const registry = await ethers.deployContract('AttestationRegistry');
await registry.waitForDeployment();
console.log(`Local AttestationRegistry: ${await registry.getAddress()}`);
