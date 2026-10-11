import { AppError } from '../../errors/app-error';
import type {
  BestSellingItem,
  DashboardRepository,
  DashboardSummary,
  LowStockSummary,
  OrderStatusBreakdownResult,
  SalesAnalyticsResult,
  SalesGroupBy,
} from './dashboard.types';

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async getSummary(now = new Date()): Promise<DashboardSummary> {
    return this.repository.getSummary(now);
  }

  async getSalesAnalytics(query: {
    startDate?: string;
    endDate?: string;
    groupBy?: string;
  }): Promise<SalesAnalyticsResult> {
    const groupBy: SalesGroupBy =
      query.groupBy === 'week' || query.groupBy === 'month'
        ? query.groupBy
        : 'day';

    if (
      query.groupBy &&
      query.groupBy !== 'day' &&
      query.groupBy !== 'week' &&
      query.groupBy !== 'month'
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        "groupBy must be 'day', 'week', or 'month'",
      );
    }

    const now = new Date();
    const end = query.endDate ? new Date(query.endDate) : now;
    if (isNaN(end.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid endDate format');
    }

    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (isNaN(start.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid startDate format');
    }

    if (start > end) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'startDate must be less than or equal to endDate',
      );
    }

    return this.repository.getSalesAnalytics({
      startDate: start,
      endDate: end,
      groupBy,
    });
  }

  async getOrderStatusBreakdown(query?: {
    startDate?: string;
    endDate?: string;
  }): Promise<OrderStatusBreakdownResult> {
    let start: Date | undefined;
    let end: Date | undefined;

    if (query?.startDate) {
      start = new Date(query.startDate);
      if (isNaN(start.getTime())) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid startDate format');
      }
    }

    if (query?.endDate) {
      end = new Date(query.endDate);
      if (isNaN(end.getTime())) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid endDate format');
      }
    }

    if (start && end && start > end) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'startDate must be less than or equal to endDate',
      );
    }

    return this.repository.getOrderStatusBreakdown({
      startDate: start,
      endDate: end,
    });
  }

  async getBestSellingProducts(query?: {
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<BestSellingItem[]> {
    let start: Date | undefined;
    let end: Date | undefined;

    if (query?.startDate) {
      start = new Date(query.startDate);
      if (isNaN(start.getTime())) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid startDate format');
      }
    }

    if (query?.endDate) {
      end = new Date(query.endDate);
      if (isNaN(end.getTime())) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid endDate format');
      }
    }

    if (start && end && start > end) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'startDate must be less than or equal to endDate',
      );
    }

    const limit = query?.limit ?? 10;
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'limit must be a positive integer',
      );
    }

    return this.repository.getBestSellingProducts({
      limit: Math.min(limit, 100),
      startDate: start,
      endDate: end,
    });
  }

  async getLowStockSummary(limit = 50): Promise<LowStockSummary> {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'limit must be a positive integer',
      );
    }

    return this.repository.getLowStockSummary(Math.min(limit, 100));
  }
}
