import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20261009000000_initial_liquor_shop/migration.sql',
);
const migrationSql = readFileSync(migrationPath, 'utf8');

describe('initial liquor-shop migration', () => {
  it('declares PostgreSQL as the migration provider', () => {
    const migrationLock = readFileSync(
      resolve(process.cwd(), 'prisma/migrations/migration_lock.toml'),
      'utf8',
    );
    expect(migrationLock).toContain('provider = "postgresql"');
  });

  it('creates the ten reviewed models', () => {
    for (const model of [
      'AdminUser',
      'Role',
      'Permission',
      'RolePermission',
      'Category',
      'Brand',
      'Product',
      'ProductImage',
      'ProductVariant',
      'Customer',
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE "${model}"`);
    }
  });

  it('enforces money, stock, discount, and nonblank variant checks', () => {
    for (const constraint of [
      'ProductVariant_purchasePrice_nonnegative_check',
      'ProductVariant_sellingPrice_nonnegative_check',
      'ProductVariant_stock_nonnegative_check',
      'ProductVariant_lowStockThreshold_nonnegative_check',
      'Product_discount_fields_consistent_check',
      'Product_discount_value_nonnegative_check',
      'Product_percentage_discount_max_check',
      'ProductVariant_sku_normalized_check',
      'ProductVariant_sizeMilliliters_positive_check',
      'ProductVariant_sizeLabel_canonical_check',
      'Customer_deliveryAddress_nonblank_check',
    ]) {
      expect(migrationSql).toContain(`CONSTRAINT "${constraint}" CHECK`);
    }
  });

  it('uses canonical storage with unique keys for case-insensitive identity', () => {
    for (const constraint of [
      'AdminUser_email_normalized_check',
      'Category_slug_canonical_check',
      'Brand_slug_canonical_check',
      'Product_slug_canonical_check',
    ]) {
      expect(migrationSql).toContain(`CONSTRAINT "${constraint}" CHECK`);
    }
    expect(migrationSql).toContain('ProductVariant_sku_normalized_check');
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "ProductVariant_productId_sizeMilliliters_key"',
    );
    expect(migrationSql).toContain('"email" = lower(btrim("email"))');
    expect(migrationSql).toContain('"sku" = upper(btrim("sku"))');
    expect(migrationSql).toContain('"slug" = lower(btrim("slug"))');
    expect(migrationSql).toContain(
      '"sizeLabel" = "sizeMilliliters"::text || \' ml\'',
    );
  });

  it('keeps discounts paired, non-negative, and within the percentage range', () => {
    expect(migrationSql).toContain(
      '"discountValue" IS NULL OR "discountValue" >= 0',
    );
    expect(migrationSql).toContain('"discountValue" <= 100');
    expect(migrationSql).toContain(
      '"discountType" IS NULL AND "discountValue" IS NULL',
    );
    expect(migrationSql).not.toContain('CREATE TABLE "Coupon"');
  });

  it('uses restrictive catalog references and cascading owned rows', () => {
    expect(migrationSql).toContain(
      '"Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT',
    );
    expect(migrationSql).toContain(
      '"Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT',
    );
    expect(migrationSql).toContain(
      '"ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT',
    );
    expect(migrationSql).toContain(
      '"ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE',
    );
  });

  it('requires guest delivery address while keeping email optional', () => {
    const customerTable = migrationSql.match(
      /CREATE TABLE "Customer" \(([\s\S]*?)\);/,
    );
    expect(customerTable?.[1]).toContain(
      '"deliveryAddress" VARCHAR(500) NOT NULL',
    );
    expect(customerTable?.[1]).toContain('"email" VARCHAR(254)');
    expect(customerTable?.[1]).not.toContain('"email" VARCHAR(254) NOT NULL');
  });

  it('does not encode implicit activation or low-stock policy defaults', () => {
    expect(migrationSql).not.toMatch(/"isActive" BOOLEAN NOT NULL DEFAULT/);
    expect(migrationSql).not.toMatch(
      /"lowStockThreshold" INTEGER NOT NULL DEFAULT/,
    );
  });

  it('contains no destructive or seed-data statements', () => {
    expect(migrationSql).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE|INSERT)\b/im);
  });

  it('does not add customer authentication fields', () => {
    const customerTable = migrationSql.match(
      /CREATE TABLE "Customer" \(([\s\S]*?)\);/,
    );
    expect(customerTable?.[1]).toBeDefined();
    expect(customerTable?.[1]).not.toMatch(/password|jwt|session/i);
    expect(migrationSql).not.toMatch(/countryOfOrigin|alcoholPercentage/i);
  });
});
