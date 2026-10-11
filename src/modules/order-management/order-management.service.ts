import type { Logger } from 'pino';
import { AppError } from '../../errors/app-error';
import type { AuditService } from '../audit/audit.service';
import type {
  ManagedOrderDetail,
  OrderFilter,
  OrderManagementRepository,
  OrderStatusHistoryRecord,
  PaginatedOrders,
  UpdateOrderStatusInput,
} from './order-management.types';

export class OrderManagementService {
  constructor(
    private readonly orderRepository: OrderManagementRepository,
    private readonly auditService?: AuditService,
    private readonly logger?: Logger,
  ) {}

  async listOrders(filter: OrderFilter): Promise<PaginatedOrders> {
    return this.orderRepository.listOrders(filter);
  }

  async getOrderById(id: string): Promise<ManagedOrderDetail> {
    const order = await this.orderRepository.findOrderById(id);
    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }

    if (this.auditService) {
      const audits = await this.auditService.listLogsForResource('ORDER', id);
      order.auditLogs = audits.map((a) => ({
        id: a.id,
        action: a.action,
        createdAt: a.createdAt,
        actorAdmin: a.actorAdmin
          ? { id: a.actorAdmin.id, name: a.actorAdmin.name }
          : null,
        metadata: a.metadata,
      }));
    }

    return order;
  }

  async getOrderByNumber(orderNumber: string): Promise<ManagedOrderDetail> {
    const order = await this.orderRepository.findOrderByNumber(orderNumber);
    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }

    if (this.auditService) {
      const audits = await this.auditService.listLogsForResource(
        'ORDER',
        order.id,
      );
      order.auditLogs = audits.map((a) => ({
        id: a.id,
        action: a.action,
        createdAt: a.createdAt,
        actorAdmin: a.actorAdmin
          ? { id: a.actorAdmin.id, name: a.actorAdmin.name }
          : null,
        metadata: a.metadata,
      }));
    }

    return order;
  }

  async updateOrderStatus(input: UpdateOrderStatusInput): Promise<{
    order: ManagedOrderDetail;
    previousStatus: string;
    historyRecord: OrderStatusHistoryRecord;
  }> {
    const result = await this.orderRepository.updateOrderStatus(input);

    this.logger?.info(
      {
        event: 'ORDER_STATUS_UPDATED',
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        fromStatus: result.previousStatus,
        toStatus: input.newStatus,
        actorAdminId: input.actorAdminId,
      },
      'Order fulfillment status updated',
    );

    return result;
  }
}
