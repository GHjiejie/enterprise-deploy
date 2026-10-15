import { randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.CONSOLE_E2E_PORT ?? 5187);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('CONSOLE_E2E_PORT 必须是 1–65535 的整数');
}
const origin = `http://127.0.0.1:${port}`;
// Workers inherit these paths, so only the coordinator creates the isolated store.
if (!process.env.CONSOLE_E2E_DIRECTORY) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'enterprise-console-e2e-')));
  const profiles = join(directory, 'profiles');
  mkdirSync(profiles);
  cpSync(join(rootDir, 'config/profiles'), profiles, { recursive: true });
  process.env.CONSOLE_E2E_DIRECTORY = directory;
  process.env.CONSOLE_E2E_PROFILE_ID = `e2e-console-${randomBytes(6).toString('hex')}`;
}

export default defineConfig({
  testDir: './tests/console',
  testMatch: 'browser.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 180_000,
  globalTeardown: './tests/console/teardown.ts',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/console', open: 'never' }]],
  use: {
    baseURL: origin,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: 'npm run configure',
    cwd: rootDir,
    url: origin,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      CONSOLE_PORT: String(port),
      APP_PROFILES_DIR: join(process.env.CONSOLE_E2E_DIRECTORY, 'profiles'),
    },
  },
});
