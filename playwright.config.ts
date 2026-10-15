import { defineConfig } from '@playwright/test';
import { loadBuildProfile } from './build/load-profile.ts';
import { parseBuildMode } from './shared/build-profile.ts';

const profile = loadBuildProfile(process.env.APP_PROFILE);
const mode = parseBuildMode(process.env.APP_MODE ?? 'production');
const port = Number(process.env.DELIVERY_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DELIVERY_PORT 无效');
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/delivery',
  testMatch: 'browser.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: origin, browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: `npm run preview -- --mode ${mode} --port ${port}`,
    url: origin,
    reuseExistingServer: false,
    env: { APP_PROFILE: profile.id },
  },
});
