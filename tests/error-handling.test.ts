import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createLogger } from '../src/lib/logger';
import { createErrorHandler } from '../src/middleware/error-handler';
import { notFoundHandler } from '../src/middleware/not-found';
import { createRequestLogger } from '../src/middleware/request-logger';
import { validateBody } from '../src/middleware/validate';

const bodySchema = z.object({ value: z.string().min(1) });

function createErrorTestApp() {
  const app = express();
  const logger = createLogger('silent');
  app.use(createRequestLogger(logger));
  app.use(express.json());
  app.post('/validated', validateBody(bodySchema), (_request, response) => {
    response.status(200).json({ success: true });
  });
  app.get('/unexpected', () => {
    throw new Error('internal detail must not be returned');
  });
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}

describe('centralized errors and validation', () => {
  it('returns consistent validation errors without echoing submitted values', async () => {
    const response = await request(createErrorTestApp())
      .post('/validated')
      .send({ value: '' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
    });
    expect(JSON.stringify(response.body)).not.toContain('input');
  });

  it('hides unexpected error details from the response', async () => {
    const response = await request(createErrorTestApp()).get('/unexpected');
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('internal detail');
  });
});
