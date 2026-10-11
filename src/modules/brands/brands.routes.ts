import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import type { AuditService } from '../audit/audit.service';
import { BrandService } from './brands.service';
import type { BrandRepository } from './brands.types';

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

const brandCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(160),
  logoUrl: z.string().trim().url().max(500).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
});

const brandUpdateSchema = brandCreateSchema.partial();

const brandIdParamSchema = z.string().uuid();

const reorderItemsSchema = z.union([
  z.object({
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          displayOrder: z.coerce.number().int().min(0),
        }),
      )
      .min(1),
  }),
  z
    .array(
      z.object({
        id: z.string().uuid(),
        displayOrder: z.coerce.number().int().min(0),
      }),
    )
    .min(1),
]);

const publicListQuerySchema = pageSchema.extend({
  q: z.string().trim().min(1).max(180).optional(),
});

export function createAdminBrandRouter(
  authService: AdminAuthService,
  repository: BrandRepository,
  auditService?: AuditService,
): Router {
  const router = Router();
  const service = new BrandService(repository, auditService);
  router.use(createAdminAuthenticationMiddleware(authService));

  router.get(
    '/',
    requireAdminPermission('catalog.brands.read'),
    asyncHandler(async (request, response) => {
      const query = pageSchema
        .extend({
          q: z.string().trim().min(1).max(180).optional(),
          isActive: optionalActiveSchema,
        })
        .parse(request.query);
      response.status(200).json(
        successResponse(
          'Brands fetched',
          await service.listBrands({
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
    requireAdminPermission('catalog.brands.create'),
    asyncHandler(async (request, response) => {
      const body = brandCreateSchema.parse(request.body);
      response
        .status(201)
        .json(
          successResponse('Brand created', await service.createBrand(body)),
        );
    }),
  );

  router.put(
    '/reorder',
    requireAdminPermission('catalog.brands.update'),
    asyncHandler(async (request, response) => {
      const parsed = reorderItemsSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid brand reorder data',
          parsed.error.format(),
        );
      }
      const items = Array.isArray(parsed.data)
        ? parsed.data
        : parsed.data.items;
      const adminId = request.adminProfile?.id;
      await service.reorderBrands(items, adminId);
      response.status(200).json(
        successResponse('Brands reordered successfully', {
          reordered: true,
        }),
      );
    }),
  );

  router.get(
    '/:id',
    requireAdminPermission('catalog.brands.read'),
    asyncHandler(async (request, response) => {
      const id = brandIdParamSchema.parse(request.params.id);
      response
        .status(200)
        .json(successResponse('Brand fetched', await service.getBrand(id)));
    }),
  );

  const handleUpdate: RequestHandler = asyncHandler(
    async (request, response) => {
      const id = brandIdParamSchema.parse(request.params.id);
      const body = brandUpdateSchema.parse(request.body);
      response
        .status(200)
        .json(
          successResponse('Brand updated', await service.updateBrand(id, body)),
        );
    },
  );

  router.patch(
    '/:id',
    requireAdminPermission('catalog.brands.update'),
    handleUpdate,
  );
  router.put(
    '/:id',
    requireAdminPermission('catalog.brands.update'),
    handleUpdate,
  );

  router.delete(
    '/:id',
    requireAdminPermission('catalog.brands.delete'),
    asyncHandler(async (request, response) => {
      const id = brandIdParamSchema.parse(request.params.id);
      await service.deleteBrand(id);
      response.status(200).json(successResponse('Brand deleted', { id }));
    }),
  );

  return router;
}

export function createPublicBrandRouter(repository: BrandRepository): Router {
  const router = Router();
  const service = new BrandService(repository);

  router.get(
    '/',
    asyncHandler(async (request, response) => {
      const query = publicListQuerySchema.parse(request.query);
      const result = await service.listPublicBrands({
        page: query.page,
        pageSize: query.pageSize,
        search: query.q,
      });
      response
        .status(200)
        .json(successResponse('Brands fetched successfully', result));
    }),
  );

  return router;
}
