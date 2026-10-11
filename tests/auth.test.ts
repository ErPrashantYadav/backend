import argon2 from 'argon2';
import express from 'express';
import jwt, { type Algorithm, type SignOptions } from 'jsonwebtoken';
import pino from 'pino';
import { Writable } from 'node:stream';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { testConfig } from './helpers';
import type { AppConfig } from '../src/config/env';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../src/middleware/admin-auth';
import { AdminAuthService } from '../src/modules/auth/auth.service';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type {
  AdminAuthRecord,
  AdminAuthRepository,
} from '../src/modules/auth/auth.types';
import { createLogger } from '../src/lib/logger';
import { createErrorHandler } from '../src/middleware/error-handler';

const ADMIN_ID = '4df5b3d4-f419-4c73-9d63-63ea6ad01533';
const ROLE_ID = '266f8b14-6415-40a5-8114-9ae0f7464494';
const ADMIN_EMAIL = 'admin@example.test';
const ADMIN_PASSWORD = 'Fixture-Password-Only-123!';

let passwordHash: string;

interface TestAccountState {
  record: AdminAuthRecord;
  findByEmailCalls: string[];
  repository: AdminAuthRepository;
}

function testAccount(
  overrides: {
    active?: boolean;
    roleActive?: boolean;
    permissions?: string[];
  } = {},
): TestAccountState {
  const record: AdminAuthRecord = {
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    name: 'Test Admin',
    passwordHash,
    isActive: overrides.active ?? true,
    role: {
      id: ROLE_ID,
      name: 'Administrator',
      isActive: overrides.roleActive ?? true,
      permissions: overrides.permissions ?? ['catalog.read'],
    },
  };
  const findByEmailCalls: string[] = [];
  const repository: AdminAuthRepository = {
    async findByEmail(email) {
      findByEmailCalls.push(email);
      return email === record.email ? record : null;
    },
    async findById(id) {
      return id === record.id ? record : null;
    },
  };
  return { record, findByEmailCalls, repository };
}

interface TestServer {
  baseUrl: string;
  server: Server;
  account: TestAccountState;
  config: AppConfig;
  close: () => Promise<void>;
}

