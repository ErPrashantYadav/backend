import { Router, type RequestHandler } from 'express';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import { DashboardService } from './dashboard.service';
import type { DashboardRepository } from './dashboard.types';

function asyncHandler(
  handler: (
    request: Parameters<RequestHandler>[0],
    response: Parameters<RequestHandler>[1],
  ) => Promise<void>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response).catch(next);
  };
}

export function createAdminDashboardRouter(
  authService: AdminAuthService,
  dashboardRepository: DashboardRepository,
  dashboardService?: DashboardService,
): Router {
  const router = Router();
  const service = dashboardService ?? new DashboardService(dashboardRepository);

  router.use(createAdminAuthenticationMiddleware(authService));
  router.use(requireAdminPermission('dashboard.read'));

  // 1. Summary / Overview metrics
  const getSummaryHandler: RequestHandler = asyncHandler(
    async (_request, response) => {
      const summary = await service.getSummary();
      response.json(successResponse('Dashboard summary retrieved', summary));
    },
  );
  router.get('/summary', getSummaryHandler);
  router.get('/overview', getSummaryHandler);

  // 2. Sales analytics
  const getSalesHandler: RequestHandler = asyncHandler(
    async (request, response) => {
      const startDate =
        typeof request.query.startDate === 'string'
          ? request.query.startDate
          : undefined;
      const endDate =
        typeof request.query.endDate === 'string'
          ? request.query.endDate
          : undefined;
      const groupBy =
        typeof request.query.groupBy === 'string'
          ? request.query.groupBy
          : undefined;

      const sales = await service.getSalesAnalytics({
        startDate,
        endDate,
        groupBy,
      });
      response.json(successResponse('Sales analytics retrieved', sales));
    },
  );
  router.get('/sales', getSalesHandler);
  router.get('/sales-chart', getSalesHandler);

  // 3. Order status breakdown
  const getStatusBreakdownHandler: RequestHandler = asyncHandler(
    async (request, response) => {
      const startDate =
        typeof request.query.startDate === 'string'
          ? request.query.startDate
          : undefined;
      const endDate =
        typeof request.query.endDate === 'string'
          ? request.query.endDate
          : undefined;

      const breakdown = await service.getOrderStatusBreakdown({
        startDate,
        endDate,
      });
      response.json(
        successResponse('Order status breakdown retrieved', breakdown),
      );
    },
  );
  router.get('/order-status-breakdown', getStatusBreakdownHandler);
  router.get('/orders/status-breakdown', getStatusBreakdownHandler);

  // 4. Best-selling products & variants
  const getTopProductsHandler: RequestHandler = asyncHandler(
    async (request, response) => {
      const limit =
        typeof request.query.limit === 'string'
          ? parseInt(request.query.limit, 10)
          : undefined;
      const startDate =
        typeof request.query.startDate === 'string'
          ? request.query.startDate
          : undefined;
      const endDate =
        typeof request.query.endDate === 'string'
          ? request.query.endDate
          : undefined;

      const topProducts = await service.getBestSellingProducts({
        limit,
        startDate,
        endDate,
      });
      response.json(
        successResponse('Best-selling products retrieved', topProducts),
      );
    },
  );
  router.get('/top-products', getTopProductsHandler);
  router.get('/best-sellers', getTopProductsHandler);

  // 5. Low-stock summary
  const getLowStockHandler: RequestHandler = asyncHandler(
    async (request, response) => {
      const limit =
        typeof request.query.limit === 'string'
          ? parseInt(request.query.limit, 10)
          : undefined;

      const lowStock = await service.getLowStockSummary(limit);
      response.json(successResponse('Low-stock summary retrieved', lowStock));
    },
  );
  router.get('/low-stock', getLowStockHandler);
  router.get('/inventory', getLowStockHandler);

  return router;
}
