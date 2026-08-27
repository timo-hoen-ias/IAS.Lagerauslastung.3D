import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['--watch', 'src/server/index.ts'], { stdio: 'inherit' }),
  spawn('node_modules/.bin/vite.exe', [], { stdio: 'inherit' }),
];

const shutdown = () => {
  for (const child of children) child.kill();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
