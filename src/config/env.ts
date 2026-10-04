/**
 * Central place for environment configuration. Every `import.meta.env` read in
 * the app goes through here so defaults and parsing live in one file.
 */

export type DataSource = 'local' | 'api';

function readString(key: string, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function readNumber(key: string, fallback: number): number {
  const parsed = Number(import.meta.env[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const dataSource = readString('VITE_DATA_SOURCE', 'local');

export const env = {
  dataSource: (dataSource === 'api' ? 'api' : 'local') as DataSource,
  apiBaseUrl: readString('VITE_API_BASE_URL', 'http://localhost:4000/api'),
  mockLatencyMs: Math.max(0, readNumber('VITE_MOCK_LATENCY_MS', 250)),
  demoEmail: readString('VITE_DEMO_EMAIL', 'zainab@zainabhenna.example'),
  demoPassword: readString('VITE_DEMO_PASSWORD', 'henna2026'),
  /** Show the demo credentials on the sign-in page. Turn off for public demos. */
  showDemoLogin: readString('VITE_SHOW_DEMO_LOGIN', 'true') !== 'false',
  /** Allow the shared demo account at all. Turn off once an owner account exists. */
  demoLoginEnabled: readString('VITE_ENABLE_DEMO_LOGIN', 'true') !== 'false',
  /** Owner account: hashed email + password from `npm run owner:credential`. Empty = no owner account. */
  ownerCredential: readString('VITE_OWNER_CREDENTIAL', ''),
  ownerName: readString('VITE_OWNER_NAME', 'Owner'),
  businessName: readString('VITE_BUSINESS_NAME', 'Zainab Henna'),
  defaultExchangeRate: readNumber('VITE_DEFAULT_EXCHANGE_RATE', 190),
} as const;
