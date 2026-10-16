import { rmSync } from 'node:fs';
import { createBuildConsole } from '../../build/console/server';

const root = process.env.CONSOLE_E2E_ROOT;
if (!root) throw new Error('Missing isolated console test root');
const app = await createBuildConsole({ root, port: 5194 });
console.log(`隔离控制台测试：${app.origin}`);
let stopping = false;
const stop = (): void => {
  if (stopping) return;
  stopping = true;
  void app.close().finally(() => {
    rmSync(root, { recursive: true, force: true });
    process.exit(0);
  });
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
