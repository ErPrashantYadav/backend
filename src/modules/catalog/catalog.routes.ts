import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import { requireAdminPermission } from '../../middleware/admin-auth';
import { validateBody } from '../../middleware/validate';
import type { AdminAuthService } from '../auth/auth.service';
import { createAdminAuthenticationMiddleware } from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import { PrismaCatalogRepository } from './catalog.repository';
import { CatalogService, normalizeMoney } from './catalog.service';
import type { CatalogRepository } from './catalog.types';
import type { InventoryService } from '../inventory/inventory.service';

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const optionalActiveSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

const categoryCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().min(1).max(240),
    description: z.string().max(20_000).nullable().optional(),
    imageUrl: z.string().url().max(2048).nullable().optional(),
    isActive: z.boolean(),
  })
  .strict();

const categoryUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(240).optional(),
    description: z.string().max(20_000).nullable().optional(),
    imageUrl: z.string().url().max(2048).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    'At least one field is required',
  );

const brandCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().min(1).max(240),
    logoUrl: z.string().url().max(2048).nullable().optional(),
    isActive: z.boolean(),
  })
  .strict();

const brandUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(240).optional(),
    logoUrl: z.string().url().max(2048).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    'At least one field is required',
  );

const currencyAmount = z
  .number()
  .finite()
  .min(0)
  .max(9_999_999_999.99)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
    'Amount may have at most two decimal places',
  );

const discountFields = {
  discountType: z.enum(['PERCENTAGE', 'FIXED']).nullable().optional(),
  discountValue: currencyAmount.nullable().optional(),
};

function validateDiscountPair(
  data: {
    discountType?: 'PERCENTAGE' | 'FIXED' | null;
    discountValue?: number | null;
  },
  context: z.RefinementCtx,
): void {
  const typeSet = data.discountType !== undefined && data.discountType !== null;
  const valueSet =
    data.discountValue !== undefined && data.discountValue !== null;
  if (typeSet !== valueSet) {
    context.addIssue({
      code: 'custom',
      path: ['discountValue'],
      message: 'Discount type and value must both be set or both be null',
    });
  }
  if (
    data.discountType === 'PERCENTAGE' &&
    data.discountValue !== undefined &&
    data.discountValue !== null &&
    data.discountValue > 100
  ) {
    context.addIssue({
      code: 'custom',
      path: ['discountValue'],
      message: 'Percentage discount cannot exceed 100',
    });
  }
}

const productCreateSchema = z
  .object({
    categoryId: z.string().uuid(),
    brandId: z.string().uuid(),
    name: z.string().trim().min(1).max(180),
    slug: z.string().trim().min(1).max(300),
    description: z.string().max(100_000).nullable().optional(),
    ...discountFields,
    isActive: z.boolean(),
  })
  .strict()
  .superRefine(validateDiscountPair);

const productUpdateSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    brandId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(180).optional(),
    slug: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(100_000).nullable().optional(),
    ...discountFields,
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    'At least one field is required',
  )
  .superRefine(validateDiscountPair);

const imageCreateSchema = z
  .object({
    imageUrl: z
      .string()
      .url()
      .max(2048)
      .refine(
        (url) => new URL(url).protocol === 'https:',
        'Image URL must use HTTPS',
      ),
    publicId: z.string().trim().max(255).nullable().optional(),
    altText: z.string().trim().max(255).nullable().optional(),
    sortOrder: z.number().int().min(0).max(2_147_483_647).default(0),
  })
  .strict();

