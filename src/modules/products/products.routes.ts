import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import type { InventoryService } from '../inventory/inventory.service';
import { ProductService } from './products.service';
import type { ProductRepository } from './products.types';

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

const productCreateSchema = z.object({
  categoryId: z.string().uuid(),
  brandId: z.string().uuid(),
  name: z.string().trim().min(1).max(180),
  slug: z.string().trim().min(1).max(220),
  description: z.string().trim().max(5000).nullable().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).nullable().optional(),
  discountValue: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((value) =>
      value === undefined || value === null ? null : String(value),
    ),
  isActive: z.boolean().default(true),
});

const productUpdateSchema = productCreateSchema.partial();

const imageCreateSchema = z.object({
  imageUrl: z.string().trim().url().max(500),
  publicId: z.string().trim().max(255).nullable().optional(),
  altText: z.string().trim().max(200).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

const imageUpdateSchema = imageCreateSchema.partial();

const variantCreateSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  size: z.string().trim().min(1).max(20),
  purchasePrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const variantUpdateSchema = variantCreateSchema.partial();

const productIdParamSchema = z.string().uuid();
const imageIdParamSchema = z.string().uuid();
const variantIdParamSchema = z.string().uuid();

const publicProductsQuerySchema = pageSchema.extend({
  q: z.string().trim().min(1).max(180).optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  sortBy: z
    .enum(['name_asc', 'name_desc', 'newest', 'price_asc', 'price_desc'])
    .default('name_asc'),
});

const publicProductIdParamSchema = z.string().trim().min(1).max(220);

export function createAdminProductRouter(
  authService: AdminAuthService,
  repository: ProductRepository,
  inventoryService?: InventoryService,
): Router {
  const router = Router();
  const service = new ProductService(repository, inventoryService);
  router.use(createAdminAuthenticationMiddleware(authService));

  router.get(
    '/',
    requireAdminPermission('catalog.products.read'),
    asyncHandler(async (request, response) => {
      const query = pageSchema
        .extend({
          q: z.string().trim().min(1).max(180).optional(),
          categoryId: z.string().uuid().optional(),
          brandId: z.string().uuid().optional(),
          isActive: optionalActiveSchema,
        })
        .parse(request.query);
      response.status(200).json(
        successResponse(
          'Products fetched',
          await service.listProducts({
            page: query.page,
            pageSize: query.pageSize,
            search: query.q,
            categoryId: query.categoryId,
            brandId: query.brandId,
            isActive: query.isActive,
          }),
        ),
      );
    }),
  );

  router.post(
    '/',
    requireAdminPermission('catalog.products.create'),
    asyncHandler(async (request, response) => {
      const body = productCreateSchema.parse(request.body);
      response
        .status(201)
        .json(
          successResponse('Product created', await service.createProduct(body)),
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
    requireAdminPermission('catalog.products.read'),
    asyncHandler(async (request, response) => {
      const id = productIdParamSchema.parse(request.params.id);
      response
        .status(200)
        .json(successResponse('Product fetched', await service.getProduct(id)));
    }),
  );

  const handleUpdateProduct: RequestHandler = asyncHandler(
    async (request, response) => {
      const id = productIdParamSchema.parse(request.params.id);
      const body = productUpdateSchema.parse(request.body);
      response
        .status(200)
        .json(
          successResponse(
            'Product updated',
            await service.updateProduct(id, body),
          ),
        );
    },
  );

  router.patch(
    '/:id',
    requireAdminPermission('catalog.products.update'),
    handleUpdateProduct,
  );
  router.put(
    '/:id',
    requireAdminPermission('catalog.products.update'),
    handleUpdateProduct,
  );

  router.delete(
    '/:id',
    requireAdminPermission('catalog.products.delete'),
    asyncHandler(async (request, response) => {
      const id = productIdParamSchema.parse(request.params.id);
      await service.deactivateProduct(id);
      response.status(200).json(successResponse('Product deactivated', { id }));
    }),
  );

  // Product Images
  router.get(
    '/:id/images',
    requireAdminPermission('catalog.product-images.read'),
    asyncHandler(async (request, response) => {
      const id = productIdParamSchema.parse(request.params.id);
      const product = await service.getProduct(id);
      response
        .status(200)
        .json(successResponse('Images fetched', product.images));
    }),
  );

  router.post(
    '/:id/images',
    requireAdminPermission('catalog.product-images.create'),
    asyncHandler(async (request, response) => {
      const productId = productIdParamSchema.parse(request.params.id);
      const body = imageCreateSchema.parse(request.body);
      response
        .status(201)
        .json(
          successResponse(
            'Image created',
            await service.createProductImage(productId, body),
          ),
        );
    }),
  );

  const handleUpdateImage: RequestHandler = asyncHandler(
    async (request, response) => {
      const productId = productIdParamSchema.parse(request.params.id);
      const imageId = imageIdParamSchema.parse(request.params.imageId);
      const body = imageUpdateSchema.parse(request.body);
      response
        .status(200)
        .json(
          successResponse(
            'Image updated',
            await service.updateProductImage(productId, imageId, body),
          ),
        );
    },
  );

  router.patch(
    '/:id/images/:imageId',
    requireAdminPermission('catalog.product-images.update'),
    handleUpdateImage,
  );
  router.put(
    '/:id/images/:imageId',
    requireAdminPermission('catalog.product-images.update'),
    handleUpdateImage,
  );

  router.delete(
    '/:id/images/:imageId',
    requireAdminPermission('catalog.product-images.delete'),
    asyncHandler(async (request, response) => {
      const productId = productIdParamSchema.parse(request.params.id);
      const imageId = imageIdParamSchema.parse(request.params.imageId);
      await service.deleteProductImage(productId, imageId);
      response
        .status(200)
        .json(successResponse('Image deleted', { id: imageId }));
    }),
  );

  // Product Variants
  router.get(
    '/:id/variants',
    requireAdminPermission('catalog.variants.read'),
    asyncHandler(async (request, response) => {
      const id = productIdParamSchema.parse(request.params.id);
      const product = await service.getProduct(id);
      response
        .status(200)
        .json(successResponse('Variants fetched', product.variants));
    }),
  );

  router.get(
    '/:id/variants/:variantId',
    requireAdminPermission('catalog.variants.read'),
    asyncHandler(async (request, response) => {
      const id = productIdParamSchema.parse(request.params.id);
      const variantId = variantIdParamSchema.parse(request.params.variantId);
      const product = await service.getProduct(id);
      const variant = product.variants.find((v) => v.id === variantId);
      if (!variant) {
        response.status(404).json({ error: { message: 'Variant not found' } });
        return;
      }
      response.status(200).json(successResponse('Variant fetched', variant));
    }),
  );

  router.post(
    '/:id/variants',
    requireAdminPermission('catalog.variants.create'),
    asyncHandler(async (request, response) => {
      const productId = productIdParamSchema.parse(request.params.id);
      const body = variantCreateSchema.parse(request.body);
      response
        .status(201)
        .json(
          successResponse(
            'Variant created',
            await service.createProductVariant(productId, body),
          ),
        );
    }),
  );

  const handleUpdateVariant: RequestHandler = asyncHandler(
    async (request, response) => {
      const productId = productIdParamSchema.parse(request.params.id);
      const variantId = variantIdParamSchema.parse(request.params.variantId);
      const body = variantUpdateSchema.parse(request.body);
      const adminId = request.adminProfile?.id;
      response
        .status(200)
        .json(
          successResponse(
            'Variant updated',
            await service.updateProductVariant(
              productId,
              variantId,
              body,
              adminId,
            ),
          ),
        );
    },
  );

  router.patch(
    '/:id/variants/:variantId',
    requireAdminPermission('catalog.variants.update'),
    handleUpdateVariant,
  );
  router.put(
    '/:id/variants/:variantId',
    requireAdminPermission('catalog.variants.update'),
    handleUpdateVariant,
  );

  router.delete(
    '/:id/variants/:variantId',
    requireAdminPermission('catalog.variants.delete'),
    asyncHandler(async (request, response) => {
      const productId = productIdParamSchema.parse(request.params.id);
      const variantId = variantIdParamSchema.parse(request.params.variantId);
      await service.deactivateProductVariant(productId, variantId);
      response
        .status(200)
        .json(successResponse('Variant deactivated', { id: variantId }));
    }),
  );

  return router;
}

export function createPublicProductRouter(
  repository: ProductRepository,
  inventoryService?: InventoryService,
): Router {
  const router = Router();
  const service = new ProductService(repository, inventoryService);

  router.get(
    '/',
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
    '/:id',
    asyncHandler(async (request, response) => {
      const id = publicProductIdParamSchema.parse(request.params.id);
      const result = await service.getPublicProduct(id);
      response
        .status(200)
        .json(successResponse('Product fetched successfully', result));
    }),
  );

  return router;
}
