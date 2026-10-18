import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
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
import type {
  OrderStatus,
  PaymentStatus,
} from '../order-management/order-management.types';

function toTwo(n: number | string | Prisma.Decimal | null | undefined): string {
  if (n === null || n === undefined) return '0.00';
  const num = typeof n === 'number' ? n : Number(n);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

export class PrismaCustomerRepository implements CustomerRepository {
  async listCustomers(params: ListCustomersParams): Promise<{
    items: CustomerListItem[];
    total: number;
  }> {
    const where: Prisma.CustomerWhereInput = {};

    if (params.search && params.search.trim()) {
      const term = params.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.customer.count({ where });

    const sortOrder = params.sortOrder ?? 'desc';
    const orderBy: Prisma.CustomerOrderByWithRelationInput =
      params.sortBy === 'name' ? { name: sortOrder } : { createdAt: sortOrder };

    const customers = await prisma.customer.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy,
      include: {
        orders: {
          select: {
            id: true,
            total: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    });

    const items: CustomerListItem[] = customers.map((c) => {
      const validOrders = c.orders.filter(
        (o) =>
          o.status !== 'CANCELLED' &&
          o.status !== 'RETURNED' &&
          o.paymentStatus !== 'REFUNDED',
      );
      const totalSpentDecimal = validOrders.reduce(
        (sum, o) => sum.plus(new Prisma.Decimal(o.total)),
        new Prisma.Decimal(0),
      );

      let latestOrderAt: string | null = null;
      if (c.orders.length > 0) {
        const latestTime = Math.max(
          ...c.orders.map((o) => o.createdAt.getTime()),
        );
        latestOrderAt = new Date(latestTime).toISOString();
      }

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        deliveryAddress: c.deliveryAddress,
        email: c.email,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        orderCount: c.orders.length,
        totalSpent: toTwo(totalSpentDecimal),
        latestOrderAt,
      };
    });

    if (
      params.sortBy === 'orderCount' ||
      params.sortBy === 'totalSpent' ||
      params.sortBy === 'latestOrderAt'
    ) {
      items.sort((a, b) => {
        if (params.sortBy === 'orderCount') {
          return sortOrder === 'asc'
            ? a.orderCount - b.orderCount
            : b.orderCount - a.orderCount;
        }
        if (params.sortBy === 'totalSpent') {
          return sortOrder === 'asc'
            ? Number(a.totalSpent) - Number(b.totalSpent)
            : Number(b.totalSpent) - Number(a.totalSpent);
        }
        if (params.sortBy === 'latestOrderAt') {
          const timeA = a.latestOrderAt
            ? new Date(a.latestOrderAt).getTime()
            : 0;
          const timeB = b.latestOrderAt
            ? new Date(b.latestOrderAt).getTime()
            : 0;
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
        return 0;
      });
    }

    return { items, total };
  }

  async findCustomerById(id: string): Promise<CustomerRecord | null> {
    return prisma.customer.findUnique({
      where: { id },
    });
  }

  async getCustomerSummary(customerId: string): Promise<CustomerSummary> {
    const orders = await prisma.order.findMany({
      where: { customerId },
      select: {
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    });

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
    let totalSpentDecimal = new Prisma.Decimal(0);

    const times = orders.map((o) => o.createdAt.getTime());
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
        totalSpentDecimal = totalSpentDecimal.plus(new Prisma.Decimal(o.total));
      }
    }

    return {
      orderCount: orders.length,
      totalSpent: toTwo(totalSpentDecimal),
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
    const where: Prisma.OrderWhereInput = {
      customerId,
    };

    if (params.status) {
      where.status = params.status as OrderStatus;
    }
    if (params.paymentStatus) {
      where.paymentStatus = params.paymentStatus as PaymentStatus;
    }
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.createdAt.lte = new Date(params.endDate);
      }
    }

    const total = await prisma.order.count({ where });

    const sortOrder = params.sortOrder ?? 'desc';
    const orderBy: Prisma.OrderOrderByWithRelationInput =
      params.sortBy === 'total'
        ? { total: sortOrder }
        : { createdAt: sortOrder };

    const orders = await prisma.order.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy,
      include: {
        items: true,
      },
    });

    const items: CustomerOrderView[] = orders.map((o) => {
      const mappedItems: CustomerOrderItemView[] = o.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        sku: item.sku,
        sizeLabel: item.sizeLabel,
        unitPrice: toTwo(item.unitPrice),
        unitDiscount: toTwo(item.unitDiscount),
        effectiveUnitPrice: toTwo(item.effectiveUnitPrice),
        quantity: item.quantity,
        subtotal: toTwo(item.subtotal),
      }));

      const itemCount = mappedItems.reduce(
        (acc, item) => acc + item.quantity,
        0,
      );

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
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
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      };
    });

    return { items, total };
  }
}
