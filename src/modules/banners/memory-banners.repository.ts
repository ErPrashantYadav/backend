import crypto from 'node:crypto';
import type {
  BannerRecord,
  BannerRepository,
  CreateBannerInput,
  ListBannersParams,
  UpdateBannerInput,
} from './banners.types';

export class MemoryBannerRepository implements BannerRepository {
  public items: BannerRecord[] = [];

  async create(data: CreateBannerInput): Promise<BannerRecord> {
    const now = new Date();
    const record: BannerRecord = {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description ?? null,
      imageUrl: data.imageUrl,
      publicId: data.publicId ?? null,
      linkUrl: data.linkUrl ?? null,
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.items.push(record);
    return { ...record };
  }

  async findById(id: string): Promise<BannerRecord | null> {
    const found = this.items.find((item) => item.id === id);
    return found ? { ...found } : null;
  }

  async list(params: ListBannersParams = {}): Promise<{
    items: BannerRecord[];
    total: number;
  }> {
    let filtered = [...this.items];

    if (params.isActive !== undefined) {
      filtered = filtered.filter((b) => b.isActive === params.isActive);
    }

    if (params.search && params.search.trim().length > 0) {
      const term = params.search.trim().toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.title.toLowerCase().includes(term) ||
          (b.description && b.description.toLowerCase().includes(term)),
      );
    }

    const sortBy = params.sortBy ?? 'displayOrder';
    const sortOrder = params.sortOrder ?? 'asc';

    filtered.sort((a, b) => {
      let valA: unknown = a[sortBy];
      let valB: unknown = b[sortBy];

      if (sortBy === 'createdAt') {
        valA = a.createdAt.getTime();
        valB = b.createdAt.getTime();
      }

      if (valA === valB) {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return 0;
    });

    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const paginated = filtered.slice(skip, skip + limit);

    return {
      items: paginated.map((item) => ({ ...item })),
      total: filtered.length,
    };
  }

  async listActive(now: Date = new Date()): Promise<BannerRecord[]> {
    const active = this.items.filter((b) => {
      if (!b.isActive) return false;
      if (b.startDate && b.startDate.getTime() > now.getTime()) return false;
      if (b.endDate && b.endDate.getTime() < now.getTime()) return false;
      return true;
    });

    active.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return active.map((item) => ({ ...item }));
  }

  async update(id: string, data: UpdateBannerInput): Promise<BannerRecord> {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Banner ${id} not found`);
    }

    const current = this.items[index];
    if (!current) {
      throw new Error(`Banner ${id} not found`);
    }
    const updated: BannerRecord = {
      ...current,
      title: data.title !== undefined ? data.title : current.title,
      description:
        data.description !== undefined ? data.description : current.description,
      imageUrl: data.imageUrl !== undefined ? data.imageUrl : current.imageUrl,
      publicId: data.publicId !== undefined ? data.publicId : current.publicId,
      linkUrl: data.linkUrl !== undefined ? data.linkUrl : current.linkUrl,
      displayOrder:
        data.displayOrder !== undefined
          ? data.displayOrder
          : current.displayOrder,
      isActive: data.isActive !== undefined ? data.isActive : current.isActive,
      startDate:
        data.startDate !== undefined ? data.startDate : current.startDate,
      endDate: data.endDate !== undefined ? data.endDate : current.endDate,
      updatedAt: new Date(),
    };

    this.items[index] = updated;
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    const initialLen = this.items.length;
    this.items = this.items.filter((item) => item.id !== id);
    return this.items.length < initialLen;
  }

  async reorder(
    items: Array<{ id: string; displayOrder: number }>,
  ): Promise<void> {
    for (const item of items) {
      const banner = this.items.find((b) => b.id === item.id);
      if (banner) {
        banner.displayOrder = item.displayOrder;
        banner.updatedAt = new Date();
      }
    }
  }
}
