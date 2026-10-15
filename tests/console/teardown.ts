import { realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default function teardown(): void {
  const directory = process.env.CONSOLE_E2E_DIRECTORY;
  const expectedPrefix = join(realpathSync(tmpdir()), 'enterprise-console-e2e-');
  if (directory?.startsWith(expectedPrefix)) rmSync(directory, { recursive: true, force: true });
}
