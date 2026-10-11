import type { PageResult } from '../../types/pagination';
import type {
  CategoryRecord,
  PublicCategory,
} from '../categories/categories.types';
import type { BrandRecord, PublicBrand } from '../brands/brands.types';

export interface PublicVariant {
  id: string;
  sku: string;
  sizeLabel: string;
  sizeMilliliters: number;
  price: string;
  discountedPrice: string;
  isAvailable: boolean;
  inStock: boolean;
}

export interface PublicProductImage {
  id: string;
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
}

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: Pick<PublicCategory, 'id' | 'name' | 'slug'>;
  brand: Pick<PublicBrand, 'id' | 'name' | 'slug'>;
  discount: {
    type: 'PERCENTAGE' | 'FIXED';
    value: string;
  } | null;
  images: PublicProductImage[];
  variants: PublicVariant[];
}

export interface ProductImageRecord {
  id: string;
  productId: string;
  imageUrl: string;
  publicId: string | null;
  altText: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariantRecord {
  id: string;
  productId: string;
  sku: string;
  sizeLabel: string;
  sizeMilliliters: number;
  purchasePrice: string;
  sellingPrice: string;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductRecord {
  id: string;
  categoryId: string;
  brandId: string;
  name: string;
  slug: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED' | null;
  discountValue: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: Pick<CategoryRecord, 'id' | 'name' | 'slug'> & {
    isActive?: boolean;
  };
  brand: Pick<BrandRecord, 'id' | 'name' | 'slug'> & { isActive?: boolean };
  images: ProductImageRecord[];
  variants: ProductVariantRecord[];
}

export interface ProductWriteInput {
  categoryId: string;
  brandId: string;
  name: string;
  slug: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED' | null;
  discountValue: string | null;
  isActive: boolean;
}

export interface ProductImageWriteInput {
  imageUrl: string;
  publicId: string | null;
  altText: string | null;
  sortOrder: number;
}

export interface ProductVariantWriteInput {
  sku: string;
  sizeLabel: string;
  sizeMilliliters: number;
  purchasePrice: string;
  sellingPrice: string;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
}

export interface ProductRepository {
  listProducts(input: {
    page: number;
    pageSize: number;
    search?: string;
    categoryId?: string;
    brandId?: string;
    isActive?: boolean;
    categoryIsActive?: boolean;
    brandIsActive?: boolean;
    sortBy?: 'name_asc' | 'name_desc' | 'newest';
  }): Promise<PageResult<ProductRecord>>;
  findProduct(id: string): Promise<ProductRecord | null>;
  createProduct(input: ProductWriteInput): Promise<ProductRecord>;
  updateProduct(
    id: string,
    input: Partial<ProductWriteInput>,
  ): Promise<ProductRecord>;
  deactivateProduct(id: string): Promise<void>;
  createProductImage(
    productId: string,
    input: ProductImageWriteInput,
  ): Promise<ProductImageRecord>;
  updateProductImage(
    productId: string,
    imageId: string,
    input: Partial<ProductImageWriteInput>,
  ): Promise<ProductImageRecord>;
  deleteProductImage(productId: string, imageId: string): Promise<void>;
  createProductVariant(
    productId: string,
    input: ProductVariantWriteInput,
  ): Promise<ProductVariantRecord>;
  updateProductVariant(
    productId: string,
    variantId: string,
    input: Partial<ProductVariantWriteInput>,
  ): Promise<ProductVariantRecord>;
  deactivateProductVariant(productId: string, variantId: string): Promise<void>;
}
