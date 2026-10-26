import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/external',
  outputDir: 'test-results/external',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/external' }]],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://127.0.0.1:5201',
          localStorage: [{ name: 'enterprise:guide:v1:enterprise-a', value: 'dismissed' }],
        },
      ],
    },
  },
  webServer: [
    {
      command: 'node --import tsx tests/e2e/server.ts --enterprise enterprise-a --port 5201',
      url: 'http://127.0.0.1:5201',
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command:
        'node --import tsx tests/e2e/server.ts --enterprise enterprise-mock-custom --port 5202',
      url: 'http://127.0.0.1:5202',
      timeout: 120000,
      reuseExistingServer: false,
    },
  ],
});
