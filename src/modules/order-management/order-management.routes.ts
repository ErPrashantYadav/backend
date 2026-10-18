import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { validateBody } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import { invoiceGeneratorService } from '../invoices/invoice-generator.service';
import { toInvoiceOrderDataFromDetail } from '../invoices/invoice.types';
import type { StoreSettingsRepository } from '../store-settings/store-settings.types';
import type { OrderManagementService } from './order-management.service';
import type { OrderStatus, PaymentStatus } from './order-management.types';

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

const updateStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'RETURNED',
  ]),
  reason: z.string().trim().max(500).optional().nullable(),
  expectedPreviousStatus: z
    .enum([
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'RETURNED',
    ])
    .optional(),
});

export function createAdminOrderManagementRouter(
  authService: AdminAuthService,
  orderService: OrderManagementService,
  storeSettingsRepository?: StoreSettingsRepository,
): Router {
  const router = Router();
  const authenticate = createAdminAuthenticationMiddleware(authService);

  router.use(authenticate);

  router.get(
    '/',
    requireAdminPermission('orders.read'),
    asyncHandler(async (request, response) => {
      const page = request.query.page
        ? parseInt(request.query.page as string, 10)
        : 1;
      const pageSize = request.query.pageSize
        ? parseInt(request.query.pageSize as string, 10)
        : 20;
      const status = request.query.status as OrderStatus | undefined;
      const paymentStatus = request.query.paymentStatus as
        PaymentStatus | undefined;
      const orderNumber = request.query.orderNumber as string | undefined;
      const dateFrom = request.query.dateFrom as string | undefined;
      const dateTo = request.query.dateTo as string | undefined;

      const data = await orderService.listOrders({
        page,
        pageSize,
        status,
        paymentStatus,
        orderNumber,
        dateFrom,
        dateTo,
      });

      response
        .status(200)
        .json(successResponse('Orders retrieved successfully', data));
    }),
  );

  router.get(
    '/:id/invoice',
    requireAdminPermission('orders.read'),
    asyncHandler(async (request, response) => {
      const id = z.string().min(1).parse(request.params.id);
      const order = await orderService.getOrderById(id);

      const storeSettings = storeSettingsRepository
        ? await storeSettingsRepository.get()
        : null;

      const storeInfo = storeSettings
        ? {
            storeName: storeSettings.storeName,
            storeTagline: storeSettings.storeTagline,
            primaryPhone: storeSettings.primaryPhone,
            supportEmail: storeSettings.supportEmail,
            address: storeSettings.address,
            city: storeSettings.city,
          }
        : undefined;

      const invoiceData = toInvoiceOrderDataFromDetail(order);
      const pdfBuffer = await invoiceGeneratorService.generateInvoicePdf(
        invoiceData,
        storeInfo,
      );

      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader(
        'Content-Disposition',
        `inline; filename="invoice-${order.orderNumber}.pdf"`,
      );
      response.setHeader('Content-Length', pdfBuffer.length);
      response.status(200).send(pdfBuffer);
    }),
  );

  router.get(
    '/:id',
    requireAdminPermission('orders.read'),
    asyncHandler(async (request, response) => {
      const id = z.string().min(1).parse(request.params.id);
      const data = await orderService.getOrderById(id);
      response
        .status(200)
        .json(successResponse('Order retrieved successfully', data));
    }),
  );

  router.get(
    '/:id/history',
    requireAdminPermission('orders.read'),
    asyncHandler(async (request, response) => {
      const id = z.string().min(1).parse(request.params.id);
      const order = await orderService.getOrderById(id);
      response.status(200).json(
        successResponse('Order status history retrieved successfully', {
          orderNumber: order.orderNumber,
          currentStatus: order.status,
          statusHistory: order.statusHistory,
          auditLogs: order.auditLogs ?? [],
        }),
      );
    }),
  );

  router.patch(
    '/:id/status',
    requireAdminPermission('orders.status'),
    validateBody(updateStatusSchema),
    asyncHandler(async (request, response) => {
      const id = z.string().min(1).parse(request.params.id);
      const adminId = request.adminProfile!.id;

      const data = await orderService.updateOrderStatus({
        orderId: id,
        newStatus: request.body.status,
        reason: request.body.reason,
        expectedPreviousStatus: request.body.expectedPreviousStatus,
        actorAdminId: adminId,
      });

      response
        .status(200)
        .json(
          successResponse(
            'Order fulfillment status updated successfully',
            data,
          ),
        );
    }),
  );

  return router;
}
