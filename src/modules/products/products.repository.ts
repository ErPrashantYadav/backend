import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/app-error';
import type { PageResult } from '../../types/pagination';
import type {
  ProductImageRecord,
  ProductImageWriteInput,
  ProductRecord,
  ProductRepository,
  ProductVariantRecord,
  ProductVariantWriteInput,
  ProductWriteInput,
} from './products.types';

const imageSelect = {
  id: true,
  productId: true,
  imageUrl: true,
  publicId: true,
  altText: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

const variantSelect = {
  id: true,
  productId: true,
  sku: true,
  sizeLabel: true,
  sizeMilliliters: true,
  purchasePrice: true,
  sellingPrice: true,
  stock: true,
  lowStockThreshold: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const productInclude = {
  category: { select: { id: true, name: true, slug: true, isActive: true } },
  brand: { select: { id: true, name: true, slug: true, isActive: true } },
  images: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: imageSelect,
  },
  variants: {
    orderBy: [{ sizeMilliliters: 'asc' }, { id: 'asc' }],
    select: variantSelect,
  },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function mapVariant(row: ProductRow['variants'][number]): ProductVariantRecord {
  return {
    ...row,
    purchasePrice: row.purchasePrice.toString(),
    sellingPrice: row.sellingPrice.toString(),
  };
}

function mapProduct(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    categoryId: row.categoryId,
    brandId: row.brandId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    discountType: row.discountType,
    discountValue: row.discountValue?.toString() ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    category: row.category,
    brand: row.brand,
    images: row.images,
    variants: row.variants.map(mapVariant),
  };
}

function throwProductError(error: unknown, resource: string): never {
  if (error instanceof AppError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new AppError(
        409,
        'DUPLICATE_RESOURCE',
        `${resource} already exists`,
      );
    }
    if (error.code === 'P2025') {
      throw new AppError(404, 'NOT_FOUND', `${resource} was not found`);
    }
    if (error.code === 'P2003') {
      throw new AppError(
        409,
        'REFERENCE_CONFLICT',
        `${resource} is still referenced`,
      );
    }
  }
  throw error;
}

function pageResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PageResult<T> {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export class PrismaProductRepository implements ProductRepository {
  async listProducts(input: {
    page: number;
    pageSize: number;
    search?: string;
    categoryId?: string;
    brandId?: string;
    isActive?: boolean;
    categoryIsActive?: boolean;
    brandIsActive?: boolean;
    sortBy?: 'name_asc' | 'name_desc' | 'newest';
  }): Promise<PageResult<ProductRecord>> {
    const where: Prisma.ProductWhereInput = {
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.brandId ? { brandId: input.brandId } : {}),
      ...(input.categoryIsActive !== undefined
        ? { category: { isActive: input.categoryIsActive } }
        : {}),
      ...(input.brandIsActive !== undefined
        ? { brand: { isActive: input.brandIsActive } }
        : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { slug: { contains: input.search, mode: 'insensitive' } },
              {
                variants: {
                  some: {
                    sku: { contains: input.search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    let orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { id: 'asc' },
    ];
    if (input.sortBy === 'name_asc') {
      orderBy = [{ name: 'asc' }, { id: 'asc' }];
    } else if (input.sortBy === 'name_desc') {
      orderBy = [{ name: 'desc' }, { id: 'asc' }];
    } else if (input.sortBy === 'newest') {
      orderBy = [{ createdAt: 'desc' }, { id: 'asc' }];
    }

    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy,
        include: productInclude,
      }),
    ]);
    return pageResult(rows.map(mapProduct), total, input.page, input.pageSize);
  }

  async findProduct(id: string): Promise<ProductRecord | null> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      );
    const row = await prisma.product.findUnique({
      where: isUuid ? { id } : { slug: id },
      include: productInclude,
    });
    return row ? mapProduct(row) : null;
  }

  async createProduct(input: ProductWriteInput): Promise<ProductRecord> {
    try {
      const row = await prisma.$transaction(
        async (transaction) => {
          await this.assertActiveReferences(
            transaction,
            input.categoryId,
            input.brandId,
          );
          return transaction.product.create({
            data: {
              ...input,
              discountValue:
                input.discountValue === null
                  ? null
                  : new Prisma.Decimal(input.discountValue),
            },
            include: productInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return mapProduct(row);
    } catch (error) {
      throwProductError(error, 'Product slug or reference');
    }
  }

  async updateProduct(
    id: string,
    input: Partial<ProductWriteInput>,
  ): Promise<ProductRecord> {
    try {
      const row = await prisma.$transaction(
        async (transaction) => {
          const current = await transaction.product.findUnique({
            where: { id },
          });
          if (!current) {
            throw new AppError(404, 'NOT_FOUND', 'Product was not found');
          }
          await this.assertActiveReferences(
            transaction,
            input.categoryId ?? current.categoryId,
            input.brandId ?? current.brandId,
          );
          return transaction.product.update({
            where: { id },
            data: {
              ...input,
              ...(input.discountValue !== undefined
                ? {
                    discountValue:
                      input.discountValue === null
                        ? null
                        : new Prisma.Decimal(input.discountValue),
                  }
                : {}),
            },
            include: productInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return mapProduct(row);
    } catch (error) {
      throwProductError(error, 'Product');
    }
  }

  async deactivateProduct(id: string): Promise<void> {
    try {
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
        select: { id: true },
      });
    } catch (error) {
      throwProductError(error, 'Product');
    }
  }

  async createProductImage(
    productId: string,
    input: ProductImageWriteInput,
  ): Promise<ProductImageRecord> {
    try {
      return await prisma.$transaction(async (transaction) => {
        const product = await transaction.product.findUnique({
          where: { id: productId },
          select: { id: true },
        });
        if (!product) {
          throw new AppError(404, 'NOT_FOUND', 'Product was not found');
        }
        return transaction.productImage.create({
          data: { ...input, productId },
          select: imageSelect,
        });
      });
    } catch (error) {
      throwProductError(error, 'Product image');
    }
  }

  async updateProductImage(
    productId: string,
    imageId: string,
    input: Partial<ProductImageWriteInput>,
  ): Promise<ProductImageRecord> {
    try {
      const result = await prisma.productImage.updateMany({
        where: { id: imageId, productId },
        data: input,
      });
      if (result.count === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Product image was not found');
      }
      return await prisma.productImage.findUniqueOrThrow({
        where: { id: imageId },
        select: imageSelect,
      });
    } catch (error) {
      throwProductError(error, 'Product image');
    }
  }

  async deleteProductImage(productId: string, imageId: string): Promise<void> {
    try {
      const result = await prisma.productImage.deleteMany({
        where: { id: imageId, productId },
      });
      if (result.count === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Product image was not found');
      }
    } catch (error) {
      throwProductError(error, 'Product image');
    }
  }

  async createProductVariant(
    productId: string,
    input: ProductVariantWriteInput,
  ): Promise<ProductVariantRecord> {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const product = await transaction.product.findUnique({
            where: { id: productId },
            select: { id: true },
          });
          if (!product) {
            throw new AppError(404, 'NOT_FOUND', 'Product was not found');
          }
          const row = await transaction.productVariant.create({
            data: {
              ...input,
              productId,
              purchasePrice: new Prisma.Decimal(input.purchasePrice),
              sellingPrice: new Prisma.Decimal(input.sellingPrice),
            },
            select: variantSelect,
          });
          return mapVariant(row);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      throwProductError(error, 'SKU or product size');
    }
  }

  async updateProductVariant(
    productId: string,
    variantId: string,
    input: Partial<ProductVariantWriteInput>,
  ): Promise<ProductVariantRecord> {
    try {
      const result = await prisma.productVariant.updateMany({
        where: { id: variantId, productId },
        data: {
          ...input,
          ...(input.purchasePrice !== undefined
            ? { purchasePrice: new Prisma.Decimal(input.purchasePrice) }
            : {}),
          ...(input.sellingPrice !== undefined
            ? { sellingPrice: new Prisma.Decimal(input.sellingPrice) }
            : {}),
        },
      });
      if (result.count === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
      }
      const row = await prisma.productVariant.findUniqueOrThrow({
        where: { id: variantId },
        select: variantSelect,
      });
      return mapVariant(row);
    } catch (error) {
      throwProductError(error, 'SKU or product size');
    }
  }

  async deactivateProductVariant(
    productId: string,
    variantId: string,
  ): Promise<void> {
    try {
      const result = await prisma.productVariant.updateMany({
        where: { id: variantId, productId },
        data: { isActive: false },
      });
      if (result.count === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
      }
    } catch (error) {
      throwProductError(error, 'Product variant');
    }
  }

  private async assertActiveReferences(
    transaction: Prisma.TransactionClient,
    categoryId: string,
    brandId: string,
  ): Promise<void> {
    const [category, brand] = await Promise.all([
      transaction.category.findUnique({
        where: { id: categoryId },
        select: { isActive: true },
      }),
      transaction.brand.findUnique({
        where: { id: brandId },
        select: { isActive: true },
      }),
    ]);
    if (!category?.isActive) {
      throw new AppError(
        400,
        'INVALID_CATEGORY',
        'An active category is required',
      );
    }
    if (!brand?.isActive) {
      throw new AppError(400, 'INVALID_BRAND', 'An active brand is required');
    }
  }
}
