import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env';
import { startServer } from '../src/server';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL:
    'postgresql://user:password@localhost:5432/liquor_shop_test?schema=public',
  CORS_ORIGINS: 'http://localhost:5173',
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
});
