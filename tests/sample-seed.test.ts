import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors/app-error';
import {
  SAMPLE_CATEGORIES,
  SAMPLE_BRANDS,
  SAMPLE_PRODUCTS,
} from '../src/seed/sample-catalog.data';
import {
  assertExpectedDatabase,
  assertSafeSeedEnvironment,
  seedSampleCatalog,
  type BrandSeedInput,
  type CategorySeedInput,
  type ProductSeedInput,
  type SampleCatalogRepository,
  type VariantSeedInput,
} from '../src/seed/sample-catalog.service';
import { normalizeCatalogSlug } from '../src/utils/slug';
import {
  normalizeSize,
  normalizeSku,
} from '../src/modules/products/products.service';

class MemorySampleCatalogRepository implements SampleCatalogRepository {
  categories = new Map<string, CategorySeedInput & { id: string }>();
  brands = new Map<string, BrandSeedInput & { id: string }>();
  products = new Map<string, ProductSeedInput & { id: string }>();
  variants = new Map<string, VariantSeedInput & { id: string }>();

  private nextId = 0;

  private generateId(): string {
    this.nextId += 1;
    return `seed-uuid-${this.nextId.toString().padStart(6, '0')}`;
  }

  async upsertCategory(input: CategorySeedInput): Promise<{ id: string }> {
    const existing = this.categories.get(input.slug);
    if (existing) {
      Object.assign(existing, input);
      return { id: existing.id };
    }
    const id = this.generateId();
    this.categories.set(input.slug, { ...input, id });
    return { id };
  }

  async upsertBrand(input: BrandSeedInput): Promise<{ id: string }> {
    const existing = this.brands.get(input.slug);
    if (existing) {
      Object.assign(existing, input);
      return { id: existing.id };
    }
    const id = this.generateId();
    this.brands.set(input.slug, { ...input, id });
    return { id };
  }

  async upsertProduct(input: ProductSeedInput): Promise<{ id: string }> {
    const existing = this.products.get(input.slug);
    if (existing) {
      Object.assign(existing, input);
      return { id: existing.id };
    }
    const id = this.generateId();
    this.products.set(input.slug, { ...input, id });
    return { id };
  }

  async upsertVariant(input: VariantSeedInput): Promise<{ id: string }> {
    const existing = this.variants.get(input.sku);
    if (existing) {
      Object.assign(existing, input);
      return { id: existing.id };
    }
    const id = this.generateId();
    this.variants.set(input.sku, { ...input, id });
    return { id };
  }

  async runInTransaction<T>(
    operation: (repo: SampleCatalogRepository) => Promise<T>,
  ): Promise<T> {
    return operation(this);
  }
}

