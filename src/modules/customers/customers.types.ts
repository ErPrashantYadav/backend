import type {
  OrderStatus,
  PaymentStatus,
} from '../order-management/order-management.types';

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  deliveryAddress: string;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerSummary {
  orderCount: number;
  totalSpent: string;
  latestOrderAt: string | null;
  firstOrderAt: string | null;
  completedOrderCount: number;
  pendingOrderCount: number;
  cancelledOrderCount: number;
}

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  deliveryAddress: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  orderCount: number;
  totalSpent: string;
  latestOrderAt: string | null;
}

export interface CustomerOrderItemView {
  id: string;
  productName: string;
  sku: string;
  sizeLabel: string;
  unitPrice: string;
  unitDiscount: string;
  effectiveUnitPrice: string;
  quantity: number;
  subtotal: string;
}

export interface CustomerOrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethodCode: string | null;
  paymentMethodName: string | null;
  subtotal: string;
  discountTotal: string;
  deliveryFee: string;
  total: string;
  promoCode: string | null;
  promoDiscount: string;
  itemCount: number;
  items: CustomerOrderItemView[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetailView {
  id: string;
  name: string;
  phone: string;
  deliveryAddress: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  summary: CustomerSummary;
  recentOrders: CustomerOrderView[];
}

export interface ListCustomersParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: 'createdAt' | 'name' | 'orderCount' | 'totalSpent' | 'latestOrderAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ListCustomerOrdersParams {
  page: number;
  limit: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'total';
  sortOrder?: 'asc' | 'desc';
}

export interface CustomerRepository {
  listCustomers(params: ListCustomersParams): Promise<{
    items: CustomerListItem[];
    total: number;
  }>;
  findCustomerById(id: string): Promise<CustomerRecord | null>;
  getCustomerSummary(customerId: string): Promise<CustomerSummary>;
  listCustomerOrders(
    customerId: string,
    params: ListCustomerOrdersParams,
  ): Promise<{
    items: CustomerOrderView[];
    total: number;
  }>;
}
