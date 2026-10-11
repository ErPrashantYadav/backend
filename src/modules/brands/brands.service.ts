import { AppError } from '../../errors/app-error';
import { normalizeCatalogSlug } from '../../utils/slug';
import type { PageResult } from '../../types/pagination';
import type { AuditService } from '../audit/audit.service';
import type { BrandRecord, BrandRepository, PublicBrand } from './brands.types';

export function toPublicBrand(brand: BrandRecord): PublicBrand {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
    displayOrder: brand.displayOrder,
  };
}

export class BrandService {
  constructor(
    private readonly repository: BrandRepository,
    private readonly auditService?: AuditService,
  ) {}

  listBrands(input: {
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }): Promise<PageResult<BrandRecord>> {
    return this.repository.listBrands(input);
  }

  async getBrand(id: string): Promise<BrandRecord> {
    const brand = await this.repository.findBrand(id);
    if (!brand) {
      throw new AppError(404, 'NOT_FOUND', 'Brand was not found');
    }
    return brand;
  }

  async listPublicBrands(input: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<PageResult<PublicBrand>> {
    const result = await this.repository.listBrands({
      ...input,
      isActive: true,
    });
    return {
      items: result.items.map(toPublicBrand),
      pagination: result.pagination,
    };
  }

  createBrand(input: {
    name: string;
    slug: string;
    logoUrl?: string | null;
    displayOrder?: number;
    isActive: boolean;
  }): Promise<BrandRecord> {
    const slug = normalizeCatalogSlug(input.slug);
    if (!slug || slug.length > 160) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Slug is empty or too long after normalization',
      );
    }
    return this.repository.createBrand({
      name: input.name.trim(),
      slug,
      logoUrl: input.logoUrl ?? null,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive,
    });
  }

  updateBrand(
    id: string,
    input: Partial<{
      name: string;
      slug: string;
      logoUrl: string | null;
      displayOrder: number;
      isActive: boolean;
    }>,
  ): Promise<BrandRecord> {
    const normalized = { ...input };
    if (input.name !== undefined) normalized.name = input.name.trim();
    if (input.slug !== undefined) {
      normalized.slug = normalizeCatalogSlug(input.slug);
      if (!normalized.slug || normalized.slug.length > 160) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Slug is empty or too long after normalization',
        );
      }
    }
    return this.repository.updateBrand(id, normalized);
  }

  deleteBrand(id: string): Promise<void> {
    return this.repository.deleteBrand(id);
  }

  async reorderBrands(
    items: Array<{ id: string; displayOrder: number }>,
    actorAdminId?: string,
  ): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'At least one brand is required for reordering',
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
          `Duplicate brand ID "${item.id}" in reorder payload`,
        );
      }
      seenIds.add(item.id);
    }

    for (const id of seenIds) {
      const existing = await this.repository.findBrand(id);
      if (!existing) {
        throw new AppError(404, 'NOT_FOUND', `Brand ${id} not found`);
      }
    }

    await this.repository.reorderBrands(items);

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'catalog.brands.reorder',
        resourceType: 'brand',
        resourceId: 'batch',
        actorAdminId,
        metadata: {
          count: items.length,
          brandIds: items.map((i) => i.id),
        },
      });
    }
  }
}
