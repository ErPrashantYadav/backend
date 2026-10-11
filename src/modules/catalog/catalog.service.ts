import { Prisma } from '@prisma/client';
import { AppError } from '../../errors/app-error';
import type { InventoryService } from '../inventory/inventory.service';
import type {
  BrandRecord,
  CatalogRepository,
  CategoryRecord,
  PageResult,
  ProductRecord,
  ProductVariantRecord,
  ProductWriteInput,
  PublicBrand,
  PublicCategory,
  PublicProduct,
  PublicVariant,
} from './catalog.types';

const MAX_MONEY = 9_999_999_999.99;
const MAX_INTEGER = 2_147_483_647;

export function normalizeCatalogSlug(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeSku(input: string): string {
  const sku = input.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{0,79}$/.test(sku)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'SKU contains unsupported characters or length',
    );
  }
  return sku;
}

export function normalizeSize(input: string): {
  sizeMilliliters: number;
  sizeLabel: string;
} {
  const match = input.trim().match(/^(\d+(?:\.\d+)?)\s*(ml|l)$/i);
  if (!match) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Size must be a volume expressed in ml or L',
    );
  }
  const numericValue = Number(match[1]);
  const unit = match[2];
  if (!unit)
    throw new AppError(400, 'VALIDATION_ERROR', 'Size unit is required');
  const milliliters =
    unit.toLowerCase() === 'l' ? numericValue * 1000 : numericValue;
  if (
    !Number.isSafeInteger(milliliters) ||
    milliliters < 1 ||
    milliliters > MAX_INTEGER
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Size must resolve to a positive whole number of milliliters',
    );
  }
  return { sizeMilliliters: milliliters, sizeLabel: `${milliliters} ml` };
}

export function normalizeMoney(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Money amount is outside the supported range',
    );
  }
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 1e-7) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Money amounts may have at most two decimal places',
    );
  }
  return new Prisma.Decimal(cents).dividedBy(100).toFixed(2);
}

function validateDiscount(
  discountType: ProductWriteInput['discountType'],
  discountValue: string | null,
): void {
  if ((discountType === null) !== (discountValue === null)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Discount type and value must both be set or both be null',
    );
  }
  if (
    discountType === 'PERCENTAGE' &&
    new Prisma.Decimal(discountValue!).greaterThan(100)
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Percentage discount cannot exceed 100',
    );
  }
}

function normalizeProductInput(input: ProductWriteInput): ProductWriteInput {
  const slug = normalizeCatalogSlug(input.slug);
  if (!slug || slug.length > 220) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Slug is empty or too long after normalization',
    );
  }
  validateDiscount(input.discountType, input.discountValue);
  return {
    ...input,
    name: input.name.trim(),
    slug,
    description: input.description?.trim() || null,
    discountValue:
      input.discountValue === null
        ? null
        : normalizeMoney(Number(input.discountValue)),
  };
}

export function calculateDiscountedPrice(
  sellingPrice: string,
  discountType: 'PERCENTAGE' | 'FIXED' | null,
  discountValue: string | null,
): string {
  if (!discountType || !discountValue) {
    return sellingPrice;
  }
  const price = new Prisma.Decimal(sellingPrice);
  let effective: Prisma.Decimal;
  if (discountType === 'PERCENTAGE') {
    const percentage = new Prisma.Decimal(discountValue);
    const discountAmount = price.times(percentage).dividedBy(100);
    effective = price.minus(discountAmount);
  } else {
    const fixedAmount = new Prisma.Decimal(discountValue);
    effective = price.minus(fixedAmount);
  }
  if (effective.lessThan(0)) {
    effective = new Prisma.Decimal(0);
  }
  return effective.toFixed(2);
}

