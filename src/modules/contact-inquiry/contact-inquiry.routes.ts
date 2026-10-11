import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../../errors/app-error';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import type { ContactInquiryService } from './contact-inquiry.service';

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

export function createPublicContactInquiryRouter(
  contactService: ContactInquiryService,
): Router {
  const router = Router();

  const publicSubmissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Too many contact submissions from this IP; please try again later',
        ),
      );
    },
  });

  router.post(
    '/',
    publicSubmissionLimiter,
    asyncHandler(async (request, response) => {
      const result = await contactService.submitPublicInquiry(request.body);
      response
        .status(201)
        .json(successResponse('Inquiry submitted successfully', result));
    }),
  );

  return router;
}

export function createAdminContactInquiryRouter(
  authService: AdminAuthService,
  contactService: ContactInquiryService,
): Router {
  const router = Router();
  const authenticate = createAdminAuthenticationMiddleware(authService);

  router.use(authenticate);

  router.get(
    '/',
    requireAdminPermission('contact-inquiries.read'),
    asyncHandler(async (request, response) => {
      const result = await contactService.listInquiries(request.query);
      response
        .status(200)
        .json(successResponse('Inquiries retrieved successfully', result));
    }),
  );

  router.get(
    '/:id',
    requireAdminPermission('contact-inquiries.read'),
    asyncHandler(async (request, response) => {
      const id = request.params.id as string;
      const result = await contactService.getInquiryById(id);
      response
        .status(200)
        .json(successResponse('Inquiry retrieved successfully', result));
    }),
  );

  const handleUpdateStatus: RequestHandler = asyncHandler(
    async (request, response) => {
      const id = request.params.id as string;
      const adminId = request.adminProfile?.id;
      const result = await contactService.updateInquiryStatus(
        id,
        request.body,
        adminId,
      );
      response
        .status(200)
        .json(successResponse('Inquiry status updated successfully', result));
    },
  );

  router.patch(
    '/:id/status',
    requireAdminPermission('contact-inquiries.update'),
    handleUpdateStatus,
  );

  router.put(
    '/:id/status',
    requireAdminPermission('contact-inquiries.update'),
    handleUpdateStatus,
  );

  router.delete(
    '/:id',
    requireAdminPermission('contact-inquiries.update'),
    asyncHandler(async (request, response) => {
      const id = request.params.id as string;
      const adminId = request.adminProfile?.id;
      await contactService.deleteInquiry(id, adminId);
      response
        .status(200)
        .json(successResponse('Inquiry deleted successfully', { id }));
    }),
  );

  return router;
}
