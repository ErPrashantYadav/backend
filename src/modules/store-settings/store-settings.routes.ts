import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { successResponse } from '../../utils/response';
import type { AdminAuthService } from '../auth/auth.service';
import type { StoreSettingsService } from './store-settings.service';

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

const dayOfWeekEnum = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

const dayScheduleSchema = z.object({
  day: dayOfWeekEnum,
  isOpen: z.boolean(),
  openTime: z.string().nullable().optional(),
  closeTime: z.string().nullable().optional(),
});

const socialLinksSchema = z.object({
  facebook: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  tiktok: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  youtube: z.string().nullable().optional(),
});

const updateSettingsSchema = z.object({
  storeName: z.string().trim().min(1).max(180).optional(),
  storeTagline: z.string().trim().max(255).nullable().optional(),
  primaryPhone: z.string().trim().optional(),
  secondaryPhone: z.string().trim().nullable().optional(),
  supportEmail: z.string().trim().email().optional(),
  address: z.string().trim().min(1).max(255).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  locationUrl: z.string().trim().nullable().optional(),
  socialLinks: socialLinksSchema.nullable().optional(),
  businessHours: z.array(dayScheduleSchema).optional(),
  announcementText: z.string().trim().max(1000).nullable().optional(),
  announcementActive: z.boolean().optional(),
  announcementStartDate: z.string().nullable().optional(),
  announcementEndDate: z.string().nullable().optional(),
  timezone: z.string().trim().optional(),
  storeOriginLatitude: z.number().min(-90).max(90).nullable().optional(),
  storeOriginLongitude: z.number().min(-180).max(180).nullable().optional(),
  deliveryFeeMode: z.enum(['FIXED', 'PER_KM', 'TIERED']).optional(),
  deliveryFeeBaseAmount: z.union([z.number().min(0), z.string()]).optional(),
  deliveryFeePerKmAmount: z.union([z.number().min(0), z.string()]).optional(),
  deliveryFeeFreeThreshold: z
    .union([z.number().min(0), z.string()])
    .nullable()
    .optional(),
  hasExplicitDeliveryFeeFreeThreshold: z.boolean().optional(),
  deliveryMaxDistanceKm: z.union([z.number().gt(0), z.string()]).optional(),
  deliveryFallbackAmount: z.union([z.number().min(0), z.string()]).optional(),
  isOrderingEnabled: z.boolean().optional(),
  orderingMessage: z.string().trim().max(500).nullable().optional(),
});

export function createPublicStoreSettingsRouter(
  settingsService: StoreSettingsService,
): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      const settings = await settingsService.getPublic();
      response
        .status(200)
        .json(
          successResponse('Store settings retrieved successfully', settings),
        );
    }),
  );

  return router;
}

export function createAdminStoreSettingsRouter(
  authService: AdminAuthService,
  settingsService: StoreSettingsService,
): Router {
  const router = Router();
  const authenticate = createAdminAuthenticationMiddleware(authService);

  router.use(authenticate);

  router.get(
    '/',
    requireAdminPermission('settings.read'),
    asyncHandler(async (_request, response) => {
      const settings = await settingsService.getAdmin();
      response
        .status(200)
        .json(
          successResponse(
            'Admin store settings retrieved successfully',
            settings,
          ),
        );
    }),
  );

  const handleUpdate: RequestHandler = asyncHandler(
    async (request, response) => {
      const parsedBody = updateSettingsSchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid store settings update payload',
          parsedBody.error.format(),
        );
      }

      const adminId = request.adminProfile?.id;
      const updated = await settingsService.update(
        {
          ...parsedBody.data,
          announcementStartDate:
            parsedBody.data.announcementStartDate !== undefined
              ? parsedBody.data.announcementStartDate === null
                ? null
                : new Date(parsedBody.data.announcementStartDate)
              : undefined,
          announcementEndDate:
            parsedBody.data.announcementEndDate !== undefined
              ? parsedBody.data.announcementEndDate === null
                ? null
                : new Date(parsedBody.data.announcementEndDate)
              : undefined,
        },
        adminId,
      );

      response
        .status(200)
        .json(successResponse('Store settings updated successfully', updated));
    },
  );

  router.put('/', requireAdminPermission('settings.update'), handleUpdate);
  router.patch('/', requireAdminPermission('settings.update'), handleUpdate);

  return router;
}
