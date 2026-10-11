import { type OrderStatus, type Prisma } from '@prisma/client';
import { AppError } from '../../errors/app-error';
import { prisma } from '../../lib/prisma';
import { sanitizeAuditMetadata } from '../audit/audit.service';
import {
  ALLOWED_ORDER_STATUS_TRANSITIONS,
  type ManagedOrderDetail,
  type ManagedOrderSummary,
  type OrderFilter,
  type OrderManagementRepository,
  type OrderStatusHistoryRecord,
  type PaginatedOrders,
  type UpdateOrderStatusInput,
} from './order-management.types';

function mapDetail(
  row: Prisma.OrderGetPayload<{
    include: {
      items: true;
      statusHistory: {
        include: {
          actorAdmin: { select: { id: true; name: true; email: true } };
        };
      };
      paymentSubmissions: true;
    };
  }>,
): ManagedOrderDetail {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customer: {
      name: row.customerName,
      phone: row.customerPhone,
      email: row.customerEmail,
      deliveryAddress: row.deliveryAddress,
      latitude: row.deliveryLatitude ? row.deliveryLatitude.toString() : null,
      longitude: row.deliveryLongitude
        ? row.deliveryLongitude.toString()
        : null,
    },
    pricing: {
      subtotal: row.subtotal.toFixed(2),
      discountTotal: row.discountTotal.toFixed(2),
      deliveryFee: row.deliveryFee.toFixed(2),
      total: row.total.toFixed(2),
    },
    payment: {
      methodCode: row.paymentMethodCode,
      methodName: row.paymentMethodName,
      status: row.paymentStatus,
      reference: row.paymentReference,
    },
    status: row.status,
    items: row.items.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      productName: i.productName,
      sku: i.sku,
      sizeLabel: i.sizeLabel,
      unitPrice: i.unitPrice.toFixed(2),
      unitDiscount: i.unitDiscount.toFixed(2),
      effectiveUnitPrice: i.effectiveUnitPrice.toFixed(2),
      quantity: i.quantity,
      subtotal: i.subtotal.toFixed(2),
    })),
    statusHistory: row.statusHistory.map((h) => ({
      id: h.id,
      orderId: h.orderId,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      reason: h.reason,
      actorAdminId: h.actorAdminId,
      createdAt: h.createdAt,
      actorAdmin: h.actorAdmin
        ? {
            id: h.actorAdmin.id,
            name: h.actorAdmin.name,
            email: h.actorAdmin.email,
          }
        : null,
    })),
    paymentSubmissions: row.paymentSubmissions.map((s) => ({
      id: s.id,
      status: s.status,
      proofImageUrl: s.proofImageUrl,
      transactionReference: s.transactionReference,
      rejectionReason: s.rejectionReason,
      createdAt: s.createdAt,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

import type { NotificationOutboxService } from '../notifications/notification-outbox.service';

export class PrismaOrderManagementRepository implements OrderManagementRepository {
  constructor(private notificationOutboxService?: NotificationOutboxService) {}

  setNotificationOutboxService(service: NotificationOutboxService): void {
    this.notificationOutboxService = service;
  }

  async listOrders(filter: OrderFilter): Promise<PaginatedOrders> {
    const where: Prisma.OrderWhereInput = {};

    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.paymentStatus) {
      where.paymentStatus = filter.paymentStatus;
    }
    if (filter.orderNumber) {
      where.orderNumber = {
        contains: filter.orderNumber,
        mode: 'insensitive',
      };
    }
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) {
        where.createdAt.gte = new Date(filter.dateFrom);
      }
      if (filter.dateTo) {
        where.createdAt.lte = new Date(filter.dateTo);
      }
    }

    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));

    const [total, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: ManagedOrderSummary[] = rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      status: r.status,
      paymentStatus: r.paymentStatus,
      paymentMethodCode: r.paymentMethodCode,
      paymentMethodName: r.paymentMethodName,
      total: r.total.toFixed(2),
      itemCount: r.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async findOrderById(id: string): Promise<ManagedOrderDetail | null> {
    const row = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        statusHistory: {
          include: {
            actorAdmin: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        paymentSubmissions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return row ? mapDetail(row) : null;
  }

  async findOrderByNumber(
    orderNumber: string,
  ): Promise<ManagedOrderDetail | null> {
    const row = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        statusHistory: {
          include: {
            actorAdmin: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        paymentSubmissions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return row ? mapDetail(row) : null;
  }

  async updateOrderStatus(input: UpdateOrderStatusInput): Promise<{
    order: ManagedOrderDetail;
    previousStatus: OrderStatus;
    historyRecord: OrderStatusHistoryRecord;
  }> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id: input.orderId },
        include: { items: true },
      });
      if (!existing) {
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
      }

      if (
        input.expectedPreviousStatus &&
        existing.status !== input.expectedPreviousStatus
      ) {
        throw new AppError(
          409,
          'CONCURRENT_STATUS_CONFLICT',
          `Order status was concurrently modified from ${input.expectedPreviousStatus} to ${existing.status}`,
        );
      }

      if (existing.status === input.newStatus) {
        throw new AppError(
          409,
          'SAME_STATUS',
          `Order is already in status ${input.newStatus}`,
        );
      }

      const allowedTransitions =
        ALLOWED_ORDER_STATUS_TRANSITIONS[existing.status] ?? [];
      if (!allowedTransitions.includes(input.newStatus)) {
        throw new AppError(
          409,
          'INVALID_STATUS_TRANSITION',
          `Cannot transition order fulfillment status from ${existing.status} to ${input.newStatus}`,
        );
      }

      const updateResult = await tx.order.updateMany({
        where: {
          id: input.orderId,
          status: existing.status,
        },
        data: {
          status: input.newStatus,
        },
      });

      if (updateResult.count === 0) {
        throw new AppError(
          409,
          'CONCURRENT_STATUS_CONFLICT',
          'Order status was concurrently modified by another administrator',
        );
      }

      const historyRow = await tx.orderStatusHistory.create({
        data: {
          orderId: input.orderId,
          fromStatus: existing.status,
          toStatus: input.newStatus,
          reason: input.reason ?? null,
          actorAdminId: input.actorAdminId,
        },
        include: {
          actorAdmin: { select: { id: true, name: true, email: true } },
        },
      });

      const auditMeta = sanitizeAuditMetadata({
        orderNumber: existing.orderNumber,
        fromStatus: existing.status,
        toStatus: input.newStatus,
        reason: input.reason ?? null,
      });

      await tx.auditLog.create({
        data: {
          action: 'ORDER_STATUS_UPDATED',
          resourceType: 'ORDER',
          resourceId: input.orderId,
          actorAdminId: input.actorAdminId,
          metadata: (auditMeta as Prisma.InputJsonValue) ?? undefined,
        },
      });

      if (this.notificationOutboxService) {
        await this.notificationOutboxService.enqueueOrderStatusEmail(
          {
            id: existing.id,
            orderNumber: existing.orderNumber,
            customerName: existing.customerName,
            customerEmail: existing.customerEmail,
            customerPhone: existing.customerPhone,
            deliveryAddress: existing.deliveryAddress,
            total: existing.total.toFixed(2),
            items: existing.items?.map((i) => ({
              productName: i.productName,
              sizeLabel: i.sizeLabel,
              quantity: i.quantity,
              unitPrice: i.unitPrice.toFixed(2),
            })),
          },
          existing.status,
          input.newStatus,
          tx,
        );
      }

      const updated = await tx.order.findUniqueOrThrow({
        where: { id: input.orderId },
        include: {
          items: true,
          statusHistory: {
            include: {
              actorAdmin: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          paymentSubmissions: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      const historyRecord: OrderStatusHistoryRecord = {
        id: historyRow.id,
        orderId: historyRow.orderId,
        fromStatus: historyRow.fromStatus,
        toStatus: historyRow.toStatus,
        reason: historyRow.reason,
        actorAdminId: historyRow.actorAdminId,
        createdAt: historyRow.createdAt,
        actorAdmin: historyRow.actorAdmin
          ? {
              id: historyRow.actorAdmin.id,
              name: historyRow.actorAdmin.name,
              email: historyRow.actorAdmin.email,
            }
          : null,
      };

      return {
        order: mapDetail(updated),
        previousStatus: existing.status,
        historyRecord,
      };
    });
  }
}
