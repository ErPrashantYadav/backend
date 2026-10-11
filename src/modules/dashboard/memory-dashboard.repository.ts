import type {
  CheckoutRepository,
  OrderSnapshot,
} from '../checkout/checkout.types';
import type { MemoryVariantItem } from '../inventory/memory-inventory.repository';
import type {
  BestSellingItem,
  DashboardPaymentStatusTotal,
  DashboardRepository,
  DashboardSummary,
  LowStockSummary,
  OrderStatusBreakdownItem,
  OrderStatusBreakdownResult,
  SalesAnalyticsPoint,
  SalesAnalyticsResult,
  SalesGroupBy,
} from './dashboard.types';

function toTwo(n: number): string {
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}

export class MemoryDashboardRepository implements DashboardRepository {
  constructor(
    private readonly checkoutRepository?: CheckoutRepository,
    public standaloneVariants: MemoryVariantItem[] = [],
    public standaloneOrders: OrderSnapshot[] = [],
  ) {}

  private getOrders(): OrderSnapshot[] {
    if (
      this.checkoutRepository &&
      'orders' in this.checkoutRepository &&
      Array.isArray(
        (this.checkoutRepository as { orders: OrderSnapshot[] }).orders,
      )
    ) {
      return (this.checkoutRepository as { orders: OrderSnapshot[] }).orders;
    }
    return this.standaloneOrders;
  }

  private getVariants(): MemoryVariantItem[] {
    if (
      this.checkoutRepository &&
      'variants' in this.checkoutRepository &&
      Array.isArray(
        (this.checkoutRepository as { variants: MemoryVariantItem[] }).variants,
      )
    ) {
      return (this.checkoutRepository as { variants: MemoryVariantItem[] })
        .variants;
    }
    return this.standaloneVariants;
  }

  async getSummary(now = new Date()): Promise<DashboardSummary> {
    const orders = this.getOrders();

    const todayStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const todayEnd = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    let todayOrders = 0;
    let pendingOrders = 0;
    let confirmedOrders = 0;
    let processingOrders = 0;
    let outForDeliveryOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let grossSales = 0;
    let deliveredSales = 0;
    let validOrdersCount = 0;

    const paymentMap: Record<string, { count: number; amount: number }> = {};

    for (const order of orders) {
      const orderDate = new Date(order.createdAt);
      if (orderDate >= todayStart && orderDate <= todayEnd) {
        todayOrders += 1;
      }

      const totalVal = Number(order.total) || 0;

      switch (order.status) {
        case 'PENDING':
          pendingOrders += 1;
          grossSales += totalVal;
          validOrdersCount += 1;
          break;
        case 'CONFIRMED':
          confirmedOrders += 1;
          grossSales += totalVal;
          validOrdersCount += 1;
          break;
        case 'PROCESSING':
          processingOrders += 1;
          grossSales += totalVal;
          validOrdersCount += 1;
          break;
        case 'OUT_FOR_DELIVERY':
          outForDeliveryOrders += 1;
          grossSales += totalVal;
          validOrdersCount += 1;
          break;
        case 'DELIVERED':
          deliveredOrders += 1;
          grossSales += totalVal;
          deliveredSales += totalVal;
          validOrdersCount += 1;
          break;
        case 'CANCELLED':
          cancelledOrders += 1;
          break;
        default:
          grossSales += totalVal;
          validOrdersCount += 1;
          break;
      }

      const pStatus = order.paymentStatus || 'PENDING';
      if (!paymentMap[pStatus]) {
        paymentMap[pStatus] = { count: 0, amount: 0 };
      }
      paymentMap[pStatus]!.count += 1;
      paymentMap[pStatus]!.amount += totalVal;
    }

    const averageOrderValue =
      validOrdersCount > 0 ? toTwo(grossSales / validOrdersCount) : '0.00';

    const paymentTotals: DashboardPaymentStatusTotal[] = Object.entries(
      paymentMap,
    ).map(([status, val]) => ({
      status,
      count: val.count,
      amount: toTwo(val.amount),
    }));

    return {
      totalOrders: orders.length,
      todayOrders,
      pendingOrders,
      confirmedOrders,
      processingOrders,
      outForDeliveryOrders,
      deliveredOrders,
      cancelledOrders,
      grossSales: toTwo(grossSales),
      deliveredSales: toTwo(deliveredSales),
      averageOrderValue,
      paymentTotals,
    };
  }

