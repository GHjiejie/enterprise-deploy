import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node --import tsx tests/e2e/server.ts --enterprise enterprise-a --port 5191',
      url: 'http://127.0.0.1:5191',
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command: 'node --import tsx tests/e2e/server.ts --enterprise enterprise-b --port 5192',
      url: 'http://127.0.0.1:5192',
      timeout: 120000,
      reuseExistingServer: false,
    },
  ],
});
