import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import type { NewsletterService } from './newsletter.service';

function asyncHandler(
  handler: (
    request: Parameters<RequestHandler>[0],
    response: Parameters<RequestHandler>[1],
  ) => Promise<void>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response).catch(next);
  };
}

const emailBodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Must be a valid email')
    .max(254, 'Email is too long'),
});

const subscriberIdParamSchema = z.string().uuid('Invalid subscriber ID format');

export function createPublicNewsletterRouter(
  newsletterService: NewsletterService,
): Router {
  const router = Router();

  const publicNewsletterLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Too many newsletter requests from this IP; please try again later',
        ),
      );
    },
  });

  router.post(
    '/subscribe',
    publicNewsletterLimiter,
    asyncHandler(async (request, response) => {
      const parsed = emailBodySchema.parse(request.body);
      const subscriber = await newsletterService.subscribe(parsed.email);
      response
        .status(201)
        .json(
          successResponse('Successfully subscribed to newsletter', subscriber),
        );
    }),
  );

  router.post(
    '/unsubscribe',
    publicNewsletterLimiter,
    asyncHandler(async (request, response) => {
      const parsed = emailBodySchema.parse(request.body);
      await newsletterService.unsubscribe(parsed.email);
      response
        .status(200)
        .json(
          successResponse('Successfully unsubscribed from newsletter', null),
        );
    }),
  );

  return router;
}

export function createAdminNewsletterRouter(
  authService: AdminAuthService,
  newsletterService: NewsletterService,
): Router {
  const router = Router();
  const authenticate = createAdminAuthenticationMiddleware(authService);

  router.use(authenticate);

  router.get(
    '/subscribers',
    requireAdminPermission('newsletter.read'),
    asyncHandler(async (request, response) => {
      const search =
        typeof request.query.search === 'string'
          ? request.query.search
          : undefined;
      const subscribers = await newsletterService.getAll({ search });
      response
        .status(200)
        .json(successResponse('Newsletter subscribers fetched', subscribers));
    }),
  );

  router.get(
    '/subscribers/active',
    requireAdminPermission('newsletter.read'),
    asyncHandler(async (request, response) => {
      const search =
        typeof request.query.search === 'string'
          ? request.query.search
          : undefined;
      const subscribers = await newsletterService.getActive({ search });
      response
        .status(200)
        .json(successResponse('Active subscribers fetched', subscribers));
    }),
  );

  router.delete(
    '/subscribers/:id',
    requireAdminPermission('newsletter.delete'),
    asyncHandler(async (request, response) => {
      const id = subscriberIdParamSchema.parse(request.params.id);
      const adminId = request.adminProfile?.id;
      const result = await newsletterService.remove(id, adminId);
      response.status(200).json(successResponse('Subscriber deleted', result));
    }),
  );

  return router;
}
