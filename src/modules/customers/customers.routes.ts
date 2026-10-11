import { Router, type RequestHandler } from 'express';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import type { CustomerService } from './customers.service';

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

export function createAdminCustomerRouter(
  authService: AdminAuthService,
  customerService: CustomerService,
): Router {
  const router = Router();
  const authenticate = createAdminAuthenticationMiddleware(authService);

  router.use(authenticate);

  router.get(
    '/',
    requireAdminPermission('customers.read'),
    asyncHandler(async (request, response) => {
      const data = await customerService.listCustomers(request.query);
      response
        .status(200)
        .json(successResponse('Customers retrieved successfully', data));
    }),
  );

  router.get(
    '/:id',
    requireAdminPermission('customers.read'),
    asyncHandler(async (request, response) => {
      const id = request.params.id as string;
      const data = await customerService.getCustomerById(id);
      response
        .status(200)
        .json(successResponse('Customer retrieved successfully', data));
    }),
  );

  router.get(
    '/:id/orders',
    requireAdminPermission('customers.read'),
    asyncHandler(async (request, response) => {
      const id = request.params.id as string;
      const data = await customerService.getCustomerOrders(id, request.query);
      response
        .status(200)
        .json(successResponse('Customer orders retrieved successfully', data));
    }),
  );

  return router;
}
