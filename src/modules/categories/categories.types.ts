import type { PageResult } from '../../types/pagination';

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryRepository {
  listCategories(input: {
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }): Promise<PageResult<CategoryRecord>>;
  findCategory(id: string): Promise<CategoryRecord | null>;
  createCategory(
    input: Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CategoryRecord>;
  updateCategory(
    id: string,
    input: Partial<Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<CategoryRecord>;
  deleteCategory(id: string): Promise<void>;
}
