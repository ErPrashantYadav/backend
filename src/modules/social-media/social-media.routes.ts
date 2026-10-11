import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import type { SocialMediaService } from './social-media.service';

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

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  platform: z.string().trim().optional(),
  type: z.enum(['video', 'profile']).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sortBy: z.enum(['displayOrder', 'createdAt', 'platform', 'label']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const createItemSchema = z.object({
  platform: z.string().trim().min(1, 'Platform is required').max(50),
  url: z.string().trim().url('Must be a valid URL'),
  type: z.enum(['video', 'profile']).default('video'),
  label: z.string().trim().max(180).optional().nullable(),
  thumbnailUrl: z.string().trim().url().optional().nullable(),
  publicId: z.string().trim().max(255).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const createBatchSchema = z.union([
  z.object({
    entries: z.array(createItemSchema).min(1, 'At least one entry is required'),
  }),
  z.array(createItemSchema).min(1, 'At least one entry is required'),
]);

const updateItemSchema = z.object({
  platform: z.string().trim().min(1).max(50).optional(),
  url: z.string().trim().url('Must be a valid URL').optional(),
  type: z.enum(['video', 'profile']).optional(),
  label: z.string().trim().max(180).optional().nullable(),
  thumbnailUrl: z.string().trim().url().optional().nullable(),
  publicId: z.string().trim().max(255).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

export function createPublicSocialMediaRouter(
  socialMediaService: SocialMediaService,
): Router {
  const router = Router();

  const handleListActive: RequestHandler = asyncHandler(
    async (request, response) => {
      const type =
        typeof request.query.type === 'string' ? request.query.type : undefined;
      const platform =
        typeof request.query.platform === 'string'
          ? request.query.platform
          : undefined;

      const items = await socialMediaService.listActive(type, platform);
      response
        .status(200)
        .json(successResponse('Active social media entries fetched', items));
    },
  );

  router.get('/', handleListActive);
  router.get('/active', handleListActive);

  router.get(
    '/profiles',
    asyncHandler(async (_request, response) => {
      const grouped = await socialMediaService.getProfileLinksGrouped();
      response
        .status(200)
        .json(successResponse('Profile links fetched', grouped));
    }),
  );

  return router;
}

export function createPublicSocialMediaLinkRouter(
  socialMediaService: SocialMediaService,
): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      const grouped = await socialMediaService.getProfileLinksGrouped();
      response
        .status(200)
        .json(successResponse('Profile links fetched', grouped));
    }),
  );

  router.get(
    '/active',
    asyncHandler(async (_request, response) => {
      const items = await socialMediaService.listActive('profile');
      response
        .status(200)
        .json(successResponse('Active profile links fetched', items));
    }),
  );

  router.get(
    '/all',
    asyncHandler(async (_request, response) => {
      const items = await socialMediaService.listActive('profile');
      response
        .status(200)
        .json(successResponse('All profile links fetched', items));
    }),
  );

  return router;
}

export function createAdminSocialMediaRouter(
  authService: AdminAuthService,
  socialMediaService: SocialMediaService,
): Router {
  const router = Router();

  router.use(createAdminAuthenticationMiddleware(authService));

  router.get(
    '/',
    requireAdminPermission('social-media.read'),
    asyncHandler(async (request, response) => {
      const parsedQuery = listQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid query parameters',
          parsedQuery.error.format(),
        );
      }

      const result = await socialMediaService.listAdmin(parsedQuery.data);
      response
        .status(200)
        .json(successResponse('Social media entries fetched', result));
    }),
  );

  router.post(
    '/batch',
    requireAdminPermission('social-media.create'),
    asyncHandler(async (request, response) => {
      const parsed = createBatchSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid batch entries data',
          parsed.error.format(),
        );
      }

      const entries = Array.isArray(parsed.data)
        ? parsed.data
        : parsed.data.entries;

      const adminId = request.adminProfile?.id;
      const created = await socialMediaService.createMany(entries, adminId);

      response
        .status(201)
        .json(successResponse('Social media entries created', created));
    }),
  );

  router.get(
    '/:id',
    requireAdminPermission('social-media.read'),
    asyncHandler(async (request, response) => {
      const id = request.params.id as string;
      const item = await socialMediaService.getById(id);
      response
        .status(200)
        .json(successResponse('Social media entry fetched', item));
    }),
  );

  router.post(
    '/',
    requireAdminPermission('social-media.create'),
    asyncHandler(async (request, response) => {
      const parsedBody = createItemSchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid social media data',
          parsedBody.error.format(),
        );
      }

      const adminId = request.adminProfile?.id;
      const item = await socialMediaService.create(parsedBody.data, adminId);

      response
        .status(201)
        .json(successResponse('Social media entry created', item));
    }),
  );

  router.patch(
    '/:id/status',
    requireAdminPermission('social-media.update'),
    asyncHandler(async (request, response) => {
      const id = request.params.id as string;
      const parsedBody = updateStatusSchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'isActive boolean is required',
          parsedBody.error.format(),
        );
      }

      const adminId = request.adminProfile?.id;
      const item = await socialMediaService.updateStatus(
        id,
        parsedBody.data.isActive,
        adminId,
      );

      response
        .status(200)
        .json(successResponse('Social media status updated', item));
    }),
  );

  const handleUpdateItem: RequestHandler = asyncHandler(
    async (request, response) => {
      const id = request.params.id as string;
      const parsedBody = updateItemSchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid update data',
          parsedBody.error.format(),
        );
      }

      const adminId = request.adminProfile?.id;
      const item = await socialMediaService.update(
        id,
        parsedBody.data,
        adminId,
      );

      response
        .status(200)
        .json(successResponse('Social media entry updated', item));
    },
  );

  router.put(
    '/:id',
    requireAdminPermission('social-media.update'),
    handleUpdateItem,
  );
  router.patch(
    '/:id',
    requireAdminPermission('social-media.update'),
    handleUpdateItem,
  );

  router.delete(
    '/:id',
    requireAdminPermission('social-media.delete'),
    asyncHandler(async (request, response) => {
      const id = request.params.id as string;
      const adminId = request.adminProfile?.id;
      await socialMediaService.delete(id, adminId);

      response
        .status(200)
        .json(successResponse('Social media entry deleted', { id }));
    }),
  );

  return router;
}
