import type { AppConfig } from '../../config/env';
import {
  DEFAULT_STORE_SETTINGS,
  TEST_BUSINESS_HOURS,
  type DeliveryFeeMode,
  type StoreSettingsRecord,
  type StoreSettingsRepository,
  type UpdateStoreSettingsInput,
} from './store-settings.types';

export class MemoryStoreSettingsRepository implements StoreSettingsRepository {
  public currentSettings: StoreSettingsRecord;

  constructor(
    initialSettings?: Partial<StoreSettingsRecord>,
    config?: Partial<AppConfig>,
  ) {
    const now = new Date();
    const defaultMode =
      (config?.DELIVERY_FEE_MODE as DeliveryFeeMode | undefined) ??
      DEFAULT_STORE_SETTINGS.deliveryFeeMode;
    const defaultBase =
      config?.DELIVERY_FEE_BASE_AMOUNT !== undefined
        ? Number(config.DELIVERY_FEE_BASE_AMOUNT).toFixed(2)
        : DEFAULT_STORE_SETTINGS.deliveryFeeBaseAmount;
    const defaultPerKm =
      config?.DELIVERY_FEE_PER_KM_AMOUNT !== undefined
        ? Number(config.DELIVERY_FEE_PER_KM_AMOUNT).toFixed(2)
        : DEFAULT_STORE_SETTINGS.deliveryFeePerKmAmount;
    const defaultThreshold =
      config?.DELIVERY_FEE_FREE_THRESHOLD !== undefined
        ? Number(config.DELIVERY_FEE_FREE_THRESHOLD).toFixed(2)
        : DEFAULT_STORE_SETTINGS.deliveryFeeFreeThreshold;
    const defaultMaxDistance =
      config?.DELIVERY_MAX_DISTANCE_KM !== undefined
        ? Number(config.DELIVERY_MAX_DISTANCE_KM).toFixed(2)
        : DEFAULT_STORE_SETTINGS.deliveryMaxDistanceKm;
    const defaultFallback =
      config?.DELIVERY_FALLBACK_AMOUNT !== undefined
        ? Number(config.DELIVERY_FALLBACK_AMOUNT).toFixed(2)
        : DEFAULT_STORE_SETTINGS.deliveryFallbackAmount;
    const defaultOriginLat =
      initialSettings?.storeOriginLatitude !== undefined
        ? initialSettings.storeOriginLatitude
        : DEFAULT_STORE_SETTINGS.storeOriginLatitude;
    const defaultOriginLng =
      initialSettings?.storeOriginLongitude !== undefined
        ? initialSettings.storeOriginLongitude
        : DEFAULT_STORE_SETTINGS.storeOriginLongitude;
    const defaultHours =
      initialSettings?.businessHours !== undefined
        ? initialSettings.businessHours
        : (config?.NODE_ENV ?? process.env.NODE_ENV) === 'test'
          ? TEST_BUSINESS_HOURS
          : DEFAULT_STORE_SETTINGS.businessHours;

    const defaultExplicit =
      initialSettings?.hasExplicitDeliveryFeeFreeThreshold !== undefined
        ? initialSettings.hasExplicitDeliveryFeeFreeThreshold
        : initialSettings?.deliveryFeeFreeThreshold !== undefined;

    this.currentSettings = {
      ...DEFAULT_STORE_SETTINGS,
      deliveryFeeMode: defaultMode,
      deliveryFeeBaseAmount: defaultBase,
      deliveryFeePerKmAmount: defaultPerKm,
      deliveryFeeFreeThreshold: defaultThreshold,
      hasExplicitDeliveryFeeFreeThreshold: defaultExplicit,
      deliveryMaxDistanceKm: defaultMaxDistance,
      deliveryFallbackAmount: defaultFallback,
      storeOriginLatitude: defaultOriginLat,
      storeOriginLongitude: defaultOriginLng,
      businessHours: defaultHours,
      ...initialSettings,
      createdAt: now,
      updatedAt: now,
    };
  }

  async get(): Promise<StoreSettingsRecord> {
    return {
      ...this.currentSettings,
      socialLinks: this.currentSettings.socialLinks
        ? { ...this.currentSettings.socialLinks }
        : null,
      businessHours: this.currentSettings.businessHours.map((d) => ({ ...d })),
    };
  }

