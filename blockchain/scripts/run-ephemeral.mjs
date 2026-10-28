import { spawnSync } from 'node:child_process';
const result = spawnSync(
  process.execPath,
  ['../node_modules/hardhat/dist/src/cli.js', 'run', 'scripts/local-demo.ts'],
  { stdio: 'inherit', env: { ...process.env, CITYPULSE_EPHEMERAL_DEMO: '1' } },
);
process.exitCode = result.status ?? 1;
