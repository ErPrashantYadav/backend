import { AppError } from '../../errors/app-error';
import { validateBusinessHours } from '../../utils/business-hours';
import type { AuditService } from '../audit/audit.service';
import { MINIMUM_ORDER_SUBTOTAL } from '../checkout/checkout.service';
import type { AppConfig } from '../../config/env';
import {
  resolveEffectiveDeliveryFreeThreshold,
  type DeliveryFeeMode,
  type PublicStoreSettings,
  type StoreSettingsRecord,
  type StoreSettingsRepository,
  type UpdateStoreSettingsInput,
} from './store-settings.types';

const PHONE_REGEX = /^\+?[0-9\s-]{7,25}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function parseNonNegativeDecimal(val: unknown, fieldName: string): string {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} must be a non-negative number`,
    );
  }
  return num.toFixed(2);
}

function parsePositiveDecimal(val: unknown, fieldName: string): string {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} must be a positive number greater than 0`,
    );
  }
  return num.toFixed(2);
}

export class StoreSettingsService {
  constructor(
    private readonly repository: StoreSettingsRepository,
    private readonly auditService?: AuditService,
    private readonly config?: Partial<AppConfig>,
  ) {}

  async getAdmin(): Promise<StoreSettingsRecord> {
    return this.repository.get();
  }

  async getPublic(now: Date = new Date()): Promise<PublicStoreSettings> {
    const settings = await this.repository.get();

    let announcement: { text: string; active: boolean } | null = null;
    if (settings.announcementActive && settings.announcementText?.trim()) {
      const startOk =
        !settings.announcementStartDate ||
        settings.announcementStartDate.getTime() <= now.getTime();
      const endOk =
        !settings.announcementEndDate ||
        settings.announcementEndDate.getTime() >= now.getTime();

      if (startOk && endOk) {
        announcement = {
          text: settings.announcementText.trim(),
          active: true,
        };
      }
    }

    const defaultMode =
      this.config?.DELIVERY_FEE_MODE ?? ('PER_KM' as DeliveryFeeMode);
    const defaultBase =
      this.config?.DELIVERY_FEE_BASE_AMOUNT !== undefined
        ? Number(this.config.DELIVERY_FEE_BASE_AMOUNT).toFixed(2)
        : '100.00';
    const defaultPerKm =
      this.config?.DELIVERY_FEE_PER_KM_AMOUNT !== undefined
        ? Number(this.config.DELIVERY_FEE_PER_KM_AMOUNT).toFixed(2)
        : '25.00';
    const effectiveFreeThreshold = resolveEffectiveDeliveryFreeThreshold(
      settings,
      this.config?.DELIVERY_FEE_FREE_THRESHOLD,
    );
    const defaultMaxDistance =
      this.config?.DELIVERY_MAX_DISTANCE_KM !== undefined
        ? Number(this.config.DELIVERY_MAX_DISTANCE_KM).toFixed(2)
        : '25.00';
    const defaultFallback =
      this.config?.DELIVERY_FALLBACK_AMOUNT !== undefined
        ? Number(this.config.DELIVERY_FALLBACK_AMOUNT).toFixed(2)
        : '0.00';

    return {
      storeName: settings.storeName,
      storeTagline: settings.storeTagline,
      primaryPhone: settings.primaryPhone,
      secondaryPhone: settings.secondaryPhone,
      supportEmail: settings.supportEmail,
      address: settings.address,
      city: settings.city,
      locationUrl: settings.locationUrl,
      socialLinks: settings.socialLinks,
      businessHours: settings.businessHours,
      announcement,
      timezone: settings.timezone,
      minOrderSubtotal: MINIMUM_ORDER_SUBTOTAL,

      // Origin coordinates (non-secret location info)
      storeOriginLatitude:
        settings.storeOriginLatitude ??
        this.config?.STORE_ORIGIN_LATITUDE ??
        null,
      storeOriginLongitude:
        settings.storeOriginLongitude ??
        this.config?.STORE_ORIGIN_LONGITUDE ??
        null,

      // Delivery Pricing (public summary)
      deliveryPricing: {
        mode: settings.deliveryFeeMode ?? defaultMode,
        baseAmount: settings.deliveryFeeBaseAmount ?? defaultBase,
        perKmAmount: settings.deliveryFeePerKmAmount ?? defaultPerKm,
        freeDeliveryThreshold:
          effectiveFreeThreshold !== null
            ? effectiveFreeThreshold.toFixed(2)
            : null,
        maxDistanceKm: settings.deliveryMaxDistanceKm ?? defaultMaxDistance,
        fallbackAmount: settings.deliveryFallbackAmount ?? defaultFallback,
      },

      // Ordering Switch
      isOrderingEnabled: settings.isOrderingEnabled,
      orderingMessage: settings.orderingMessage,
    };
  }

