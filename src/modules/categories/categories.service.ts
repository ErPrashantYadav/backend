import { AppError } from '../../errors/app-error';
import { normalizeCatalogSlug } from '../../utils/slug';
import type { PageResult } from '../../types/pagination';
import type {
  CategoryRecord,
  CategoryRepository,
  PublicCategory,
} from './categories.types';

export function toPublicCategory(category: CategoryRecord): PublicCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.imageUrl,
    displayOrder: category.displayOrder,
  };
}

export class CategoryService {
  constructor(private readonly repository: CategoryRepository) {}

  listCategories(input: {
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }): Promise<PageResult<CategoryRecord>> {
    return this.repository.listCategories(input);
  }

  async getCategory(id: string): Promise<CategoryRecord> {
    const category = await this.repository.findCategory(id);
    if (!category) {
      throw new AppError(404, 'NOT_FOUND', 'Category was not found');
    }
    return category;
  }

  async listPublicCategories(input: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<PageResult<PublicCategory>> {
    const result = await this.repository.listCategories({
      ...input,
      isActive: true,
    });
    return {
      items: result.items.map(toPublicCategory),
      pagination: result.pagination,
    };
  }

  createCategory(input: {
    name: string;
    slug: string;
    description?: string | null;
    imageUrl?: string | null;
    displayOrder?: number;
    isActive: boolean;
  }): Promise<CategoryRecord> {
    const slug = normalizeCatalogSlug(input.slug);
    if (!slug || slug.length > 160) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Slug is empty or too long after normalization',
      );
    }
    return this.repository.createCategory({
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl ?? null,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive,
    });
  }

  updateCategory(
    id: string,
    input: Partial<{
      name: string;
      slug: string;
      description: string | null;
      imageUrl: string | null;
      displayOrder: number;
      isActive: boolean;
    }>,
  ): Promise<CategoryRecord> {
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
    if (input.description !== undefined) {
      normalized.description = input.description?.trim() || null;
    }
    return this.repository.updateCategory(id, normalized);
  }

  deleteCategory(id: string): Promise<void> {
    return this.repository.deleteCategory(id);
  }
}
