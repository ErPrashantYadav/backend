import {
  DEFAULT_STORE_SETTINGS,
  type StoreSettingsRecord,
  type StoreSettingsRepository,
  type UpdateStoreSettingsInput,
} from './store-settings.types';

export class MemoryStoreSettingsRepository implements StoreSettingsRepository {
  public currentSettings: StoreSettingsRecord;

  constructor(initialSettings?: Partial<StoreSettingsRecord>) {
    const now = new Date();
    this.currentSettings = {
      ...DEFAULT_STORE_SETTINGS,
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
      updatedAt: new Date(),
    };

    return this.get();
  }
}
