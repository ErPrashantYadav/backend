import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../errors/app-error';
import {
  SAMPLE_CATEGORIES,
  SAMPLE_BRANDS,
  SAMPLE_PRODUCTS,
} from './sample-catalog.data';

export interface CategorySeedInput {
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface BrandSeedInput {
  name: string;
  slug: string;
  logoUrl: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface ProductSeedInput {
  categoryId: string;
  brandId: string;
  name: string;
  slug: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED' | null;
  discountValue: string | null;
  isActive: boolean;
}

export interface VariantSeedInput {
  productId: string;
  sku: string;
  sizeLabel: string;
  sizeMilliliters: number;
  purchasePrice: string;
  sellingPrice: string;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
}

export interface SampleCatalogRepository {
  upsertCategory(input: CategorySeedInput): Promise<{ id: string }>;
  upsertBrand(input: BrandSeedInput): Promise<{ id: string }>;
  upsertProduct(input: ProductSeedInput): Promise<{ id: string }>;
  upsertVariant(input: VariantSeedInput): Promise<{ id: string }>;
  runInTransaction<T>(
    operation: (repo: SampleCatalogRepository) => Promise<T>,
  ): Promise<T>;
}

export interface SampleCatalogSeedResult {
  categoriesUpserted: number;
  brandsUpserted: number;
  productsUpserted: number;
  variantsUpserted: number;
  isDryRun: boolean;
}

export class PrismaSampleCatalogRepository implements SampleCatalogRepository {
  constructor(
    private readonly client: PrismaClient | Prisma.TransactionClient,
  ) {}

  async upsertCategory(input: CategorySeedInput): Promise<{ id: string }> {
    const record = await this.client.category.upsert({
      where: { slug: input.slug },
      update: {
        name: input.name,
        description: input.description,
        imageUrl: input.imageUrl,
        displayOrder: input.displayOrder,
        isActive: input.isActive,
      },
      create: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        imageUrl: input.imageUrl,
        displayOrder: input.displayOrder,
        isActive: input.isActive,
      },
      select: { id: true },
    });
    return { id: record.id };
  }

  async upsertBrand(input: BrandSeedInput): Promise<{ id: string }> {
    const record = await this.client.brand.upsert({
      where: { slug: input.slug },
      update: {
        name: input.name,
        logoUrl: input.logoUrl,
        displayOrder: input.displayOrder,
        isActive: input.isActive,
      },
      create: {
        name: input.name,
        slug: input.slug,
        logoUrl: input.logoUrl,
        displayOrder: input.displayOrder,
        isActive: input.isActive,
      },
      select: { id: true },
    });
    return { id: record.id };
  }

  async upsertProduct(input: ProductSeedInput): Promise<{ id: string }> {
    const record = await this.client.product.upsert({
      where: { slug: input.slug },
      update: {
        categoryId: input.categoryId,
        brandId: input.brandId,
        name: input.name,
        description: input.description,
        discountType: input.discountType,
        discountValue:
          input.discountValue !== null
            ? new Prisma.Decimal(input.discountValue)
            : null,
        isActive: input.isActive,
      },
      create: {
        categoryId: input.categoryId,
        brandId: input.brandId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        discountType: input.discountType,
        discountValue:
          input.discountValue !== null
            ? new Prisma.Decimal(input.discountValue)
            : null,
        isActive: input.isActive,
      },
      select: { id: true },
    });
    return { id: record.id };
  }

  async upsertVariant(input: VariantSeedInput): Promise<{ id: string }> {
    const record = await this.client.productVariant.upsert({
      where: { sku: input.sku },
      update: {
        productId: input.productId,
        sizeLabel: input.sizeLabel,
        sizeMilliliters: input.sizeMilliliters,
        purchasePrice: new Prisma.Decimal(input.purchasePrice),
        sellingPrice: new Prisma.Decimal(input.sellingPrice),
        stock: input.stock,
        lowStockThreshold: input.lowStockThreshold,
        isActive: input.isActive,
      },
      create: {
        productId: input.productId,
        sku: input.sku,
        sizeLabel: input.sizeLabel,
        sizeMilliliters: input.sizeMilliliters,
        purchasePrice: new Prisma.Decimal(input.purchasePrice),
        sellingPrice: new Prisma.Decimal(input.sellingPrice),
        stock: input.stock,
        lowStockThreshold: input.lowStockThreshold,
        isActive: input.isActive,
      },
      select: { id: true },
    });
    return { id: record.id };
  }

  async runInTransaction<T>(
    operation: (repo: SampleCatalogRepository) => Promise<T>,
  ): Promise<T> {
    if ('$transaction' in this.client) {
      return (this.client as PrismaClient).$transaction(async (tx) => {
        const txRepo = new PrismaSampleCatalogRepository(tx);
        return operation(txRepo);
      });
    }
    return operation(this);
  }
}

export function assertSafeSeedEnvironment(env: {
  nodeEnv?: string;
  databaseUrl?: string;
  allowProductionSeed?: string;
}): void {
  const isProduction =
    env.nodeEnv === 'production' ||
    (env.databaseUrl
      ? env.databaseUrl.toLowerCase().includes('production')
      : false);

  if (isProduction && env.allowProductionSeed !== 'true') {
    throw new AppError(
      403,
      'PRODUCTION_SEED_FORBIDDEN',
      'Refusing to execute sample seed data in production environment without explicit ALLOW_PRODUCTION_SAMPLE_SEED=true',
    );
  }
}

export function assertExpectedDatabase(
  actualDatabaseName: string,
  expectedDatabaseName?: string,
): void {
  if (expectedDatabaseName && expectedDatabaseName.trim()) {
    if (actualDatabaseName !== expectedDatabaseName.trim()) {
      throw new AppError(
        400,
        'SEED_DATABASE_MISMATCH',
        `Connected database "${actualDatabaseName}" does not match SAMPLE_SEED_EXPECTED_DATABASE "${expectedDatabaseName.trim()}"; no seeding was performed`,
      );
    }
  }
}

export async function seedSampleCatalog(
  repository: SampleCatalogRepository,
  options: { dryRun?: boolean } = {},
): Promise<SampleCatalogSeedResult> {
  const { dryRun = false } = options;

  if (dryRun) {
    let variantCount = 0;
    for (const product of SAMPLE_PRODUCTS) {
      variantCount += product.variants.length;
    }
    return {
      categoriesUpserted: SAMPLE_CATEGORIES.length,
      brandsUpserted: SAMPLE_BRANDS.length,
      productsUpserted: SAMPLE_PRODUCTS.length,
      variantsUpserted: variantCount,
      isDryRun: true,
    };
  }

  return repository.runInTransaction(async (repo) => {
    const categoryMap = new Map<string, string>();
    let categoriesUpserted = 0;
    for (const category of SAMPLE_CATEGORIES) {
      const res = await repo.upsertCategory({
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: null,
        displayOrder: category.displayOrder,
        isActive: category.isActive,
      });
      categoryMap.set(category.slug, res.id);
      categoriesUpserted++;
    }

    const brandMap = new Map<string, string>();
    let brandsUpserted = 0;
    for (const brand of SAMPLE_BRANDS) {
      const res = await repo.upsertBrand({
        name: brand.name,
        slug: brand.slug,
        logoUrl: null,
        displayOrder: brand.displayOrder,
        isActive: brand.isActive,
      });
      brandMap.set(brand.slug, res.id);
      brandsUpserted++;
    }

    let productsUpserted = 0;
    let variantsUpserted = 0;
    for (const product of SAMPLE_PRODUCTS) {
      const categoryId = categoryMap.get(product.categorySlug);
      if (!categoryId) {
        throw new AppError(
          400,
          'SEED_DATA_INVALID',
          `Unknown category slug "${product.categorySlug}" for product "${product.name}"`,
        );
      }
      const brandId = brandMap.get(product.brandSlug);
      if (!brandId) {
        throw new AppError(
          400,
          'SEED_DATA_INVALID',
          `Unknown brand slug "${product.brandSlug}" for product "${product.name}"`,
        );
      }

      const productRes = await repo.upsertProduct({
        categoryId,
        brandId,
        name: product.name,
        slug: product.slug,
        description: product.description,
        discountType: product.discountType,
        discountValue: product.discountValue,
        isActive: product.isActive,
      });
      productsUpserted++;

      for (const variant of product.variants) {
        await repo.upsertVariant({
          productId: productRes.id,
          sku: variant.sku,
          sizeLabel: variant.sizeLabel,
          sizeMilliliters: variant.sizeMilliliters,
          purchasePrice: variant.purchasePrice,
          sellingPrice: variant.sellingPrice,
          stock: variant.stock,
          lowStockThreshold: variant.lowStockThreshold,
          isActive: variant.isActive,
        });
        variantsUpserted++;
      }
    }

    return {
      categoriesUpserted,
      brandsUpserted,
      productsUpserted,
      variantsUpserted,
      isDryRun: false,
    };
  });
}