  async getSalesAnalytics(input: {
    startDate: Date;
    endDate: Date;
    groupBy: SalesGroupBy;
  }): Promise<SalesAnalyticsResult> {
    const orders = this.getOrders();
    const { startDate, endDate, groupBy } = input;

    const filtered = orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= startDate && d <= endDate && o.status !== 'CANCELLED';
    });

    const groups: Record<string, { count: number; sales: number }> = {};

    for (const order of filtered) {
      const d = new Date(order.createdAt);
      let key = '';

      if (groupBy === 'day') {
        key = d.toISOString().slice(0, 10);
      } else if (groupBy === 'month') {
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
      } else if (groupBy === 'week') {
        // Simple Monday-based week key
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setUTCDate(diff);
        key = monday.toISOString().slice(0, 10);
      }

      if (!groups[key]) {
        groups[key] = { count: 0, sales: 0 };
      }
      groups[key]!.count += 1;
      groups[key]!.sales += Number(order.total) || 0;
    }

    const sortedKeys = Object.keys(groups).sort();
    let totalOrders = 0;
    let totalSales = 0;

    const points: SalesAnalyticsPoint[] = sortedKeys.map((key) => {
      const g = groups[key]!;
      totalOrders += g.count;
      totalSales += g.sales;
      const aov = g.count > 0 ? g.sales / g.count : 0;
      return {
        period: key,
        orderCount: g.count,
        totalSales: toTwo(g.sales),
        averageOrderValue: toTwo(aov),
      };
    });

    const averageOrderValue =
      totalOrders > 0 ? toTwo(totalSales / totalOrders) : '0.00';

    return {
      groupBy,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalOrders,
      totalSales: toTwo(totalSales),
      averageOrderValue,
      points,
    };
  }

  async getOrderStatusBreakdown(input?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<OrderStatusBreakdownResult> {
    const orders = this.getOrders();

    const filtered = orders.filter((o) => {
      const d = new Date(o.createdAt);
      if (input?.startDate && d < input.startDate) return false;
      if (input?.endDate && d > input.endDate) return false;
      return true;
    });

    const statusMap: Record<string, { count: number; total: number }> = {};
    for (const o of filtered) {
      const s = o.status;
      if (!statusMap[s]) {
        statusMap[s] = { count: 0, total: 0 };
      }
      statusMap[s]!.count += 1;
      statusMap[s]!.total += Number(o.total) || 0;
    }

    const totalOrders = filtered.length;
    const breakdown: OrderStatusBreakdownItem[] = Object.entries(statusMap).map(
      ([status, data]) => ({
        status,
        count: data.count,
        totalAmount: toTwo(data.total),
        percentageOfTotal:
          totalOrders > 0 ? toTwo((data.count / totalOrders) * 100) : '0.00',
      }),
    );

    return {
      totalOrders,
      breakdown,
    };
  }

  async getBestSellingProducts(input: {
    limit: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<BestSellingItem[]> {
    const orders = this.getOrders();
    const variants = this.getVariants();
    const limit = Math.min(Math.max(1, input.limit), 100);

    const filtered = orders.filter((o) => {
      const d = new Date(o.createdAt);
      if (input.startDate && d < input.startDate) return false;
      if (input.endDate && d > input.endDate) return false;
      return o.status !== 'CANCELLED';
    });

    const map: Record<
      string,
      {
        variantId: string;
        productName: string;
        sku: string;
        sizeLabel: string;
        quantitySold: number;
        totalRevenue: number;
      }
    > = {};

    for (const order of filtered) {
      for (const item of order.items) {
        if (!map[item.variantId]) {
          map[item.variantId] = {
            variantId: item.variantId,
            productName: item.productName,
            sku: item.sku,
            sizeLabel: item.sizeLabel,
            quantitySold: 0,
            totalRevenue: 0,
          };
        }
        map[item.variantId]!.quantitySold += item.quantity;
        map[item.variantId]!.totalRevenue += Number(item.subtotal) || 0;
      }
    }

    const sorted = Object.values(map).sort(
      (a, b) => b.quantitySold - a.quantitySold,
    );

    return sorted.slice(0, limit).map((s) => {
      const v = variants.find((variant) => variant.id === s.variantId);
      return {
        variantId: s.variantId,
        productName: s.productName,
        sku: s.sku,
        sizeLabel: s.sizeLabel,
        quantitySold: s.quantitySold,
        totalRevenue: toTwo(s.totalRevenue),
        currentStock: v ? v.stock : 0,
      };
    });
  }

  async getLowStockSummary(limit = 50): Promise<LowStockSummary> {
    const variants = this.getVariants();
    const activeVariants = variants.filter((v) => v.isActive);
    const boundedLimit = Math.min(Math.max(1, limit), 100);

    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const lowStockItems: LowStockSummary['items'] = [];

    for (const v of activeVariants) {
      if (v.stock === 0) {
        outOfStockCount += 1;
        lowStockItems.push({
          variantId: v.id,
          productId: v.productId,
          productName: v.product?.name ?? 'Product',
          sku: v.sku,
          sizeLabel: v.sizeLabel,
          stock: v.stock,
          lowStockThreshold: v.lowStockThreshold,
          isOutOfStock: true,
        });
      } else if (v.stock <= v.lowStockThreshold) {
        lowStockCount += 1;
        lowStockItems.push({
          variantId: v.id,
          productId: v.productId,
          productName: v.product?.name ?? 'Product',
          sku: v.sku,
          sizeLabel: v.sizeLabel,
          stock: v.stock,
          lowStockThreshold: v.lowStockThreshold,
          isOutOfStock: false,
        });
      } else {
        inStockCount += 1;
      }
    }

    lowStockItems.sort((a, b) => a.stock - b.stock);

    return {
      totalVariants: activeVariants.length,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      items: lowStockItems.slice(0, boundedLimit),
    };
  }
}
