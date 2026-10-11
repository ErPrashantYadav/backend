import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { validateBody } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import { InventoryService } from './inventory.service';
import {
  INVENTORY_MOVEMENT_TYPES,
  type InventoryRepository,
} from './inventory.types';

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

const adjustmentSchema = z
  .object({
    variantId: z.string().uuid(),
    quantityDelta: z
      .number()
      .int()
      .refine((n) => n !== 0, 'Delta must be a non-zero integer'),
    type: z.enum(INVENTORY_MOVEMENT_TYPES),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

const variantAdjustmentSchema = z
  .object({
    quantityDelta: z
      .number()
      .int()
      .refine((n) => n !== 0, 'Delta must be a non-zero integer'),
    type: z.enum(INVENTORY_MOVEMENT_TYPES),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

const movementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  variantId: z.string().uuid().optional(),
  startDate: z
    .string()
    .datetime()
    .optional()
    .transform((d) => (d ? new Date(d) : undefined)),
  endDate: z
    .string()
    .datetime()
    .optional()
    .transform((d) => (d ? new Date(d) : undefined)),
  type: z.enum(INVENTORY_MOVEMENT_TYPES).optional(),
});

const lowStockQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().uuid().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export function createInventoryRouter(
  authService: AdminAuthService,
  repository: InventoryRepository,
): Router {
  const router = Router();
  const service = new InventoryService(repository);

  router.use(createAdminAuthenticationMiddleware(authService));

  router.post(
    '/adjustments',
    requireAdminPermission('inventory.adjust'),
    validateBody(adjustmentSchema),
    asyncHandler(async (request, response) => {
      const result = await service.adjustStock({
        ...request.body,
        actorAdminId: request.adminProfile!.id,
      });
      response
        .status(200)
        .json(successResponse('Stock adjusted successfully', result));
    }),
  );

  router.post(
    '/variants/:variantId/adjustments',
    requireAdminPermission('inventory.adjust'),
    validateBody(variantAdjustmentSchema),
    asyncHandler(async (request, response) => {
      const variantId = z.string().uuid().parse(request.params.variantId);
      const result = await service.adjustStock({
        variantId,
        ...request.body,
        actorAdminId: request.adminProfile!.id,
      });
      response
        .status(200)
        .json(successResponse('Stock adjusted successfully', result));
    }),
  );

  router.get(
    '/movements',
    requireAdminPermission('inventory.movements.read'),
    asyncHandler(async (request, response) => {
      const parsed = movementsQuerySchema.parse(request.query);
      const result = await service.listMovements(parsed);
      response
        .status(200)
        .json(successResponse('Inventory movements fetched', result));
    }),
  );

  router.get(
    '/low-stock',
    requireAdminPermission('inventory.low-stock.read'),
    asyncHandler(async (request, response) => {
      const parsed = lowStockQuerySchema.parse(request.query);
      const result = await service.listLowStock(parsed);
      response
        .status(200)
        .json(successResponse('Low stock variants fetched', result));
    }),
  );

  router.get(
    '/variants/:variantId/stock',
    requireAdminPermission('inventory.movements.read'),
    asyncHandler(async (request, response) => {
      const variantId = z.string().uuid().parse(request.params.variantId);
      const result = await service.getVariantStock(variantId);
      response
        .status(200)
        .json(successResponse('Variant stock fetched', result));
    }),
  );

  return router;
}
