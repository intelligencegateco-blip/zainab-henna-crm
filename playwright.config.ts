import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests for the main CRM workflows.
 * Uses the installed Google Chrome (channel: 'chrome'), so no browser
 * download is needed. Each test starts with fresh demo data.
 */
const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    env: { ...baseEnv, VITE_MOCK_LATENCY_MS: '30' },
  },
});
