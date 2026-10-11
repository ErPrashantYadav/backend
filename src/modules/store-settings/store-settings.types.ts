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
};

export interface StoreSettingsRepository {
  get(): Promise<StoreSettingsRecord>;
  update(data: UpdateStoreSettingsInput): Promise<StoreSettingsRecord>;
}
