import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import type { GalleryService } from './gallery.service';

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
  category: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sortBy: z.enum(['displayOrder', 'createdAt', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const createGallerySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(180, 'Title must not exceed 180 characters'),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().min(1, 'Image URL is required'),
  publicId: z.string().trim().max(255).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const updateGallerySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(180, 'Title must not exceed 180 characters')
    .optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().min(1, 'Image URL is required').optional(),
  publicId: z.string().trim().max(255).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

export function createPublicGalleryRouter(
  galleryService: GalleryService,
): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (request, response) => {
      const category =
        typeof request.query.category === 'string'
          ? request.query.category.trim()
          : undefined;
      const items = await galleryService.listActive(category);
      response
        .status(200)
        .json(
          successResponse('Active gallery items retrieved successfully', items),
        );
    }),
  );

  return router;
}

export function createAdminGalleryRouter(
  authService: AdminAuthService,
  galleryService: GalleryService,
): Router {
  const router = Router();
  const authenticate = createAdminAuthenticationMiddleware(authService);

  router.use(authenticate);

  router.get(
    '/',
    requireAdminPermission('gallery.read'),
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

      const result = await galleryService.listAdmin(parsedQuery.data);
      response
        .status(200)
        .json(successResponse('Gallery items retrieved successfully', result));
    }),
  );

  router.get(
    '/:id',

    requireAdminPermission('gallery.read'),
    asyncHandler(async (request, response) => {
      const id = request.params.id as string;
      const item = await galleryService.getById(id);
      response
        .status(200)
        .json(successResponse('Gallery item retrieved successfully', item));
    }),
  );

  router.post(
    '/',
    requireAdminPermission('gallery.create'),
    asyncHandler(async (request, response) => {
      const parsedBody = createGallerySchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid gallery item data',
          parsedBody.error.format(),
        );
      }

      const adminId = request.adminProfile?.id;
      const item = await galleryService.create(parsedBody.data, adminId);

      response
        .status(201)
        .json(successResponse('Gallery item created successfully', item));
    }),
  );

  const handleUpdate: RequestHandler = asyncHandler(
    async (request, response) => {
      const id = request.params.id as string;
      const parsedBody = updateGallerySchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid gallery item update data',
          parsedBody.error.format(),
        );
      }

      const adminId = request.adminProfile?.id;
      const item = await galleryService.update(id, parsedBody.data, adminId);

      response
        .status(200)
        .json(successResponse('Gallery item updated successfully', item));
    },
  );

  router.put('/:id', requireAdminPermission('gallery.update'), handleUpdate);
  router.patch('/:id', requireAdminPermission('gallery.update'), handleUpdate);

  router.patch(
    '/:id/status',
    requireAdminPermission('gallery.update'),
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
      const item = await galleryService.updateStatus(
        id,
        parsedBody.data.isActive,
        adminId,
      );

      response
        .status(200)
        .json(
          successResponse('Gallery item status updated successfully', item),
        );
    }),
  );

  router.delete(
    '/:id',
    requireAdminPermission('gallery.delete'),
    asyncHandler(async (request, response) => {
      const id = request.params.id as string;
      const adminId = request.adminProfile?.id;
      await galleryService.delete(id, adminId);
      response
        .status(200)
        .json(successResponse('Gallery item deleted successfully', { id }));
    }),
  );

  return router;
}
