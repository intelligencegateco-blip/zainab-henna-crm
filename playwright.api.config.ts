import { defineConfig } from '@playwright/test';

/**
 * Full-stack end-to-end tests: the real PHP API (fresh SQLite database) behind
 * the Vite dev server in API mode. Needs PHP 8.1+ with pdo_sqlite
 * (set PHP_BIN if `php` is not on your PATH).
 */
const php = process.env.PHP_BIN ?? 'php';
const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>;
const sqlite = `${process.cwd()}/.tmp/e2e-api.sqlite`;

export default defineConfig({
  // Role tests, then the standard workflow suite in API mode.
  testDir: './tests',
  testMatch: ['e2e-api/**/*.spec.ts', 'e2e/workflows.spec.ts'],
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/e2e-api/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5175',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `${php} -S 127.0.0.1:8098 api/index.php`,
      url: 'http://127.0.0.1:8098/api/health',
      reuseExistingServer: false,
      env: { ...baseEnv, ZCRM_CONFIG: `${process.cwd()}/tests/api/config.test.php`, ZCRM_SQLITE: sqlite },
    },
    {
      command: 'npx vite --port 5175 --strictPort',
      url: 'http://localhost:5175',
      reuseExistingServer: false,
      env: { ...baseEnv, VITE_MOCK_LATENCY_MS: '0', VITE_DATA_SOURCE: 'api', VITE_API_BASE_URL: '/api', API_PROXY_TARGET: 'http://127.0.0.1:8098' },
    },
  ],
});
