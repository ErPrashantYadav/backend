import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { validateBody } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import { extractOrderLookupToken } from '../checkout/checkout.routes';
import type { CloudinaryService } from '../media/cloudinary.service';
import { validateImageBuffer } from '../media/image-validator';
import type { PaymentSubmissionService } from './payment-submission.service';
import type { PaymentSubmissionStatus } from './payment-submission.types';

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
});

function handleOptionalMulterUpload(
  multerMiddleware: RequestHandler,
): RequestHandler {
  return (request, response, next) => {
    const contentType = request.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      multerMiddleware(request, response, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return next(
                new AppError(
                  400,
                  'FILE_TOO_LARGE',
                  'Payment proof screenshot exceeds 5 MB size limit',
                ),
              );
            }
            return next(new AppError(400, 'UPLOAD_ERROR', err.message));
          }
          return next(err);
        }
        next();
      });
    } else {
      next();
    }
  };
}

const submitProofSchema = z.object({
  proofImageUrl: z.string().trim().min(5).max(2048).optional(),
  transactionReference: z.string().trim().max(120).optional().nullable(),
  customerNotes: z.string().trim().max(500).optional().nullable(),
  orderLookupToken: z.string().trim().optional(),
});

const rejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Rejection reason must be at least 3 characters')
    .max(500, 'Rejection reason must not exceed 500 characters'),
});

const reviewSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('APPROVE') }),
  z.object({
    action: z.literal('REJECT'),
    reason: z
      .string()
      .trim()
      .min(3, 'Rejection reason must be at least 3 characters')
      .max(500, 'Rejection reason must not exceed 500 characters'),
  }),
]);

export function createPublicPaymentSubmissionRouter(
  service: PaymentSubmissionService,
  cloudinaryService?:
    CloudinaryService | (() => CloudinaryService | undefined | null),
): Router {
  const router = Router();

  const submissionRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Too many payment submission attempts; try again later',
        ),
      );
    },
  });

  router.post(
    '/:orderNumber/payment-proof',
    submissionRateLimiter,
    handleOptionalMulterUpload(upload.single('file')),
    validateBody(submitProofSchema),
    asyncHandler(async (request, response) => {
      const orderNumber = z.string().min(1).parse(request.params.orderNumber);
      const token =
        extractOrderLookupToken(request) ||
        (request.body?.orderLookupToken as string | undefined);

      if (!token || !token.trim()) {
        throw new AppError(
          404,
          'ORDER_NOT_FOUND',
          'Order not found or invalid lookup token',
        );
      }

      // Guest order verification before accepting or uploading any proof
      await service.verifyOrderForProofSubmission(orderNumber, token);

      let proofImageUrl = (
        request.body?.proofImageUrl as string | undefined
      )?.trim();

      if (request.file) {
        validateImageBuffer(
          request.file.buffer,
          request.file.mimetype,
          'PAYMENT_PROOF',
        );

        const cloudinary =
          typeof cloudinaryService === 'function'
            ? cloudinaryService()
            : cloudinaryService;

        if (!cloudinary) {
          throw new AppError(
            500,
            'CLOUDINARY_CONFIG_MISSING',
            'Image upload service is not configured',
          );
        }

        const uploadResult = await cloudinary.upload({
          buffer: request.file.buffer,
          mimeType: request.file.mimetype,
          purpose: 'PAYMENT_PROOF',
          originalFilename: request.file.originalname,
        });

        proofImageUrl = uploadResult.secureUrl;
      }

      if (!proofImageUrl) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Either a proof image file or proofImageUrl must be provided',
        );
      }

      const result = await service.submitPaymentProof({
        orderNumber,
        orderLookupToken: token,
        proofImageUrl,
        transactionReference: request.body?.transactionReference,
        customerNotes: request.body?.customerNotes,
      });

      response
        .status(201)
        .json(successResponse('Payment proof submitted successfully', result));
    }),
  );

  return router;
}

export function createAdminPaymentSubmissionRouter(
  authService: AdminAuthService,
  service: PaymentSubmissionService,
): Router {
  const router = Router();
  const authenticate = createAdminAuthenticationMiddleware(authService);

  router.use(authenticate);

  router.get(
    '/',
    requireAdminPermission('payment-submissions.read'),
    asyncHandler(async (request, response) => {
      const page = request.query.page
        ? parseInt(request.query.page as string, 10)
        : 1;
      const pageSize = request.query.pageSize
        ? parseInt(request.query.pageSize as string, 10)
        : 20;
      const status = request.query.status as
        PaymentSubmissionStatus | undefined;
      const orderNumber = request.query.orderNumber as string | undefined;

      const data = await service.listSubmissions({
        page,
        pageSize,
        status,
        orderNumber,
      });

      response
        .status(200)
        .json(
          successResponse('Payment submissions retrieved successfully', data),
        );
    }),
  );

  router.get(
    '/:id',
    requireAdminPermission('payment-submissions.read'),
    asyncHandler(async (request, response) => {
      const id = z.string().uuid().parse(request.params.id);
      const data = await service.getSubmissionById(id);
      response
        .status(200)
        .json(
          successResponse('Payment submission retrieved successfully', data),
        );
    }),
  );

  router.post(
    '/:id/approve',
    requireAdminPermission('payment-submissions.review'),
    asyncHandler(async (request, response) => {
      const id = z.string().uuid().parse(request.params.id);
      const adminId = request.adminProfile!.id;
      const data = await service.approveSubmission(id, adminId);
      response
        .status(200)
        .json(
          successResponse('Payment submission approved successfully', data),
        );
    }),
  );

  router.post(
    '/:id/reject',
    requireAdminPermission('payment-submissions.review'),
    validateBody(rejectSchema),
    asyncHandler(async (request, response) => {
      const id = z.string().uuid().parse(request.params.id);
      const adminId = request.adminProfile!.id;
      const data = await service.rejectSubmission(
        id,
        adminId,
        request.body.reason,
      );
      response
        .status(200)
        .json(
          successResponse('Payment submission rejected successfully', data),
        );
    }),
  );

  router.post(
    '/:id/review',
    requireAdminPermission('payment-submissions.review'),
    validateBody(reviewSchema),
    asyncHandler(async (request, response) => {
      const id = z.string().uuid().parse(request.params.id);
      const adminId = request.adminProfile!.id;
      let data;
      if (request.body.action === 'APPROVE') {
        data = await service.approveSubmission(id, adminId);
      } else {
        data = await service.rejectSubmission(
          id,
          adminId,
          request.body.reason!,
        );
      }
      response
        .status(200)
        .json(
          successResponse(
            `Payment submission ${request.body.action.toLowerCase()}d successfully`,
            data,
          ),
        );
    }),
  );

  return router;
}
