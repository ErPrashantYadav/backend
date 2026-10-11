import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import type { BannerService } from './banners.service';

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
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sortBy: z.enum(['displayOrder', 'createdAt', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const createBannerSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(180, 'Title must not exceed 180 characters'),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().min(1, 'Image URL is required'),
  publicId: z.string().trim().max(255).optional().nullable(),
  linkUrl: z.string().trim().max(2048).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const updateBannerSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(180, 'Title must not exceed 180 characters')
    .optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().min(1, 'Image URL is required').optional(),
  publicId: z.string().trim().max(255).optional().nullable(),
  linkUrl: z.string().trim().max(2048).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

const reorderSchema = z.union([
  z.object({
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          displayOrder: z.coerce.number().int().min(0),
        }),
      )
      .min(1, 'At least one item is required'),
  }),
  z
    .array(
      z.object({
        id: z.string().uuid(),
        displayOrder: z.coerce.number().int().min(0),
      }),
    )
    .min(1, 'At least one item is required'),
]);

export function createPublicBannerRouter(bannerService: BannerService): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      const banners = await bannerService.listActive();
      response
        .status(200)
        .json(
          successResponse('Active banners retrieved successfully', banners),
        );
    }),
  );

  return router;
}

export function createAdminBannerRouter(
  authService: AdminAuthService,
  bannerService: BannerService,
): Router {
  const router = Router();
  const authenticate = createAdminAuthenticationMiddleware(authService);

  router.use(authenticate);

  router.get(
    '/',
    requireAdminPermission('banners.read'),
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

      const result = await bannerService.listAdmin(parsedQuery.data);
      response
        .status(200)
        .json(successResponse('Banners retrieved successfully', result));
    }),
  );

  router.put(
    '/reorder',
    requireAdminPermission('banners.update'),
    asyncHandler(async (request, response) => {
      const parsed = reorderSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid reorder payload',
          parsed.error.format(),
        );
      }
      const items = Array.isArray(parsed.data)
        ? parsed.data
        : parsed.data.items;
      const adminId = request.adminProfile?.id;
      await bannerService.reorder(items, adminId);
      response.status(200).json(
        successResponse('Banners reordered successfully', {
          reordered: true,
        }),
      );
    }),
  );

  router.get(
    '/:id',

    requireAdminPermission('banners.read'),
    asyncHandler(async (request, response) => {
      const id = request.params.id as string;
      const banner = await bannerService.getById(id);
      response
        .status(200)
        .json(successResponse('Banner retrieved successfully', banner));
    }),
  );

  router.post(
    '/',
    requireAdminPermission('banners.create'),
    asyncHandler(async (request, response) => {
      const parsedBody = createBannerSchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid banner data',
          parsedBody.error.format(),
        );
      }

      const adminId = request.adminProfile?.id;
      const banner = await bannerService.create(
        {
          ...parsedBody.data,
          startDate: parsedBody.data.startDate
            ? new Date(parsedBody.data.startDate)
            : null,
          endDate: parsedBody.data.endDate
            ? new Date(parsedBody.data.endDate)
            : null,
        },
        adminId,
      );

      response
        .status(201)
        .json(successResponse('Banner created successfully', banner));
    }),
  );

  const handleUpdate: RequestHandler = asyncHandler(
    async (request, response) => {
      const id = request.params.id as string;
      const parsedBody = updateBannerSchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid banner update data',
          parsedBody.error.format(),
        );
      }

      const adminId = request.adminProfile?.id;
      const banner = await bannerService.update(
        id,
        {
          ...parsedBody.data,
          startDate:
            parsedBody.data.startDate !== undefined
              ? parsedBody.data.startDate === null
                ? null
                : new Date(parsedBody.data.startDate)
              : undefined,
          endDate:
            parsedBody.data.endDate !== undefined
              ? parsedBody.data.endDate === null
                ? null
                : new Date(parsedBody.data.endDate)
              : undefined,
        },
        adminId,
      );

      response
        .status(200)
        .json(successResponse('Banner updated successfully', banner));
    },
  );

  router.put('/:id', requireAdminPermission('banners.update'), handleUpdate);
  router.patch('/:id', requireAdminPermission('banners.update'), handleUpdate);

  router.patch(
    '/:id/status',
    requireAdminPermission('banners.update'),
    asyncHandler(async (request, response) => {
      const id = request.params.id as string;
      const parsedBody = updateStatusSchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid status update data',
          parsedBody.error.format(),
        );
      }

      const adminId = request.adminProfile?.id;
      const banner = await bannerService.updateStatus(
        id,
        parsedBody.data.isActive,
        adminId,
      );

      response
        .status(200)
        .json(successResponse('Banner status updated successfully', banner));
    }),
  );

  router.delete(
    '/:id',
    requireAdminPermission('banners.delete'),
    asyncHandler(async (request, response) => {
      const id = request.params.id as string;
      const adminId = request.adminProfile?.id;
      await bannerService.delete(id, adminId);
      response
        .status(200)
        .json(successResponse('Banner deleted successfully', { id }));
    }),
  );

  return router;
}
