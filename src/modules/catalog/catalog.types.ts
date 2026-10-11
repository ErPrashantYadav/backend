export interface PageResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
}

export interface PublicBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

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

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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

export interface CatalogRepository {
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
