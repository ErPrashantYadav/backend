import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { AppConfig } from './config/env';
import { AppError } from './errors/app-error';
import { createLogger } from './lib/logger';
import { checkDatabaseConnection } from './lib/prisma';
import { createErrorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { createRequestLogger } from './middleware/request-logger';
import { successResponse } from './utils/response';

export type DatabaseReadinessCheck = () => Promise<void>;

export function createApp(
  config: AppConfig,
  databaseReadinessCheck: DatabaseReadinessCheck = checkDatabaseConnection,
): Express {
  const app = express();
  const logger = createLogger(config.LOG_LEVEL);

  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(createRequestLogger(logger));
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(
          new AppError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed'),
        );
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: config.REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.get('/api/health/live', (_request, response) => {
    response
      .status(200)
      .json(successResponse('Service is alive', { status: 'ok' }));
  });

  app.get('/api/health/ready', async (_request, response, next) => {
    try {
      await databaseReadinessCheck();
      response.status(200).json(
        successResponse('Service is ready', {
          status: 'ready',
          database: 'connected',
        }),
      );
    } catch (error) {
      logger.error(
        { errorName: error instanceof Error ? error.name : 'UnknownError' },
        'Database readiness probe failed',
      );
      next(
        new AppError(503, 'DATABASE_UNAVAILABLE', 'Database is not available'),
      );
    }
  });

  const apiLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(
        new AppError(429, 'RATE_LIMITED', 'Too many requests; try again later'),
      );
    },
  });

  app.use('/api', apiLimiter);
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
