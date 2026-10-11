import { AppError } from '../../errors/app-error';
import { normalizeCatalogSlug } from '../../utils/slug';
import { normalizeMoney } from '../../utils/money';
import {
  calculateDiscountedPrice,
  validateDiscount,
} from '../../utils/discount';
import type { PageResult } from '../../types/pagination';
import type { InventoryService } from '../inventory/inventory.service';
import type {
  ProductImageRecord,
  ProductRecord,
  ProductRepository,
  ProductVariantRecord,
  ProductWriteInput,
  PublicProduct,
  PublicVariant,
} from './products.types';

export {
  calculateDiscountedPrice,
  validateDiscount,
} from '../../utils/discount';

const MAX_INTEGER = 2_147_483_647;

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
  if (!unit) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Size unit is required');
  }
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
    images: product.images.map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      altText: image.altText,
      sortOrder: image.sortOrder,
    })),
    variants: activeVariants,
  };
}

export class ProductService {
  constructor(
    private readonly repository: ProductRepository,
    private readonly inventoryService?: InventoryService,
  ) {}

  listProducts(input: Parameters<ProductRepository['listProducts']>[0]) {
    return this.repository.listProducts(input);
  }

  async getProduct(id: string): Promise<ProductRecord> {
    const product = await this.repository.findProduct(id);
    if (!product) {
      throw new AppError(404, 'NOT_FOUND', 'Product was not found');
    }
    return product;
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

  async createProduct(
    input: Omit<
      ProductWriteInput,
      'description' | 'discountType' | 'discountValue'
    > & {
      description?: string | null;
      discountType?: ProductWriteInput['discountType'];
      discountValue?: string | null;
    },
  ): Promise<ProductRecord> {
    const normalized = normalizeProductInput({
      ...input,
      description: input.description ?? null,
      discountType: input.discountType ?? null,
      discountValue: input.discountValue ?? null,
    });
    return this.repository.createProduct(normalized);
  }

  async updateProduct(
    id: string,
    input: Partial<ProductWriteInput>,
  ): Promise<ProductRecord> {
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

  deactivateProduct(id: string): Promise<void> {
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
  ): Promise<ProductImageRecord> {
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
  ): Promise<ProductImageRecord> {
    const normalized = { ...input };
    if (input.altText !== undefined) {
      normalized.altText = input.altText?.trim() || null;
    }
    return this.repository.updateProductImage(productId, imageId, normalized);
  }

  deleteProductImage(productId: string, imageId: string): Promise<void> {
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
  ): Promise<ProductVariantRecord> {
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
  ): Promise<ProductVariantRecord> {
    const currentProduct = await this.getProduct(productId);
    const current = currentProduct.variants.find(
      (variant) => variant.id === variantId,
    );
    if (!current) {
      throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
    }
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

  deactivateProductVariant(
    productId: string,
    variantId: string,
  ): Promise<void> {
    return this.repository.deactivateProductVariant(productId, variantId);
  }
}
