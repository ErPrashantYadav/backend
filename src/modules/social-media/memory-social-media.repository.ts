import { randomUUID } from 'crypto';
import type {
  CreateSocialMediaInput,
  ListSocialMediaParams,
  PlatformCounts,
  SocialMediaRecord,
  SocialMediaRepository,
  UpdateSocialMediaInput,
} from './social-media.types';

export class MemorySocialMediaRepository implements SocialMediaRepository {
  private records: SocialMediaRecord[] = [];

  constructor(initialRecords: SocialMediaRecord[] = []) {
    this.records = [...initialRecords];
  }

  async create(data: CreateSocialMediaInput): Promise<SocialMediaRecord> {
    const record: SocialMediaRecord = {
      id: randomUUID(),
      platform: data.platform.toUpperCase(),
      url: data.url,
      type: data.type ?? 'video',
      label: data.label ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      publicId: data.publicId ?? null,
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.records.push(record);
    return { ...record };
  }

  async createMany(
    data: CreateSocialMediaInput[],
  ): Promise<SocialMediaRecord[]> {
    const created: SocialMediaRecord[] = [];
    for (const item of data) {
      const record = await this.create(item);
      created.push(record);
    }
    return created;
  }

  async findById(id: string): Promise<SocialMediaRecord | null> {
    const record = this.records.find((r) => r.id === id);
    return record ? { ...record } : null;
  }

  async list(params: ListSocialMediaParams = {}): Promise<{
    items: SocialMediaRecord[];
    total: number;
    platformCounts: PlatformCounts;
  }> {
    let filtered = [...this.records];

    if (params.isActive !== undefined) {
      filtered = filtered.filter((r) => r.isActive === params.isActive);
    }

    if (params.type && params.type.trim().length > 0) {
      filtered = filtered.filter(
        (r) => r.type.toLowerCase() === params.type!.trim().toLowerCase(),
      );
    }

    if (
      params.platform &&
      params.platform.trim().length > 0 &&
      params.platform.trim().toUpperCase() !== 'ALL'
    ) {
      filtered = filtered.filter(
        (r) =>
          r.platform.toUpperCase() === params.platform!.trim().toUpperCase(),
      );
    }

    if (params.search && params.search.trim().length > 0) {
      const term = params.search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.label && r.label.toLowerCase().includes(term)) ||
          r.url.toLowerCase().includes(term) ||
          r.platform.toLowerCase().includes(term),
      );
    }

    // Sort
    const sortBy = params.sortBy ?? 'displayOrder';
    const sortOrder = params.sortOrder === 'desc' ? -1 : 1;

    filtered.sort((a, b) => {
      if (sortBy === 'displayOrder') {
        if (a.displayOrder !== b.displayOrder) {
          return (a.displayOrder - b.displayOrder) * sortOrder;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      if (sortBy === 'createdAt') {
        return (a.createdAt.getTime() - b.createdAt.getTime()) * sortOrder;
      }
      if (sortBy === 'platform') {
        return a.platform.localeCompare(b.platform) * sortOrder;
      }
      if (sortBy === 'label') {
        const aLabel = a.label ?? '';
        const bLabel = b.label ?? '';
        return aLabel.localeCompare(bLabel) * sortOrder;
      }
      return 0;
    });

    // Compute platformCounts across type (if type filter provided, else all)
    const baseForCounts = params.type
      ? this.records.filter(
          (r) => r.type.toLowerCase() === params.type!.trim().toLowerCase(),
        )
      : this.records;

    const counts: PlatformCounts = {
      ALL: baseForCounts.length,
      FACEBOOK: 0,
      INSTAGRAM: 0,
      YOUTUBE: 0,
      TIKTOK: 0,
      OTHER: 0,
    };

    for (const r of baseForCounts) {
      const key = r.platform.toUpperCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }

    const total = filtered.length;
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const items = filtered.slice(skip, skip + limit).map((r) => ({ ...r }));

    return {
      items,
      total,
      platformCounts: counts,
    };
  }

  async listActive(
    type?: string,
    platform?: string,
  ): Promise<SocialMediaRecord[]> {
    let filtered = this.records.filter((r) => r.isActive);

    if (type && type.trim().length > 0) {
      filtered = filtered.filter(
        (r) => r.type.toLowerCase() === type.trim().toLowerCase(),
      );
    }

    if (
      platform &&
      platform.trim().length > 0 &&
      platform.trim().toUpperCase() !== 'ALL'
    ) {
      filtered = filtered.filter(
        (r) => r.platform.toUpperCase() === platform.trim().toUpperCase(),
      );
    }

    filtered.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return filtered.map((r) => ({ ...r }));
  }

  async update(
    id: string,
    data: UpdateSocialMediaInput,
  ): Promise<SocialMediaRecord> {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Social media entry with id ${id} not found`);
    }

    const existing = this.records[index]!;
    const updated: SocialMediaRecord = {
      ...existing,
      platform:
        data.platform !== undefined
          ? data.platform.toUpperCase()
          : existing.platform,
      url: data.url !== undefined ? data.url : existing.url,
      type: data.type !== undefined ? data.type : existing.type,
      label: data.label !== undefined ? data.label : existing.label,
      thumbnailUrl:
        data.thumbnailUrl !== undefined
          ? data.thumbnailUrl
          : existing.thumbnailUrl,
      publicId: data.publicId !== undefined ? data.publicId : existing.publicId,
      displayOrder:
        data.displayOrder !== undefined
          ? data.displayOrder
          : existing.displayOrder,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      updatedAt: new Date(),
    };

    this.records[index] = updated;
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) return false;
    this.records.splice(index, 1);
    return true;
  }
}
