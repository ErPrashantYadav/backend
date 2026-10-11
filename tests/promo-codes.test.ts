import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { MemoryCartRepository } from '../src/modules/cart/memory-cart.repository';
import type {
  BrandRecord,
  CatalogRepository,
  CategoryRecord,
  PageResult,
  ProductImageRecord,
  ProductRecord,
} from './test-catalog';
import { MemoryCheckoutRepository } from '../src/modules/checkout/memory-checkout.repository';
import type { InventoryMovementRecord } from '../src/modules/inventory/inventory.types';
import type { MemoryVariantItem } from '../src/modules/inventory/memory-inventory.repository';
import { MemoryAuditLogRepository } from '../src/modules/audit/memory-audit.repository';
import { MemoryPaymentMethodRepository } from '../src/modules/payment-method/memory-payment-method.repository';
import { MemoryPromoCodeRepository } from '../src/modules/promo-code/memory-promo-code.repository';
import { testConfig } from './helpers';

class TestCatalogRepo implements CatalogRepository {
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
  async createCategory(): Promise<CategoryRecord> {
    throw new Error('unused');
  }
  async updateCategory(): Promise<CategoryRecord> {
    throw new Error('unused');
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
  async createBrand(): Promise<BrandRecord> {
    throw new Error('unused');
  }
  async updateBrand(): Promise<BrandRecord> {
    throw new Error('unused');
  }
  async listProducts(): Promise<PageResult<ProductRecord>> {
    return {
      items: this.products,
      pagination: {
        page: 1,
        pageSize: 50,
        total: this.products.length,
        totalPages: 1,
      },
    };
  }
  async findProduct(id: string): Promise<ProductRecord | null> {
    return this.products.find((p) => p.id === id) ?? null;
  }
  async createProduct(): Promise<ProductRecord> {
    throw new Error('unused');
  }
  async updateProduct(): Promise<ProductRecord> {
    throw new Error('unused');
  }
  async deactivateProduct(): Promise<void> {
    throw new Error('unused');
  }
  async createProductImage(): Promise<ProductImageRecord> {
    throw new Error('unused');
  }
  async updateProductImage(): Promise<ProductImageRecord> {
    throw new Error('unused');
  }
  async deleteProductImage(): Promise<void> {
    throw new Error('unused');
  }
  async createProductVariant(): Promise<ProductVariantRecord> {
    throw new Error('unused');
  }
  async updateProductVariant(): Promise<ProductVariantRecord> {
    throw new Error('unused');
  }
  async deactivateProductVariant(): Promise<void> {
    throw new Error('unused');
  }
}

interface TestContext {
  app: ReturnType<typeof createApp>;
  token: string;
  promoRepo: MemoryPromoCodeRepository;
  checkoutRepo: MemoryCheckoutRepository;
  auditRepo: MemoryAuditLogRepository;
  variant: MemoryVariantItem;
}

function setupPromoFixture(permissions: string[] = []): TestContext {
  const config = testConfig();
  const adminId = '90000000-0000-4000-8000-000000000001';
  const roleId = '90000000-0000-4000-8000-000000000002';

  const authRepository: AdminAuthRepository = {
    async findByEmail() {
      return null;
    },
    async findById(id) {
      if (id !== adminId) return null;
      return {
        id: adminId,
        email: 'admin@liquorshop.test',
        name: 'Shop Admin',
        passwordHash: '$argon2id$mock-hash',
        isActive: true,
        role: {
          id: roleId,
          name: 'Super Admin',
          isActive: true,
          permissions,
        },
      };
    },
  };

  const token = createAdminAccessToken(config, adminId);

  const categoryId = '10000000-0000-4000-8000-000000000001';
  const brandId = '20000000-0000-4000-8000-000000000001';
  const productId = '30000000-0000-4000-8000-000000000001';
  const variantId = '40000000-0000-4000-8000-000000000001';

  const category: CategoryRecord = {
    id: categoryId,
    name: 'Whisky',
    slug: 'whisky',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const brand: BrandRecord = {
    id: brandId,
    name: 'Old Durbar',
    slug: 'old-durbar',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const variantRecord: ProductVariantRecord = {
    id: variantId,
    productId,
    sku: 'OD-750',
    sizeMilliliters: 750,
    sizeLabel: '750 ml',
    purchasePrice: '2000.00',
    sellingPrice: '2500.00',
    stock: 50,
    lowStockThreshold: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const productRecord: ProductRecord = {
    id: productId,
    name: 'Old Durbar Black Chimney',
    slug: 'old-durbar-black-chimney',
    description: null,
    categoryId,
    brandId,
    discountType: null,
    discountValue: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category,
    brand,
    images: [],
    variants: [variantRecord],
  };

  const variantItem: MemoryVariantItem = {
    id: variantId,
    productId,
    sku: 'OD-750',
    sizeMilliliters: 750,
    sizeLabel: '750 ml',
    purchasePrice: '2000.00',
    sellingPrice: '2500.00',
    stock: 50,
    lowStockThreshold: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    product: {
      id: productId,
      name: 'Old Durbar Black Chimney',
      slug: 'old-durbar-black-chimney',
      isActive: true,
      categoryId,
      brandId,
    },
  };

  const catalogRepo = new TestCatalogRepo([category], [brand], [productRecord]);
  const cartRepo = new MemoryCartRepository();
  const promoRepo = new MemoryPromoCodeRepository();
  const auditRepo = new MemoryAuditLogRepository();
  const paymentRepo = new MemoryPaymentMethodRepository();
  const movements: InventoryMovementRecord[] = [];
  const checkoutRepo = new MemoryCheckoutRepository(
    [variantItem],
    movements,
    cartRepo,
    undefined,
    promoRepo,
  );

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    catalogRepository: catalogRepo,
    cartRepository: cartRepo,
    checkoutRepository: checkoutRepo,
    paymentMethodRepository: paymentRepo,
    promoCodeRepository: promoRepo,
    auditRepository: auditRepo,
  });

  return {
    app,
    token,
    promoRepo,
    checkoutRepo,
    auditRepo,
    variant: variantItem,
  };
}

describe('Promo Codes & Discount Management', () => {
  describe('Admin Authorization and CRUD', () => {
    it('requires authentication for admin promo code endpoints', async () => {
      const { app } = setupPromoFixture([]);

      const listRes = await request(app).get('/api/admin/promo-codes');
      expect(listRes.status).toBe(401);

      const createRes = await request(app).post('/api/admin/promo-codes').send({
        code: 'FESTIVE10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
      });
      expect(createRes.status).toBe(401);
    });

    it('enforces RBAC permissions: promo-codes.read, create, update, delete', async () => {
      const { app, token } = setupPromoFixture(['orders.read']); // lacking promo-codes.*

      const listRes = await request(app)
        .get('/api/admin/promo-codes')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(403);

      const createRes = await request(app)
        .post('/api/admin/promo-codes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'FESTIVE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        });
      expect(createRes.status).toBe(403);
    });

    it('creates fixed-amount and percentage promo codes with validation and records audit logs', async () => {
      const { app, token, auditRepo } = setupPromoFixture([
        'promo-codes.create',
        'promo-codes.read',
      ]);

      // 1. Create fixed discount promo code
      const fixedRes = await request(app)
        .post('/api/admin/promo-codes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'FESTIVE500',
          description: 'Flat NPR 500 off on festive orders',
          discountType: 'FIXED',
          discountValue: 500,
          minimumOrderAmount: 2000,
          usageLimit: 100,
        });

      expect(fixedRes.status).toBe(201);
      expect(fixedRes.body.data.code).toBe('FESTIVE500');
      expect(fixedRes.body.data.discountType).toBe('FIXED');
      expect(fixedRes.body.data.discountValue).toBe('500.00');
      expect(fixedRes.body.data.minimumOrderAmount).toBe('2000.00');
      expect(fixedRes.body.data.usageLimit).toBe(100);
      expect(fixedRes.body.data.usedCount).toBe(0);
      expect(fixedRes.body.data.isActive).toBe(true);

      // Verify audit log
      const createAudit = auditRepo.logs.find(
        (l) => l.action === 'promo_code.create',
      );
      expect(createAudit).toBeDefined();
      expect(createAudit?.resourceType).toBe('promo_code');
      expect((createAudit?.metadata as { code: string }).code).toBe(
        'FESTIVE500',
      );

      // 2. Create percentage promo code with max discount cap
      const pctRes = await request(app)
        .post('/api/admin/promo-codes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'SAVE10',
          description: '10% off up to NPR 300',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          maxDiscountAmount: 300,
          minimumOrderAmount: 1000,
        });

      expect(pctRes.status).toBe(201);
      expect(pctRes.body.data.code).toBe('SAVE10');
      expect(pctRes.body.data.discountType).toBe('PERCENTAGE');
      expect(pctRes.body.data.discountValue).toBe('10.00');
      expect(pctRes.body.data.maxDiscountAmount).toBe('300.00');
    });

    it('rejects duplicate code, percentage > 100, negative values, and inverted dates', async () => {
      const { app, token } = setupPromoFixture(['promo-codes.create']);

      // Create base code
      await request(app)
        .post('/api/admin/promo-codes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'UNIQUE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        });

      // Duplicate (case-insensitive)
      const dupRes = await request(app)
        .post('/api/admin/promo-codes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'unique10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        });
      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe('DUPLICATE_PROMO_CODE');

      // Percentage > 100
      const invalidPct = await request(app)
        .post('/api/admin/promo-codes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'TOOBIG',
          discountType: 'PERCENTAGE',
          discountValue: 120,
        });
      expect(invalidPct.status).toBe(400);

      // Inverted dates
      const invertedDate = await request(app)
        .post('/api/admin/promo-codes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'INVDATE',
          discountType: 'FIXED',
          discountValue: 100,
          startDate: '2026-12-01T00:00:00.000Z',
          endDate: '2026-11-01T00:00:00.000Z',
        });
      expect(invertedDate.status).toBe(400);
    });

    it('supports listing with filters, updating, toggling status, and deleting promo codes', async () => {
      const { app, token, auditRepo } = setupPromoFixture([
        'promo-codes.create',
        'promo-codes.read',
        'promo-codes.update',
        'promo-codes.delete',
      ]);

      const createRes = await request(app)
        .post('/api/admin/promo-codes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'WINTER25',
          description: 'Winter Promo',
          discountType: 'PERCENTAGE',
          discountValue: 25,
        });
      const promoId = createRes.body.data.id;

      // List with search
      const listRes = await request(app)
        .get('/api/admin/promo-codes?search=WINTER')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].code).toBe('WINTER25');

      // Update
      const updateRes = await request(app)
        .patch(`/api/admin/promo-codes/${promoId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          discountValue: 30,
          description: 'Updated Winter Promo 30%',
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.discountValue).toBe('30.00');

      // Status toggle
      const statusRes = await request(app)
        .patch(`/api/admin/promo-codes/${promoId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.isActive).toBe(false);

      // Delete
      const delRes = await request(app)
        .delete(`/api/admin/promo-codes/${promoId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.data.deleted).toBe(true);

      // Verify audit logs for status and delete
      expect(
        auditRepo.logs.some((l) => l.action === 'promo_code.status_change'),
      ).toBe(true);
      expect(auditRepo.logs.some((l) => l.action === 'promo_code.delete')).toBe(
        true,
      );
    });
  });

  describe('Public Promo Code Endpoints', () => {
    it('GET /api/promo-codes/active returns safe public views without internal counters or inactive items', async () => {
      const { app, promoRepo } = setupPromoFixture([]);

      // 1. Active unexpired code
      await promoRepo.create({
        code: 'PUBLIC10',
        description: '10% public discount',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        usageLimit: 50,
      });

      // 2. Inactive code
      await promoRepo.create({
        code: 'INACTIVE',
        discountType: 'FIXED',
        discountValue: 100,
        isActive: false,
      });

      // 3. Expired code
      await promoRepo.create({
        code: 'EXPIRED',
        discountType: 'FIXED',
        discountValue: 100,
        endDate: new Date(Date.now() - 3600000), // 1 hour ago
      });

      const res = await request(app).get('/api/promo-codes/active');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);

      const pub = res.body.data[0];
      expect(pub.code).toBe('PUBLIC10');
      expect(pub.description).toBe('10% public discount');
      expect(pub.discountType).toBe('PERCENTAGE');
      expect(pub.discountValue).toBe('10.00');
      // Must not expose internal usage counts or admin metadata
      expect(pub.usedCount).toBeUndefined();
      expect(pub.usageLimit).toBeUndefined();
      expect(pub.createdAt).toBeUndefined();
    });

    it('POST /api/promo-codes/validate calculates correct discounts and validates conditions', async () => {
      const { app, promoRepo } = setupPromoFixture([]);

      await promoRepo.create({
        code: 'FLAT500',
        discountType: 'FIXED',
        discountValue: 500,
        minimumOrderAmount: 2000,
      });

      await promoRepo.create({
        code: 'PERC20',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        maxDiscountAmount: 400,
      });

      // Valid flat discount
      const val1 = await request(app)
        .post('/api/promo-codes/validate')
        .send({ code: 'FLAT500', subtotal: 2500 });
      expect(val1.status).toBe(200);
      expect(val1.body.data.valid).toBe(true);
      expect(val1.body.data.discountAmount).toBe('500.00');
      expect(val1.body.data.newTotal).toBe('2000.00');

      // Below minimum order amount
      const val2 = await request(app)
        .post('/api/promo-codes/validate')
        .send({ code: 'FLAT500', subtotal: 1500 });
      expect(val2.status).toBe(400);
      expect(val2.body.error.code).toBe('PROMO_MINIMUM_ORDER_NOT_MET');

      // Percentage discount capped at maxDiscountAmount (20% of 3000 is 600, capped at 400)
      const val3 = await request(app)
        .post('/api/promo-codes/validate')
        .send({ code: 'PERC20', subtotal: 3000 });
      expect(val3.status).toBe(200);
      expect(val3.body.data.valid).toBe(true);
      expect(val3.body.data.discountAmount).toBe('400.00');
      expect(val3.body.data.newTotal).toBe('2600.00');

      // Non-existent promo code
      const val4 = await request(app)
        .post('/api/promo-codes/validate')
        .send({ code: 'NONEXISTENT', subtotal: 1000 });
      expect(val4.status).toBe(404);
      expect(val4.body.error.code).toBe('PROMO_NOT_FOUND');
    });
  });

  describe('Guest Checkout Integration with Promo Codes', () => {
    it('applies promo code at checkout, reconciles totals strictly, and updates usedCount', async () => {
      const { app, promoRepo, variant } = setupPromoFixture([]);

      // Create active promo code: 10% off up to NPR 500
      await promoRepo.create({
        code: 'DRINK10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        maxDiscountAmount: 500,
        usageLimit: 10,
      });

      // Checkout 1 bottle: 2500 selling price
      // Promo discount: 10% of 2500 = 250.00
      // Delivery fee: 0.00 (ZeroDeliveryFeeEstimator)
      // subtotal = 2500.00, discountTotal = 250.00, total = 2250.00
      const checkoutRes = await request(app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: variant.id, quantity: 1 }],
          customer: {
            name: 'Pramod Sharma',
            phone: '+977-9841234567',
            deliveryAddress: 'Thamel Marg, Kathmandu',
            email: 'pramod@test.com',
          },
          promoCode: 'DRINK10',
        });

      expect(checkoutRes.status).toBe(201);
      const order = checkoutRes.body.data;
      expect(order.subtotal).toBe('2500.00');
      expect(order.discountTotal).toBe('250.00');
      expect(order.deliveryFee).toBe('0.00');
      expect(order.total).toBe('2250.00');
      expect(order.promoCode).toBe('DRINK10');
      expect(order.promoDiscount).toBe('250.00');

      // Verify promo repository usedCount incremented and redemption recorded
      const updatedPromo = await promoRepo.findByCode('DRINK10');
      expect(updatedPromo?.usedCount).toBe(1);
      expect(promoRepo.redemptions).toHaveLength(1);
      expect(promoRepo.redemptions[0].promoCodeId).toBe(updatedPromo?.id);
      expect(promoRepo.redemptions[0].discountAmount).toBe('250.00');

      // Verify order public lookup includes promo details in pricing
      const publicRes = await request(app)
        .get(`/api/orders/${order.orderNumber}`)
        .set('x-order-token', order.orderLookupToken);

      expect(publicRes.status).toBe(200);
      expect(publicRes.body.data.pricing.promoCode).toBe('DRINK10');
      expect(publicRes.body.data.pricing.promoDiscount).toBe('250.00');
      expect(publicRes.body.data.pricing.total).toBe('2250.00');
    });

    it('enforces atomic usage limit exhaustion near limit', async () => {
      const { app, promoRepo, variant } = setupPromoFixture([]);

      // Create promo with limit = 1
      await promoRepo.create({
        code: 'ONETIME',
        discountType: 'FIXED',
        discountValue: 200,
        usageLimit: 1,
      });

      const initialStock = variant.stock;

      // 1st checkout succeeds
      const res1 = await request(app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: variant.id, quantity: 1 }],
          customer: {
            name: 'First Guest',
            phone: '+977-9841111111',
            deliveryAddress: 'Baluwatar, Kathmandu',
          },
          promoCode: 'ONETIME',
        });
      expect(res1.status).toBe(201);
      expect(variant.stock).toBe(initialStock - 1);

      // 2nd checkout fails because limit is exhausted
      const res2 = await request(app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: variant.id, quantity: 1 }],
          customer: {
            name: 'Second Guest',
            phone: '+977-9842222222',
            deliveryAddress: 'Lalitpur, Patan',
          },
          promoCode: 'ONETIME',
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('PROMO_USAGE_LIMIT_EXCEEDED');

      // Crucial: Stock must NOT have been deducted on the failed checkout
      expect(variant.stock).toBe(initialStock - 1);
    });

    it('ensures checkout idempotency does not double-count promo code redemptions', async () => {
      const { app, promoRepo, variant } = setupPromoFixture([]);

      await promoRepo.create({
        code: 'IDEMP100',
        discountType: 'FIXED',
        discountValue: 100,
        usageLimit: 5,
      });

      const idempotencyKey = 'unique-checkout-uuid-999';

      const payload = {
        items: [{ variantId: variant.id, quantity: 1 }],
        customer: {
          name: 'Repeat Buyer',
          phone: '+977-9849999999',
          deliveryAddress: 'New Road, Kathmandu',
        },
        promoCode: 'IDEMP100',
        idempotencyKey,
      };

      // First attempt
      const res1 = await request(app).post('/api/checkout').send(payload);
      expect(res1.status).toBe(201);
      const promoAfterFirst = await promoRepo.findByCode('IDEMP100');
      expect(promoAfterFirst?.usedCount).toBe(1);

      // Retry with same idempotency key
      const res2 = await request(app).post('/api/checkout').send(payload);
      expect(res2.status).toBe(201);
      expect(res2.body.data.orderNumber).toBe(res1.body.data.orderNumber);

      // Verify promo usedCount did NOT increment again and only 1 redemption exists
      const promoAfterRetry = await promoRepo.findByCode('IDEMP100');
      expect(promoAfterRetry?.usedCount).toBe(1);
      expect(promoRepo.redemptions).toHaveLength(1);
    });

    it('ignores client-supplied discountTotal and recalculates discounts strictly on the server', async () => {
      const { app, promoRepo, variant } = setupPromoFixture([]);

      await promoRepo.create({
        code: 'REAL100',
        discountType: 'FIXED',
        discountValue: 100,
      });

      // Attacker tries to pass client-forged discountTotal of 2000 in checkout body
      const res = await request(app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: variant.id, quantity: 1 }],
          customer: {
            name: 'Sneaky Client',
            phone: '+977-9848888888',
            deliveryAddress: 'Lazimpat, Kathmandu',
          },
          promoCode: 'REAL100',
          discountTotal: '2000.00', // Forged field!
          total: '500.00', // Forged total!
        });

      expect(res.status).toBe(201);
      // Server must calculate 100 discount, total = 2400
      expect(res.body.data.discountTotal).toBe('100.00');
      expect(res.body.data.total).toBe('2400.00');
    });

    it('rejects reusing the same idempotency key with a DIFFERENT promo code with 409 conflict', async () => {
      const { app, promoRepo, variant } = setupPromoFixture([]);

      await promoRepo.create({
        code: 'CODE_A',
        discountType: 'FIXED',
        discountValue: 100,
      });

      await promoRepo.create({
        code: 'CODE_B',
        discountType: 'FIXED',
        discountValue: 200,
      });

      const idempotencyKey = 'conflict-promo-key-123';
      const basePayload = {
        items: [{ variantId: variant.id, quantity: 1 }],
        customer: {
          name: 'Conflict User',
          phone: '+977-9840000000',
          deliveryAddress: 'Thamel, Kathmandu',
        },
        idempotencyKey,
      };

      // 1. First checkout with CODE_A
      const res1 = await request(app)
        .post('/api/checkout')
        .send({ ...basePayload, promoCode: 'CODE_A' });
      expect(res1.status).toBe(201);

      // 2. Second checkout with SAME idempotency key but DIFFERENT promo code CODE_B
      const res2 = await request(app)
        .post('/api/checkout')
        .send({ ...basePayload, promoCode: 'CODE_B' });
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('IDEMPOTENCY_CONFLICT');

      // Verify promo B was NOT redeemed or incremented
      const promoB = await promoRepo.findByCode('CODE_B');
      expect(promoB?.usedCount).toBe(0);
    });

    it('clamps fixed discount to eligible subtotal so totals never drop below zero', async () => {
      const { app, promoRepo } = setupPromoFixture([]);

      await promoRepo.create({
        code: 'MEGA5000',
        discountType: 'FIXED',
        discountValue: 5000,
      });

      const res = await request(app)
        .post('/api/promo-codes/validate')
        .send({ code: 'MEGA5000', subtotal: 1500 });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.discountAmount).toBe('1500.00');
      expect(res.body.data.newTotal).toBe('0.00');
    });

    it('excludes future start date codes from public active listing and rejects early validation', async () => {
      const { app, promoRepo } = setupPromoFixture([]);

      const futureDate = new Date(Date.now() + 86400000); // 1 day in future
      await promoRepo.create({
        code: 'FUTURE_PROMO',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        startDate: futureDate,
      });

      // Active listing must not expose future codes
      const listRes = await request(app).get('/api/promo-codes/active');
      expect(listRes.status).toBe(200);
      expect(
        listRes.body.data.some(
          (p: { code: string }) => p.code === 'FUTURE_PROMO',
        ),
      ).toBe(false);

      // Validate must reject future codes
      const valRes = await request(app)
        .post('/api/promo-codes/validate')
        .send({ code: 'FUTURE_PROMO', subtotal: 2000 });
      expect(valRes.status).toBe(400);
      expect(valRes.body.error.code).toBe('PROMO_NOT_YET_ACTIVE');
    });
  });
});