const imageUpdateSchema = z
  .object({
    imageUrl: z
      .string()
      .url()
      .max(2048)
      .refine(
        (url) => new URL(url).protocol === 'https:',
        'Image URL must use HTTPS',
      )
      .optional(),
    publicId: z.string().trim().max(255).nullable().optional(),
    altText: z.string().trim().max(255).nullable().optional(),
    sortOrder: z.number().int().min(0).max(2_147_483_647).optional(),
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    'At least one field is required',
  );

const variantCreateSchema = z
  .object({
    sku: z.string().trim().min(1).max(80),
    size: z.string().trim().min(1).max(50),
    purchasePrice: currencyAmount,
    sellingPrice: currencyAmount,
    stock: z.number().int().min(0).max(2_147_483_647).default(0),
    lowStockThreshold: z.number().int().min(0).max(2_147_483_647),
    isActive: z.boolean(),
  })
  .strict();

const variantUpdateSchema = z
  .object({
    sku: z.string().trim().min(1).max(80).optional(),
    size: z.string().trim().min(1).max(50).optional(),
    purchasePrice: currencyAmount.optional(),
    sellingPrice: currencyAmount.optional(),
    stock: z.number().int().min(0).max(2_147_483_647).optional(),
    lowStockThreshold: z.number().int().min(0).max(2_147_483_647).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    'At least one field is required',
  );

const productFiltersSchema = pageSchema.extend({
  q: z.string().trim().min(1).max(180).optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  isActive: optionalActiveSchema,
});

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

function toProductWriteInput(body: z.infer<typeof productCreateSchema>) {
  return {
    ...body,
    description: body.description ?? null,
    discountType: body.discountType ?? null,
    discountValue:
      body.discountValue == null ? null : normalizeMoney(body.discountValue),
  };
}

function toProductUpdateInput(body: z.infer<typeof productUpdateSchema>) {
  const { discountValue, ...remaining } = body;
  if (discountValue === undefined) return remaining;
  return {
    ...remaining,
    discountValue:
      discountValue === null ? null : normalizeMoney(discountValue),
  };
}

export function createCatalogRouter(
  authService: AdminAuthService,
  repository: CatalogRepository = new PrismaCatalogRepository(),
  inventoryService?: InventoryService,
): Router {
  const router = Router();
  const service = new CatalogService(repository, inventoryService);
  router.use(createAdminAuthenticationMiddleware(authService));

  router.get(
    '/categories',
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
    '/categories',
    requireAdminPermission('catalog.categories.create'),
    validateBody(categoryCreateSchema),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          successResponse(
            'Category created',
            await service.createCategory(request.body),
          ),
        );
    }),
  );
  router.get(
    '/categories/:id',
    requireAdminPermission('catalog.categories.read'),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          successResponse(
            'Category fetched',
            await service.getCategory(
              z.string().uuid().parse(request.params.id),
            ),
          ),
        );
    }),
  );
  router.patch(
    '/categories/:id',
    requireAdminPermission('catalog.categories.update'),
    validateBody(categoryUpdateSchema),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          successResponse(
            'Category updated',
            await service.updateCategory(
              z.string().uuid().parse(request.params.id),
              request.body,
            ),
          ),
        );
    }),
  );
  router.delete(
    '/categories/:id',
    requireAdminPermission('catalog.categories.delete'),
    asyncHandler(async (request, response) => {
      await service.deleteCategory(z.string().uuid().parse(request.params.id));
      response
        .status(200)
        .json(successResponse('Category deleted', { id: request.params.id }));
    }),
  );

  router.get(
    '/brands',
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
    '/brands',
    requireAdminPermission('catalog.brands.create'),
    validateBody(brandCreateSchema),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          successResponse(
            'Brand created',
            await service.createBrand(request.body),
          ),
        );
    }),
  );
  router.get(
    '/brands/:id',
    requireAdminPermission('catalog.brands.read'),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          successResponse(
            'Brand fetched',
            await service.getBrand(z.string().uuid().parse(request.params.id)),
          ),
        );
    }),
  );
  router.patch(
    '/brands/:id',
    requireAdminPermission('catalog.brands.update'),
    validateBody(brandUpdateSchema),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          successResponse(
            'Brand updated',
            await service.updateBrand(
              z.string().uuid().parse(request.params.id),
              request.body,
            ),
          ),
        );
    }),
  );
  router.delete(
    '/brands/:id',
    requireAdminPermission('catalog.brands.delete'),
    asyncHandler(async (request, response) => {
      await service.deleteBrand(z.string().uuid().parse(request.params.id));
      response
        .status(200)
        .json(successResponse('Brand deleted', { id: request.params.id }));
    }),
  );

  router.get(
    '/products',
    requireAdminPermission('catalog.products.read'),
    asyncHandler(async (request, response) => {
      const query = productFiltersSchema.parse(request.query);
      response
        .status(200)
        .json(
          successResponse(
            'Products fetched',
            await service.listProducts({ ...query, search: query.q }),
          ),
        );
    }),
  );
  router.post(
    '/products',
    requireAdminPermission('catalog.products.create'),
    validateBody(productCreateSchema),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          successResponse(
            'Product created',
            await service.createProduct(toProductWriteInput(request.body)),
          ),
        );
    }),
  );
  router.get(
    '/products/:id',
    requireAdminPermission('catalog.products.read'),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          successResponse(
            'Product fetched',
            await service.getProduct(
              z.string().uuid().parse(request.params.id),
            ),
          ),
        );
    }),
  );
  router.patch(
    '/products/:id',
    requireAdminPermission('catalog.products.update'),
    validateBody(productUpdateSchema),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          successResponse(
            'Product updated',
            await service.updateProduct(
              z.string().uuid().parse(request.params.id),
              toProductUpdateInput(request.body),
            ),
          ),
        );
    }),
  );
  router.delete(
    '/products/:id',
    requireAdminPermission('catalog.products.delete'),
    asyncHandler(async (request, response) => {
      await service.deactivateProduct(
        z.string().uuid().parse(request.params.id),
      );
      response
        .status(200)
        .json(
          successResponse('Product deactivated', { id: request.params.id }),
        );
    }),
  );

  router.get(
    '/products/:id/images',
    requireAdminPermission('catalog.product-images.read'),
    asyncHandler(async (request, response) => {
      const product = await service.getProduct(
        z.string().uuid().parse(request.params.id),
      );
      response
        .status(200)
        .json(successResponse('Product images fetched', product.images));
    }),
  );
  router.post(
    '/products/:id/images',
    requireAdminPermission('catalog.product-images.create'),
    validateBody(imageCreateSchema),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          successResponse(
            'Product image created',
            await service.createProductImage(
              z.string().uuid().parse(request.params.id),
              request.body,
            ),
          ),
        );
    }),
  );
  router.patch(
    '/products/:id/images/:imageId',
    requireAdminPermission('catalog.product-images.update'),
    validateBody(imageUpdateSchema),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          successResponse(
            'Product image updated',
            await service.updateProductImage(
              z.string().uuid().parse(request.params.id),
              z.string().uuid().parse(request.params.imageId),
              request.body,
            ),
          ),
        );
    }),
  );
  router.delete(
    '/products/:id/images/:imageId',
    requireAdminPermission('catalog.product-images.delete'),
    asyncHandler(async (request, response) => {
      await service.deleteProductImage(
        z.string().uuid().parse(request.params.id),
        z.string().uuid().parse(request.params.imageId),
      );
      response.status(200).json(successResponse('Product image deleted', {}));
    }),
  );

  router.get(
    '/products/:id/variants',
    requireAdminPermission('catalog.variants.read'),
    asyncHandler(async (request, response) => {
      const product = await service.getProduct(
        z.string().uuid().parse(request.params.id),
      );
      response
        .status(200)
        .json(successResponse('Product variants fetched', product.variants));
    }),
  );
  router.get(
    '/products/:id/variants/:variantId',
    requireAdminPermission('catalog.variants.read'),
    asyncHandler(async (request, response) => {
      const product = await service.getProduct(
        z.string().uuid().parse(request.params.id),
      );
      const variant = product.variants.find(
        (item) => item.id === z.string().uuid().parse(request.params.variantId),
      );
      if (!variant)
        throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
      response
        .status(200)
        .json(successResponse('Product variant fetched', variant));
    }),
  );
  router.post(
    '/products/:id/variants',
    requireAdminPermission('catalog.variants.create'),
    validateBody(variantCreateSchema),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          successResponse(
            'Product variant created',
            await service.createProductVariant(
              z.string().uuid().parse(request.params.id),
              request.body,
            ),
          ),
        );
    }),
  );
  router.patch(
    '/products/:id/variants/:variantId',
    requireAdminPermission('catalog.variants.update'),
    validateBody(variantUpdateSchema),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          successResponse(
            'Product variant updated',
            await service.updateProductVariant(
              z.string().uuid().parse(request.params.id),
              z.string().uuid().parse(request.params.variantId),
              request.body,
              request.adminProfile?.id,
            ),
          ),
        );
    }),
  );
  router.delete(
    '/products/:id/variants/:variantId',
    requireAdminPermission('catalog.variants.delete'),
    asyncHandler(async (request, response) => {
      await service.deactivateProductVariant(
        z.string().uuid().parse(request.params.id),
        z.string().uuid().parse(request.params.variantId),
      );
      response.status(200).json(
        successResponse('Product variant deactivated', {
          id: request.params.variantId,
        }),
      );
    }),
  );

  return router;
}
