import type { OrderStatus, PaymentStatus } from '@prisma/client';
import { AppError } from '../../errors/app-error';
import type { AuditLogRepository } from '../audit/audit.types';
import { sanitizeAuditMetadata } from '../audit/audit.service';
import type {
  CheckoutRepository,
  OrderSnapshot,
} from '../checkout/checkout.types';
import type { PaymentSubmissionRepository } from '../payment-submission/payment-submission.types';
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

import type { NotificationOutboxService } from '../notifications/notification-outbox.service';

export class MemoryOrderManagementRepository implements OrderManagementRepository {
  history: OrderStatusHistoryRecord[] = [];

  constructor(
    private readonly checkoutRepository: CheckoutRepository,
    public readonly admins: Array<{
      id: string;
      name: string;
      email: string;
    }> = [],
    private readonly paymentSubmissionRepository?: PaymentSubmissionRepository,
    public auditRepository?: AuditLogRepository,
    public notificationOutboxService?: NotificationOutboxService,
  ) {}

  setAuditRepository(repo: AuditLogRepository): void {
    this.auditRepository = repo;
  }

  setNotificationOutboxService(service: NotificationOutboxService): void {
    this.notificationOutboxService = service;
  }

  private getOrdersList(): OrderSnapshot[] {
    if ('orders' in this.checkoutRepository) {
      return (this.checkoutRepository as { orders: OrderSnapshot[] }).orders;
    }
    return [];
  }

  private mapDetail(order: OrderSnapshot): ManagedOrderDetail {
    const orderHistory = this.history
      .filter((h) => h.orderId === order.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
        deliveryAddress: order.deliveryAddress,
        latitude: order.deliveryLatitude,
        longitude: order.deliveryLongitude,
      },
      pricing: {
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
      },
      payment: {
        methodCode: order.paymentMethodCode,
        methodName: order.paymentMethodName,
        status: order.paymentStatus as PaymentStatus,
        reference: order.paymentReference,
      },
      status: order.status as OrderStatus,
      items: order.items.map((i) => ({
        id: i.id,
        variantId: i.variantId,
        productName: i.productName,
        sku: i.sku,
        sizeLabel: i.sizeLabel,
        unitPrice: i.unitPrice,
        unitDiscount: i.unitDiscount,
        effectiveUnitPrice: i.effectiveUnitPrice,
        quantity: i.quantity,
        subtotal: i.subtotal,
      })),
      statusHistory: orderHistory,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async listOrders(filter: OrderFilter): Promise<PaginatedOrders> {
    let orders = [...this.getOrdersList()];

    if (filter.status) {
      orders = orders.filter((o) => o.status === filter.status);
    }
    if (filter.paymentStatus) {
      orders = orders.filter((o) => o.paymentStatus === filter.paymentStatus);
    }
    if (filter.orderNumber) {
      const query = filter.orderNumber.toLowerCase();
      orders = orders.filter((o) =>
        o.orderNumber.toLowerCase().includes(query),
      );
    }
    if (filter.dateFrom) {
      const from = new Date(filter.dateFrom).getTime();
      orders = orders.filter((o) => o.createdAt.getTime() >= from);
    }
    if (filter.dateTo) {
      const to = new Date(filter.dateTo).getTime();
      orders = orders.filter((o) => o.createdAt.getTime() <= to);
    }

    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
    const total = orders.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const paginated = orders.slice((page - 1) * pageSize, page * pageSize);

    const items: ManagedOrderSummary[] = paginated.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      status: r.status as OrderStatus,
      paymentStatus: r.paymentStatus as PaymentStatus,
      paymentMethodCode: r.paymentMethodCode,
      paymentMethodName: r.paymentMethodName,
      total: r.total,
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
        totalPages,
      },
    };
  }

  async findOrderById(id: string): Promise<ManagedOrderDetail | null> {
    const orders = this.getOrdersList();
    const order = orders.find((o) => o.id === id);
    if (!order) return null;
    return this.mapDetail(order);
  }

  async findOrderByNumber(
    orderNumber: string,
  ): Promise<ManagedOrderDetail | null> {
    const orders = this.getOrdersList();
    const order = orders.find((o) => o.orderNumber === orderNumber);
    if (!order) return null;
    return this.mapDetail(order);
  }

  async updateOrderStatus(input: UpdateOrderStatusInput): Promise<{
    order: ManagedOrderDetail;
    previousStatus: OrderStatus;
    historyRecord: OrderStatusHistoryRecord;
  }> {
    const orders = this.getOrdersList();
    const order = orders.find((o) => o.id === input.orderId);
    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }

    const previousStatus = order.status as OrderStatus;

    if (
      input.expectedPreviousStatus &&
      previousStatus !== input.expectedPreviousStatus
    ) {
      throw new AppError(
        409,
        'CONCURRENT_STATUS_CONFLICT',
        `Order status was concurrently modified from ${input.expectedPreviousStatus} to ${previousStatus}`,
      );
    }

    if (previousStatus === input.newStatus) {
      throw new AppError(
        409,
        'SAME_STATUS',
        `Order is already in status ${input.newStatus}`,
      );
    }

    const allowedTransitions =
      ALLOWED_ORDER_STATUS_TRANSITIONS[previousStatus] ?? [];
    if (!allowedTransitions.includes(input.newStatus)) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot transition order fulfillment status from ${previousStatus} to ${input.newStatus}`,
      );
    }
    if (this.auditRepository) {
      await this.auditRepository.createLog({
        action: 'ORDER_STATUS_UPDATED',
        resourceType: 'ORDER',
        resourceId: order.id,
        actorAdminId: input.actorAdminId,
        metadata: sanitizeAuditMetadata({
          orderNumber: order.orderNumber,
          fromStatus: previousStatus,
          toStatus: input.newStatus,
          reason: input.reason ?? null,
        }),
      });
    }

    order.status = input.newStatus;
    order.updatedAt = new Date();

    const admin = input.actorAdminId
      ? this.admins.find((a) => a.id === input.actorAdminId)
      : null;

    const historyRecord: OrderStatusHistoryRecord = {
      id: crypto.randomUUID(),
      orderId: order.id,
      fromStatus: previousStatus,
      toStatus: input.newStatus,
      reason: input.reason ?? null,
      actorAdminId: input.actorAdminId,
      createdAt: new Date(),
      actorAdmin: admin
        ? {
            id: admin.id,
            name: admin.name,
            email: admin.email,
          }
        : null,
    };

    this.history.push(historyRecord);

    if (this.notificationOutboxService) {
      await this.notificationOutboxService.enqueueOrderStatusEmail(
        order,
        previousStatus,
        input.newStatus,
      );
    }

    return {
      order: this.mapDetail(order),
      previousStatus,
      historyRecord,
    };
  }
}
