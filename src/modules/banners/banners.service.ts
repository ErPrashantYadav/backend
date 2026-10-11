import { AppError } from '../../errors/app-error';
import type { AuditService } from '../audit/audit.service';
import type {
  BannerRecord,
  BannerRepository,
  CreateBannerInput,
  ListBannersParams,
  UpdateBannerInput,
} from './banners.types';

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export class BannerService {
  constructor(
    private readonly repository: BannerRepository,
    private readonly auditService?: AuditService,
  ) {}

  async listActive(now?: Date): Promise<BannerRecord[]> {
    return this.repository.listActive(now);
  }

  async listAdmin(params: ListBannersParams = {}): Promise<{
    items: BannerRecord[];
    total: number;
  }> {
    return this.repository.list(params);
  }

  async getById(id: string): Promise<BannerRecord> {
    const banner = await this.repository.findById(id);
    if (!banner) {
      throw new AppError(404, 'BANNER_NOT_FOUND', `Banner ${id} not found`);
    }
    return banner;
  }

  async create(
    input: CreateBannerInput,
    actorAdminId?: string,
  ): Promise<BannerRecord> {
    const title = input.title?.trim();
    if (!title || title.length > 180) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Title is required and must not exceed 180 characters',
      );
    }

    if (!input.imageUrl || !isValidUrl(input.imageUrl)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'A valid image URL is required',
      );
    }

    if (input.linkUrl && input.linkUrl.trim().length > 0) {
      const link = input.linkUrl.trim();
      if (!isValidUrl(link) && !link.startsWith('/')) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Link URL must be a valid HTTP(S) URL or relative path starting with /',
        );
      }
    }

    if (input.displayOrder !== undefined) {
      const order = Number(input.displayOrder);
      if (!Number.isInteger(order) || order < 0) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'displayOrder must be a non-negative integer',
        );
      }
    }

    const startDate = input.startDate ? new Date(input.startDate) : null;
    const endDate = input.endDate ? new Date(input.endDate) : null;

    if (startDate && isNaN(startDate.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid startDate format');
    }
    if (endDate && isNaN(endDate.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid endDate format');
    }

    if (startDate && endDate && startDate > endDate) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'endDate must be greater than or equal to startDate',
      );
    }

    const banner = await this.repository.create({
      title,
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl.trim(),
      publicId: input.publicId?.trim() || null,
      linkUrl: input.linkUrl?.trim() || null,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
      startDate,
      endDate,
    });

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'banner.create',
        resourceType: 'banner',
        resourceId: banner.id,
        actorAdminId,
        metadata: {
          title: banner.title,
          imageUrl: banner.imageUrl,
          isActive: banner.isActive,
        },
      });
    }

    return banner;
  }

  async update(
    id: string,
    input: UpdateBannerInput,
    actorAdminId?: string,
  ): Promise<BannerRecord> {
    const existing = await this.getById(id);

    const updatePayload: UpdateBannerInput = {};

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title || title.length > 180) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Title must not be empty and must not exceed 180 characters',
        );
      }
      updatePayload.title = title;
    }

    if (input.description !== undefined) {
      updatePayload.description = input.description?.trim() || null;
    }

    if (input.imageUrl !== undefined) {
      if (!input.imageUrl || !isValidUrl(input.imageUrl)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'A valid image URL is required',
        );
      }
      updatePayload.imageUrl = input.imageUrl.trim();
    }

    if (input.publicId !== undefined) {
      updatePayload.publicId = input.publicId?.trim() || null;
    }

    if (input.linkUrl !== undefined) {
      if (input.linkUrl && input.linkUrl.trim().length > 0) {
        const link = input.linkUrl.trim();
        if (!isValidUrl(link) && !link.startsWith('/')) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Link URL must be a valid HTTP(S) URL or relative path starting with /',
          );
        }
        updatePayload.linkUrl = link;
      } else {
        updatePayload.linkUrl = null;
      }
    }

    if (input.displayOrder !== undefined) {
      const order = Number(input.displayOrder);
      if (!Number.isInteger(order) || order < 0) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'displayOrder must be a non-negative integer',
        );
      }
      updatePayload.displayOrder = order;
    }

    if (input.isActive !== undefined) {
      updatePayload.isActive = Boolean(input.isActive);
    }

    let effectiveStartDate = existing.startDate;
    let effectiveEndDate = existing.endDate;

    if (input.startDate !== undefined) {
      if (input.startDate === null) {
        effectiveStartDate = null;
        updatePayload.startDate = null;
      } else {
        const d = new Date(input.startDate);
        if (isNaN(d.getTime())) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Invalid startDate format',
          );
        }
        effectiveStartDate = d;
        updatePayload.startDate = d;
      }
    }

    if (input.endDate !== undefined) {
      if (input.endDate === null) {
        effectiveEndDate = null;
        updatePayload.endDate = null;
      } else {
        const d = new Date(input.endDate);
        if (isNaN(d.getTime())) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Invalid endDate format');
        }
        effectiveEndDate = d;
        updatePayload.endDate = d;
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
        'endDate must be greater than or equal to startDate',
      );
    }

    const updated = await this.repository.update(id, updatePayload);

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'banner.update',
        resourceType: 'banner',
        resourceId: updated.id,
        actorAdminId,
        metadata: {
          changes: Object.keys(input),
        },
      });
    }

    return updated;
  }

  async updateStatus(
    id: string,
    isActive: boolean,
    actorAdminId?: string,
  ): Promise<BannerRecord> {
    const existing = await this.getById(id);

    const updated = await this.repository.update(id, { isActive });

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'banner.update_status',
        resourceType: 'banner',
        resourceId: updated.id,
        actorAdminId,
        metadata: {
          previousStatus: existing.isActive,
          newStatus: isActive,
        },
      });
    }

    return updated;
  }

  async delete(id: string, actorAdminId?: string): Promise<void> {
    const existing = await this.getById(id);

    await this.repository.delete(id);

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'banner.delete',
        resourceType: 'banner',
        resourceId: id,
        actorAdminId,
        metadata: {
          title: existing.title,
        },
      });
    }
  }

  async reorder(
    items: Array<{ id: string; displayOrder: number }>,
    actorAdminId?: string,
  ): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'At least one banner is required for reordering',
      );
    }

    const seenIds = new Set<string>();
    for (const item of items) {
      if (
        !item.id ||
        typeof item.displayOrder !== 'number' ||
        item.displayOrder < 0
      ) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Each reorder item must have an id and non-negative displayOrder',
        );
      }
      if (seenIds.has(item.id)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `Duplicate banner ID "${item.id}" in reorder payload`,
        );
      }
      seenIds.add(item.id);
    }

    for (const id of seenIds) {
      const existing = await this.repository.findById(id);
      if (!existing) {
        throw new AppError(404, 'BANNER_NOT_FOUND', `Banner ${id} not found`);
      }
    }

    if (this.repository.reorder) {
      await this.repository.reorder(items);
    }

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'banner.reorder',
        resourceType: 'banner',
        resourceId: 'batch',
        actorAdminId,
        metadata: {
          count: items.length,
          bannerIds: items.map((i) => i.id),
        },
      });
    }
  }
}
