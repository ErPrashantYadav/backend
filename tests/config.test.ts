import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env';
import { startServer } from '../src/server';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL:
    'postgresql://user:password@localhost:5432/liquor_shop_test?schema=public',
  CORS_ORIGINS: 'http://localhost:5173',
  JWT_SECRET: Buffer.alloc(32, 2).toString('base64url'),
  JWT_ISSUER: 'https://liquor-shop.test',
  JWT_AUDIENCE: 'liquor-shop-admin-api-test',
  JWT_ACCESS_TOKEN_TTL_SECONDS: '900',
};

describe('loadConfig', () => {
  it('accepts valid test configuration', () => {
    expect(loadConfig(validEnvironment)).toMatchObject({
      NODE_ENV: 'test',
      PORT: 3000,
      CORS_ORIGINS: ['http://localhost:5173'],
    });
  });

  it('rejects missing required settings and invalid values without echoing secrets', () => {
    expect(() =>
      loadConfig({
        ...validEnvironment,
        DATABASE_URL: undefined,
        PORT: '70000',
      }),
    ).toThrow(/Invalid environment configuration/);
    expect(() =>
      loadConfig({
        ...validEnvironment,
        CORS_ORIGINS: 'https://example.com/path',
      }),
    ).toThrow(/CORS origin must be an exact HTTP\(S\) origin/);
  });

  it('requires a strong JWT key and exactly fifteen-minute access tokens', () => {
    expect(() =>
      loadConfig({ ...validEnvironment, JWT_SECRET: 'too-short' }),
    ).toThrow(/JWT_SECRET/);
    expect(() =>
      loadConfig({ ...validEnvironment, JWT_ACCESS_TOKEN_TTL_SECONDS: '901' }),
    ).toThrow(/JWT_ACCESS_TOKEN_TTL_SECONDS/);

    const missingAudience = { ...validEnvironment } as Record<
      string,
      string | undefined
    >;
    delete missingAudience.JWT_AUDIENCE;
    expect(() => loadConfig(missingAudience)).toThrow(/JWT_AUDIENCE/);
  });

  it('refuses to start the server when required configuration is missing', () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      expect(() => startServer()).toThrow(/DATABASE_URL/);
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('validates Google Maps and delivery fee configuration defaults and bounds', () => {
    const config = loadConfig(validEnvironment);
    expect(config.STORE_ORIGIN_LATITUDE).toBe(27.7172);
    expect(config.STORE_ORIGIN_LONGITUDE).toBe(85.324);
    expect(config.DELIVERY_FEE_MODE).toBe('PER_KM');
    expect(config.DELIVERY_FEE_BASE_AMOUNT).toBe(100);
    expect(config.DELIVERY_FEE_PER_KM_AMOUNT).toBe(25);
    expect(config.DELIVERY_MAX_DISTANCE_KM).toBe(25);
    expect(config.DELIVERY_FALLBACK_AMOUNT).toBe(0);

    // Rejects invalid delivery fee mode
    expect(() =>
      loadConfig({
        ...validEnvironment,
        DELIVERY_FEE_MODE: 'HOURLY',
      }),
    ).toThrow(/DELIVERY_FEE_MODE/);

    // Rejects out of range latitude / longitude
    expect(() =>
      loadConfig({
        ...validEnvironment,
        STORE_ORIGIN_LATITUDE: '95',
      }),
    ).toThrow(/STORE_ORIGIN_LATITUDE/);

    expect(() =>
      loadConfig({
        ...validEnvironment,
        STORE_ORIGIN_LONGITUDE: '-190',
      }),
    ).toThrow(/STORE_ORIGIN_LONGITUDE/);
  });
});
