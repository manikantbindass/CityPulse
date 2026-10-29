import { defineConfig, configVariable } from 'hardhat/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatNodeTestRunner from '@nomicfoundation/hardhat-node-test-runner';

export default defineConfig({
  plugins: [hardhatEthers, hardhatNodeTestRunner],
  solidity: '0.8.28',
  networks: {
    testnet: {
      type: 'http',
      url: configVariable('TESTNET_RPC_URL'),
      accounts: [configVariable('TESTNET_PRIVATE_KEY')],
    },
    localhost: { type: 'http', url: process.env.LOCAL_CHAIN_RPC_URL ?? 'http://127.0.0.1:8545' },
  },
});
