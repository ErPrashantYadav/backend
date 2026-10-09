import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import { testConfig } from './helpers';

describe('application foundation', () => {
  let server: Server;
  let baseUrl: string;
  let databaseAvailable = true;

  beforeAll(async () => {
    const app = createApp(testConfig(), async () => {
      if (!databaseAvailable) throw new Error('Database probe failed');
    });
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Expected an internet socket address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('starts with valid test configuration and serves liveness', async () => {
    const response = await fetch(`${baseUrl}/api/health/live`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      message: 'Service is alive',
      data: { status: 'ok' },
    });
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('reports readiness from the actual database probe result', async () => {
    const availableResponse = await fetch(`${baseUrl}/api/health/ready`);
    expect(availableResponse.status).toBe(200);
    expect(await availableResponse.json()).toMatchObject({
      success: true,
      data: { status: 'ready', database: 'connected' },
    });

    databaseAvailable = false;
    const unavailableResponse = await fetch(`${baseUrl}/api/health/ready`);
    expect(unavailableResponse.status).toBe(503);
    expect(await unavailableResponse.json()).toMatchObject({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is not available',
      },
    });
  });

  it('returns a standard error response for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/api/not-a-route?private=value`);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('allows only configured browser origins', async () => {
    const allowed = await fetch(`${baseUrl}/api/health/live`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173',
    );

    const denied = await fetch(`${baseUrl}/api/health/live`, {
      headers: { Origin: 'https://not-allowed.example' },
    });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({
      success: false,
      error: { code: 'CORS_ORIGIN_DENIED' },
    });
  });
});
