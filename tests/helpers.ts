import type { AppConfig } from '../src/config/env';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL:
      'postgresql://user:password@localhost:5432/liquor_shop_test?schema=public',
    CORS_ORIGINS: ['http://localhost:5173'],
    LOG_LEVEL: 'silent',
    TRUST_PROXY_HOPS: 0,
    REQUEST_BODY_LIMIT: '1mb',
    RATE_LIMIT_WINDOW_MS: 60_000,
    RATE_LIMIT_MAX_REQUESTS: 120,
    ...overrides,
  };
}
