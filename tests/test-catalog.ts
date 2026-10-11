import type {
  CategoryRecord,
  CategoryRepository,
} from '../src/modules/categories/categories.types';
import type {
  BrandRecord,
  BrandRepository,
} from '../src/modules/brands/brands.types';
import type {
  ProductDetailRecord,
  ProductImageRecord,
  ProductImageWriteInput,
  ProductRecord,
  ProductRepository,
  ProductVariantRecord,
  ProductVariantWriteInput,
  ProductWriteInput,
} from '../src/modules/products/products.types';
import type { PageResult } from '../src/types/pagination';

export type {
  CategoryRecord,
  BrandRecord,
  ProductRecord,
  ProductVariantRecord,
  ProductImageRecord,
  ProductWriteInput,
  ProductVariantWriteInput,
  ProductImageWriteInput,
  ProductDetailRecord,
  PageResult,
  CategoryRepository,
  BrandRepository,
  ProductRepository,
};

export interface CatalogRepository
  extends
    CategoryRepository,
    Omit<BrandRepository, 'reorderBrands'>,
    ProductRepository {
  reorderBrands?(
    items: Array<{ id: string; displayOrder: number }>,
  ): Promise<void>;
}
