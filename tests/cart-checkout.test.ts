import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@prisma/client';
import { createApp } from '../src/app';
import { MemoryCartRepository } from '../src/modules/cart/memory-cart.repository';
import type {
  BrandRecord,
  CatalogRepository,
  CategoryRecord,
  PageResult,
  ProductImageRecord,
  ProductRecord,
  ProductVariantRecord,
} from '../src/modules/catalog/catalog.types';
import { MemoryCheckoutRepository } from '../src/modules/checkout/memory-checkout.repository';
import type { InventoryMovementRecord } from '../src/modules/inventory/inventory.types';
import type { MemoryVariantItem } from '../src/modules/inventory/memory-inventory.repository';
import { testConfig } from './helpers';

class TestCatalogRepository implements CatalogRepository {
  categories: CategoryRecord[] = [];
  brands: BrandRecord[] = [];
  products: ProductRecord[] = [];

  constructor(
    categories: CategoryRecord[] = [],
    brands: BrandRecord[] = [],
    products: ProductRecord[] = [],
  ) {
    this.categories = categories;
    this.brands = brands;
    this.products = products;
  }

  async listCategories(): Promise<PageResult<CategoryRecord>> {
    return {
      items: this.categories,
      pagination: {
        page: 1,
        pageSize: 50,
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
    const c: CategoryRecord = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.categories.push(c);
    return c;
  }
  async updateCategory(): Promise<CategoryRecord> {
    throw new Error('Not implemented');
  }
  async deleteCategory(): Promise<void> {
    throw new Error('Not implemented');
  }

  async listBrands(): Promise<PageResult<BrandRecord>> {
    return {
      items: this.brands,
      pagination: {
        page: 1,
        pageSize: 50,
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
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.brands.push(b);
    return b;
  }
  async updateBrand(): Promise<BrandRecord> {
    throw new Error('Not implemented');
  }
  async deleteBrand(): Promise<void> {
    throw new Error('Not implemented');
  }

  async listProducts(input: {
    page: number;
    pageSize: number;
  }): Promise<PageResult<ProductRecord>> {
    const start = (input.page - 1) * input.pageSize;
    const items = this.products.slice(start, start + input.pageSize);
    return {
      items,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total: this.products.length,
        totalPages: Math.ceil(this.products.length / input.pageSize) || 1,
      },
    };
  }
  async findProduct(id: string): Promise<ProductRecord | null> {
    return this.products.find((p) => p.id === id) ?? null;
  }
  async createProduct(): Promise<ProductRecord> {
    throw new Error('Not implemented');
  }
  async updateProduct(): Promise<ProductRecord> {
    throw new Error('Not implemented');
  }
  async deactivateProduct(): Promise<void> {
    throw new Error('Not implemented');
  }
  async createProductImage(): Promise<ProductImageRecord> {
    throw new Error('Not implemented');
  }
  async updateProductImage(): Promise<ProductImageRecord> {
    throw new Error('Not implemented');
  }
  async deleteProductImage(): Promise<void> {
    throw new Error('Not implemented');
  }
  async createProductVariant(): Promise<ProductVariantRecord> {
    throw new Error('Not implemented');
  }
  async updateProductVariant(): Promise<ProductVariantRecord> {
    throw new Error('Not implemented');
  }
  async deactivateProductVariant(): Promise<void> {
    throw new Error('Not implemented');
  }
}

interface TestSetup {
  app: ReturnType<typeof createApp>;
  catalogRepo: TestCatalogRepository;
  cartRepo: MemoryCartRepository;
  checkoutRepo: MemoryCheckoutRepository;
  variantA: MemoryVariantItem;
  variantB: MemoryVariantItem;
  productA: ProductRecord;
  productB: ProductRecord;
  movements: InventoryMovementRecord[];
}

function setupTestFixture(
  overrides: {
    variantAStock?: number;
    variantBStock?: number;
    productADiscount?: {
      type: 'PERCENTAGE' | 'FIXED';
      value: string;
    };
  } = {},
): TestSetup {
  const categoryId = '10000000-0000-4000-8000-000000000001';
  const brandId = '10000000-0000-4000-8000-000000000002';
  const productAId = '10000000-0000-4000-8000-000000000003';
  const productBId = '10000000-0000-4000-8000-000000000004';
  const variantAId = '20000000-0000-4000-8000-000000000001';
  const variantBId = '20000000-0000-4000-8000-000000000002';

  const category: CategoryRecord = {
    id: categoryId,
    name: 'Whiskey',
    slug: 'whiskey',
    description: null,
    imageUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const brand: BrandRecord = {
    id: brandId,
    name: 'Old Durbar',
    slug: 'old-durbar',
    logoUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const variantA: MemoryVariantItem = {
    id: variantAId,
    productId: productAId,
    sku: 'OD-750',
    sizeLabel: '750 ml',
    sizeMilliliters: 750,
    purchasePrice: '2000.00',
    sellingPrice: '2500.00',
    stock: overrides.variantAStock ?? 20,
    lowStockThreshold: 5,
    isActive: true,
    product: {
      id: productAId,
      name: 'Old Durbar Black Chimney',
      slug: 'old-durbar-black-chimney',
      isActive: true,
    },
  };

  const variantB: MemoryVariantItem = {
    id: variantBId,
    productId: productBId,
    sku: 'OD-1000',
    sizeLabel: '1000 ml',
    sizeMilliliters: 1000,
    purchasePrice: '3000.00',
    sellingPrice: '3800.00',
    stock: overrides.variantBStock ?? 10,
    lowStockThreshold: 3,
    isActive: true,
    product: {
      id: productBId,
      name: 'Old Durbar Reserve',
      slug: 'old-durbar-reserve',
      isActive: true,
    },
  };

  const productA: ProductRecord = {
    id: productAId,
    categoryId,
    brandId,
    name: 'Old Durbar Black Chimney',
    slug: 'old-durbar-black-chimney',
    description: 'Blended peated whisky',
    discountType: overrides.productADiscount?.type ?? 'PERCENTAGE',
    discountValue: overrides.productADiscount?.value ?? '10', // 10% discount: 2500 -> 2250
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      isActive: true,
    },
    brand: {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      isActive: true,
    },
    images: [],
    variants: [variantA as unknown as ProductVariantRecord],
  };

  const productB: ProductRecord = {
    id: productBId,
    categoryId,
    brandId,
    name: 'Old Durbar Reserve',
    slug: 'old-durbar-reserve',
    description: 'Reserve blend',
    discountType: null,
    discountValue: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      isActive: true,
    },
    brand: {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      isActive: true,
    },
    images: [],
    variants: [variantB as unknown as ProductVariantRecord],
  };

  const variants = [variantA, variantB];
  const movements: InventoryMovementRecord[] = [];
  const catalogRepo = new TestCatalogRepository(
    [category],
    [brand],
    [productA, productB],
  );
  const cartRepo = new MemoryCartRepository();
  const checkoutRepo = new MemoryCheckoutRepository(
    variants,
    movements,
    cartRepo,
  );

  const app = createApp(testConfig(), async () => {}, {
    catalogRepository: catalogRepo,
    cartRepository: cartRepo,
    checkoutRepository: checkoutRepo,
  });

  return {
    app,
    catalogRepo,
    cartRepo,
    checkoutRepo,
    variantA,
    variantB,
    productA,
    productB,
    movements,
  };
}

describe('Guest Cart & Checkout Security & Consistency', () => {
  describe('Cart CRUD & Calculations', () => {
    it('creates an empty cart with X-Cart-Id header on GET /api/cart', async () => {
      const fixture = setupTestFixture();

      const res = await request(fixture.app).get('/api/cart').expect(200);

      expect(res.headers['x-cart-id']).toBeDefined();
      expect(res.body.success).toBe(true);
      expect(res.body.data.itemCount).toBe(0);
      expect(res.body.data.subtotal).toBe('0.00');
      expect(res.body.data.items).toEqual([]);
    });

    it('adds an item, recalculates server-side prices and discounts', async () => {
      const fixture = setupTestFixture();

      const res = await request(fixture.app)
        .post('/api/cart/items')
        .send({
          variantId: fixture.variantA.id,
          quantity: 2,
        })
        .expect(200);

      const cartId = res.headers['x-cart-id'];
      expect(cartId).toBeDefined();
      expect(res.body.data.itemCount).toBe(2);

      const item = res.body.data.items[0];
      expect(item.variantId).toBe(fixture.variantA.id);
      expect(item.quantity).toBe(2);
      expect(item.unitPrice).toBe('2500.00');
      // 10% discount on 2500 = 2250.00
      expect(item.discountedUnitPrice).toBe('2250.00');
      // subtotal for 2 items = 2 * 2250 = 4500.00
      expect(item.subtotal).toBe('4500.00');
      expect(res.body.data.subtotal).toBe('5000.00'); // unitPrice * 2
      expect(res.body.data.discountTotal).toBe('500.00'); // 250 * 2
      expect(res.body.data.total).toBe('4500.00');
    });

    it('increments quantity when adding the same item again', async () => {
      const fixture = setupTestFixture();

      const res1 = await request(fixture.app)
        .post('/api/cart/items')
        .send({ variantId: fixture.variantA.id, quantity: 1 })
        .expect(200);

      const cartId = res1.headers['x-cart-id'];

      const res2 = await request(fixture.app)
        .post('/api/cart/items')
        .set('X-Cart-Id', cartId)
        .send({ variantId: fixture.variantA.id, quantity: 2 })
        .expect(200);

      expect(res2.body.data.itemCount).toBe(3);
      expect(res2.body.data.items[0].quantity).toBe(3);
      expect(res2.body.data.total).toBe('6750.00'); // 3 * 2250
    });

    it('updates item quantity via PATCH /api/cart/items/:variantId', async () => {
      const fixture = setupTestFixture();

      const res1 = await request(fixture.app)
        .post('/api/cart/items')
        .send({ variantId: fixture.variantA.id, quantity: 2 })
        .expect(200);

      const cartId = res1.headers['x-cart-id'];

      const res2 = await request(fixture.app)
        .patch(`/api/cart/items/${fixture.variantA.id}`)
        .set('X-Cart-Id', cartId)
        .send({ quantity: 5 })
        .expect(200);

      expect(res2.body.data.itemCount).toBe(5);
      expect(res2.body.data.items[0].quantity).toBe(5);
    });

    it('removes item via DELETE /api/cart/items/:variantId', async () => {
      const fixture = setupTestFixture();

      const res1 = await request(fixture.app)
        .post('/api/cart/items')
        .send({ variantId: fixture.variantA.id, quantity: 1 })
        .expect(200);

      const cartId = res1.headers['x-cart-id'];

      const res2 = await request(fixture.app)
        .delete(`/api/cart/items/${fixture.variantA.id}`)
        .set('X-Cart-Id', cartId)
        .expect(200);

      expect(res2.body.data.itemCount).toBe(0);
      expect(res2.body.data.items.length).toBe(0);
    });

    it('clears cart via DELETE /api/cart', async () => {
      const fixture = setupTestFixture();

      const res1 = await request(fixture.app)
        .post('/api/cart/items')
        .send({ variantId: fixture.variantA.id, quantity: 1 })
        .expect(200);

      const cartId = res1.headers['x-cart-id'];

      await request(fixture.app)
        .post('/api/cart/items')
        .set('X-Cart-Id', cartId)
        .send({ variantId: fixture.variantB.id, quantity: 1 })
        .expect(200);

      const res3 = await request(fixture.app)
        .delete('/api/cart')
        .set('X-Cart-Id', cartId)
        .expect(200);

      expect(res3.body.data.itemCount).toBe(0);
      expect(res3.body.data.items).toEqual([]);
    });

    it('requires a valid cart token for cart mutations', async () => {
      const fixture = setupTestFixture();

      // Mutation without X-Cart-Id header
      const resPatch = await request(fixture.app)
        .patch(`/api/cart/items/${fixture.variantA.id}`)
        .send({ quantity: 3 })
        .expect(400);

      expect(resPatch.body.error.code).toBe('CART_TOKEN_REQUIRED');

      const resDelete = await request(fixture.app)
        .delete(`/api/cart/items/${fixture.variantA.id}`)
        .expect(400);

      expect(resDelete.body.error.code).toBe('CART_TOKEN_REQUIRED');

      const resClear = await request(fixture.app)
        .delete('/api/cart')
        .expect(400);

      expect(resClear.body.error.code).toBe('CART_TOKEN_REQUIRED');
    });

    it('rejects adding inactive variant or product with 400', async () => {
      const fixture = setupTestFixture();
      fixture.variantA.isActive = false;

      const res = await request(fixture.app)
        .post('/api/cart/items')
        .send({ variantId: fixture.variantA.id, quantity: 1 })
        .expect(400);

      expect(res.body.error.code).toBe('INACTIVE_PRODUCT');
    });

    it('flags variant as unavailable in cart if it becomes inactive later', async () => {
      const fixture = setupTestFixture();

      const res1 = await request(fixture.app)
        .post('/api/cart/items')
        .send({ variantId: fixture.variantA.id, quantity: 1 })
        .expect(200);

      const cartId = res1.headers['x-cart-id'];

      // Deactivate variant in catalog
      fixture.variantA.isActive = false;

      const res2 = await request(fixture.app)
        .get('/api/cart')
        .set('X-Cart-Id', cartId)
        .expect(200);

      expect(res2.body.data.hasUnavailableItems).toBe(true);
      expect(res2.body.data.items[0].isAvailable).toBe(false);
      expect(res2.body.data.items[0].statusMessage).toContain(
        'no longer active',
      );
    });

    it('rejects adding more than available stock', async () => {
      const fixture = setupTestFixture({ variantAStock: 3 });

      const res = await request(fixture.app)
        .post('/api/cart/items')
        .send({ variantId: fixture.variantA.id, quantity: 5 })
        .expect(400);

      expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    });

    it('rejects invalid quantities (negative or > 100)', async () => {
      const fixture = setupTestFixture();

      await request(fixture.app)
        .post('/api/cart/items')
        .send({ variantId: fixture.variantA.id, quantity: 0 })
        .expect(400);

      await request(fixture.app)
        .post('/api/cart/items')
        .send({ variantId: fixture.variantA.id, quantity: 101 })
        .expect(400);
    });
  });

  describe('Guest Checkout Foundation', () => {
    const validCustomer = {
      name: 'Ram Bahadur',
      phone: '+977-9841234567',
      deliveryAddress: 'House 12, Thamel, Kathmandu, Ward 26',
      email: 'ram@example.com',
      coordinates: { latitude: 27.7172, longitude: 85.324 },
    };

    it('successfully checks out via cart with atomic stock deduction and SALE movement', async () => {
      const fixture = setupTestFixture({ variantAStock: 10 });

      // 1. Add item to cart
      const cartRes = await request(fixture.app)
        .post('/api/cart/items')
        .send({ variantId: fixture.variantA.id, quantity: 2 })
        .expect(200);

      const cartId = cartRes.headers['x-cart-id'];

      // 2. Perform checkout
      const checkoutRes = await request(fixture.app)
        .post('/api/checkout')
        .set('X-Cart-Id', cartId)
        .send({ customer: validCustomer })
        .expect(201);

      expect(checkoutRes.body.success).toBe(true);
      const order = checkoutRes.body.data;
      expect(order.orderNumber).toMatch(/^ORD-\d{8}-[A-F0-9]{6}$/);
      expect(order.orderLookupToken).toBeDefined();
      expect(typeof order.orderLookupToken).toBe('string');
      expect(order.orderLookupToken.length).toBeGreaterThan(20);
      expect(order.customerName).toBe(validCustomer.name);
      expect(order.deliveryAddress).toBe(validCustomer.deliveryAddress);
      expect(order.deliveryFee).toBe('0.00');
      expect(order.items.length).toBe(1);
      expect(order.items[0].variantId).toBe(fixture.variantA.id);
      expect(order.items[0].quantity).toBe(2);
      expect(order.items[0].unitPrice).toBe('2500.00');
      expect(order.items[0].effectiveUnitPrice).toBe('2250.00');
      expect(order.items[0].subtotal).toBe('4500.00');
      expect(order.total).toBe('4500.00');

      // 3. Verify variant stock deducted: 10 - 2 = 8
      expect(fixture.variantA.stock).toBe(8);

      // 4. Verify InventoryMovement created
      expect(fixture.movements.length).toBe(1);
      const m = fixture.movements[0];
      expect(m.variantId).toBe(fixture.variantA.id);
      expect(m.quantityDelta).toBe(-2);
      expect(m.stockBefore).toBe(10);
      expect(m.stockAfter).toBe(8);
      expect(m.type).toBe('SALE');
      expect(m.actorAdminId).toBeNull();
      expect(m.reason).toContain(order.orderNumber);

      // 5. Verify cart cleared
      const emptyCartRes = await request(fixture.app)
        .get('/api/cart')
        .set('X-Cart-Id', cartId)
        .expect(200);
      expect(emptyCartRes.body.data.itemCount).toBe(0);
    });

    it('successfully checks out with direct items array', async () => {
      const fixture = setupTestFixture({ variantAStock: 15, variantBStock: 5 });

      const res = await request(fixture.app)
        .post('/api/checkout')
        .send({
          customer: validCustomer,
          items: [
            { variantId: fixture.variantA.id, quantity: 1 },
            { variantId: fixture.variantB.id, quantity: 2 },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const order = res.body.data;
      expect(order.items.length).toBe(2);
      expect(order.orderLookupToken).toBeDefined();

      // Variant A: 2500 - 10% = 2250
      // Variant B: 3800 * 2 = 7600
      // Total: 2250 + 7600 = 9850.00
      expect(order.total).toBe('9850.00');
      expect(fixture.variantA.stock).toBe(14);
      expect(fixture.variantB.stock).toBe(3);
      expect(fixture.movements.length).toBe(2);
    });

    it('enforces order lookup privacy: rejects unauthenticated or invalid token requests with 404', async () => {
      const fixture = setupTestFixture();

      const checkoutRes = await request(fixture.app)
        .post('/api/checkout')
        .send({
          customer: validCustomer,
          items: [{ variantId: fixture.variantA.id, quantity: 1 }],
        })
        .expect(201);

      const orderNumber = checkoutRes.body.data.orderNumber;
      const orderLookupToken = checkoutRes.body.data.orderLookupToken;
      expect(orderLookupToken).toBeDefined();

      // 1. Missing lookup token returns 404 (protecting order number existence)
      await request(fixture.app).get(`/api/orders/${orderNumber}`).expect(404);

      await request(fixture.app)
        .get(`/api/checkout/orders/${orderNumber}`)
        .expect(404);

      // 2. Invalid/tampered lookup token returns 404
      await request(fixture.app)
        .get(`/api/orders/${orderNumber}?token=invalid-token-12345`)
        .expect(404);

      // 3. Valid token via query param (?token=) returns 200 with masked PII
      const resQuery = await request(fixture.app)
        .get(`/api/orders/${orderNumber}?token=${orderLookupToken}`)
        .expect(200);

      const publicOrder = resQuery.body.data;
      expect(publicOrder.orderNumber).toBe(orderNumber);
      expect(publicOrder.status).toBe('PENDING');
      expect(publicOrder.customer.name).toBe(validCustomer.name);
      // Masked phone
      expect(publicOrder.customer.maskedPhone).toBe('***-***-4567');
      // Masked email
      expect(publicOrder.customer.maskedEmail).toBe('r***m@example.com');
      // Masked delivery address
      expect(publicOrder.customer.maskedDeliveryAddress).toContain(
        'Thamel, Kathmandu',
      );
      // Items have safe presentation fields without internal database IDs
      expect(publicOrder.items.length).toBe(1);
      expect(publicOrder.items[0].productName).toBe('Old Durbar Black Chimney');
      expect(publicOrder.items[0].sku).toBe('OD-750');
      expect(publicOrder.items[0].effectiveUnitPrice).toBe('2250.00');
      expect(publicOrder.items[0].id).toBeUndefined();
      expect(publicOrder.items[0].variantId).toBeUndefined();
      expect(publicOrder.items[0].orderId).toBeUndefined();

      // Pricing reconciliation
      expect(publicOrder.pricing.subtotal).toBe('2500.00');
      expect(publicOrder.pricing.discountTotal).toBe('250.00');
      expect(publicOrder.pricing.deliveryFee).toBe('0.00');
      expect(publicOrder.pricing.total).toBe('2250.00');

      // 4. Valid token via header (X-Order-Token) also succeeds
      const resHeader = await request(fixture.app)
        .get(`/api/orders/${orderNumber}`)
        .set('X-Order-Token', orderLookupToken)
        .expect(200);

      expect(resHeader.body.data.orderNumber).toBe(orderNumber);
    });

    it('validates customer details strictly (rejecting invalid phone or address)', async () => {
      const fixture = setupTestFixture();

      // Invalid phone
      await request(fixture.app)
        .post('/api/checkout')
        .send({
          customer: {
            ...validCustomer,
            phone: 'not-a-phone',
          },
          items: [{ variantId: fixture.variantA.id, quantity: 1 }],
        })
        .expect(400);

      // Empty delivery address
      await request(fixture.app)
        .post('/api/checkout')
        .send({
          customer: {
            ...validCustomer,
            deliveryAddress: '   ',
          },
          items: [{ variantId: fixture.variantA.id, quantity: 1 }],
        })
        .expect(400);
    });

    it('enforces idempotency on duplicate checkout submissions with the same payload', async () => {
      const fixture = setupTestFixture({ variantAStock: 10 });
      const idempotencyKey = 'checkout-idemp-key-12345';

      // First submission
      const res1 = await request(fixture.app)
        .post('/api/checkout')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          customer: validCustomer,
          items: [{ variantId: fixture.variantA.id, quantity: 2 }],
        })
        .expect(201);

      const order1 = res1.body.data;
      expect(order1.idempotencyKey).toBe(idempotencyKey);
      expect(fixture.variantA.stock).toBe(8);
      expect(fixture.movements.length).toBe(1);

      // Re-submit with same idempotency key and same payload
      const res2 = await request(fixture.app)
        .post('/api/checkout')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          customer: validCustomer,
          items: [{ variantId: fixture.variantA.id, quantity: 2 }],
        })
        .expect(201);

      const order2 = res2.body.data;
      expect(order2.orderNumber).toBe(order1.orderNumber);
      expect(order2.id).toBe(order1.id);

      // Stock NOT deducted a second time
      expect(fixture.variantA.stock).toBe(8);
      // No duplicate movement created
      expect(fixture.movements.length).toBe(1);
    });

    it('rejects reusing the same idempotency key with a DIFFERENT payload with 409 conflict', async () => {
      const fixture = setupTestFixture({ variantAStock: 10 });
      const idempotencyKey = 'checkout-conflict-key-999';

      // 1. First submission with quantity 2
      await request(fixture.app)
        .post('/api/checkout')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          customer: validCustomer,
          items: [{ variantId: fixture.variantA.id, quantity: 2 }],
        })
        .expect(201);

      expect(fixture.variantA.stock).toBe(8);

      // 2. Second submission with SAME idempotency key but DIFFERENT payload (quantity 3)
      const resConflict = await request(fixture.app)
        .post('/api/checkout')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          customer: validCustomer,
          items: [{ variantId: fixture.variantA.id, quantity: 3 }],
        })
        .expect(409);

      expect(resConflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
      // Stock remains 8, no extra deduction
      expect(fixture.variantA.stock).toBe(8);
      expect(fixture.movements.length).toBe(1);
    });

    it('handles concurrent identical checkout requests safely', async () => {
      const fixture = setupTestFixture({ variantAStock: 10 });
      const idempotencyKey = 'concurrent-identical-key-777';

      const checkoutPromise1 = request(fixture.app)
        .post('/api/checkout')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          customer: validCustomer,
          items: [{ variantId: fixture.variantA.id, quantity: 2 }],
        });

      const checkoutPromise2 = request(fixture.app)
        .post('/api/checkout')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          customer: validCustomer,
          items: [{ variantId: fixture.variantA.id, quantity: 2 }],
        });

