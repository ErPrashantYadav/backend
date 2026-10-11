import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { AppConfig } from '../../config/env';
import { AppError } from '../../errors/app-error';
import { PrismaAdminAuthRepository } from './auth.repository';
import type { AdminAuthRepository } from './auth.types';
import { AdminAuthService } from './auth.service';
import { createAdminAuthenticationMiddleware } from '../../middleware/admin-auth';
import { validateBody } from '../../middleware/validate';
import { z } from 'zod';
import { successResponse } from '../../utils/response';

const loginBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
    password: z.string().min(1).max(1024),
  })
  .strict();

export function createAdminAuthRouter(
  config: AppConfig,
  repository: AdminAuthRepository = new PrismaAdminAuthRepository(),
  existingAuthService?: AdminAuthService,
): Router {
  const router = Router();
  const authService =
    existingAuthService ?? new AdminAuthService(config, repository);
  const authenticate = createAdminAuthenticationMiddleware(authService);
  const loginLimiter = rateLimit({
    windowMs: config.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: config.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Too many login attempts; try again later',
        ),
      );
    },
  });

  router.post(
    '/login',
    loginLimiter,
    validateBody(loginBodySchema),
    async (request, response, next) => {
      try {
        const result = await authService.login(
          request.body.email,
          request.body.password,
        );
        response.status(200).json(successResponse('Login successful', result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get('/me', authenticate, (request, response) => {
    response
      .status(200)
      .json(successResponse('Admin profile fetched', request.adminProfile));
  });

  return router;
}