async function startTestServer(
  options: {
    active?: boolean;
    roleActive?: boolean;
    permissions?: string[];
    loginLimit?: number;
    logger?: pino.Logger;
  } = {},
): Promise<TestServer> {
  const account = testAccount(options);
  const config = testConfig({
    AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS: options.loginLimit ?? 20,
  });
  const app = createApp(config, async () => {}, {
    adminAuthRepository: account.repository,
    logger: options.logger ?? createLogger('silent'),
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected an internet socket address');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
    account,
    config,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function withTestServer<T>(
  callback: (context: TestServer) => Promise<T>,
  options: Parameters<typeof startTestServer>[0] = {},
): Promise<T> {
  const context = await startTestServer(options);
  try {
    return await callback(context);
  } finally {
    await context.close();
  }
}

function signedToken(
  config: AppConfig,
  overrides: {
    algorithm?: Algorithm;
    issuer?: string;
    audience?: string;
    payload?: Record<string, unknown>;
    subject?: string;
    jwtid?: string;
    expiresIn?: number;
    noTimestamp?: boolean;
  } = {},
): string {
  const key = Buffer.from(config.JWT_SECRET, 'base64url');
  const options: SignOptions = {
    algorithm: overrides.algorithm ?? 'HS256',
    issuer: overrides.issuer ?? config.JWT_ISSUER,
    audience: overrides.audience ?? config.JWT_AUDIENCE,
    subject: overrides.subject ?? ADMIN_ID,
  };
  if (overrides.jwtid !== undefined) options.jwtid = overrides.jwtid;
  if (overrides.expiresIn !== undefined)
    options.expiresIn = overrides.expiresIn;
  if (overrides.noTimestamp !== undefined)
    options.noTimestamp = overrides.noTimestamp;

  return jwt.sign(
    { tokenUse: 'admin_access', ...(overrides.payload ?? {}) },
    key,
    options,
  );
}

async function login(
  baseUrl: string,
  body: unknown = {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  },
) {
  return fetch(`${baseUrl}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('admin authentication', () => {
  beforeAll(async () => {
    passwordHash = await argon2.hash(ADMIN_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  });

  afterAll(() => {
    passwordHash = '';
  });

  it('logs in with normalized email and issues a valid 15-minute token', async () => {
    await withTestServer(async ({ baseUrl, account, config }) => {
      const response = await login(baseUrl, {
        email: '  ADMIN@EXAMPLE.TEST  ',
        password: ADMIN_PASSWORD,
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(account.findByEmailCalls).toEqual([ADMIN_EMAIL]);
      expect(body.data.admin).toMatchObject({
        id: ADMIN_ID,
        email: ADMIN_EMAIL,
        role: { id: ROLE_ID, name: 'Administrator' },
        permissions: ['catalog.read'],
      });
      expect(body.data).not.toHaveProperty('admin.passwordHash');
      expect(body.data.admin).not.toHaveProperty('passwordHash');
      expect(body.data.expiresIn).toBe(900);

      const payload = jwt.verify(
        body.data.accessToken,
        Buffer.from(config.JWT_SECRET, 'base64url'),
        {
          algorithms: ['HS256'],
          issuer: config.JWT_ISSUER,
          audience: config.JWT_AUDIENCE,
        },
      ) as jwt.JwtPayload & { tokenUse: string };
      expect(payload.sub).toBe(ADMIN_ID);
      expect(payload.tokenUse).toBe('admin_access');
      expect(payload.exp! - payload.iat!).toBe(900);
      expect(payload).not.toHaveProperty('permissions');
      expect(payload).not.toHaveProperty('role');
    });
  });

  it('returns the same generic 401 for unknown email and wrong password', async () => {
    await withTestServer(async ({ baseUrl, account }) => {
      const unknown = await login(baseUrl, {
        email: 'missing@example.test',
        password: ADMIN_PASSWORD,
      });
      const wrongPassword = await login(baseUrl, {
        email: ADMIN_EMAIL,
        password: 'incorrect-password',
      });
      const unknownBody = await unknown.json();
      const wrongPasswordBody = await wrongPassword.json();

      expect(unknown.status).toBe(401);
      expect(wrongPassword.status).toBe(401);
      expect(unknownBody.error).toEqual(wrongPasswordBody.error);
      expect(unknownBody.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      expect(account.findByEmailCalls).toEqual([
        'missing@example.test',
        ADMIN_EMAIL,
      ]);
    });
  });

  it('rejects inactive admins and inactive roles with generic login errors', async () => {
    await withTestServer(
      async ({ baseUrl }) => {
        const response = await login(baseUrl);
        expect(response.status).toBe(401);
        expect((await response.json()).error).toMatchObject({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        });
      },
      { active: false },
    );

    await withTestServer(
      async ({ baseUrl }) => {
        const response = await login(baseUrl);
        expect(response.status).toBe(401);
        expect((await response.json()).error).toMatchObject({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        });
      },
      { roleActive: false },
    );
  });

  it('rejects missing, malformed, and tampered bearer tokens', async () => {
    await withTestServer(async ({ baseUrl, config }) => {
      const token = createAdminAccessToken(config, ADMIN_ID);
      const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
      for (const authorization of [
        undefined,
        'Bearer not-a-jwt',
        `Bearer ${tampered}`,
      ]) {
        const response = await fetch(`${baseUrl}/api/admin/auth/me`, {
          headers: authorization ? { authorization } : {},
        });
        expect(response.status).toBe(401);
        expect((await response.json()).error.code).toBe('UNAUTHORIZED');
      }
    });
  });

  it.each([
    ['expired', { expiresIn: -1 }],
    ['wrong issuer', { issuer: 'https://other.example.test' }],
    ['wrong audience', { audience: 'other-api' }],
    ['wrong algorithm', { algorithm: 'HS384' as const }],
    ['missing token id', { jwtid: undefined }],
    ['wrong subject type', { subject: 'not-a-uuid' }],
    ['wrong token type', { payload: { tokenUse: 'customer_access' } }],
  ])('rejects a token with %s', async (_name, overrides) => {
    await withTestServer(async ({ baseUrl, config }) => {
      const token = signedToken(config, overrides);
      const response = await fetch(`${baseUrl}/api/admin/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe('UNAUTHORIZED');
    });
  });

  it('rejects tokens missing required expiration claims', async () => {
    await withTestServer(async ({ baseUrl, config }) => {
      const token = signedToken(config, { noTimestamp: true });
      const response = await fetch(`${baseUrl}/api/admin/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(401);
    });
  });

  it('reloads account and role status for previously issued tokens', async () => {
    await withTestServer(async ({ baseUrl, config, account }) => {
      const token = createAdminAccessToken(config, ADMIN_ID);
      account.record.isActive = false;
      const response = await fetch(`${baseUrl}/api/admin/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(401);
    });

    await withTestServer(async ({ baseUrl, config, account }) => {
      const token = createAdminAccessToken(config, ADMIN_ID);
      account.record.role.isActive = false;
      const response = await fetch(`${baseUrl}/api/admin/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(401);
    });
  });

  it('returns current profile and permissions and enforces permission middleware', async () => {
    await withTestServer(async ({ baseUrl, config }) => {
      const token = createAdminAccessToken(config, ADMIN_ID);
      const response = await fetch(`${baseUrl}/api/admin/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        success: true,
        data: {
          id: ADMIN_ID,
          role: { id: ROLE_ID, name: 'Administrator' },
          permissions: ['catalog.read'],
        },
      });
    });

    for (const permissions of [[], ['catalog.read']]) {
      const account = testAccount({ permissions });
      const config = testConfig();
      const service = new AdminAuthService(config, account.repository);
      const app = express();
      app.get(
        '/protected',
        createAdminAuthenticationMiddleware(service),
        requireAdminPermission('orders.read'),
        (_request, response) => response.json({ success: true }),
      );
      app.use(createErrorHandler(createLogger('silent')));
      const server = app.listen(0);
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('Expected socket address');
      try {
        const token = createAdminAccessToken(config, ADMIN_ID);
        const response = await fetch(
          `http://127.0.0.1:${address.port}/protected`,
          {
            headers: { authorization: `Bearer ${token}` },
          },
        );
        if (permissions.includes('orders.read')) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(403);
          expect((await response.json()).error.code).toBe('FORBIDDEN');
        }
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    }
  });

  it('rejects invalid login payloads', async () => {
    await withTestServer(async ({ baseUrl }) => {
      for (const body of [
        { email: 'not-an-email', password: ADMIN_PASSWORD },
        { email: ADMIN_EMAIL, password: '' },
        { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, extra: true },
      ]) {
        const response = await login(baseUrl, body);
        expect(response.status).toBe(400);
        expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  it('rate limits login attempts more strictly than general API traffic', async () => {
    await withTestServer(
      async ({ baseUrl }) => {
        expect(
          (
            await login(baseUrl, {
              email: 'nobody@example.test',
              password: 'bad',
            })
          ).status,
        ).toBe(401);
        const limited = await login(baseUrl, {
          email: 'nobody@example.test',
          password: 'bad',
        });
        expect(limited.status).toBe(429);
        expect((await limited.json()).error.code).toBe('RATE_LIMITED');
      },
      { loginLimit: 1 },
    );
  });

  it('does not include passwords or bearer tokens in request logs', async () => {
    let logOutput = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logOutput += chunk.toString();
        callback();
      },
    });
    const logger = pino({ level: 'info' }, stream);

    await withTestServer(
      async ({ baseUrl }) => {
        const loginResponse = await login(baseUrl);
        const token = (await loginResponse.json()).data.accessToken as string;
        await fetch(`${baseUrl}/api/admin/auth/me`, {
          headers: { authorization: `Bearer ${token}` },
        });
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(logOutput).not.toContain(ADMIN_PASSWORD);
        expect(logOutput).not.toContain(token);
        expect(logOutput).not.toContain('passwordHash');
      },
      { logger },
    );
  });
});
