import { defineConfig } from '@playwright/test';
import { fixture } from './tests/helpers/fixture';

const root = process.env.CONSOLE_E2E_ROOT ?? fixture().root;
process.env.CONSOLE_E2E_ROOT = root;

export default defineConfig({
  testDir: './tests/console',
  outputDir: 'test-results/console',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/console' }]],
  use: {
    baseURL: 'http://127.0.0.1:5194',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://127.0.0.1:5194',
          localStorage: [{ name: 'enterprise:guide:v1:build-console', value: 'dismissed' }],
        },
      ],
    },
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node --import tsx tests/console/server.ts',
    url: 'http://127.0.0.1:5194',
    timeout: 120000,
    reuseExistingServer: false,
    env: { CONSOLE_E2E_ROOT: root },
  },
});
