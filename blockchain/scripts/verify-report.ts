import fs from 'node:fs/promises';
import { JsonRpcProvider, Contract, sha256 } from 'ethers';

const file = process.env.REPORT_FILE ?? '../.data/blockchain/sample-report.csv';
const manifest = JSON.parse(
  await fs.readFile(
    process.env.DEPLOYMENT_FILE ?? '../.data/blockchain/local-demo-result.json',
    'utf8',
  ),
);
if (manifest.ephemeral)
  throw new Error(
    'This receipt came from an ended in-process chain. Run demo:local against a persistent local node for later independent RPC verification.',
  );
const provider = new JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL ?? manifest.rpc);
const network = await provider.getNetwork();
if (network.chainId !== BigInt(manifest.chainId))
  throw new Error('Network mismatch; refusing verification.');
if ((await provider.getCode(manifest.contracts.VerificationRecord)) === '0x')
  throw new Error('No verifier code at the recorded address. Local chain may have restarted.');
const verifier = new Contract(
  manifest.contracts.VerificationRecord,
  [
    'function verify(bytes32,bytes32) view returns(bool valid,address submitter,uint64 timestamp,uint8 kind)',
  ],
  provider,
);
const hash = sha256(await fs.readFile(file));
const proof = await verifier.verify(manifest.attestationId, hash);
console.log(
  JSON.stringify(
    {
      file,
      contentHash: hash,
      chainId: manifest.chainId,
      contractVersion: manifest.contractVersion,
      valid: proof.valid,
      submitter: proof.submitter,
      timestamp: proof.timestamp.toString(),
      kind: Number(proof.kind),
    },
    null,
    2,
  ),
);
if (!proof.valid) process.exitCode = 1;
