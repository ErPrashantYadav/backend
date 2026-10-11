import type { PageResult } from '../../types/pagination';

export interface PublicBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  displayOrder: number;
}

export interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandRepository {
  listBrands(input: {
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }): Promise<PageResult<BrandRecord>>;
  findBrand(id: string): Promise<BrandRecord | null>;
  createBrand(
    input: Omit<BrandRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BrandRecord>;
  updateBrand(
    id: string,
    input: Partial<Omit<BrandRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BrandRecord>;
  deleteBrand(id: string): Promise<void>;
  reorderBrands(
    items: Array<{ id: string; displayOrder: number }>,
  ): Promise<void>;
}
