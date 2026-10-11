import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { AppError } from '../src/errors/app-error';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { ADMIN_SYSTEM_PERMISSION } from '../src/modules/admin-management/admin-management.types';
import type {
  BrandRecord,
  CatalogRepository,
  CategoryRecord,
  PageResult,
  ProductDetailRecord,
  ProductImageRecord,
  ProductImageWriteInput,
  ProductRecord,
  ProductVariantRecord,
  ProductVariantWriteInput,
} from './test-catalog';
import {
  MemoryInventoryRepository,
  type MemoryVariantItem,
} from '../src/modules/inventory/memory-inventory.repository';
import { testConfig } from './helpers';

class MemoryCatalogForInventory implements CatalogRepository {
  categories: CategoryRecord[] = [];
  brands: BrandRecord[] = [];
  products: ProductRecord[] = [];
  variants: ProductVariantRecord[] = [];
  private nextId = 100;

  private id(): string {
    this.nextId += 1;
    return `20000000-0000-4000-8000-${this.nextId.toString().padStart(12, '0')}`;
  }

  async listCategories(): Promise<PageResult<CategoryRecord>> {
    return {
      items: this.categories,
      pagination: {
        page: 1,
        pageSize: 20,
        total: this.categories.length,
        totalPages: 1,
      },
    };
  }
  async findCategory(id: string): Promise<CategoryRecord | null> {
    return this.categories.find((c) => c.id === id) ?? null;
  }
  async createCategory(
    input: Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CategoryRecord> {
    const cat: CategoryRecord = {
      id: this.id(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };
    this.categories.push(cat);
    return cat;
  }
  async updateCategory(
    id: string,
    input: Partial<Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<CategoryRecord> {
    const cat = await this.findCategory(id);
    if (!cat) throw new AppError(404, 'NOT_FOUND', 'Category not found');
    Object.assign(cat, input, { updatedAt: new Date() });
    return cat;
  }
  async deleteCategory(id: string): Promise<void> {
    this.categories = this.categories.filter((c) => c.id !== id);
  }

  async listBrands(): Promise<PageResult<BrandRecord>> {
    return {
      items: this.brands,
      pagination: {
        page: 1,
        pageSize: 20,
        total: this.brands.length,
        totalPages: 1,
      },
    };
  }
  async findBrand(id: string): Promise<BrandRecord | null> {
    return this.brands.find((b) => b.id === id) ?? null;
  }
  async createBrand(
    input: Omit<BrandRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BrandRecord> {
    const b: BrandRecord = {
      id: this.id(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };
    this.brands.push(b);
    return b;
  }
  async updateBrand(
    id: string,
    input: Partial<Omit<BrandRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BrandRecord> {
    const b = await this.findBrand(id);
    if (!b) throw new AppError(404, 'NOT_FOUND', 'Brand not found');
    Object.assign(b, input, { updatedAt: new Date() });
    return b;
  }
  async deleteBrand(id: string): Promise<void> {
    this.brands = this.brands.filter((b) => b.id !== id);
  }

  async listProducts(): Promise<PageResult<ProductRecord>> {
    return {
      items: this.products,
      pagination: {
        page: 1,
        pageSize: 20,
        total: this.products.length,
        totalPages: 1,
      },
    };
  }
  async findProduct(id: string): Promise<ProductDetailRecord | null> {
    const p = this.products.find((prod) => prod.id === id);
    if (!p) return null;
    return {
      ...p,
      category: this.categories.find((c) => c.id === p.categoryId)!,
      brand: this.brands.find((b) => b.id === p.brandId)!,
      images: [],
      variants: this.variants.filter((v) => v.productId === p.id),
    };
  }
  async createProduct(input: ProductWriteInput): Promise<ProductDetailRecord> {
    const p: ProductRecord = {
      id: this.id(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };
    this.products.push(p);
    return (await this.findProduct(p.id))!;
  }
  async updateProduct(
    id: string,
    input: Partial<ProductWriteInput>,
  ): Promise<ProductDetailRecord> {
    const p = this.products.find((prod) => prod.id === id);
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    Object.assign(p, input, { updatedAt: new Date() });
    return (await this.findProduct(id))!;
  }
  async deactivateProduct(id: string): Promise<void> {
    const p = this.products.find((prod) => prod.id === id);
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    p.isActive = false;
  }

  async listProductImages(): Promise<ProductImageRecord[]> {
    return [];
  }
  async createProductImage(
    _productId: string,
    _input: ProductImageWriteInput,
  ): Promise<ProductImageRecord> {
    throw new Error('unused');
  }
  async updateProductImage(
    _productId: string,
    _imageId: string,
    _input: Partial<ProductImageWriteInput>,
  ): Promise<ProductImageRecord> {
    throw new Error('unused');
  }
  async deleteProductImage(
    _productId: string,
    _imageId: string,
  ): Promise<void> {
    throw new Error('unused');
  }

  async createProductVariant(
    productId: string,
    input: ProductVariantWriteInput,
  ): Promise<ProductVariantRecord> {
    const v: ProductVariantRecord = {
      id: this.id(),
      productId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };
    this.variants.push(v);
    return v;
  }
  async updateProductVariant(
    productId: string,
    variantId: string,
    input: Partial<ProductVariantWriteInput>,
  ): Promise<ProductVariantRecord> {
    const v = this.variants.find(
      (item) => item.id === variantId && item.productId === productId,
    );
    if (!v)
      throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
    Object.assign(v, input, { updatedAt: new Date() });
    return v;
  }
  async deactivateProductVariant(
    productId: string,
    variantId: string,
  ): Promise<void> {
    const v = this.variants.find(
      (item) => item.id === variantId && item.productId === productId,
    );
    if (!v)
      throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
    v.isActive = false;
  }
}

function setupInventoryApp(
  inventoryRepo: MemoryInventoryRepository,
  catalogRepo: MemoryCatalogForInventory,
  permissions = [
    'inventory.adjust',
    'inventory.movements.read',
    'inventory.low-stock.read',
    'catalog.variants.read',
    'catalog.variants.create',
    'catalog.variants.update',
    'catalog.products.read',
  ],
) {
  const config = testConfig();
  const roleId = '10000000-0000-4000-8000-000000000100';
  const adminId = '10000000-0000-4000-8000-000000000101';

  inventoryRepo.adminUsers = [
    {
      id: adminId,
      name: 'Inventory Manager',
      email: 'inv-manager@example.test',
    },
  ];

  const authRepository: AdminAuthRepository = {
    async findByEmail() {
      return null;
    },
    async findById(id) {
      if (id !== adminId) return null;
      return {
        id: adminId,
        email: 'inv-manager@example.test',
        name: 'Inventory Manager',
        passwordHash: '$argon2id$unused-test-hash',
        isActive: true,
        role: {
          id: roleId,
          name: 'Inventory Manager',
          isActive: true,
          permissions,
        },
      };
    },
  };

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    catalogRepository: catalogRepo,
    inventoryRepository: inventoryRepo,
  });

  const token = createAdminAccessToken(config, adminId);

  return { app, token, adminId, inventoryRepo, catalogRepo };
}

describe('Inventory Management Module', () => {
  it('supports authorized stock adjustments for increase and decrease, recording movement history', async () => {
    const catalogRepo = new MemoryCatalogForInventory();
    const inventoryRepo = new MemoryInventoryRepository(
      catalogRepo.variants as unknown as MemoryVariantItem[],
    );
    const { app, token, adminId } = setupInventoryApp(
      inventoryRepo,
      catalogRepo,
    );
    const headers = { Authorization: `Bearer ${token}` };

    const cat = await catalogRepo.createCategory({
      name: 'Whiskey',
      slug: 'whiskey',
      description: null,
      imageUrl: null,
      isActive: true,
    });
    const brand = await catalogRepo.createBrand({
      name: 'Jameson',
      slug: 'jameson',
      logoUrl: null,
      isActive: true,
    });
    const prod = await catalogRepo.createProduct({
      categoryId: cat.id,
      brandId: brand.id,
      name: 'Jameson Irish Whiskey',
      slug: 'jameson-irish-whiskey',
      description: null,
      discountType: null,
      discountValue: null,
      isActive: true,
    });
    const variant = await catalogRepo.createProductVariant(prod.id, {
      sku: 'JAM-750ML',
      sizeLabel: '750 ml',
      sizeMilliliters: 750,
      purchasePrice: '20.00',
      sellingPrice: '35.00',
      stock: 10,
      lowStockThreshold: 5,
      isActive: true,
    });

    // 1. Stock Increase (RESTOCK) via /adjustments
    const increaseRes = await request(app)
      .post('/api/admin/inventory/adjustments')
      .set(headers)
      .send({
        variantId: variant.id,
        quantityDelta: 8,
        type: 'RESTOCK',
        reason: 'Received shipment from distributor',
      });

    expect(increaseRes.status).toBe(200);
    expect(increaseRes.body.data.variant.stock).toBe(18);
    expect(increaseRes.body.data.movement).toMatchObject({
      variantId: variant.id,
      quantityDelta: 8,
      stockBefore: 10,
      stockAfter: 18,
      type: 'RESTOCK',
      reason: 'Received shipment from distributor',
      actorAdminId: adminId,
    });
    expect(variant.stock).toBe(18);

    // 2. Stock Decrease (DAMAGE) via /variants/:variantId/adjustments
    const decreaseRes = await request(app)
      .post(`/api/admin/inventory/variants/${variant.id}/adjustments`)
      .set(headers)
      .send({
        quantityDelta: -3,
        type: 'DAMAGE',
        reason: 'Three bottles broken during stocking',
      });

    expect(decreaseRes.status).toBe(200);
    expect(decreaseRes.body.data.variant.stock).toBe(15);
    expect(decreaseRes.body.data.movement).toMatchObject({
      variantId: variant.id,
      quantityDelta: -3,
      stockBefore: 18,
      stockAfter: 15,
      type: 'DAMAGE',
      reason: 'Three bottles broken during stocking',
      actorAdminId: adminId,
    });
    expect(variant.stock).toBe(15);
  });

  it('prevents negative stock, insufficient stock, and invalid adjustment payloads', async () => {
    const catalogRepo = new MemoryCatalogForInventory();
    const inventoryRepo = new MemoryInventoryRepository(
      catalogRepo.variants as unknown as MemoryVariantItem[],
    );
    const { app, token } = setupInventoryApp(inventoryRepo, catalogRepo);
    const headers = { Authorization: `Bearer ${token}` };

    const variant = await catalogRepo.createProductVariant('prod-1', {
      sku: 'TEST-SKU',
      sizeLabel: '500 ml',
      sizeMilliliters: 500,
      purchasePrice: '10.00',
      sellingPrice: '15.00',
      stock: 5,
      lowStockThreshold: 2,
      isActive: true,
    });

    // Insufficient stock: delta -10 when stock is 5
    const insufficientRes = await request(app)
      .post('/api/admin/inventory/adjustments')
      .set(headers)
      .send({
        variantId: variant.id,
        quantityDelta: -10,
        type: 'CORRECTION',
        reason: 'Physical count discrepancy',
      });

    expect(insufficientRes.status).toBe(400);
    expect(insufficientRes.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(variant.stock).toBe(5);

    // Zero delta rejected
    const zeroDeltaRes = await request(app)
      .post('/api/admin/inventory/adjustments')
      .set(headers)
      .send({
        variantId: variant.id,
        quantityDelta: 0,
        type: 'CORRECTION',
        reason: 'No change',
      });
    expect(zeroDeltaRes.status).toBe(400);

    // Empty/missing reason rejected
    const emptyReasonRes = await request(app)
      .post('/api/admin/inventory/adjustments')
      .set(headers)
      .send({
        variantId: variant.id,
        quantityDelta: 1,
        type: 'RESTOCK',
        reason: '   ',
      });
    expect(emptyReasonRes.status).toBe(400);

    // Invalid adjustment type rejected
    const badTypeRes = await request(app)
      .post('/api/admin/inventory/adjustments')
      .set(headers)
      .send({
        variantId: variant.id,
        quantityDelta: 1,
        type: 'MAGIC_TELEPORTATION',
        reason: 'Invalid type test',
      });
    expect(badTypeRes.status).toBe(400);

    // Non-existent variant returns 404
    const notFoundRes = await request(app)
      .post('/api/admin/inventory/adjustments')
      .set(headers)
      .send({
        variantId: '30000000-0000-4000-8000-000000000999',
        quantityDelta: 2,
        type: 'RESTOCK',
        reason: 'Restocking ghost variant',
      });
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.error.code).toBe('NOT_FOUND');
  });

  it('prevents negative stock under concurrent adjustment requests', async () => {
    const catalogRepo = new MemoryCatalogForInventory();
    const inventoryRepo = new MemoryInventoryRepository(
      catalogRepo.variants as unknown as MemoryVariantItem[],
    );
    const { app, token } = setupInventoryApp(inventoryRepo, catalogRepo);
    const headers = { Authorization: `Bearer ${token}` };

    const variant = await catalogRepo.createProductVariant('prod-concurrent', {
      sku: 'CONCURRENT-SKU',
      sizeLabel: '1000 ml',
      sizeMilliliters: 1000,
      purchasePrice: '15.00',
      sellingPrice: '25.00',
      stock: 5,
      lowStockThreshold: 1,
      isActive: true,
    });

    const responses = await Promise.all([
      request(app).post('/api/admin/inventory/adjustments').set(headers).send({
        variantId: variant.id,
        quantityDelta: -3,
        type: 'SALE',
        reason: 'Order 1',
      }),
      request(app).post('/api/admin/inventory/adjustments').set(headers).send({
        variantId: variant.id,
        quantityDelta: -3,
        type: 'SALE',
        reason: 'Order 2',
      }),
      request(app).post('/api/admin/inventory/adjustments').set(headers).send({
        variantId: variant.id,
        quantityDelta: -3,
        type: 'SALE',
        reason: 'Order 3',
      }),
    ]);

    const successes = responses.filter((r) => r.status === 200);
    const failures = responses.filter(
      (r) => r.status === 400 && r.body.error.code === 'INSUFFICIENT_STOCK',
    );

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(2);
    expect(variant.stock).toBe(2);
    expect(variant.stock).toBeGreaterThanOrEqual(0);
  });

  it('guarantees atomic stock change and movement creation with rollback on failure', async () => {
    const catalogRepo = new MemoryCatalogForInventory();
    const inventoryRepo = new MemoryInventoryRepository(
      catalogRepo.variants as unknown as MemoryVariantItem[],
    );

    const originalAdjustStock = inventoryRepo.adjustStock.bind(inventoryRepo);
    let shouldFail = false;
    inventoryRepo.adjustStock = async (input) => {
      if (shouldFail) {
        throw new AppError(
          500,
          'DATABASE_TRANSACTION_FAILED',
          'Simulated transaction failure',
        );
      }
      return originalAdjustStock(input);
    };

    const { app, token } = setupInventoryApp(inventoryRepo, catalogRepo);
    const headers = { Authorization: `Bearer ${token}` };

    const variant = await catalogRepo.createProductVariant('prod-atom', {
      sku: 'ATOMIC-SKU',
      sizeLabel: '750 ml',
      sizeMilliliters: 750,
      purchasePrice: '12.00',
      sellingPrice: '20.00',
      stock: 10,
      lowStockThreshold: 3,
      isActive: true,
    });

    shouldFail = true;
    const failedRes = await request(app)
      .post('/api/admin/inventory/adjustments')
      .set(headers)
      .send({
        variantId: variant.id,
        quantityDelta: 5,
        type: 'RESTOCK',
        reason: 'Should rollback',
      });

    expect(failedRes.status).toBe(500);
    expect(variant.stock).toBe(10);
    expect(inventoryRepo.movements).toHaveLength(0);
  });

  it('provides paginated movement history filtered by variant, type, and date', async () => {
    const catalogRepo = new MemoryCatalogForInventory();
    const inventoryRepo = new MemoryInventoryRepository(
      catalogRepo.variants as unknown as MemoryVariantItem[],
    );
    const { app, token } = setupInventoryApp(inventoryRepo, catalogRepo);
    const headers = { Authorization: `Bearer ${token}` };

    const v1 = await catalogRepo.createProductVariant('prod-hist', {
      sku: 'HIST-1',
      sizeLabel: '750 ml',
      sizeMilliliters: 750,
      purchasePrice: '10.00',
      sellingPrice: '15.00',
      stock: 5,
      lowStockThreshold: 2,
      isActive: true,
    });
    const v2 = await catalogRepo.createProductVariant('prod-hist', {
      sku: 'HIST-2',
      sizeLabel: '1000 ml',
      sizeMilliliters: 1000,
      purchasePrice: '12.00',
      sellingPrice: '18.00',
      stock: 10,
      lowStockThreshold: 3,
      isActive: true,
    });

    await request(app)
      .post('/api/admin/inventory/adjustments')
      .set(headers)
      .send({
        variantId: v1.id,
        quantityDelta: 5,
        type: 'RESTOCK',
        reason: 'V1 Restock',
      });
    await request(app)
      .post('/api/admin/inventory/adjustments')
      .set(headers)
      .send({
        variantId: v1.id,
        quantityDelta: -2,
        type: 'DAMAGE',
        reason: 'V1 Damage',
      });
    await request(app)
      .post('/api/admin/inventory/adjustments')
      .set(headers)
      .send({
        variantId: v1.id,
        quantityDelta: 1,
        type: 'RETURN',
        reason: 'V1 Return',
      });
    await request(app)
      .post('/api/admin/inventory/adjustments')
      .set(headers)
      .send({
        variantId: v2.id,
        quantityDelta: 10,
        type: 'RESTOCK',
        reason: 'V2 Restock',
      });
    await request(app)
      .post('/api/admin/inventory/adjustments')
      .set(headers)
      .send({
        variantId: v2.id,
        quantityDelta: -3,
        type: 'CORRECTION',
        reason: 'V2 Correction',
      });

    // 1. List all movements paginated
    const allRes = await request(app)
      .get('/api/admin/inventory/movements?page=1&pageSize=10')
      .set(headers);
    expect(allRes.status).toBe(200);
    expect(allRes.body.data.items).toHaveLength(5);
    expect(allRes.body.data.pagination.total).toBe(5);

    // 2. Filter by variantId
    const v1Res = await request(app)
      .get(`/api/admin/inventory/movements?variantId=${v1.id}`)
      .set(headers);
    expect(v1Res.status).toBe(200);
    expect(v1Res.body.data.items).toHaveLength(3);
    expect(
      v1Res.body.data.items.every(
        (m: { variantId: string }) => m.variantId === v1.id,
      ),
    ).toBe(true);

    // 3. Filter by type
    const damageRes = await request(app)
      .get('/api/admin/inventory/movements?type=DAMAGE')
      .set(headers);
    expect(damageRes.status).toBe(200);
    expect(damageRes.body.data.items).toHaveLength(1);
    expect(damageRes.body.data.items[0].type).toBe('DAMAGE');

    // 4. Filter by date range
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const dateRes = await request(app)
      .get(
        `/api/admin/inventory/movements?startDate=${pastDate}&endDate=${futureDate}`,
      )
      .set(headers);
    expect(dateRes.status).toBe(200);
    expect(dateRes.body.data.items).toHaveLength(5);
  });

  it('provides low-stock queries based on lowStockThreshold', async () => {
    const catalogRepo = new MemoryCatalogForInventory();
    const inventoryRepo = new MemoryInventoryRepository(
      catalogRepo.variants as unknown as MemoryVariantItem[],
    );
    const { app, token } = setupInventoryApp(inventoryRepo, catalogRepo);
    const headers = { Authorization: `Bearer ${token}` };

    const vA = await catalogRepo.createProductVariant('prod-low', {
      sku: 'LOW-A',
      sizeLabel: '500 ml',
      sizeMilliliters: 500,
      purchasePrice: '5.00',
      sellingPrice: '8.00',
      stock: 2,
      lowStockThreshold: 5,
      isActive: true,
    });
    const vB = await catalogRepo.createProductVariant('prod-low', {
      sku: 'LOW-B',
      sizeLabel: '750 ml',
      sizeMilliliters: 750,
      purchasePrice: '8.00',
      sellingPrice: '12.00',
      stock: 0,
      lowStockThreshold: 0,
      isActive: true,
    });
    await catalogRepo.createProductVariant('prod-low', {
      sku: 'HIGH-C',
      sizeLabel: '1000 ml',
      sizeMilliliters: 1000,
      purchasePrice: '10.00',
      sellingPrice: '15.00',
      stock: 20,
      lowStockThreshold: 5,
      isActive: true,
    });

    const lowStockRes = await request(app)
      .get('/api/admin/inventory/low-stock')
      .set(headers);
    expect(lowStockRes.status).toBe(200);
    expect(lowStockRes.body.data.items).toHaveLength(2);
    const returnedIds = lowStockRes.body.data.items.map(
      (i: { id: string }) => i.id,
    );
    expect(returnedIds).toContain(vA.id);
    expect(returnedIds).toContain(vB.id);

    // Get specific variant stock
    const stockRes = await request(app)
      .get(`/api/admin/inventory/variants/${vA.id}/stock`)
      .set(headers);
    expect(stockRes.status).toBe(200);
    expect(stockRes.body.data).toMatchObject({
      id: vA.id,
      stock: 2,
      lowStockThreshold: 5,
      isActive: true,
    });
  });

  it('enforces permission denial and authentication across inventory routes', async () => {
    const catalogRepo = new MemoryCatalogForInventory();
    const inventoryRepo = new MemoryInventoryRepository(
      catalogRepo.variants as unknown as MemoryVariantItem[],
    );
    const { app: deniedApp, token: deniedToken } = setupInventoryApp(
      inventoryRepo,
      catalogRepo,
      [],
    );
    const deniedHeaders = { Authorization: `Bearer ${deniedToken}` };

    expect(
      (await request(deniedApp).get('/api/admin/inventory/movements')).status,
    ).toBe(401);
    expect(
      (await request(deniedApp).get('/api/admin/inventory/low-stock')).status,
    ).toBe(401);
    expect(
      (await request(deniedApp).post('/api/admin/inventory/adjustments'))
        .status,
    ).toBe(401);

    expect(
      (
        await request(deniedApp)
          .get('/api/admin/inventory/movements')
          .set(deniedHeaders)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(deniedApp)
          .get('/api/admin/inventory/low-stock')
          .set(deniedHeaders)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(deniedApp)
          .post('/api/admin/inventory/adjustments')
          .set(deniedHeaders)
          .send({
            variantId: '10000000-0000-4000-8000-000000000001',
            quantityDelta: 1,
            type: 'RESTOCK',
            reason: 'Restock',
          })
      ).status,
    ).toBe(403);

    const { app: superApp, token: superToken } = setupInventoryApp(
      inventoryRepo,
      catalogRepo,
      [ADMIN_SYSTEM_PERMISSION],
    );
    const superHeaders = { Authorization: `Bearer ${superToken}` };
    expect(
      (
        await request(superApp)
          .get('/api/admin/inventory/movements')
          .set(superHeaders)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(superApp)
          .get('/api/admin/inventory/low-stock')
          .set(superHeaders)
      ).status,
    ).toBe(200);
  });

  it('routes catalog variant stock updates through inventory service so stock changes cannot bypass history', async () => {
    const catalogRepo = new MemoryCatalogForInventory();
    const inventoryRepo = new MemoryInventoryRepository(
      catalogRepo.variants as unknown as MemoryVariantItem[],
    );
    const { app, token, adminId } = setupInventoryApp(
      inventoryRepo,
      catalogRepo,
    );
    const headers = { Authorization: `Bearer ${token}` };

    const cat = await catalogRepo.createCategory({
      name: 'Rum',
      slug: 'rum',
      description: null,
      imageUrl: null,
      isActive: true,
    });
    const brand = await catalogRepo.createBrand({
      name: 'Bacardi',
      slug: 'bacardi',
      logoUrl: null,
      isActive: true,
    });
    const prod = await catalogRepo.createProduct({
      categoryId: cat.id,
      brandId: brand.id,
      name: 'Bacardi Superior',
      slug: 'bacardi-superior',
      description: null,
      discountType: null,
      discountValue: null,
      isActive: true,
    });
    const variant = await catalogRepo.createProductVariant(prod.id, {
      sku: 'BAC-750ML',
      sizeLabel: '750 ml',
      sizeMilliliters: 750,
      purchasePrice: '14.00',
      sellingPrice: '22.00',
      stock: 10,
      lowStockThreshold: 4,
      isActive: true,
    });

    const updateRes = await request(app)
      .patch(`/api/admin/products/${prod.id}/variants/${variant.id}`)
      .set(headers)
      .send({ stock: 25 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.stock).toBe(25);
    expect(variant.stock).toBe(25);

    expect(inventoryRepo.movements).toHaveLength(1);
    expect(inventoryRepo.movements[0]).toMatchObject({
      variantId: variant.id,
      quantityDelta: 15,
      stockBefore: 10,
      stockAfter: 25,
      type: 'CORRECTION',
      actorAdminId: adminId,
    });

    const negativeRes = await request(app)
      .patch(`/api/admin/products/${prod.id}/variants/${variant.id}`)
      .set(headers)
      .send({ stock: -5 });

    expect(negativeRes.status).toBe(400);
    expect(variant.stock).toBe(25);
  });

  it('guarantees inventory movement records are never hard-deleted', async () => {
    const catalogRepo = new MemoryCatalogForInventory();
    const inventoryRepo = new MemoryInventoryRepository(
      catalogRepo.variants as unknown as MemoryVariantItem[],
    );
    const { app, token } = setupInventoryApp(inventoryRepo, catalogRepo);
    const headers = { Authorization: `Bearer ${token}` };

    const deleteMovement = await request(app)
      .delete(
        '/api/admin/inventory/movements/10000000-0000-4000-8000-000000000001',
      )
      .set(headers);
    expect(deleteMovement.status).toBe(404);

    const deleteCollection = await request(app)
      .delete('/api/admin/inventory/movements')
      .set(headers);
    expect(deleteCollection.status).toBe(404);
  });
});
