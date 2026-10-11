import { Router, type RequestHandler } from 'express';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import type { AuditService } from './audit.service';

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

export function createAdminAuditRouter(
  authService: AdminAuthService,
  auditService: AuditService,
): Router {
  const router = Router();
  const authenticate = createAdminAuthenticationMiddleware(authService);

  router.use(authenticate);

  router.get(
    '/',
    requireAdminPermission('audit-logs.read'),
    asyncHandler(async (request, response) => {
      const page = request.query.page
        ? parseInt(request.query.page as string, 10)
        : 1;
      const pageSize = request.query.pageSize
        ? parseInt(request.query.pageSize as string, 10)
        : 20;
      const action = request.query.action as string | undefined;
      const resourceType = request.query.resourceType as string | undefined;
      const resourceId = request.query.resourceId as string | undefined;
      const actorAdminId = request.query.actorAdminId as string | undefined;
      const dateFrom = request.query.dateFrom as string | undefined;
      const dateTo = request.query.dateTo as string | undefined;

      const data = await auditService.listLogs({
        page,
        pageSize,
        action,
        resourceType,
        resourceId,
        actorAdminId,
        dateFrom,
        dateTo,
      });

      response
        .status(200)
        .json(successResponse('Audit logs retrieved successfully', data));
    }),
  );

  return router;
}
