import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  BestSellingItem,
  DashboardRepository,
  DashboardSummary,
  LowStockSummary,
  OrderStatusBreakdownResult,
  SalesAnalyticsResult,
  SalesGroupBy,
} from './dashboard.types';

function toTwo(n: number | string | Prisma.Decimal | null | undefined): string {
  if (n === null || n === undefined) return '0.00';
  const num = typeof n === 'number' ? n : Number(n);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

export class PrismaDashboardRepository implements DashboardRepository {
  async getSummary(now = new Date()): Promise<DashboardSummary> {
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

    const [totalOrders, todayOrders, statusGroups, paymentGroups] =
      await Promise.all([
        prisma.order.count(),
        prisma.order.count({
          where: { createdAt: { gte: todayStart, lte: todayEnd } },
        }),
        prisma.order.groupBy({
          by: ['status'],
          _count: { id: true },
          _sum: { total: true },
        }),
        prisma.order.groupBy({
          by: ['paymentStatus'],
          _count: { id: true },
          _sum: { total: true },
        }),
      ]);

    let pendingOrders = 0;
    let confirmedOrders = 0;
    let processingOrders = 0;
    let outForDeliveryOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let grossSalesDec = new Prisma.Decimal(0);
    let deliveredSalesDec = new Prisma.Decimal(0);
    let validOrdersCount = 0;

    for (const sg of statusGroups) {
      const count = sg._count.id;
      const sum = sg._sum.total ?? new Prisma.Decimal(0);

      switch (sg.status) {
        case 'PENDING':
          pendingOrders = count;
          grossSalesDec = grossSalesDec.plus(sum);
          validOrdersCount += count;
          break;
        case 'CONFIRMED':
          confirmedOrders = count;
          grossSalesDec = grossSalesDec.plus(sum);
          validOrdersCount += count;
          break;
        case 'PROCESSING':
          processingOrders = count;
          grossSalesDec = grossSalesDec.plus(sum);
          validOrdersCount += count;
          break;
        case 'OUT_FOR_DELIVERY':
          outForDeliveryOrders = count;
          grossSalesDec = grossSalesDec.plus(sum);
          validOrdersCount += count;
          break;
        case 'DELIVERED':
          deliveredOrders = count;
          grossSalesDec = grossSalesDec.plus(sum);
          deliveredSalesDec = deliveredSalesDec.plus(sum);
          validOrdersCount += count;
          break;
        case 'CANCELLED':
          cancelledOrders = count;
          break;
      }
    }

    const averageOrderValue =
      validOrdersCount > 0
        ? toTwo(grossSalesDec.dividedBy(validOrdersCount).toNumber())
        : '0.00';

    const paymentTotals = paymentGroups.map((pg) => ({
      status: pg.paymentStatus,
      count: pg._count.id,
      amount: toTwo(pg._sum.total),
    }));

    return {
      totalOrders,
      todayOrders,
      pendingOrders,
      confirmedOrders,
      processingOrders,
      outForDeliveryOrders,
      deliveredOrders,
      cancelledOrders,
      grossSales: toTwo(grossSalesDec),
      deliveredSales: toTwo(deliveredSalesDec),
      averageOrderValue,
      paymentTotals,
    };
  }

  async getSalesAnalytics(input: {
    startDate: Date;
    endDate: Date;
    groupBy: SalesGroupBy;
  }): Promise<SalesAnalyticsResult> {
    const { startDate, endDate, groupBy } = input;

    // Use PostgreSQL date_trunc for database aggregation
    const rawPoints = await prisma.$queryRaw<
      Array<{
        period: string;
        orderCount: number;
        totalSales: number | string | Prisma.Decimal;
      }>
    >`
      SELECT
        to_char(date_trunc(${groupBy}, "createdAt"), 'YYYY-MM-DD') AS "period",
        COUNT(*)::int AS "orderCount",
        COALESCE(SUM("total"), 0)::numeric AS "totalSales"
      FROM "Order"
      WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
        AND "status" != 'CANCELLED'
      GROUP BY date_trunc(${groupBy}, "createdAt")
      ORDER BY date_trunc(${groupBy}, "createdAt") ASC
    `;

    let totalOrders = 0;
    let totalSalesDec = new Prisma.Decimal(0);

    const points = rawPoints.map((pt) => {
      const count = Number(pt.orderCount);
      const salesDec = new Prisma.Decimal(pt.totalSales.toString());
      totalOrders += count;
      totalSalesDec = totalSalesDec.plus(salesDec);

      const aov = count > 0 ? salesDec.dividedBy(count).toNumber() : 0;

      return {
        period: pt.period,
        orderCount: count,
        totalSales: toTwo(salesDec),
        averageOrderValue: toTwo(aov),
      };
    });

    const averageOrderValue =
      totalOrders > 0
        ? toTwo(totalSalesDec.dividedBy(totalOrders).toNumber())
        : '0.00';

    return {
      groupBy,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalOrders,
      totalSales: toTwo(totalSalesDec),
      averageOrderValue,
      points,
    };
  }

  async getOrderStatusBreakdown(input?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<OrderStatusBreakdownResult> {
    const where: Prisma.OrderWhereInput = {};
    if (input?.startDate || input?.endDate) {
      where.createdAt = {};
      if (input.startDate) where.createdAt.gte = input.startDate;
      if (input.endDate) where.createdAt.lte = input.endDate;
    }

    const [totalOrders, groups] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
        _sum: { total: true },
      }),
    ]);

    const breakdown = groups.map((g) => {
      const count = g._count.id;
      const percentage =
        totalOrders > 0 ? ((count / totalOrders) * 100).toFixed(2) : '0.00';

      return {
        status: g.status,
        count,
        totalAmount: toTwo(g._sum.total),
        percentageOfTotal: percentage,
      };
    });

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
    const limit = Math.min(Math.max(1, input.limit), 100);

    const rows = await prisma.$queryRaw<
      Array<{
        variantId: string;
        productName: string;
        sku: string;
        sizeLabel: string;
        quantitySold: number;
        totalRevenue: number | string | Prisma.Decimal;
        currentStock: number;
      }>
    >`
      SELECT
        oi."variantId",
        oi."productName",
        oi."sku",
        oi."sizeLabel",
        SUM(oi."quantity")::int AS "quantitySold",
        COALESCE(SUM(oi."subtotal"), 0)::numeric AS "totalRevenue",
        COALESCE(pv."stock", 0)::int AS "currentStock"
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "ProductVariant" pv ON pv."id" = oi."variantId"
      WHERE o."status" != 'CANCELLED'
        AND (${input.startDate ?? null}::timestamptz IS NULL OR o."createdAt" >= ${input.startDate ?? null})
        AND (${input.endDate ?? null}::timestamptz IS NULL OR o."createdAt" <= ${input.endDate ?? null})
      GROUP BY oi."variantId", oi."productName", oi."sku", oi."sizeLabel", pv."stock"
      ORDER BY "quantitySold" DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      variantId: r.variantId,
      productName: r.productName,
      sku: r.sku,
      sizeLabel: r.sizeLabel,
      quantitySold: Number(r.quantitySold),
      totalRevenue: toTwo(r.totalRevenue),
      currentStock: Number(r.currentStock),
    }));
  }

  async getLowStockSummary(limit = 50): Promise<LowStockSummary> {
    const boundedLimit = Math.min(Math.max(1, limit), 100);

    const [countsRaw, items] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          totalVariants: number;
          outOfStockCount: number;
          lowStockCount: number;
          inStockCount: number;
        }>
      >`
        SELECT
          COUNT(*)::int AS "totalVariants",
          COUNT(*) FILTER (WHERE pv."stock" = 0)::int AS "outOfStockCount",
          COUNT(*) FILTER (WHERE pv."stock" > 0 AND pv."stock" <= pv."lowStockThreshold")::int AS "lowStockCount",
          COUNT(*) FILTER (WHERE pv."stock" > pv."lowStockThreshold")::int AS "inStockCount"
        FROM "ProductVariant" pv
        WHERE pv."isActive" = true
      `,
      prisma.$queryRaw<
        Array<{
          variantId: string;
          productId: string;
          productName: string;
          sku: string;
          sizeLabel: string;
          stock: number;
          lowStockThreshold: number;
          isOutOfStock: boolean;
        }>
      >`
        SELECT
          pv."id" AS "variantId",
          pv."productId",
          p."name" AS "productName",
          pv."sku",
          pv."sizeLabel",
          pv."stock",
          pv."lowStockThreshold",
          (pv."stock" = 0) AS "isOutOfStock"
        FROM "ProductVariant" pv
        JOIN "Product" p ON p."id" = pv."productId"
        WHERE pv."isActive" = true AND pv."stock" <= pv."lowStockThreshold"
        ORDER BY pv."stock" ASC, p."name" ASC
        LIMIT ${boundedLimit}
      `,
    ]);

    const counts = countsRaw[0] ?? {
      totalVariants: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
      inStockCount: 0,
    };

    return {
      totalVariants: Number(counts.totalVariants),
      inStockCount: Number(counts.inStockCount),
      lowStockCount: Number(counts.lowStockCount),
      outOfStockCount: Number(counts.outOfStockCount),
      items: items.map((i) => ({
        variantId: i.variantId,
        productId: i.productId,
        productName: i.productName,
        sku: i.sku,
        sizeLabel: i.sizeLabel,
        stock: Number(i.stock),
        lowStockThreshold: Number(i.lowStockThreshold),
        isOutOfStock: Boolean(i.isOutOfStock),
      })),
    };
  }
}
