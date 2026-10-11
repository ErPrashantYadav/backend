import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import { CategoryService } from './categories.service';
import type { CategoryRepository } from './categories.types';

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

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const optionalActiveSchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    const lower = value.toLowerCase().trim();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    return undefined;
  });

const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  imageUrl: z.string().trim().url().max(500).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
});

const categoryUpdateSchema = categoryCreateSchema.partial();

const categoryIdParamSchema = z.string().uuid();

const publicListQuerySchema = pageSchema.extend({
  q: z.string().trim().min(1).max(180).optional(),
});

export function createAdminCategoryRouter(
  authService: AdminAuthService,
  repository: CategoryRepository,
): Router {
  const router = Router();
  const service = new CategoryService(repository);
  router.use(createAdminAuthenticationMiddleware(authService));

  router.get(
    '/',
    requireAdminPermission('catalog.categories.read'),
    asyncHandler(async (request, response) => {
      const query = pageSchema
        .extend({
          q: z.string().trim().min(1).max(180).optional(),
          isActive: optionalActiveSchema,
        })
        .parse(request.query);
      response.status(200).json(
        successResponse(
          'Categories fetched',
          await service.listCategories({
            page: query.page,
            pageSize: query.pageSize,
            search: query.q,
            isActive: query.isActive,
          }),
        ),
      );
    }),
  );

  router.post(
    '/',
    requireAdminPermission('catalog.categories.create'),
    asyncHandler(async (request, response) => {
      const body = categoryCreateSchema.parse(request.body);
      response
        .status(201)
        .json(
          successResponse(
            'Category created',
            await service.createCategory(body),
          ),
        );
    }),
  );

  router.param('id', (_request, _response, next, id) => {
    if (id === 'reorder') {
      return next('route');
    }
    next();
  });

  router.get(
    '/:id',
    requireAdminPermission('catalog.categories.read'),
    asyncHandler(async (request, response) => {
      const id = categoryIdParamSchema.parse(request.params.id);
      response
        .status(200)
        .json(
          successResponse('Category fetched', await service.getCategory(id)),
        );
    }),
  );

  const handleUpdate: RequestHandler = asyncHandler(
    async (request, response) => {
      const id = categoryIdParamSchema.parse(request.params.id);
      const body = categoryUpdateSchema.parse(request.body);
      response
        .status(200)
        .json(
          successResponse(
            'Category updated',
            await service.updateCategory(id, body),
          ),
        );
    },
  );

  router.patch(
    '/:id',
    requireAdminPermission('catalog.categories.update'),
    handleUpdate,
  );
  router.put(
    '/:id',
    requireAdminPermission('catalog.categories.update'),
    handleUpdate,
  );

  router.delete(
    '/:id',
    requireAdminPermission('catalog.categories.delete'),
    asyncHandler(async (request, response) => {
      const id = categoryIdParamSchema.parse(request.params.id);
      await service.deleteCategory(id);
      response.status(200).json(successResponse('Category deleted', { id }));
    }),
  );

  return router;
}

export function createPublicCategoryRouter(
  repository: CategoryRepository,
): Router {
  const router = Router();
  const service = new CategoryService(repository);

  router.get(
    '/',
    asyncHandler(async (request, response) => {
      const query = publicListQuerySchema.parse(request.query);
      const result = await service.listPublicCategories({
        page: query.page,
        pageSize: query.pageSize,
        search: query.q,
      });
      response
        .status(200)
        .json(successResponse('Categories fetched successfully', result));
    }),
  );

  return router;
}
