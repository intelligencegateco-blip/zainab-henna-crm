import { env } from '../config/env';
import { createSeedData } from '../data/seed';
import { now } from '../lib/format';
import { HttpAuthApi, LocalAuthApi, type AuthApi } from './authApi';
import { CrmService } from './crmService';
import { HttpRepository } from './httpRepository';
import { LocalRepository } from './localRepository';
import type { CrmRepository } from './repository';

function createRepository(): CrmRepository {
  if (env.dataSource === 'api') {
    return new HttpRepository(env.apiBaseUrl);
  }
  return new LocalRepository({
    latencyMs: env.mockLatencyMs,
    seed: () => createSeedData(now(), { exchangeRate: env.defaultExchangeRate, businessName: env.businessName }),
  });
}

export const crmService = new CrmService(createRepository());

export const authApi: AuthApi = env.dataSource === 'api' ? new HttpAuthApi(env.apiBaseUrl) : new LocalAuthApi();

export { CrmService } from './crmService';
export type { CrmRepository } from './repository';
