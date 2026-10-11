import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import { createAdminAuthenticationMiddleware } from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import type { CloudinaryService } from './cloudinary.service';
import type { UploadPurpose } from './media.types';

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
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

const deleteSchema = z.object({
  publicId: z.string().trim().min(1).max(255),
});

function handleMulterUpload(multerMiddleware: RequestHandler): RequestHandler {
  return (request, response, next) => {
    multerMiddleware(request, response, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(
              new AppError(
                400,
                'FILE_TOO_LARGE',
                'Uploaded file exceeds the maximum allowed size limit',
              ),
            );
          }
          return next(new AppError(400, 'UPLOAD_ERROR', err.message));
        }
        return next(err);
      }
      next();
    });
  };
}

export function createAdminMediaRouter(
  authService: AdminAuthService,
  cloudinaryService: CloudinaryService,
): Router {
  const router = Router();

  router.use(createAdminAuthenticationMiddleware(authService));

  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Too many upload requests; try again later',
        ),
      );
    },
  });

  router.post(
    '/upload',
    uploadLimiter,
    handleMulterUpload(upload.single('file')),
    asyncHandler(async (request, response) => {
      let buffer: Buffer | undefined;
      let mimeType: string | undefined;
      let originalFilename: string | undefined;

      const bodyPurpose =
        (request.body.purpose as string) || (request.query.purpose as string);
      const purposeParsed = z
        .enum(['PRODUCT_IMAGE', 'PAYMENT_QR'])
        .safeParse(bodyPurpose);

      if (!purposeParsed.success) {
        throw new AppError(
          400,
          'INVALID_UPLOAD_PURPOSE',
          'Upload purpose must be PRODUCT_IMAGE or PAYMENT_QR',
        );
      }
      const purpose: UploadPurpose = purposeParsed.data;

      // Check permissions based on upload purpose
      const adminPermissions = request.adminProfile?.permissions ?? [];

      if (purpose === 'PRODUCT_IMAGE') {
        const hasProductPerm =
          adminPermissions.includes('catalog.product-images.create') ||
          adminPermissions.includes('catalog.product-images.update') ||
          adminPermissions.includes('media.upload');
        if (!hasProductPerm) {
          throw new AppError(
            403,
            'FORBIDDEN',
            'Permission catalog.product-images.create or update required for product image upload',
          );
        }
      } else {
        const hasPaymentPerm =
          adminPermissions.includes('payment-methods.create') ||
          adminPermissions.includes('payment-methods.update') ||
          adminPermissions.includes('media.upload');
        if (!hasPaymentPerm) {
          throw new AppError(
            403,
            'FORBIDDEN',
            'Permission payment-methods.create or update required for payment QR upload',
          );
        }
      }

      if (request.file) {
        buffer = request.file.buffer;
        mimeType = request.file.mimetype;
        originalFilename = request.file.originalname;
      } else if (request.body.fileBase64) {
        let base64 = (request.body.fileBase64 as string).trim();
        mimeType = request.body.mimeType as string | undefined;

        if (base64.startsWith('data:')) {
          const commaIndex = base64.indexOf(',');
          const header = base64.slice(0, commaIndex);
          base64 = base64.slice(commaIndex + 1);
          const mimeMatch = header.match(/data:([^;]+);base64/);
          if (mimeMatch && !mimeType) {
            mimeType = mimeMatch[1];
          }
        }
        buffer = Buffer.from(base64, 'base64');
        originalFilename = request.body.originalFilename as string | undefined;
      }

      if (!buffer || buffer.length === 0) {
        throw new AppError(
          400,
          'MISSING_FILE',
          'No image file provided in multipart "file" or "fileBase64"',
        );
      }

      if (!mimeType) {
        throw new AppError(
          400,
          'MISSING_MIME_TYPE',
          'Image MIME type must be provided',
        );
      }

      const asset = await cloudinaryService.upload({
        buffer,
        mimeType,
        purpose,
        originalFilename,
      });

      response
        .status(201)
        .json(successResponse('Media asset uploaded successfully', asset));
    }),
  );

  router.delete(
    '/',
    asyncHandler(async (request, response) => {
      const parsed = deleteSchema.parse(request.body);
      const publicId = parsed.publicId;

      const adminPermissions = request.adminProfile?.permissions ?? [];

      if (publicId.includes('product')) {
        const hasPerm =
          adminPermissions.includes('catalog.product-images.delete') ||
          adminPermissions.includes('media.manage');
        if (!hasPerm) {
          throw new AppError(
            403,
            'FORBIDDEN',
            'Permission catalog.product-images.delete required',
          );
        }
      } else if (publicId.includes('payment_qr')) {
        const hasPerm =
          adminPermissions.includes('payment-methods.update') ||
          adminPermissions.includes('media.manage');
        if (!hasPerm) {
          throw new AppError(
            403,
            'FORBIDDEN',
            'Permission payment-methods.update required',
          );
        }
      }

      const result = await cloudinaryService.delete({ publicId });
      response
        .status(200)
        .json(successResponse('Asset deleted successfully', result));
    }),
  );

  return router;
}