export function toPublicVariant(
  variant: ProductVariantRecord,
  discountType: 'PERCENTAGE' | 'FIXED' | null,
  discountValue: string | null,
): PublicVariant {
  return {
    id: variant.id,
    sku: variant.sku,
    sizeLabel: variant.sizeLabel,
    sizeMilliliters: variant.sizeMilliliters,
    price: variant.sellingPrice,
    discountedPrice: calculateDiscountedPrice(
      variant.sellingPrice,
      discountType,
      discountValue,
    ),
    isAvailable: variant.stock > 0,
    inStock: variant.stock > 0,
  };
}

export function toPublicProduct(product: ProductRecord): PublicProduct {
  const activeVariants = product.variants
    .filter((v) => v.isActive)
    .map((v) =>
      toPublicVariant(v, product.discountType, product.discountValue),
    );

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    },
    brand: {
      id: product.brand.id,
      name: product.brand.name,
      slug: product.brand.slug,
    },
    discount:
      product.discountType && product.discountValue
        ? {
            type: product.discountType,
            value: product.discountValue,
          }
        : null,
    images: [...product.images]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      .map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        altText: img.altText,
        sortOrder: img.sortOrder,
      })),
    variants: activeVariants,
  };
}

export function toPublicCategory(category: CategoryRecord): PublicCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.imageUrl,
  };
}

export function toPublicBrand(brand: BrandRecord): PublicBrand {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
  };
}