describe('Sample Catalog Seed Dataset & Constraints', () => {
  it('defines valid categories conforming to schema constraints and canonical slugs', () => {
    expect(SAMPLE_CATEGORIES.length).toBeGreaterThan(0);
    const slugs = new Set<string>();

    for (const category of SAMPLE_CATEGORIES) {
      expect(category.name.trim().length).toBeGreaterThan(0);
      expect(category.name.length).toBeLessThanOrEqual(120);
      expect(category.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(category.slug).toBe(normalizeCatalogSlug(category.slug));
      expect(category.displayOrder).toBeGreaterThanOrEqual(0);
      expect(typeof category.isActive).toBe('boolean');
      expect(slugs.has(category.slug)).toBe(false);
      slugs.add(category.slug);
    }
  });

  it('defines valid brands conforming to schema constraints and canonical slugs', () => {
    expect(SAMPLE_BRANDS.length).toBeGreaterThan(0);
    const slugs = new Set<string>();

    for (const brand of SAMPLE_BRANDS) {
      expect(brand.name.trim().length).toBeGreaterThan(0);
      expect(brand.name.length).toBeLessThanOrEqual(120);
      expect(brand.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(brand.slug).toBe(normalizeCatalogSlug(brand.slug));
      expect(brand.displayOrder).toBeGreaterThanOrEqual(0);
      expect(typeof brand.isActive).toBe('boolean');
      expect(slugs.has(brand.slug)).toBe(false);
      slugs.add(brand.slug);
    }
  });

  it('defines valid products conforming to schema constraints and foreign key references', () => {
    expect(SAMPLE_PRODUCTS.length).toBeGreaterThan(0);
    const categorySlugs = new Set(SAMPLE_CATEGORIES.map((c) => c.slug));
    const brandSlugs = new Set(SAMPLE_BRANDS.map((b) => b.slug));
    const productSlugs = new Set<string>();
    const allSkus = new Set<string>();

    for (const product of SAMPLE_PRODUCTS) {
      expect(product.name.trim().length).toBeGreaterThan(0);
      expect(product.name.length).toBeLessThanOrEqual(180);
      expect(product.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(product.slug).toBe(normalizeCatalogSlug(product.slug));
      expect(productSlugs.has(product.slug)).toBe(false);
      productSlugs.add(product.slug);

      expect(categorySlugs.has(product.categorySlug)).toBe(true);
      expect(brandSlugs.has(product.brandSlug)).toBe(true);

      if (product.discountType === null) {
        expect(product.discountValue).toBeNull();
      } else {
        expect(product.discountValue).not.toBeNull();
        const numVal = Number(product.discountValue);
        expect(numVal).toBeGreaterThanOrEqual(0);
        if (product.discountType === 'PERCENTAGE') {
          expect(numVal).toBeLessThanOrEqual(100);
        }
      }

      expect(product.variants.length).toBeGreaterThan(0);
      const variantMilliliters = new Set<number>();

      for (const variant of product.variants) {
        expect(variant.sku.startsWith('SAMPLE-')).toBe(true);
        expect(variant.sku).toBe(normalizeSku(variant.sku));
        expect(allSkus.has(variant.sku)).toBe(false);
        allSkus.add(variant.sku);

        expect(variant.sizeMilliliters).toBeGreaterThan(0);
        expect(variant.sizeLabel).toBe(`${variant.sizeMilliliters} ml`);
        expect(
          normalizeSize(`${variant.sizeMilliliters} ml`).sizeMilliliters,
        ).toBe(variant.sizeMilliliters);
        expect(variantMilliliters.has(variant.sizeMilliliters)).toBe(false);
        variantMilliliters.add(variant.sizeMilliliters);

        expect(Number(variant.purchasePrice)).toBeGreaterThanOrEqual(0);
        expect(Number(variant.sellingPrice)).toBeGreaterThanOrEqual(0);
        expect(variant.stock).toBeGreaterThanOrEqual(0);
        expect(variant.lowStockThreshold).toBeGreaterThanOrEqual(0);
        expect(typeof variant.isActive).toBe('boolean');
      }
    }
  });
});

describe('Sample Catalog Seeder Execution & Idempotency', () => {
  it('seeds all categories, brands, products, and variants into empty repository', async () => {
    const repo = new MemorySampleCatalogRepository();
    const result = await seedSampleCatalog(repo);

    expect(result.isDryRun).toBe(false);
    expect(result.categoriesUpserted).toBe(SAMPLE_CATEGORIES.length);
    expect(result.brandsUpserted).toBe(SAMPLE_BRANDS.length);
    expect(result.productsUpserted).toBe(SAMPLE_PRODUCTS.length);
    const expectedVariantCount = SAMPLE_PRODUCTS.reduce(
      (sum, p) => sum + p.variants.length,
      0,
    );
    expect(result.variantsUpserted).toBe(expectedVariantCount);

    expect(repo.categories.size).toBe(SAMPLE_CATEGORIES.length);
    expect(repo.brands.size).toBe(SAMPLE_BRANDS.length);
    expect(repo.products.size).toBe(SAMPLE_PRODUCTS.length);
    expect(repo.variants.size).toBe(expectedVariantCount);
  });

  it('is strictly idempotent when executed repeatedly', async () => {
    const repo = new MemorySampleCatalogRepository();

    const firstRun = await seedSampleCatalog(repo);
    const categoriesAfterFirst = repo.categories.size;
    const brandsAfterFirst = repo.brands.size;
    const productsAfterFirst = repo.products.size;
    const variantsAfterFirst = repo.variants.size;

    const secondRun = await seedSampleCatalog(repo);
    expect(secondRun.categoriesUpserted).toBe(firstRun.categoriesUpserted);
    expect(secondRun.brandsUpserted).toBe(firstRun.brandsUpserted);
    expect(secondRun.productsUpserted).toBe(firstRun.productsUpserted);
    expect(secondRun.variantsUpserted).toBe(firstRun.variantsUpserted);

    // Repository sizes must remain exactly unchanged
    expect(repo.categories.size).toBe(categoriesAfterFirst);
    expect(repo.brands.size).toBe(brandsAfterFirst);
    expect(repo.products.size).toBe(productsAfterFirst);
    expect(repo.variants.size).toBe(variantsAfterFirst);

    // Third run to confirm stability
    const thirdRun = await seedSampleCatalog(repo);
    expect(thirdRun.productsUpserted).toBe(firstRun.productsUpserted);
    expect(repo.products.size).toBe(productsAfterFirst);
  });

  it('preserves existing unrelated catalog data without deletion or modification', async () => {
    const repo = new MemorySampleCatalogRepository();

    // Pre-populate with unrelated category and brand
    await repo.upsertCategory({
      name: 'Unrelated Existing Category',
      slug: 'unrelated-existing-category',
      description: 'Preserved item',
      imageUrl: null,
      displayOrder: 99,
      isActive: true,
    });
    await repo.upsertBrand({
      name: 'Unrelated Existing Brand',
      slug: 'unrelated-existing-brand',
      logoUrl: null,
      displayOrder: 99,
      isActive: true,
    });

    await seedSampleCatalog(repo);

    expect(repo.categories.has('unrelated-existing-category')).toBe(true);
    expect(repo.brands.has('unrelated-existing-brand')).toBe(true);
    expect(repo.categories.size).toBe(SAMPLE_CATEGORIES.length + 1);
    expect(repo.brands.size).toBe(SAMPLE_BRANDS.length + 1);
  });

  it('dry-run mode validates and computes statistics without persisting changes', async () => {
    const repo = new MemorySampleCatalogRepository();

    const dryRunResult = await seedSampleCatalog(repo, { dryRun: true });
    expect(dryRunResult.isDryRun).toBe(true);
    expect(dryRunResult.categoriesUpserted).toBe(SAMPLE_CATEGORIES.length);
    expect(dryRunResult.brandsUpserted).toBe(SAMPLE_BRANDS.length);
    expect(dryRunResult.productsUpserted).toBe(SAMPLE_PRODUCTS.length);

    // Memory repository must still be completely empty
    expect(repo.categories.size).toBe(0);
    expect(repo.brands.size).toBe(0);
    expect(repo.products.size).toBe(0);
    expect(repo.variants.size).toBe(0);
  });
});

describe('Safety Guards & Protection', () => {
  it('allows seeding in development and test environments', () => {
    expect(() => assertSafeSeedEnvironment({ nodeEnv: 'test' })).not.toThrow();
    expect(() =>
      assertSafeSeedEnvironment({ nodeEnv: 'development' }),
    ).not.toThrow();
  });

  it('blocks seeding in production unless explicit override is provided', () => {
    expect(() =>
      assertSafeSeedEnvironment({ nodeEnv: 'production' }),
    ).toThrowError(AppError);

    expect(() =>
      assertSafeSeedEnvironment({
        databaseUrl: 'postgresql://user:pass@render.com/production_liquor',
      }),
    ).toThrowError(AppError);

    expect(() =>
      assertSafeSeedEnvironment({
        nodeEnv: 'production',
        allowProductionSeed: 'true',
      }),
    ).not.toThrow();
  });

  it('validates target database name against expected database if configured', () => {
    expect(() =>
      assertExpectedDatabase('liquor_shop', 'liquor_shop'),
    ).not.toThrow();

    expect(() =>
      assertExpectedDatabase('liquor_shop', undefined),
    ).not.toThrow();

    expect(() =>
      assertExpectedDatabase('liquor_shop', 'wrong_db'),
    ).toThrowError(AppError);
  });
});