      const [res1, res2] = await Promise.all([
        checkoutPromise1,
        checkoutPromise2,
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.data.orderNumber).toBe(res2.body.data.orderNumber);

      // Stock deducted only once: 10 - 2 = 8
      expect(fixture.variantA.stock).toBe(8);
      expect(fixture.movements.length).toBe(1);
    });

    it('rolls back atomically if any item has insufficient stock', async () => {
      const fixture = setupTestFixture({
        variantAStock: 10,
        variantBStock: 1, // Only 1 in stock
      });

      // Request 2 of Variant A and 3 of Variant B (Variant B has only 1)
      const res = await request(fixture.app)
        .post('/api/checkout')
        .send({
          customer: validCustomer,
          items: [
            { variantId: fixture.variantA.id, quantity: 2 },
            { variantId: fixture.variantB.id, quantity: 3 },
          ],
        })
        .expect(400);

      expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');

      // Variant A stock must NOT be altered (atomic rollback)
      expect(fixture.variantA.stock).toBe(10);
      expect(fixture.variantB.stock).toBe(1);
      // No movement or order created
      expect(fixture.movements.length).toBe(0);
      expect(fixture.checkoutRepo.orders.length).toBe(0);
    });

    it('rejects checkout when a variant becomes inactive', async () => {
      const fixture = setupTestFixture({ variantAStock: 10 });
      fixture.variantA.isActive = false;

      const res = await request(fixture.app)
        .post('/api/checkout')
        .send({
          customer: validCustomer,
          items: [{ variantId: fixture.variantA.id, quantity: 1 }],
        })
        .expect(400);

      expect(res.body.error.code).toBe('INACTIVE_VARIANT');
      expect(fixture.variantA.stock).toBe(10);
      expect(fixture.movements.length).toBe(0);
    });

    it('prevents overselling under concurrent checkouts competing for stock (Unit Test Fixture)', async () => {
      // Stock is 5. Two concurrent checkouts both request 3.
      // One must succeed (stock becomes 2), other must fail with INSUFFICIENT_STOCK.
      // Note: This unit test verifies application-level transactional validation.
      const fixture = setupTestFixture({ variantAStock: 5 });

      const checkoutPromise1 = request(fixture.app)
        .post('/api/checkout')
        .send({
          customer: { ...validCustomer, name: 'Customer One' },
          items: [{ variantId: fixture.variantA.id, quantity: 3 }],
        });

      const checkoutPromise2 = request(fixture.app)
        .post('/api/checkout')
        .send({
          customer: { ...validCustomer, name: 'Customer Two' },
          items: [{ variantId: fixture.variantA.id, quantity: 3 }],
        });

      const [res1, res2] = await Promise.all([
        checkoutPromise1,
        checkoutPromise2,
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      const failedRes = res1.status === 400 ? res1 : res2;
      expect(failedRes.body.error.code).toBe('INSUFFICIENT_STOCK');

      // Remaining stock must be 2, never negative
      expect(fixture.variantA.stock).toBe(2);
      expect(fixture.movements.length).toBe(1);
    });

    it('verifies OrderStatus enum values and exact total decimal reconciliation', async () => {
      // Verify OrderStatus enum contains all agreed status values
      expect(OrderStatus.PENDING).toBe('PENDING');
      expect(OrderStatus.CONFIRMED).toBe('CONFIRMED');
      expect(OrderStatus.PROCESSING).toBe('PROCESSING');
      expect(OrderStatus.OUT_FOR_DELIVERY).toBe('OUT_FOR_DELIVERY');
      expect(OrderStatus.DELIVERED).toBe('DELIVERED');
      expect(OrderStatus.CANCELLED).toBe('CANCELLED');
      expect(OrderStatus.RETURNED).toBe('RETURNED');

      const fixture = setupTestFixture({ variantAStock: 10, variantBStock: 5 });

      const res = await request(fixture.app)
        .post('/api/checkout')
        .send({
          customer: validCustomer,
          items: [
            { variantId: fixture.variantA.id, quantity: 2 },
            { variantId: fixture.variantB.id, quantity: 1 },
          ],
        })
        .expect(201);

      const order = res.body.data;
      // Variant A: sellingPrice 2500, 10% discount => effective 2250, qty 2 => subtotal 4500
      // Variant B: sellingPrice 3800, no discount => effective 3800, qty 1 => subtotal 3800
      // Gross subtotal = 2500 * 2 + 3800 = 8800.00
      // Discount total = 250 * 2 = 500.00
      // Delivery fee = 0.00
      // Net Total = 8800.00 - 500.00 + 0.00 = 8300.00
      expect(order.subtotal).toBe('8800.00');
      expect(order.discountTotal).toBe('500.00');
      expect(order.deliveryFee).toBe('0.00');
      expect(order.total).toBe('8300.00');

      // Verify item subtotals sum up to net total
      const itemSubtotalsSum = order.items.reduce(
        (sum: number, item: { subtotal: string }) =>
          sum + Number(item.subtotal),
        0,
      );
      expect(itemSubtotalsSum).toBe(8300);
      expect(Number(order.total)).toBe(itemSubtotalsSum);
    });
  });
});
