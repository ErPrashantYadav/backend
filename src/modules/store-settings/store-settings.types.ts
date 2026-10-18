export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface DaySchedule {
  day: DayOfWeek;
  isOpen: boolean;
  openTime?: string | null;
  closeTime?: string | null;
}

export interface SocialLinks {
  facebook?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  whatsapp?: string | null;
  youtube?: string | null;
}

export type DeliveryFeeMode = 'FIXED' | 'PER_KM' | 'TIERED';

export interface PublicDeliveryPricing {
  mode: DeliveryFeeMode;
  baseAmount: string;
  perKmAmount: string;
  freeDeliveryThreshold: string | null;
  maxDistanceKm: string;
  fallbackAmount: string;
}

export interface StoreSettingsRecord {
  id: string;
  storeName: string;
  storeTagline: string | null;
  primaryPhone: string;
  secondaryPhone: string | null;
  supportEmail: string;
  address: string;
  city: string;
  locationUrl: string | null;
  socialLinks: SocialLinks | null;
  businessHours: DaySchedule[];
  announcementText: string | null;
  announcementActive: boolean;
  announcementStartDate: Date | null;
  announcementEndDate: Date | null;
  timezone: string;

  // Origin Coordinates (Phase 2)
  storeOriginLatitude: number | null;
  storeOriginLongitude: number | null;

  // Delivery Pricing Settings (Phase 2)
  deliveryFeeMode: DeliveryFeeMode;
  deliveryFeeBaseAmount: string;
  deliveryFeePerKmAmount: string;
  deliveryFeeFreeThreshold: string | null;
  hasExplicitDeliveryFeeFreeThreshold: boolean;
  deliveryMaxDistanceKm: string;
  deliveryFallbackAmount: string;

  // Ordering Switch (Phase 2)
  isOrderingEnabled: boolean;
  orderingMessage: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateStoreSettingsInput {
  storeName?: string;
  storeTagline?: string | null;
  primaryPhone?: string;
  secondaryPhone?: string | null;
  supportEmail?: string;
  address?: string;
  city?: string;
  locationUrl?: string | null;
  socialLinks?: SocialLinks | null;
  businessHours?: DaySchedule[];
  announcementText?: string | null;
  announcementActive?: boolean;
  announcementStartDate?: Date | null;
  announcementEndDate?: Date | null;
  timezone?: string;

  // Origin Coordinates (Phase 2)
  storeOriginLatitude?: number | null;
  storeOriginLongitude?: number | null;

  // Delivery Pricing Settings (Phase 2)
  deliveryFeeMode?: DeliveryFeeMode;
  deliveryFeeBaseAmount?: string | number;
  deliveryFeePerKmAmount?: string | number;
  deliveryFeeFreeThreshold?: string | number | null;
  hasExplicitDeliveryFeeFreeThreshold?: boolean;
  deliveryMaxDistanceKm?: string | number;
  deliveryFallbackAmount?: string | number;

  // Ordering Switch (Phase 2)
  isOrderingEnabled?: boolean;
  orderingMessage?: string | null;
}

export interface PublicStoreSettings {
  storeName: string;
  storeTagline: string | null;
  primaryPhone: string;
  secondaryPhone: string | null;
  supportEmail: string;
  address: string;
  city: string;
  locationUrl: string | null;
  socialLinks: SocialLinks | null;
  businessHours: DaySchedule[];
  announcement: {
    text: string;
    active: boolean;
  } | null;
  timezone: string;
  minOrderSubtotal: string;

  // Origin Coordinates (Phase 2)
  storeOriginLatitude: number | null;
  storeOriginLongitude: number | null;

  // Delivery Pricing Settings (Phase 2)
  deliveryPricing: PublicDeliveryPricing;

