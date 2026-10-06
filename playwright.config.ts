import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PW_PREVIEW ? 'http://127.0.0.1:4322' : 'http://127.0.0.1:4321',
    ...devices['Desktop Chrome'],
    channel: process.env.CI ? undefined : 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: process.env.PW_PREVIEW
      ? 'npm run preview -- --port 4322'
      : 'npm run dev -- --port 4321',
    port: process.env.PW_PREVIEW ? 4322 : 4321,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
