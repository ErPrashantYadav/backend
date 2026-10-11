import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { successResponse } from '../../utils/response';
import { CatalogService } from './catalog.service';
import type { CatalogRepository } from './catalog.types';
import type { InventoryService } from '../inventory/inventory.service';

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

const publicListQuerySchema = pageSchema.extend({
  q: z.string().trim().min(1).max(180).optional(),
});

const publicProductsQuerySchema = pageSchema.extend({
  q: z.string().trim().min(1).max(180).optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  sortBy: z
    .enum(['name_asc', 'name_desc', 'newest', 'price_asc', 'price_desc'])
    .default('name_asc'),
});

const productIdParamSchema = z.string().trim().min(1).max(220);

export function createPublicCatalogRouter(
  repository: CatalogRepository,
  inventoryService?: InventoryService,
): Router {
  const router = Router();
  const service = new CatalogService(repository, inventoryService);

  router.get(
    '/categories',
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

  router.get(
    '/brands',
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

  router.get(
    '/products',
    asyncHandler(async (request, response) => {
      const query = publicProductsQuerySchema.parse(request.query);
      const result = await service.listPublicProducts({
        page: query.page,
        pageSize: query.pageSize,
        search: query.q,
        categoryId: query.categoryId,
        brandId: query.brandId,
        sortBy: query.sortBy,
      });
      response
        .status(200)
        .json(successResponse('Products fetched successfully', result));
    }),
  );

  router.get(
    '/products/:id',
    asyncHandler(async (request, response) => {
      const id = productIdParamSchema.parse(request.params.id);
      const result = await service.getPublicProduct(id);
      response
        .status(200)
        .json(successResponse('Product fetched successfully', result));
    }),
  );

  return router;
}
