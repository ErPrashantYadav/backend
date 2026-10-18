import type {
  CheckoutRepository,
  OrderSnapshot,
} from '../checkout/checkout.types';
import type {
  OrderStatus,
  PaymentStatus,
} from '../order-management/order-management.types';
import type {
  CustomerListItem,
  CustomerOrderItemView,
  CustomerOrderView,
  CustomerRecord,
  CustomerRepository,
  CustomerSummary,
  ListCustomerOrdersParams,
  ListCustomersParams,
} from './customers.types';

function toTwo(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return '0.00';
  const num = typeof n === 'number' ? n : Number(n);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

export class MemoryCustomerRepository implements CustomerRepository {
  customers: CustomerRecord[] = [];

  constructor(
    private readonly checkoutRepository?: CheckoutRepository,
    initialCustomers: CustomerRecord[] = [],
  ) {
    this.customers = [...initialCustomers];
  }

  private get orders(): OrderSnapshot[] {
    if (
      this.checkoutRepository &&
      'orders' in this.checkoutRepository &&
      Array.isArray(
        (this.checkoutRepository as unknown as { orders: unknown }).orders,
      )
    ) {
      return (this.checkoutRepository as unknown as { orders: OrderSnapshot[] })
        .orders;
    }
    return [];
  }

  private get checkoutCustomers(): CustomerRecord[] {
    if (
      this.checkoutRepository &&
      'customers' in this.checkoutRepository &&
      Array.isArray(
        (this.checkoutRepository as unknown as { customers: unknown })
          .customers,
      )
    ) {
      return (
        this.checkoutRepository as unknown as { customers: CustomerRecord[] }
      ).customers;
    }
    return [];
  }

  private getAllCustomers(): CustomerRecord[] {
    const map = new Map<string, CustomerRecord>();

    for (const c of this.customers) {
      map.set(c.id, c);
    }

    for (const c of this.checkoutCustomers) {
      if (!map.has(c.id)) {
        map.set(c.id, c);
      }
    }

    for (const order of this.orders) {
      if (order.customerId && !map.has(order.customerId)) {
        map.set(order.customerId, {
          id: order.customerId,
          name: order.customerName,
          phone: order.customerPhone,
          deliveryAddress: order.deliveryAddress,
          email: order.customerEmail,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        });
      }
    }

    return Array.from(map.values());
  }

  async listCustomers(params: ListCustomersParams): Promise<{
    items: CustomerListItem[];
    total: number;
  }> {
    let all = this.getAllCustomers();

    if (params.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      all = all.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.phone.toLowerCase().includes(term) ||
          (c.email && c.email.toLowerCase().includes(term)),
      );
    }

    const items: CustomerListItem[] = all.map((c) => {
      const orders = this.orders.filter((o) => o.customerId === c.id);

      const validOrders = orders.filter(
        (o) =>
          o.status !== 'CANCELLED' &&
          o.status !== 'RETURNED' &&
          o.paymentStatus !== 'REFUNDED',
      );
      const totalSpentNum = validOrders.reduce(
        (sum, o) => sum + Number(o.total || 0),
        0,
      );

      let latestOrderAt: string | null = null;
      if (orders.length > 0) {
        const latestTime = Math.max(
          ...orders.map((o) => new Date(o.createdAt).getTime()),
        );
        latestOrderAt = new Date(latestTime).toISOString();
      }

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        deliveryAddress: c.deliveryAddress,
        email: c.email,
        createdAt: new Date(c.createdAt).toISOString(),
        updatedAt: new Date(c.updatedAt).toISOString(),
        orderCount: orders.length,
        totalSpent: toTwo(totalSpentNum),
        latestOrderAt,
      };
    });

    const sortOrder = params.sortOrder ?? 'desc';
    const sortBy = params.sortBy ?? 'createdAt';

    items.sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortBy === 'orderCount') {
        return sortOrder === 'asc'
          ? a.orderCount - b.orderCount
          : b.orderCount - a.orderCount;
      }
      if (sortBy === 'totalSpent') {
        return sortOrder === 'asc'
          ? Number(a.totalSpent) - Number(b.totalSpent)
          : Number(b.totalSpent) - Number(a.totalSpent);
      }
      if (sortBy === 'latestOrderAt') {
        const timeA = a.latestOrderAt ? new Date(a.latestOrderAt).getTime() : 0;
        const timeB = b.latestOrderAt ? new Date(b.latestOrderAt).getTime() : 0;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      // default: createdAt
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    const total = items.length;
    const start = (params.page - 1) * params.limit;
    const paginated = items.slice(start, start + params.limit);

    return { items: paginated, total };
  }

  async findCustomerById(id: string): Promise<CustomerRecord | null> {
    const all = this.getAllCustomers();
    return all.find((c) => c.id === id) ?? null;
  }

  async getCustomerSummary(customerId: string): Promise<CustomerSummary> {
    const orders = this.orders.filter((o) => o.customerId === customerId);

    if (orders.length === 0) {
      return {
        orderCount: 0,
        totalSpent: '0.00',
        latestOrderAt: null,
        firstOrderAt: null,
        completedOrderCount: 0,
        pendingOrderCount: 0,
        cancelledOrderCount: 0,
      };
    }

    let completedOrderCount = 0;
    let pendingOrderCount = 0;
    let cancelledOrderCount = 0;
    let totalSpentNum = 0;

    const times = orders.map((o) => new Date(o.createdAt).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    for (const o of orders) {
      if (o.status === 'DELIVERED') {
        completedOrderCount++;
      } else if (o.status === 'CANCELLED' || o.status === 'RETURNED') {
        cancelledOrderCount++;
      } else {
        pendingOrderCount++;
      }

      if (
        o.status !== 'CANCELLED' &&
        o.status !== 'RETURNED' &&
        o.paymentStatus !== 'REFUNDED'
      ) {
        totalSpentNum += Number(o.total || 0);
      }
    }

    return {
      orderCount: orders.length,
      totalSpent: toTwo(totalSpentNum),
      latestOrderAt: new Date(maxTime).toISOString(),
      firstOrderAt: new Date(minTime).toISOString(),
      completedOrderCount,
      pendingOrderCount,
      cancelledOrderCount,
    };
  }

  async listCustomerOrders(
    customerId: string,
    params: ListCustomerOrdersParams,
  ): Promise<{
    items: CustomerOrderView[];
    total: number;
  }> {
    let orders = this.orders.filter((o) => o.customerId === customerId);

    if (params.status) {
      orders = orders.filter((o) => o.status === params.status);
    }
    if (params.paymentStatus) {
      orders = orders.filter((o) => o.paymentStatus === params.paymentStatus);
    }
    if (params.startDate) {
      const startTime = new Date(params.startDate).getTime();
      orders = orders.filter(
        (o) => new Date(o.createdAt).getTime() >= startTime,
      );
    }
    if (params.endDate) {
      const endTime = new Date(params.endDate).getTime();
      orders = orders.filter((o) => new Date(o.createdAt).getTime() <= endTime);
    }

    const sortOrder = params.sortOrder ?? 'desc';
    const sortBy = params.sortBy ?? 'createdAt';

    orders.sort((a, b) => {
      if (sortBy === 'total') {
        return sortOrder === 'asc'
          ? Number(a.total) - Number(b.total)
          : Number(b.total) - Number(a.total);
      }
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    const total = orders.length;
    const start = (params.page - 1) * params.limit;
    const paginated = orders.slice(start, start + params.limit);

    const items: CustomerOrderView[] = paginated.map((o) => {
      const mappedItems: CustomerOrderItemView[] = (o.items || []).map(
        (item) => ({
          id: item.id,
          productName: item.productName,
          sku: item.sku,
          sizeLabel: item.sizeLabel,
          unitPrice: toTwo(item.unitPrice),
          unitDiscount: toTwo(item.unitDiscount),
          effectiveUnitPrice: toTwo(item.effectiveUnitPrice),
          quantity: item.quantity,
          subtotal: toTwo(item.subtotal),
        }),
      );

      const itemCount = mappedItems.reduce(
        (acc, item) => acc + item.quantity,
        0,
      );

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status as OrderStatus,
        paymentStatus: o.paymentStatus as PaymentStatus,
        paymentMethodCode: o.paymentMethodCode,
        paymentMethodName: o.paymentMethodName,
        subtotal: toTwo(o.subtotal),
        discountTotal: toTwo(o.discountTotal),
        deliveryFee: toTwo(o.deliveryFee),
        total: toTwo(o.total),
        promoCode: o.promoCode,
        promoDiscount: toTwo(o.promoDiscount),
        itemCount,
        items: mappedItems,
        createdAt: new Date(o.createdAt).toISOString(),
        updatedAt: new Date(o.updatedAt).toISOString(),
      };
    });

    return { items, total };
  }
}
