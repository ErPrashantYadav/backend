import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import {
  DEFAULT_STORE_SETTINGS,
  type DaySchedule,
  type SocialLinks,
  type StoreSettingsRecord,
  type StoreSettingsRepository,
  type UpdateStoreSettingsInput,
} from './store-settings.types';

export class PrismaStoreSettingsRepository implements StoreSettingsRepository {
  private formatRecord(row: {
    id: string;
    storeName: string;
    storeTagline: string | null;
    primaryPhone: string;
    secondaryPhone: string | null;
    supportEmail: string;
    address: string;
    city: string;
    locationUrl: string | null;
    socialLinks: Prisma.JsonValue | null;
    businessHours: Prisma.JsonValue;
    announcementText: string | null;
    announcementActive: boolean;
    announcementStartDate: Date | null;
    announcementEndDate: Date | null;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
  }): StoreSettingsRecord {
    return {
      id: row.id,
      storeName: row.storeName,
      storeTagline: row.storeTagline,
      primaryPhone: row.primaryPhone,
      secondaryPhone: row.secondaryPhone,
      supportEmail: row.supportEmail,
      address: row.address,
      city: row.city,
      locationUrl: row.locationUrl,
      socialLinks: (row.socialLinks as SocialLinks | null) ?? null,
      businessHours: (row.businessHours as unknown as DaySchedule[]) ?? [],
      announcementText: row.announcementText,
      announcementActive: row.announcementActive,
      announcementStartDate: row.announcementStartDate,
      announcementEndDate: row.announcementEndDate,
      timezone: row.timezone,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async get(): Promise<StoreSettingsRecord> {
    let settings = await prisma.storeSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.storeSettings.create({
        data: {
          id: 'default',
          storeName: DEFAULT_STORE_SETTINGS.storeName,
          storeTagline: DEFAULT_STORE_SETTINGS.storeTagline,
          primaryPhone: DEFAULT_STORE_SETTINGS.primaryPhone,
          secondaryPhone: DEFAULT_STORE_SETTINGS.secondaryPhone,
          supportEmail: DEFAULT_STORE_SETTINGS.supportEmail,
          address: DEFAULT_STORE_SETTINGS.address,
          city: DEFAULT_STORE_SETTINGS.city,
          locationUrl: DEFAULT_STORE_SETTINGS.locationUrl,
          socialLinks:
            DEFAULT_STORE_SETTINGS.socialLinks as unknown as Prisma.InputJsonValue,
          businessHours:
            DEFAULT_STORE_SETTINGS.businessHours as unknown as Prisma.InputJsonValue,
          announcementText: DEFAULT_STORE_SETTINGS.announcementText,
          announcementActive: DEFAULT_STORE_SETTINGS.announcementActive,
          announcementStartDate: DEFAULT_STORE_SETTINGS.announcementStartDate,
          announcementEndDate: DEFAULT_STORE_SETTINGS.announcementEndDate,
          timezone: DEFAULT_STORE_SETTINGS.timezone,
        },
      });
    }

    return this.formatRecord(settings);
  }

  async update(data: UpdateStoreSettingsInput): Promise<StoreSettingsRecord> {
    const updateData: Prisma.StoreSettingsUpdateInput = {};

    if (data.storeName !== undefined) updateData.storeName = data.storeName;
    if (data.storeTagline !== undefined)
      updateData.storeTagline = data.storeTagline;
    if (data.primaryPhone !== undefined)
      updateData.primaryPhone = data.primaryPhone;
    if (data.secondaryPhone !== undefined)
      updateData.secondaryPhone = data.secondaryPhone;
    if (data.supportEmail !== undefined)
      updateData.supportEmail = data.supportEmail;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.locationUrl !== undefined)
      updateData.locationUrl = data.locationUrl;
    if (data.socialLinks !== undefined)
      updateData.socialLinks =
        data.socialLinks as unknown as Prisma.InputJsonValue;
    if (data.businessHours !== undefined)
      updateData.businessHours =
        data.businessHours as unknown as Prisma.InputJsonValue;
    if (data.announcementText !== undefined)
      updateData.announcementText = data.announcementText;
    if (data.announcementActive !== undefined)
      updateData.announcementActive = data.announcementActive;
    if (data.announcementStartDate !== undefined)
      updateData.announcementStartDate = data.announcementStartDate;
    if (data.announcementEndDate !== undefined)
      updateData.announcementEndDate = data.announcementEndDate;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;

    const updated = await prisma.storeSettings.upsert({
      where: { id: 'default' },
      update: updateData,
      create: {
        id: 'default',
        storeName: data.storeName ?? DEFAULT_STORE_SETTINGS.storeName,
        storeTagline:
          data.storeTagline !== undefined
            ? data.storeTagline
            : DEFAULT_STORE_SETTINGS.storeTagline,
        primaryPhone: data.primaryPhone ?? DEFAULT_STORE_SETTINGS.primaryPhone,
        secondaryPhone:
          data.secondaryPhone !== undefined
            ? data.secondaryPhone
            : DEFAULT_STORE_SETTINGS.secondaryPhone,
        supportEmail: data.supportEmail ?? DEFAULT_STORE_SETTINGS.supportEmail,
        address: data.address ?? DEFAULT_STORE_SETTINGS.address,
        city: data.city ?? DEFAULT_STORE_SETTINGS.city,
        locationUrl:
          data.locationUrl !== undefined
            ? data.locationUrl
            : DEFAULT_STORE_SETTINGS.locationUrl,
        socialLinks: (data.socialLinks !== undefined
          ? data.socialLinks
          : DEFAULT_STORE_SETTINGS.socialLinks) as unknown as Prisma.InputJsonValue,
        businessHours: (data.businessHours ??
          DEFAULT_STORE_SETTINGS.businessHours) as unknown as Prisma.InputJsonValue,
        announcementText:
          data.announcementText !== undefined
            ? data.announcementText
            : DEFAULT_STORE_SETTINGS.announcementText,
        announcementActive:
          data.announcementActive ?? DEFAULT_STORE_SETTINGS.announcementActive,
        announcementStartDate:
          data.announcementStartDate !== undefined
            ? data.announcementStartDate
            : DEFAULT_STORE_SETTINGS.announcementStartDate,
        announcementEndDate:
          data.announcementEndDate !== undefined
            ? data.announcementEndDate
            : DEFAULT_STORE_SETTINGS.announcementEndDate,
        timezone: data.timezone ?? DEFAULT_STORE_SETTINGS.timezone,
      },
    });

    return this.formatRecord(updated);
  }
}
