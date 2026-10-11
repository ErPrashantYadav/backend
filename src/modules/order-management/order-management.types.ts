import type { OrderStatus, PaymentStatus } from '@prisma/client';
export type { OrderStatus, PaymentStatus };

export const ALLOWED_ORDER_STATUS_TRANSITIONS: Record<
  OrderStatus,
  OrderStatus[]
> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED', 'CANCELLED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export interface OrderStatusHistoryRecord {
  id: string;
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  reason: string | null;
  actorAdminId: string | null;
  createdAt: Date;
  actorAdmin?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface ManagedOrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethodCode: string | null;
  paymentMethodName: string | null;
  total: string;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagedOrderItem {
  id: string;
  variantId: string;
  productName: string;
  sku: string;
  sizeLabel: string;
  unitPrice: string;
  unitDiscount: string;
  effectiveUnitPrice: string;
  quantity: number;
  subtotal: string;
}

export interface ManagedOrderDetail {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
    deliveryAddress: string;
    latitude: string | null;
    longitude: string | null;
  };
  pricing: {
    subtotal: string;
    discountTotal: string;
    deliveryFee: string;
    total: string;
  };
  payment: {
    methodCode: string | null;
    methodName: string | null;
    status: PaymentStatus;
    reference: string | null;
  };
  status: OrderStatus;
  items: ManagedOrderItem[];
  statusHistory: OrderStatusHistoryRecord[];
  auditLogs?: Array<{
    id: string;
    action: string;
    createdAt: Date;
    actorAdmin?: { id: string; name: string } | null;
    metadata: Record<string, unknown> | null;
  }>;
  paymentSubmissions?: Array<{
    id: string;
    status: string;
    proofImageUrl: string;
    transactionReference: string | null;
    rejectionReason: string | null;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderFilter {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  orderNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedOrders {
  items: ManagedOrderSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface UpdateOrderStatusInput {
  orderId: string;
  newStatus: OrderStatus;
  actorAdminId: string;
  reason?: string | null;
  expectedPreviousStatus?: OrderStatus;
}

export interface OrderManagementRepository {
  listOrders(filter: OrderFilter): Promise<PaginatedOrders>;
  findOrderById(id: string): Promise<ManagedOrderDetail | null>;
  findOrderByNumber(orderNumber: string): Promise<ManagedOrderDetail | null>;
  updateOrderStatus(input: UpdateOrderStatusInput): Promise<{
    order: ManagedOrderDetail;
    previousStatus: OrderStatus;
    historyRecord: OrderStatusHistoryRecord;
  }>;
}
