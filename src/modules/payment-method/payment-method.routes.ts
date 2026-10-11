import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { validateBody } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import { PaymentMethodService } from './payment-method.service';
import type { PaymentMethodRepository } from './payment-method.types';

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

const createSchema = z.object({
  code: z.string().trim().min(2).max(50),
  type: z.enum(['COD', 'STATIC_QR']),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  providerLabel: z.string().trim().max(120).optional().nullable(),
  accountName: z.string().trim().max(180).optional().nullable(),
  accountNumber: z.string().trim().max(100).optional().nullable(),
  qrImageUrl: z.string().trim().max(2048).optional().nullable(),
  instructions: z.string().trim().max(2000).optional().nullable(),
  minAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional()
    .nullable(),
  maxAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional()
    .nullable(),
  displayOrder: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  providerLabel: z.string().trim().max(120).optional().nullable(),
  accountName: z.string().trim().max(180).optional().nullable(),
  accountNumber: z.string().trim().max(100).optional().nullable(),
  qrImageUrl: z.string().trim().max(2048).optional().nullable(),
  instructions: z.string().trim().max(2000).optional().nullable(),
  minAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional()
    .nullable(),
  maxAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional()
    .nullable(),
  displayOrder: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});

const setStatusSchema = z.object({
  isActive: z.boolean(),
});

export function createAdminPaymentMethodRouter(
  authService: AdminAuthService,
  repository: PaymentMethodRepository,
): Router {
  const router = Router();
  const service = new PaymentMethodService(repository);

  router.use(createAdminAuthenticationMiddleware(authService));

  router.get(
    '/',
    requireAdminPermission('payment-methods.read'),
    asyncHandler(async (request, response) => {
      let isActive: boolean | undefined;
      if (request.query.isActive === 'true') isActive = true;
      if (request.query.isActive === 'false') isActive = false;

      const methods = await service.listAdmin({ isActive });
      response
        .status(200)
        .json(successResponse('Payment methods retrieved', methods));
    }),
  );

  router.get(
    '/:id',
    requireAdminPermission('payment-methods.read'),
    asyncHandler(async (request, response) => {
      const id = z.string().uuid().parse(request.params.id);
      const method = await service.getAdmin(id);
      response
        .status(200)
        .json(successResponse('Payment method retrieved', method));
    }),
  );

  router.post(
    '/',
    requireAdminPermission('payment-methods.create'),
    validateBody(createSchema),
    asyncHandler(async (request, response) => {
      const created = await service.create(request.body);
      response
        .status(201)
        .json(successResponse('Payment method created', created));
    }),
  );

  router.patch(
    '/:id',
    requireAdminPermission('payment-methods.update'),
    validateBody(updateSchema),
    asyncHandler(async (request, response) => {
      const id = z.string().uuid().parse(request.params.id);
      const updated = await service.update(id, request.body);
      response
        .status(200)
        .json(successResponse('Payment method updated', updated));
    }),
  );

  router.patch(
    '/:id/status',
    requireAdminPermission('payment-methods.status'),
    validateBody(setStatusSchema),
    asyncHandler(async (request, response) => {
      const id = z.string().uuid().parse(request.params.id);
      const updated = await service.setStatus(id, request.body.isActive);
      response
        .status(200)
        .json(successResponse('Payment method status updated', updated));
    }),
  );

  return router;
}

export function createPublicPaymentMethodRouter(
  repository: PaymentMethodRepository,
): Router {
  const router = Router();
  const service = new PaymentMethodService(repository);

  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      const methods = await service.listPublic();
      response
        .status(200)
        .json(successResponse('Active payment methods retrieved', methods));
    }),
  );

  return router;
}