export class CatalogService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly inventoryService?: InventoryService,
  ) {}

  async listPublicCategories(input: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<PageResult<PublicCategory>> {
    const page = Math.max(1, input.page || 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize || 20));
    const result = await this.repository.listCategories({
      page,
      pageSize,
      search: input.search,
      isActive: true,
    });
    return {
      items: result.items.map(toPublicCategory),
      pagination: result.pagination,
    };
  }

  async listPublicBrands(input: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<PageResult<PublicBrand>> {
    const page = Math.max(1, input.page || 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize || 20));
    const result = await this.repository.listBrands({
      page,
      pageSize,
      search: input.search,
      isActive: true,
    });
    return {
      items: result.items.map(toPublicBrand),
      pagination: result.pagination,
    };
  }

  async listPublicProducts(input: {
    page?: number;
    pageSize?: number;
    search?: string;
    categoryId?: string;
    brandId?: string;
    sortBy?: 'name_asc' | 'name_desc' | 'newest' | 'price_asc' | 'price_desc';
  }): Promise<PageResult<PublicProduct>> {
    const page = Math.max(1, input.page || 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize || 20));
    const sortBy = input.sortBy || 'name_asc';

    const repoSortBy =
      sortBy === 'name_desc'
        ? 'name_desc'
        : sortBy === 'newest'
          ? 'newest'
          : 'name_asc';

    const result = await this.repository.listProducts({
      page,
      pageSize,
      search: input.search,
      categoryId: input.categoryId,
      brandId: input.brandId,
      isActive: true,
      categoryIsActive: true,
      brandIsActive: true,
      sortBy: repoSortBy,
    });

    let items = result.items
      .filter(
        (p) =>
          p.isActive &&
          p.category.isActive !== false &&
          p.brand.isActive !== false,
      )
      .map(toPublicProduct);

    if (sortBy === 'price_asc' || sortBy === 'price_desc') {
      const getMinPrice = (p: PublicProduct): number => {
        if (p.variants.length === 0) return Number.POSITIVE_INFINITY;
        return Math.min(...p.variants.map((v) => Number(v.discountedPrice)));
      };
      items = items.sort((a, b) =>
        sortBy === 'price_asc'
          ? getMinPrice(a) - getMinPrice(b)
          : getMinPrice(b) - getMinPrice(a),
      );
    }

    return {
      items,
      pagination: result.pagination,
    };
  }

  async getPublicProduct(id: string): Promise<PublicProduct> {
    const product = await this.repository.findProduct(id);
    if (!product || !product.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'Product was not found');
    }
    if (
      product.category.isActive === false ||
      product.brand.isActive === false
    ) {
      throw new AppError(404, 'NOT_FOUND', 'Product was not found');
    }
    return toPublicProduct(product);
  }

  listCategories(input: Parameters<CatalogRepository['listCategories']>[0]) {
    return this.repository.listCategories(input);
  }

  getCategory(id: string) {
    return this.repository.findCategory(id).then((category) => {
      if (!category)
        throw new AppError(404, 'NOT_FOUND', 'Category was not found');
      return category;
    });
  }

  createCategory(input: {
    name: string;
    slug: string;
    description?: string | null;
    imageUrl?: string | null;
    isActive: boolean;
  }) {
    const slug = normalizeCatalogSlug(input.slug);
    if (!slug || slug.length > 160)
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Slug is empty or too long after normalization',
      );
    return this.repository.createCategory({
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl ?? null,
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
      isActive: boolean;
    }>,
  ) {
    const normalized = { ...input };
    if (input.name !== undefined) normalized.name = input.name.trim();
    if (input.slug !== undefined) {
      normalized.slug = normalizeCatalogSlug(input.slug);
      if (!normalized.slug || normalized.slug.length > 160)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Slug is empty or too long after normalization',
        );
    }
    if (input.description !== undefined)
      normalized.description = input.description?.trim() || null;
    return this.repository.updateCategory(id, normalized);
  }

  deleteCategory(id: string) {
    return this.repository.deleteCategory(id);
  }

  listBrands(input: Parameters<CatalogRepository['listBrands']>[0]) {
    return this.repository.listBrands(input);
  }

  getBrand(id: string) {
    return this.repository.findBrand(id).then((brand) => {
      if (!brand) throw new AppError(404, 'NOT_FOUND', 'Brand was not found');
      return brand;
    });
  }

  createBrand(input: {
    name: string;
    slug: string;
    logoUrl?: string | null;
    isActive: boolean;
  }) {
    const slug = normalizeCatalogSlug(input.slug);
    if (!slug || slug.length > 160)
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Slug is empty or too long after normalization',
      );
    return this.repository.createBrand({
      name: input.name.trim(),
      slug,
      logoUrl: input.logoUrl ?? null,
      isActive: input.isActive,
    });
  }

  updateBrand(
    id: string,
    input: Partial<{
      name: string;
      slug: string;
      logoUrl: string | null;
      isActive: boolean;
    }>,
  ) {
    const normalized = { ...input };
    if (input.name !== undefined) normalized.name = input.name.trim();
    if (input.slug !== undefined) {
      normalized.slug = normalizeCatalogSlug(input.slug);
      if (!normalized.slug || normalized.slug.length > 160)
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Slug is empty or too long after normalization',
        );
    }
    return this.repository.updateBrand(id, normalized);
  }

  deleteBrand(id: string) {
    return this.repository.deleteBrand(id);
  }

  listProducts(input: Parameters<CatalogRepository['listProducts']>[0]) {
    return this.repository.listProducts(input);
  }

  getProduct(id: string) {
    return this.repository.findProduct(id).then((product) => {
      if (!product)
        throw new AppError(404, 'NOT_FOUND', 'Product was not found');
      return product;
    });
  }

  async createProduct(
    input: Omit<
      ProductWriteInput,
      'description' | 'discountType' | 'discountValue'
    > & {
      description?: string | null;
      discountType?: ProductWriteInput['discountType'];
      discountValue?: string | null;
    },
  ) {
    const normalized = normalizeProductInput({
      ...input,
      description: input.description ?? null,
      discountType: input.discountType ?? null,
      discountValue: input.discountValue ?? null,
    });
    return this.repository.createProduct(normalized);
  }

  async updateProduct(id: string, input: Partial<ProductWriteInput>) {
    const current = await this.getProduct(id);
    const merged = normalizeProductInput({
      categoryId: input.categoryId ?? current.categoryId,
      brandId: input.brandId ?? current.brandId,
      name: input.name ?? current.name,
      slug: input.slug ?? current.slug,
      description:
        input.description === undefined
          ? current.description
          : input.description,
      discountType:
        input.discountType === undefined
          ? current.discountType
          : input.discountType,
      discountValue:
        input.discountValue === undefined
          ? current.discountValue
          : input.discountValue,
      isActive: input.isActive ?? current.isActive,
    });
    return this.repository.updateProduct(id, merged);
  }

  deactivateProduct(id: string) {
    return this.repository.deactivateProduct(id);
  }

  createProductImage(
    productId: string,
    input: {
      imageUrl: string;
      publicId?: string | null;
      altText?: string | null;
      sortOrder: number;
    },
  ) {
    return this.repository.createProductImage(productId, {
      ...input,
      publicId: input.publicId ?? null,
      altText: input.altText?.trim() || null,
    });
  }

  updateProductImage(
    productId: string,
    imageId: string,
    input: Partial<{
      imageUrl: string;
      publicId: string | null;
      altText: string | null;
      sortOrder: number;
    }>,
  ) {
    const normalized = { ...input };
    if (input.altText !== undefined)
      normalized.altText = input.altText?.trim() || null;
    return this.repository.updateProductImage(productId, imageId, normalized);
  }

  deleteProductImage(productId: string, imageId: string) {
    return this.repository.deleteProductImage(productId, imageId);
  }

  createProductVariant(
    productId: string,
    input: {
      sku: string;
      size: string;
      purchasePrice: number;
      sellingPrice: number;
      stock: number;
      lowStockThreshold: number;
      isActive: boolean;
    },
  ) {
    const size = normalizeSize(input.size);
    return this.repository.createProductVariant(productId, {
      sku: normalizeSku(input.sku),
      ...size,
      purchasePrice: normalizeMoney(input.purchasePrice),
      sellingPrice: normalizeMoney(input.sellingPrice),
      stock: input.stock,
      lowStockThreshold: input.lowStockThreshold,
      isActive: input.isActive,
    });
  }

  async updateProductVariant(
    productId: string,
    variantId: string,
    input: Partial<{
      sku: string;
      size: string;
      purchasePrice: number;
      sellingPrice: number;
      stock: number;
      lowStockThreshold: number;
      isActive: boolean;
    }>,
    actorAdminId?: string,
  ) {
    const currentProduct = await this.getProduct(productId);
    const current = currentProduct.variants.find(
      (variant) => variant.id === variantId,
    );
    if (!current)
      throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
    const size =
      input.size === undefined
        ? {
            sizeLabel: current.sizeLabel,
            sizeMilliliters: current.sizeMilliliters,
          }
        : normalizeSize(input.size);

    if (input.stock !== undefined && input.stock !== current.stock) {
      if (this.inventoryService) {
        const delta = input.stock - current.stock;
        await this.inventoryService.adjustStock({
          variantId,
          quantityDelta: delta,
          type: 'CORRECTION',
          reason: 'Catalog variant stock update',
          actorAdminId: actorAdminId ?? 'system',
        });
      }
    }

    return this.repository.updateProductVariant(productId, variantId, {
      ...(input.sku !== undefined ? { sku: normalizeSku(input.sku) } : {}),
      ...size,
      ...(input.purchasePrice !== undefined
        ? { purchasePrice: normalizeMoney(input.purchasePrice) }
        : {}),
      ...(input.sellingPrice !== undefined
        ? { sellingPrice: normalizeMoney(input.sellingPrice) }
        : {}),
      ...(this.inventoryService
        ? {}
        : input.stock !== undefined
          ? { stock: input.stock }
          : {}),
      ...(input.lowStockThreshold !== undefined
        ? { lowStockThreshold: input.lowStockThreshold }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });
  }

  deactivateProductVariant(productId: string, variantId: string) {
    return this.repository.deactivateProductVariant(productId, variantId);
  }
}
