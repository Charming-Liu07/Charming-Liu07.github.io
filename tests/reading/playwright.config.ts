import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: '.',
  testMatch: 'reading.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../../test-results/reading',
  use: {
    baseURL: 'http://127.0.0.1:4323',
    ...devices['Desktop Chrome'],
    channel: process.env.CI ? undefined : 'chrome',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    command:
      'node node_modules/astro/bin/astro.mjs preview --outDir .reading-dist --host 127.0.0.1 --port 4323',
    port: 4323,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