  async update(data: UpdateStoreSettingsInput): Promise<StoreSettingsRecord> {
    this.currentSettings = {
      ...this.currentSettings,
      storeName:
        data.storeName !== undefined
          ? data.storeName
          : this.currentSettings.storeName,
      storeTagline:
        data.storeTagline !== undefined
          ? data.storeTagline
          : this.currentSettings.storeTagline,
      primaryPhone:
        data.primaryPhone !== undefined
          ? data.primaryPhone
          : this.currentSettings.primaryPhone,
      secondaryPhone:
        data.secondaryPhone !== undefined
          ? data.secondaryPhone
          : this.currentSettings.secondaryPhone,
      supportEmail:
        data.supportEmail !== undefined
          ? data.supportEmail
          : this.currentSettings.supportEmail,
      address:
        data.address !== undefined
          ? data.address
          : this.currentSettings.address,
      city: data.city !== undefined ? data.city : this.currentSettings.city,
      locationUrl:
        data.locationUrl !== undefined
          ? data.locationUrl
          : this.currentSettings.locationUrl,
      socialLinks:
        data.socialLinks !== undefined
          ? data.socialLinks
          : this.currentSettings.socialLinks,
      businessHours:
        data.businessHours !== undefined
          ? data.businessHours
          : this.currentSettings.businessHours,
      announcementText:
        data.announcementText !== undefined
          ? data.announcementText
          : this.currentSettings.announcementText,
      announcementActive:
        data.announcementActive !== undefined
          ? data.announcementActive
          : this.currentSettings.announcementActive,
      announcementStartDate:
        data.announcementStartDate !== undefined
          ? data.announcementStartDate
          : this.currentSettings.announcementStartDate,
      announcementEndDate:
        data.announcementEndDate !== undefined
          ? data.announcementEndDate
          : this.currentSettings.announcementEndDate,
      timezone:
        data.timezone !== undefined
          ? data.timezone
          : this.currentSettings.timezone,

      // Origin Coordinates (Phase 2)
      storeOriginLatitude:
        data.storeOriginLatitude !== undefined
          ? data.storeOriginLatitude
          : this.currentSettings.storeOriginLatitude,
      storeOriginLongitude:
        data.storeOriginLongitude !== undefined
          ? data.storeOriginLongitude
          : this.currentSettings.storeOriginLongitude,

      // Delivery Pricing (Phase 2)
      deliveryFeeMode:
        data.deliveryFeeMode !== undefined
          ? data.deliveryFeeMode
          : this.currentSettings.deliveryFeeMode,
      deliveryFeeBaseAmount:
        data.deliveryFeeBaseAmount !== undefined
          ? String(data.deliveryFeeBaseAmount)
          : this.currentSettings.deliveryFeeBaseAmount,
      deliveryFeePerKmAmount:
        data.deliveryFeePerKmAmount !== undefined
          ? String(data.deliveryFeePerKmAmount)
          : this.currentSettings.deliveryFeePerKmAmount,
      deliveryFeeFreeThreshold:
        data.deliveryFeeFreeThreshold !== undefined
          ? data.deliveryFeeFreeThreshold === null
            ? null
            : String(data.deliveryFeeFreeThreshold)
          : data.hasExplicitDeliveryFeeFreeThreshold === false
            ? null
            : this.currentSettings.deliveryFeeFreeThreshold,
      hasExplicitDeliveryFeeFreeThreshold:
        data.hasExplicitDeliveryFeeFreeThreshold !== undefined
          ? data.hasExplicitDeliveryFeeFreeThreshold
          : data.deliveryFeeFreeThreshold !== undefined
            ? true
            : this.currentSettings.hasExplicitDeliveryFeeFreeThreshold,
      deliveryMaxDistanceKm:
        data.deliveryMaxDistanceKm !== undefined
          ? String(data.deliveryMaxDistanceKm)
          : this.currentSettings.deliveryMaxDistanceKm,
      deliveryFallbackAmount:
        data.deliveryFallbackAmount !== undefined
          ? String(data.deliveryFallbackAmount)
          : this.currentSettings.deliveryFallbackAmount,

      // Ordering Switch (Phase 2)
      isOrderingEnabled:
        data.isOrderingEnabled !== undefined
          ? data.isOrderingEnabled
          : this.currentSettings.isOrderingEnabled,
      orderingMessage:
        data.orderingMessage !== undefined
          ? data.orderingMessage
          : this.currentSettings.orderingMessage,

      updatedAt: new Date(),
    };

    return this.get();
  }
}
