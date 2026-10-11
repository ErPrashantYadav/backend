import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { validateBody } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import { PromoCodeService } from './promo-code.service';
import type { PromoCodeRepository } from './promo-code.types';

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

const createPromoCodeSchema = z.object({
  code: z.string().trim().min(2).max(50),
  description: z.string().trim().max(255).optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.union([z.number().positive(), z.string().trim()]),
  minimumOrderAmount: z
    .union([z.number().min(0), z.string().trim()])
    .optional()
    .nullable(),
  maxDiscountAmount: z
    .union([z.number().positive(), z.string().trim()])
    .optional()
    .nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

const updatePromoCodeSchema = z.object({
  code: z.string().trim().min(2).max(50).optional(),
  description: z.string().trim().max(255).optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  discountValue: z.union([z.number().positive(), z.string().trim()]).optional(),
  minimumOrderAmount: z
    .union([z.number().min(0), z.string().trim()])
    .optional()
    .nullable(),
  maxDiscountAmount: z
    .union([z.number().positive(), z.string().trim()])
    .optional()
    .nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

const setStatusSchema = z.object({
  isActive: z.boolean(),
});

const validatePromoCodeSchema = z.object({
  code: z.string().trim().min(1).max(50),
  subtotal: z.union([z.number().min(0), z.string().trim()]),
});

export function createAdminPromoCodeRouter(
  authService: AdminAuthService,
  promoCodeRepository: PromoCodeRepository,
  promoCodeService?: PromoCodeService,
): Router {
  const router = Router();
  const service = promoCodeService ?? new PromoCodeService(promoCodeRepository);

  router.use(createAdminAuthenticationMiddleware(authService));

  router.get(
    '/',
    requireAdminPermission('promo-codes.read'),
    asyncHandler(async (request, response) => {
      const isActiveParam = request.query.isActive;
      let isActive: boolean | undefined;
      if (isActiveParam === 'true') isActive = true;
      if (isActiveParam === 'false') isActive = false;

      const discountType =
        request.query.discountType === 'PERCENTAGE' ||
        request.query.discountType === 'FIXED'
          ? request.query.discountType
          : undefined;

      const search =
        typeof request.query.search === 'string'
          ? request.query.search
          : undefined;

      const list = await service.listAdmin({ isActive, discountType, search });
      response.json(successResponse('Promo codes retrieved', list));
    }),
  );

  router.get(
    '/:id',
    requireAdminPermission('promo-codes.read'),
    asyncHandler(async (request, response) => {
      const item = await service.getAdmin(request.params.id as string);
      response.json(successResponse('Promo code retrieved', item));
    }),
  );

  router.post(
    '/',
    requireAdminPermission('promo-codes.create'),
    validateBody(createPromoCodeSchema),
    asyncHandler(async (request, response) => {
      const created = await service.create(
        request.body as z.infer<typeof createPromoCodeSchema>,
        request.adminProfile?.id,
      );
      response.status(201).json(successResponse('Promo code created', created));
    }),
  );

  router.patch(
    '/:id',
    requireAdminPermission('promo-codes.update'),
    validateBody(updatePromoCodeSchema),
    asyncHandler(async (request, response) => {
      const updated = await service.update(
        request.params.id as string,
        request.body as z.infer<typeof updatePromoCodeSchema>,
        request.adminProfile?.id,
      );
      response.json(successResponse('Promo code updated', updated));
    }),
  );

  router.patch(
    '/:id/status',
    requireAdminPermission('promo-codes.update'),
    validateBody(setStatusSchema),
    asyncHandler(async (request, response) => {
      const { isActive } = request.body as z.infer<typeof setStatusSchema>;
      const updated = await service.setStatus(
        request.params.id as string,
        isActive,
        request.adminProfile?.id,
      );
      response.json(successResponse('Promo code status updated', updated));
    }),
  );

  router.delete(
    '/:id',
    requireAdminPermission('promo-codes.delete'),
    asyncHandler(async (request, response) => {
      const result = await service.delete(
        request.params.id as string,
        request.adminProfile?.id,
      );
      response.json(successResponse('Promo code deleted', result));
    }),
  );

  return router;
}

export function createPublicPromoCodeRouter(
  promoCodeRepository: PromoCodeRepository,
  promoCodeService?: PromoCodeService,
): Router {
  const router = Router();
  const service = promoCodeService ?? new PromoCodeService(promoCodeRepository);

  router.get(
    '/active',
    asyncHandler(async (_request, response) => {
      const list = await service.listPublicActive();
      response.json(successResponse('Active promo codes retrieved', list));
    }),
  );

  router.post(
    '/validate',
    validateBody(validatePromoCodeSchema),
    asyncHandler(async (request, response) => {
      const { code, subtotal } = request.body as z.infer<
        typeof validatePromoCodeSchema
      >;
      const result = await service.validatePromoCode(code, subtotal);
      response.json(
        successResponse('Promo code validated', {
          valid: true,
          code: result.code,
          discountType: result.discountType,
          discountValue: result.discountValue,
          discountAmount: result.discountAmount,
          eligibleSubtotal: result.eligibleSubtotal,
          newTotal: result.newTotal,
        }),
      );
    }),
  );

  return router;
}
