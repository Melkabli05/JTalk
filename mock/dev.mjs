// `pnpm start:mock`: the mock API plus `ng serve`, with /api proxied to the mock.
// Extra arguments go to ng serve, e.g. `pnpm start:mock --port 4300`.
import { spawn } from 'node:child_process';
import { optionsFromEnv, startMockApi } from './server.mjs';

const server = await startMockApi(optionsFromEnv());
const ng = spawn(
  'pnpm',
  ['exec', 'ng', 'serve', '--proxy-config', 'mock/proxy.conf.json', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  },
);
const stop = () => {
  ng.kill();
  server.close();
};
ng.on('exit', (code) => {
  server.close();
  process.exit(code ?? 0);
});
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
// Never leave the dev server behind if this process is killed.
process.on('exit', () => ng.kill());
