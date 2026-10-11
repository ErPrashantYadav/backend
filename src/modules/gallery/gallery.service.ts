import { AppError } from '../../errors/app-error';
import type { AuditService } from '../audit/audit.service';
import type {
  CreateGalleryItemInput,
  GalleryItemRecord,
  GalleryRepository,
  ListGalleryParams,
  UpdateGalleryItemInput,
} from './gallery.types';

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export class GalleryService {
  constructor(
    private readonly repository: GalleryRepository,
    private readonly auditService?: AuditService,
  ) {}

  async listActive(category?: string): Promise<GalleryItemRecord[]> {
    return this.repository.listActive(category);
  }

  async listAdmin(params: ListGalleryParams = {}): Promise<{
    items: GalleryItemRecord[];
    total: number;
  }> {
    return this.repository.list(params);
  }

  async getById(id: string): Promise<GalleryItemRecord> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new AppError(
        404,
        'GALLERY_ITEM_NOT_FOUND',
        `Gallery item ${id} not found`,
      );
    }
    return item;
  }

  async create(
    input: CreateGalleryItemInput,
    actorAdminId?: string,
  ): Promise<GalleryItemRecord> {
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

    if (input.category && input.category.trim().length > 100) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Category must not exceed 100 characters',
      );
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

    const item = await this.repository.create({
      title,
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl.trim(),
      publicId: input.publicId?.trim() || null,
      category: input.category?.trim() || null,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    });

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'gallery.create',
        resourceType: 'gallery',
        resourceId: item.id,
        actorAdminId,
        metadata: {
          title: item.title,
          category: item.category,
          imageUrl: item.imageUrl,
        },
      });
    }

    return item;
  }

  async update(
    id: string,
    input: UpdateGalleryItemInput,
    actorAdminId?: string,
  ): Promise<GalleryItemRecord> {
    await this.getById(id);

    const updatePayload: UpdateGalleryItemInput = {};

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

    if (input.category !== undefined) {
      const cat = input.category?.trim();
      if (cat && cat.length > 100) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Category must not exceed 100 characters',
        );
      }
      updatePayload.category = cat || null;
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

    const updated = await this.repository.update(id, updatePayload);

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'gallery.update',
        resourceType: 'gallery',
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
  ): Promise<GalleryItemRecord> {
    const existing = await this.getById(id);

    const updated = await this.repository.update(id, { isActive });

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'gallery.update_status',
        resourceType: 'gallery',
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
        action: 'gallery.delete',
        resourceType: 'gallery',
        resourceId: id,
        actorAdminId,
        metadata: {
          title: existing.title,
        },
      });
    }
  }
}
