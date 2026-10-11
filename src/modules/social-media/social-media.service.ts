import { AppError } from '../../errors/app-error';
import type { AuditService } from '../audit/audit.service';
import type {
  CreateSocialMediaInput,
  ListSocialMediaParams,
  PlatformCounts,
  SocialMediaRecord,
  SocialMediaRepository,
  UpdateSocialMediaInput,
} from './social-media.types';

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export class SocialMediaService {
  constructor(
    private readonly repository: SocialMediaRepository,
    private readonly auditService?: AuditService,
  ) {}

  async listActive(
    type?: string,
    platform?: string,
  ): Promise<SocialMediaRecord[]> {
    return this.repository.listActive(type, platform);
  }

  async getProfileLinksGrouped(): Promise<
    Record<
      string,
      Array<{
        id: string;
        url: string;
        label: string | null;
        platform: string;
        displayOrder: number;
      }>
    >
  > {
    const profiles = await this.repository.listActive('profile');
    const grouped: Record<
      string,
      Array<{
        id: string;
        url: string;
        label: string | null;
        platform: string;
        displayOrder: number;
      }>
    > = {};

    for (const item of profiles) {
      const key = item.platform.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push({
        id: item.id,
        url: item.url,
        label: item.label,
        platform: item.platform,
        displayOrder: item.displayOrder,
      });
    }

    return grouped;
  }

  async listAdmin(params: ListSocialMediaParams = {}): Promise<{
    items: SocialMediaRecord[];
    total: number;
    platformCounts: PlatformCounts;
  }> {
    return this.repository.list(params);
  }

  async getById(id: string): Promise<SocialMediaRecord> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new AppError(
        404,
        'SOCIAL_MEDIA_NOT_FOUND',
        `Social media entry ${id} not found`,
      );
    }
    return item;
  }

  private validateEntry(input: CreateSocialMediaInput): void {
    const platform = input.platform?.trim();
    if (!platform) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Platform is required');
    }

    if (!input.url || !isValidUrl(input.url.trim())) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'A valid HTTP/HTTPS URL is required',
      );
    }

    if (
      input.type &&
      !['video', 'profile'].includes(input.type.toLowerCase())
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Type must be either "video" or "profile"',
      );
    }

    if (input.label && input.label.length > 180) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Label must not exceed 180 characters',
      );
    }

    if (input.thumbnailUrl && !isValidUrl(input.thumbnailUrl.trim())) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Thumbnail URL must be a valid HTTP/HTTPS URL',
      );
    }
  }

  async create(
    input: CreateSocialMediaInput,
    actorAdminId?: string,
  ): Promise<SocialMediaRecord> {
    this.validateEntry(input);

    const record = await this.repository.create({
      platform: input.platform.trim().toUpperCase(),
      url: input.url.trim(),
      type: input.type?.trim().toLowerCase() ?? 'video',
      label: input.label?.trim() || null,
      thumbnailUrl: input.thumbnailUrl?.trim() || null,
      publicId: input.publicId?.trim() || null,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    });

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'social_media.create',
        resourceType: 'social_media',
        resourceId: record.id,
        actorAdminId,
        metadata: {
          platform: record.platform,
          url: record.url,
          type: record.type,
          label: record.label,
          isActive: record.isActive,
        },
      });
    }

    return record;
  }

  async createMany(
    entries: CreateSocialMediaInput[],
    actorAdminId?: string,
  ): Promise<SocialMediaRecord[]> {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'At least one social media entry is required',
      );
    }

    for (const entry of entries) {
      this.validateEntry(entry);
    }

    const normalized = entries.map((e) => ({
      platform: e.platform.trim().toUpperCase(),
      url: e.url.trim(),
      type: e.type?.trim().toLowerCase() ?? 'video',
      label: e.label?.trim() || null,
      thumbnailUrl: e.thumbnailUrl?.trim() || null,
      publicId: e.publicId?.trim() || null,
      displayOrder: e.displayOrder ?? 0,
      isActive: e.isActive ?? true,
    }));

    const records = await this.repository.createMany(normalized);

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'social_media.create',
        resourceType: 'social_media',
        resourceId: 'batch',
        actorAdminId,
        metadata: {
          count: records.length,
          platforms: records.map((r) => r.platform),
        },
      });
    }

    return records;
  }

  async update(
    id: string,
    input: UpdateSocialMediaInput,
    actorAdminId?: string,
  ): Promise<SocialMediaRecord> {
    const existing = await this.getById(id);

    if (input.platform !== undefined) {
      const platform = input.platform.trim();
      if (!platform) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Platform cannot be empty');
      }
    }

    if (input.url !== undefined) {
      if (!input.url || !isValidUrl(input.url.trim())) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'A valid HTTP/HTTPS URL is required',
        );
      }
    }

    if (input.type !== undefined) {
      if (!['video', 'profile'].includes(input.type.toLowerCase())) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Type must be either "video" or "profile"',
        );
      }
    }

    if (input.label !== undefined && input.label && input.label.length > 180) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Label must not exceed 180 characters',
      );
    }

    if (
      input.thumbnailUrl !== undefined &&
      input.thumbnailUrl &&
      !isValidUrl(input.thumbnailUrl.trim())
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Thumbnail URL must be a valid HTTP/HTTPS URL',
      );
    }

    const updated = await this.repository.update(id, {
      platform: input.platform?.trim().toUpperCase(),
      url: input.url?.trim(),
      type: input.type?.trim().toLowerCase(),
      label:
        input.label !== undefined ? input.label?.trim() || null : undefined,
      thumbnailUrl:
        input.thumbnailUrl !== undefined
          ? input.thumbnailUrl?.trim() || null
          : undefined,
      publicId:
        input.publicId !== undefined
          ? input.publicId?.trim() || null
          : undefined,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
    });

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'social_media.update',
        resourceType: 'social_media',
        resourceId: id,
        actorAdminId,
        metadata: {
          previous: {
            platform: existing.platform,
            url: existing.url,
            type: existing.type,
            label: existing.label,
            isActive: existing.isActive,
          },
          updated: {
            platform: updated.platform,
            url: updated.url,
            type: updated.type,
            label: updated.label,
            isActive: updated.isActive,
          },
        },
      });
    }

    return updated;
  }

  async updateStatus(
    id: string,
    isActive: boolean,
    actorAdminId?: string,
  ): Promise<SocialMediaRecord> {
    const existing = await this.getById(id);

    const updated = await this.repository.update(id, { isActive });

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'social_media.update_status',
        resourceType: 'social_media',
        resourceId: id,
        actorAdminId,
        metadata: {
          previousIsActive: existing.isActive,
          newIsActive: isActive,
        },
      });
    }

    return updated;
  }

  async delete(id: string, actorAdminId?: string): Promise<boolean> {
    const existing = await this.getById(id);
    const success = await this.repository.delete(id);

    if (success && this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'social_media.delete',
        resourceType: 'social_media',
        resourceId: id,
        actorAdminId,
        metadata: {
          platform: existing.platform,
          url: existing.url,
          type: existing.type,
          label: existing.label,
        },
      });
    }

    return success;
  }
}
