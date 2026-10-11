import crypto from 'node:crypto';
import type {
  CreateGalleryItemInput,
  GalleryItemRecord,
  GalleryRepository,
  ListGalleryParams,
  UpdateGalleryItemInput,
} from './gallery.types';

export class MemoryGalleryRepository implements GalleryRepository {
  public items: GalleryItemRecord[] = [];

  async create(data: CreateGalleryItemInput): Promise<GalleryItemRecord> {
    const now = new Date();
    const record: GalleryItemRecord = {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description ?? null,
      imageUrl: data.imageUrl,
      publicId: data.publicId ?? null,
      category: data.category ?? null,
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.items.push(record);
    return { ...record };
  }

  async findById(id: string): Promise<GalleryItemRecord | null> {
    const found = this.items.find((item) => item.id === id);
    return found ? { ...found } : null;
  }

  async list(params: ListGalleryParams = {}): Promise<{
    items: GalleryItemRecord[];
    total: number;
  }> {
    let filtered = [...this.items];

    if (params.isActive !== undefined) {
      filtered = filtered.filter((g) => g.isActive === params.isActive);
    }

    if (params.category && params.category.trim().length > 0) {
      const cat = params.category.trim().toLowerCase();
      filtered = filtered.filter(
        (g) => g.category && g.category.toLowerCase() === cat,
      );
    }

    if (params.search && params.search.trim().length > 0) {
      const term = params.search.trim().toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.title.toLowerCase().includes(term) ||
          (g.description && g.description.toLowerCase().includes(term)) ||
          (g.category && g.category.toLowerCase().includes(term)),
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

  async listActive(category?: string): Promise<GalleryItemRecord[]> {
    let active = this.items.filter((g) => g.isActive);

    if (category && category.trim().length > 0) {
      const cat = category.trim().toLowerCase();
      active = active.filter(
        (g) => g.category && g.category.toLowerCase() === cat,
      );
    }

    active.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return active.map((item) => ({ ...item }));
  }

  async update(
    id: string,
    data: UpdateGalleryItemInput,
  ): Promise<GalleryItemRecord> {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Gallery item ${id} not found`);
    }

    const current = this.items[index];
    if (!current) {
      throw new Error(`Gallery item ${id} not found`);
    }

    const updated: GalleryItemRecord = {
      ...current,
      title: data.title !== undefined ? data.title : current.title,
      description:
        data.description !== undefined ? data.description : current.description,
      imageUrl: data.imageUrl !== undefined ? data.imageUrl : current.imageUrl,
      publicId: data.publicId !== undefined ? data.publicId : current.publicId,
      category: data.category !== undefined ? data.category : current.category,
      displayOrder:
        data.displayOrder !== undefined
          ? data.displayOrder
          : current.displayOrder,
      isActive: data.isActive !== undefined ? data.isActive : current.isActive,
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
}