  // Ordering Switch (Phase 2)
  isOrderingEnabled: boolean;
  orderingMessage: string | null;
}

export const DEFAULT_BUSINESS_HOURS: DaySchedule[] = [
  { day: 'MONDAY', isOpen: true, openTime: '10:00', closeTime: '22:00' },
  { day: 'TUESDAY', isOpen: true, openTime: '10:00', closeTime: '22:00' },
  { day: 'WEDNESDAY', isOpen: true, openTime: '10:00', closeTime: '22:00' },
  { day: 'THURSDAY', isOpen: true, openTime: '10:00', closeTime: '22:00' },
  { day: 'FRIDAY', isOpen: true, openTime: '10:00', closeTime: '23:00' },
  { day: 'SATURDAY', isOpen: true, openTime: '10:00', closeTime: '23:00' },
  { day: 'SUNDAY', isOpen: true, openTime: '10:00', closeTime: '22:00' },
];

export const TEST_BUSINESS_HOURS: DaySchedule[] = [
  { day: 'MONDAY', isOpen: true, openTime: '00:00', closeTime: '23:59' },
  { day: 'TUESDAY', isOpen: true, openTime: '00:00', closeTime: '23:59' },
  { day: 'WEDNESDAY', isOpen: true, openTime: '00:00', closeTime: '23:59' },
  { day: 'THURSDAY', isOpen: true, openTime: '00:00', closeTime: '23:59' },
  { day: 'FRIDAY', isOpen: true, openTime: '00:00', closeTime: '23:59' },
  { day: 'SATURDAY', isOpen: true, openTime: '00:00', closeTime: '23:59' },
  { day: 'SUNDAY', isOpen: true, openTime: '00:00', closeTime: '23:59' },
];

export const DEFAULT_STORE_SETTINGS: Omit<
  StoreSettingsRecord,
  'createdAt' | 'updatedAt'
> = {
  id: 'default',
  storeName: 'Old Liquor',
  storeTagline: 'Premium Spirits & Wine Delivery',
  primaryPhone: '+977-9801234567',
  secondaryPhone: null,
  supportEmail: 'support@oldliquor.com',
  address: 'Kathmandu, Nepal',
  city: 'Kathmandu',
  locationUrl: null,
  socialLinks: {
    facebook: 'https://facebook.com/oldliquor',
    instagram: 'https://instagram.com/oldliquor',
    tiktok: null,
    whatsapp: '+9779801234567',
    youtube: null,
  },
  businessHours: DEFAULT_BUSINESS_HOURS,
  announcementText: null,
  announcementActive: false,
  announcementStartDate: null,
  announcementEndDate: null,
  timezone: 'Asia/Kathmandu',

  // Origin Coordinates (Phase 2)
  storeOriginLatitude: null,
  storeOriginLongitude: null,

  // Delivery Pricing Settings (Phase 2)
  deliveryFeeMode: 'PER_KM',
  deliveryFeeBaseAmount: '100.00',
  deliveryFeePerKmAmount: '25.00',
  deliveryFeeFreeThreshold: null,
  hasExplicitDeliveryFeeFreeThreshold: false,
  deliveryMaxDistanceKm: '25.00',
  deliveryFallbackAmount: '0.00',

  // Ordering Switch (Phase 2)
  isOrderingEnabled: true,
  orderingMessage: null,
};

export interface StoreSettingsRepository {
  get(): Promise<StoreSettingsRecord>;
  update(data: UpdateStoreSettingsInput): Promise<StoreSettingsRecord>;
}

/**
 * Resolves the effective free delivery threshold by checking if the threshold
 * was explicitly configured in StoreSettings.
 *
 * Precedence rules:
 * 1. If hasExplicitDeliveryFeeFreeThreshold is false/falsy (legacy unconfigured row):
 *    Falls back to envDefaultThreshold (e.g. env.DELIVERY_FEE_FREE_THRESHOLD).
 * 2. If hasExplicitDeliveryFeeFreeThreshold is true:
 *    - If deliveryFeeFreeThreshold is non-null/non-empty number, returns that number.
 *    - If deliveryFeeFreeThreshold is null, free delivery is explicitly disabled -> returns null.
 */
export function resolveEffectiveDeliveryFreeThreshold(
  settings: {
    deliveryFeeFreeThreshold?: string | number | null;
    hasExplicitDeliveryFeeFreeThreshold?: boolean | null;
  },
  envDefaultThreshold?: number | string | null,
): number | null {
  const isExplicit = Boolean(settings.hasExplicitDeliveryFeeFreeThreshold);
  if (!isExplicit) {
    if (
      envDefaultThreshold !== undefined &&
      envDefaultThreshold !== null &&
      envDefaultThreshold !== ''
    ) {
      const parsed = Number(envDefaultThreshold);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }
    return null;
  }

  if (
    settings.deliveryFeeFreeThreshold !== undefined &&
    settings.deliveryFeeFreeThreshold !== null &&
    settings.deliveryFeeFreeThreshold !== ''
  ) {
    const parsed = Number(settings.deliveryFeeFreeThreshold);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}
