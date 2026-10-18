import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import {
  DEFAULT_STORE_SETTINGS,
  type DaySchedule,
  type DeliveryFeeMode,
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
    storeOriginLatitude?: Prisma.Decimal | number | null;
    storeOriginLongitude?: Prisma.Decimal | number | null;
    deliveryFeeMode?: string;
    deliveryFeeBaseAmount?: Prisma.Decimal | number | string;
    deliveryFeePerKmAmount?: Prisma.Decimal | number | string;
    deliveryFeeFreeThreshold?: Prisma.Decimal | number | string | null;
    hasExplicitDeliveryFeeFreeThreshold?: boolean | null;
    deliveryMaxDistanceKm?: Prisma.Decimal | number | string;
    deliveryFallbackAmount?: Prisma.Decimal | number | string;
    isOrderingEnabled?: boolean;
    orderingMessage?: string | null;
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
      storeOriginLatitude:
        row.storeOriginLatitude !== null &&
        row.storeOriginLatitude !== undefined
          ? Number(row.storeOriginLatitude)
          : null,
      storeOriginLongitude:
        row.storeOriginLongitude !== null &&
        row.storeOriginLongitude !== undefined
          ? Number(row.storeOriginLongitude)
          : null,
      deliveryFeeMode:
        (row.deliveryFeeMode as DeliveryFeeMode) ||
        DEFAULT_STORE_SETTINGS.deliveryFeeMode,
      deliveryFeeBaseAmount:
        row.deliveryFeeBaseAmount !== undefined &&
        row.deliveryFeeBaseAmount !== null
          ? String(row.deliveryFeeBaseAmount)
          : DEFAULT_STORE_SETTINGS.deliveryFeeBaseAmount,
      deliveryFeePerKmAmount:
        row.deliveryFeePerKmAmount !== undefined &&
        row.deliveryFeePerKmAmount !== null
          ? String(row.deliveryFeePerKmAmount)
          : DEFAULT_STORE_SETTINGS.deliveryFeePerKmAmount,
      deliveryFeeFreeThreshold:
        row.deliveryFeeFreeThreshold !== undefined &&
        row.deliveryFeeFreeThreshold !== null
          ? String(row.deliveryFeeFreeThreshold)
          : null,
      hasExplicitDeliveryFeeFreeThreshold: Boolean(
        row.hasExplicitDeliveryFeeFreeThreshold,
      ),
      deliveryMaxDistanceKm:
        row.deliveryMaxDistanceKm !== undefined &&
        row.deliveryMaxDistanceKm !== null
          ? String(row.deliveryMaxDistanceKm)
          : DEFAULT_STORE_SETTINGS.deliveryMaxDistanceKm,
      deliveryFallbackAmount:
        row.deliveryFallbackAmount !== undefined &&
        row.deliveryFallbackAmount !== null
          ? String(row.deliveryFallbackAmount)
          : DEFAULT_STORE_SETTINGS.deliveryFallbackAmount,
      isOrderingEnabled:
        row.isOrderingEnabled !== undefined
          ? Boolean(row.isOrderingEnabled)
          : DEFAULT_STORE_SETTINGS.isOrderingEnabled,
      orderingMessage: row.orderingMessage ?? null,
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
          storeOriginLatitude: DEFAULT_STORE_SETTINGS.storeOriginLatitude,
          storeOriginLongitude: DEFAULT_STORE_SETTINGS.storeOriginLongitude,
          deliveryFeeMode: DEFAULT_STORE_SETTINGS.deliveryFeeMode,
          deliveryFeeBaseAmount: DEFAULT_STORE_SETTINGS.deliveryFeeBaseAmount,
          deliveryFeePerKmAmount: DEFAULT_STORE_SETTINGS.deliveryFeePerKmAmount,
          deliveryFeeFreeThreshold:
            DEFAULT_STORE_SETTINGS.deliveryFeeFreeThreshold,
          hasExplicitDeliveryFeeFreeThreshold:
            DEFAULT_STORE_SETTINGS.hasExplicitDeliveryFeeFreeThreshold,
          deliveryMaxDistanceKm: DEFAULT_STORE_SETTINGS.deliveryMaxDistanceKm,
          deliveryFallbackAmount: DEFAULT_STORE_SETTINGS.deliveryFallbackAmount,
          isOrderingEnabled: DEFAULT_STORE_SETTINGS.isOrderingEnabled,
          orderingMessage: DEFAULT_STORE_SETTINGS.orderingMessage,
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

    // Origin Coordinates (Phase 2)
    if (data.storeOriginLatitude !== undefined)
      updateData.storeOriginLatitude = data.storeOriginLatitude;
    if (data.storeOriginLongitude !== undefined)
      updateData.storeOriginLongitude = data.storeOriginLongitude;

    // Delivery Pricing (Phase 2)
    if (data.deliveryFeeMode !== undefined)
      updateData.deliveryFeeMode = data.deliveryFeeMode;
    if (data.deliveryFeeBaseAmount !== undefined)
      updateData.deliveryFeeBaseAmount = String(data.deliveryFeeBaseAmount);
    if (data.deliveryFeePerKmAmount !== undefined)
      updateData.deliveryFeePerKmAmount = String(data.deliveryFeePerKmAmount);
    if (data.deliveryFeeFreeThreshold !== undefined)
      updateData.deliveryFeeFreeThreshold =
        data.deliveryFeeFreeThreshold === null
          ? null
          : String(data.deliveryFeeFreeThreshold);
    if (data.hasExplicitDeliveryFeeFreeThreshold !== undefined)
      updateData.hasExplicitDeliveryFeeFreeThreshold =
        data.hasExplicitDeliveryFeeFreeThreshold;
    if (data.deliveryMaxDistanceKm !== undefined)
      updateData.deliveryMaxDistanceKm = String(data.deliveryMaxDistanceKm);
    if (data.deliveryFallbackAmount !== undefined)
      updateData.deliveryFallbackAmount = String(data.deliveryFallbackAmount);

    // Ordering Switch (Phase 2)
    if (data.isOrderingEnabled !== undefined)
      updateData.isOrderingEnabled = data.isOrderingEnabled;
    if (data.orderingMessage !== undefined)
      updateData.orderingMessage = data.orderingMessage;

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
        storeOriginLatitude:
          data.storeOriginLatitude !== undefined
            ? data.storeOriginLatitude
            : DEFAULT_STORE_SETTINGS.storeOriginLatitude,
        storeOriginLongitude:
          data.storeOriginLongitude !== undefined
            ? data.storeOriginLongitude
            : DEFAULT_STORE_SETTINGS.storeOriginLongitude,
        deliveryFeeMode:
          data.deliveryFeeMode ?? DEFAULT_STORE_SETTINGS.deliveryFeeMode,
        deliveryFeeBaseAmount:
          data.deliveryFeeBaseAmount !== undefined
            ? String(data.deliveryFeeBaseAmount)
            : DEFAULT_STORE_SETTINGS.deliveryFeeBaseAmount,
        deliveryFeePerKmAmount:
          data.deliveryFeePerKmAmount !== undefined
            ? String(data.deliveryFeePerKmAmount)
            : DEFAULT_STORE_SETTINGS.deliveryFeePerKmAmount,
        deliveryFeeFreeThreshold:
          data.deliveryFeeFreeThreshold !== undefined
            ? data.deliveryFeeFreeThreshold === null
              ? null
              : String(data.deliveryFeeFreeThreshold)
            : DEFAULT_STORE_SETTINGS.deliveryFeeFreeThreshold,
        hasExplicitDeliveryFeeFreeThreshold:
          data.hasExplicitDeliveryFeeFreeThreshold !== undefined
            ? data.hasExplicitDeliveryFeeFreeThreshold
            : DEFAULT_STORE_SETTINGS.hasExplicitDeliveryFeeFreeThreshold,
        deliveryMaxDistanceKm:
          data.deliveryMaxDistanceKm !== undefined
            ? String(data.deliveryMaxDistanceKm)
            : DEFAULT_STORE_SETTINGS.deliveryMaxDistanceKm,
        deliveryFallbackAmount:
          data.deliveryFallbackAmount !== undefined
            ? String(data.deliveryFallbackAmount)
            : DEFAULT_STORE_SETTINGS.deliveryFallbackAmount,
        isOrderingEnabled:
          data.isOrderingEnabled !== undefined
            ? data.isOrderingEnabled
            : DEFAULT_STORE_SETTINGS.isOrderingEnabled,
        orderingMessage:
          data.orderingMessage !== undefined
            ? data.orderingMessage
            : DEFAULT_STORE_SETTINGS.orderingMessage,
      },
    });

    return this.formatRecord(updated);
  }
}