  async update(
    input: UpdateStoreSettingsInput,
    actorAdminId?: string,
  ): Promise<StoreSettingsRecord> {
    const existing = await this.repository.get();
    const payload: UpdateStoreSettingsInput = {};

    if (input.storeName !== undefined) {
      const name = input.storeName.trim();
      if (!name || name.length > 180) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'storeName is required and must not exceed 180 characters',
        );
      }
      payload.storeName = name;
    }

    if (input.storeTagline !== undefined) {
      payload.storeTagline = input.storeTagline?.trim() || null;
    }

    if (input.primaryPhone !== undefined) {
      const phone = input.primaryPhone.trim();
      if (!phone || !PHONE_REGEX.test(phone)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'primaryPhone must be a valid phone number (7-25 digits)',
        );
      }
      payload.primaryPhone = phone;
    }

    if (input.secondaryPhone !== undefined) {
      const phone = input.secondaryPhone?.trim();
      if (phone && !PHONE_REGEX.test(phone)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'secondaryPhone must be a valid phone number',
        );
      }
      payload.secondaryPhone = phone || null;
    }

    if (input.supportEmail !== undefined) {
      const email = input.supportEmail.trim();
      if (!email || !EMAIL_REGEX.test(email)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'supportEmail must be a valid email address',
        );
      }
      payload.supportEmail = email;
    }

    if (input.address !== undefined) {
      const addr = input.address.trim();
      if (!addr || addr.length > 255) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'address is required and must not exceed 255 characters',
        );
      }
      payload.address = addr;
    }

    if (input.city !== undefined) {
      const city = input.city.trim();
      if (!city || city.length > 100) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'city is required and must not exceed 100 characters',
        );
      }
      payload.city = city;
    }

    if (input.locationUrl !== undefined) {
      const url = input.locationUrl?.trim();
      if (url && !isValidUrl(url)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'locationUrl must be a valid URL starting with http:// or https://',
        );
      }
      payload.locationUrl = url || null;
    }

    if (input.timezone !== undefined) {
      const tz = input.timezone.trim();
      if (!tz || !isValidTimezone(tz)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `timezone '${tz}' is not a valid IANA timezone name`,
        );
      }
      payload.timezone = tz;
    }

    if (input.socialLinks !== undefined) {
      if (input.socialLinks) {
        const links = input.socialLinks;
        for (const [key, val] of Object.entries(links)) {
          if (val && typeof val === 'string' && val.trim()) {
            if (key !== 'whatsapp' && !isValidUrl(val.trim())) {
              throw new AppError(
                400,
                'VALIDATION_ERROR',
                `Social link for '${key}' must be a valid URL`,
              );
            }
          }
        }
        payload.socialLinks = links;
      } else {
        payload.socialLinks = null;
      }
    }

    if (input.businessHours !== undefined) {
      payload.businessHours = validateBusinessHours(input.businessHours);
    }

    if (input.announcementText !== undefined) {
      payload.announcementText = input.announcementText?.trim() || null;
    }

    if (input.announcementActive !== undefined) {
      payload.announcementActive = Boolean(input.announcementActive);
    }

    let effectiveStartDate = existing.announcementStartDate;
    let effectiveEndDate = existing.announcementEndDate;

    if (input.announcementStartDate !== undefined) {
      if (input.announcementStartDate === null) {
        effectiveStartDate = null;
        payload.announcementStartDate = null;
      } else {
        const d = new Date(input.announcementStartDate);
        if (isNaN(d.getTime())) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Invalid announcementStartDate format',
          );
        }
        effectiveStartDate = d;
        payload.announcementStartDate = d;
      }
    }

    if (input.announcementEndDate !== undefined) {
      if (input.announcementEndDate === null) {
        effectiveEndDate = null;
        payload.announcementEndDate = null;
      } else {
        const d = new Date(input.announcementEndDate);
        if (isNaN(d.getTime())) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Invalid announcementEndDate format',
          );
        }
        effectiveEndDate = d;
        payload.announcementEndDate = d;
      }
    }

    if (
      effectiveStartDate &&
      effectiveEndDate &&
      effectiveStartDate > effectiveEndDate
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'announcementEndDate must be greater than or equal to announcementStartDate',
      );
    }

    // Origin Coordinates Validation (Phase 2)
    if (input.storeOriginLatitude !== undefined) {
      if (input.storeOriginLatitude === null) {
        payload.storeOriginLatitude = null;
      } else {
        const lat = Number(input.storeOriginLatitude);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'storeOriginLatitude must be a valid number between -90 and 90 degrees',
          );
        }
        payload.storeOriginLatitude = lat;
      }
    }

    if (input.storeOriginLongitude !== undefined) {
      if (input.storeOriginLongitude === null) {
        payload.storeOriginLongitude = null;
      } else {
        const lng = Number(input.storeOriginLongitude);
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'storeOriginLongitude must be a valid number between -180 and 180 degrees',
          );
        }
        payload.storeOriginLongitude = lng;
      }
    }

    // Delivery Pricing Validation (Phase 2)
    if (input.deliveryFeeMode !== undefined) {
      const mode = input.deliveryFeeMode;
      if (!mode || !['FIXED', 'PER_KM', 'TIERED'].includes(mode)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          "deliveryFeeMode must be one of 'FIXED', 'PER_KM', or 'TIERED'",
        );
      }
      payload.deliveryFeeMode = mode as DeliveryFeeMode;
    }

    if (input.deliveryFeeBaseAmount !== undefined) {
      payload.deliveryFeeBaseAmount = parseNonNegativeDecimal(
        input.deliveryFeeBaseAmount,
        'deliveryFeeBaseAmount',
      );
    }

    if (input.deliveryFeePerKmAmount !== undefined) {
      payload.deliveryFeePerKmAmount = parseNonNegativeDecimal(
        input.deliveryFeePerKmAmount,
        'deliveryFeePerKmAmount',
      );
    }

    if (input.deliveryFeeFreeThreshold !== undefined) {
      if (
        input.deliveryFeeFreeThreshold === null ||
        input.deliveryFeeFreeThreshold === ''
      ) {
        payload.deliveryFeeFreeThreshold = null;
      } else {
        payload.deliveryFeeFreeThreshold = parseNonNegativeDecimal(
          input.deliveryFeeFreeThreshold,
          'deliveryFeeFreeThreshold',
        );
      }
      payload.hasExplicitDeliveryFeeFreeThreshold =
        input.hasExplicitDeliveryFeeFreeThreshold ?? true;
    } else if (input.hasExplicitDeliveryFeeFreeThreshold !== undefined) {
      payload.hasExplicitDeliveryFeeFreeThreshold = Boolean(
        input.hasExplicitDeliveryFeeFreeThreshold,
      );
      if (!payload.hasExplicitDeliveryFeeFreeThreshold) {
        payload.deliveryFeeFreeThreshold = null;
      }
    }

    if (input.deliveryMaxDistanceKm !== undefined) {
      payload.deliveryMaxDistanceKm = parsePositiveDecimal(
        input.deliveryMaxDistanceKm,
        'deliveryMaxDistanceKm',
      );
    }

    if (input.deliveryFallbackAmount !== undefined) {
      payload.deliveryFallbackAmount = parseNonNegativeDecimal(
        input.deliveryFallbackAmount,
        'deliveryFallbackAmount',
      );
    }

    // Ordering Control Switch (Phase 2)
    if (input.isOrderingEnabled !== undefined) {
      payload.isOrderingEnabled = Boolean(input.isOrderingEnabled);
    }

    if (input.orderingMessage !== undefined) {
      if (input.orderingMessage === null) {
        payload.orderingMessage = null;
      } else {
        const msg = input.orderingMessage.trim();
        if (msg.length > 500) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'orderingMessage must not exceed 500 characters',
          );
        }
        payload.orderingMessage = msg || null;
      }
    }

    const updated = await this.repository.update(payload);

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'settings.update',
        resourceType: 'store_settings',
        resourceId: 'default',
        actorAdminId,
        metadata: {
          updatedFields: Object.keys(input),
        },
      });
    }

    return updated;
  }
}
