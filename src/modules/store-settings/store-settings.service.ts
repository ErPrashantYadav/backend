import { AppError } from '../../errors/app-error';
import type { AuditService } from '../audit/audit.service';
import type {
  DaySchedule,
  PublicStoreSettings,
  StoreSettingsRecord,
  StoreSettingsRepository,
  UpdateStoreSettingsInput,
} from './store-settings.types';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
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

export class StoreSettingsService {
  constructor(
    private readonly repository: StoreSettingsRepository,
    private readonly auditService?: AuditService,
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
      const hours = input.businessHours;
      if (!Array.isArray(hours)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'businessHours must be an array of day schedules',
        );
      }

      const validatedHours: DaySchedule[] = [];
      const validDays = new Set([
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ]);

      for (const item of hours) {
        if (!validDays.has(item.day)) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            `Invalid day of week: ${item.day}`,
          );
        }

        const isOpen = Boolean(item.isOpen);
        let openTime: string | null = null;
        let closeTime: string | null = null;

        if (isOpen) {
          if (!item.openTime || !TIME_REGEX.test(item.openTime.trim())) {
            throw new AppError(
              400,
              'VALIDATION_ERROR',
              `openTime for ${item.day} must be in 24-hour HH:mm format (e.g. 09:00)`,
            );
          }
          if (!item.closeTime || !TIME_REGEX.test(item.closeTime.trim())) {
            throw new AppError(
              400,
              'VALIDATION_ERROR',
              `closeTime for ${item.day} must be in 24-hour HH:mm format (e.g. 22:00)`,
            );
          }
          openTime = item.openTime.trim();
          closeTime = item.closeTime.trim();
        } else {
          openTime = item.openTime?.trim() || null;
          closeTime = item.closeTime?.trim() || null;
        }

        validatedHours.push({
          day: item.day,
          isOpen,
          openTime,
          closeTime,
        });
      }

      payload.businessHours = validatedHours;
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
