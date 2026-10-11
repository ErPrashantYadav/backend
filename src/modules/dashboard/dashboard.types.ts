export type SalesGroupBy = 'day' | 'week' | 'month';

export interface DashboardPaymentStatusTotal {
  status: string;
  count: number;
  amount: string;
}

export interface DashboardSummary {
  totalOrders: number;
  todayOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  processingOrders: number;
  outForDeliveryOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  grossSales: string;
  deliveredSales: string;
  averageOrderValue: string;
  paymentTotals: DashboardPaymentStatusTotal[];
}

export interface SalesAnalyticsPoint {
  period: string;
  orderCount: number;
  totalSales: string;
  averageOrderValue: string;
}

export interface SalesAnalyticsResult {
  groupBy: SalesGroupBy;
  startDate: string;
  endDate: string;
  totalOrders: number;
  totalSales: string;
  averageOrderValue: string;
  points: SalesAnalyticsPoint[];
}

export interface OrderStatusBreakdownItem {
  status: string;
  count: number;
  totalAmount: string;
  percentageOfTotal: string;
}

export interface OrderStatusBreakdownResult {
  totalOrders: number;
  breakdown: OrderStatusBreakdownItem[];
}

export interface BestSellingItem {
  variantId: string;
  productName: string;
  sku: string;
  sizeLabel: string;
  quantitySold: number;
  totalRevenue: string;
  currentStock: number;
}

export interface LowStockSummaryItem {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  sizeLabel: string;
  stock: number;
  lowStockThreshold: number;
  isOutOfStock: boolean;
}

export interface LowStockSummary {
  totalVariants: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  items: LowStockSummaryItem[];
}

export interface DashboardRepository {
  getSummary(now?: Date): Promise<DashboardSummary>;
  getSalesAnalytics(input: {
    startDate: Date;
    endDate: Date;
    groupBy: SalesGroupBy;
  }): Promise<SalesAnalyticsResult>;
  getOrderStatusBreakdown(input?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<OrderStatusBreakdownResult>;
  getBestSellingProducts(input: {
    limit: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<BestSellingItem[]>;
  getLowStockSummary(limit?: number): Promise<LowStockSummary>;
}

