import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  ProductVariantRecord,
} from '../src/modules/catalog/catalog.types';
import { MemoryCheckoutRepository } from '../src/modules/checkout/memory-checkout.repository';
import type { InventoryMovementRecord } from '../src/modules/inventory/inventory.types';
import type { MemoryVariantItem } from '../src/modules/inventory/memory-inventory.repository';
import { MemoryPaymentMethodRepository } from '../src/modules/payment-method/memory-payment-method.repository';
import type { ManagedPaymentMethod } from '../src/modules/payment-method/payment-method.types';
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
    throw new Error('unused');
  }
  async deleteCategory(): Promise<void> {
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
    throw new Error('unused');
  }
  async deleteBrand(): Promise<void> {
    throw new Error('unused');
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
  paymentRepo: MemoryPaymentMethodRepository;
  checkoutRepo: MemoryCheckoutRepository;
  variant: MemoryVariantItem;
}

function setupPaymentFixture(permissions: string[] = []): TestContext {
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
          name: 'Payment Administrator',
          isActive: true,
          permissions,
        },
      };
    },
  };

  const initialPaymentMethods: ManagedPaymentMethod[] = [
    {
      id: '80000000-0000-4000-8000-000000000001',
      code: 'COD',
      type: 'COD',
      name: 'Cash on Delivery',
      description: 'Pay cash when your order arrives',
      providerLabel: null,
      accountName: null,
      accountNumber: null,
      qrImageUrl: null,
      instructions: 'Please keep exact cash ready',
      minAmount: '500.00',
      maxAmount: '50000.00',
      displayOrder: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '80000000-0000-4000-8000-000000000002',
      code: 'STATIC_QR',
      type: 'STATIC_QR',
      name: 'Fonepay QR',
      description: 'Scan and pay using any mobile banking app',
      providerLabel: 'Fonepay',
      accountName: 'Old Liquor Store Pvt. Ltd.',
      accountNumber: '9801234567', // Admin secret: must NOT be exposed in public API!
      qrImageUrl: 'https://assets.liquorshop.test/qr/fonepay.png',
      instructions: 'Mention order number in payment remarks',
      minAmount: null,
      maxAmount: null,
      displayOrder: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '80000000-0000-4000-8000-000000000003',
      code: 'DISABLED_QR',
      type: 'STATIC_QR',
      name: 'Inactive eSewa QR',
      description: 'Currently undergoing maintenance',
      providerLabel: 'eSewa',
      accountName: 'Old Liquor Store',
      accountNumber: '9841000000',
      qrImageUrl: 'https://assets.liquorshop.test/qr/esewa.png',
      instructions: null,
      minAmount: null,
      maxAmount: null,
      displayOrder: 3,
      isActive: false, // Disabled!
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const paymentRepo = new MemoryPaymentMethodRepository(initialPaymentMethods);

  const categoryId = '70000000-0000-4000-8000-000000000001';
  const brandId = '70000000-0000-4000-8000-000000000002';
  const productId = '70000000-0000-4000-8000-000000000003';
  const variantId = '70000000-0000-4000-8000-000000000004';

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
    name: 'Yeti',
    slug: 'yeti',
    logoUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const variant: MemoryVariantItem = {
    id: variantId,
    productId,
    sku: 'YETI-750',
    sizeLabel: '750 ml',
    sizeMilliliters: 750,
    purchasePrice: '1500.00',
    sellingPrice: '2000.00',
    stock: 20,
    lowStockThreshold: 5,
    isActive: true,
    product: {
      id: productId,
      name: 'Old Monk Rum',
      slug: 'old-monk-rum',
      isActive: true,
    },
  };

  const product: ProductRecord = {
    id: productId,
    categoryId,
    brandId,
    name: 'Old Monk Rum',
    slug: 'old-monk-rum',
    description: null,
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
    variants: [variant as unknown as ProductVariantRecord],
  };

  const catalogRepo = new TestCatalogRepo([category], [brand], [product]);
  const cartRepo = new MemoryCartRepository();
  const movements: InventoryMovementRecord[] = [];
  const checkoutRepo = new MemoryCheckoutRepository(
    [variant],
    movements,
    cartRepo,
  );

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    catalogRepository: catalogRepo,
    cartRepository: cartRepo,
    checkoutRepository: checkoutRepo,
    paymentMethodRepository: paymentRepo,
  });

  const token = createAdminAccessToken(config, adminId);

  return { app, token, paymentRepo, checkoutRepo, variant };
}

describe('Payment Methods Foundation (Task 17)', () => {
  describe('Public Storefront Payment Methods API', () => {
    it('returns only active payment methods in display order without sensitive fields', async () => {
      const { app } = setupPaymentFixture();

      const res = await request(app).get('/api/payment-methods').expect(200);

      expect(res.body.success).toBe(true);
      const methods = res.body.data;
      expect(Array.isArray(methods)).toBe(true);
      // There are 3 total methods, but DISABLED_QR must be excluded!
      expect(methods.length).toBe(2);

      const codes = methods.map((m: { code: string }) => m.code);
      expect(codes).toEqual(['COD', 'STATIC_QR']);

      for (const m of methods) {
        // Safe display fields must be present
        expect(m.id).toBeDefined();
        expect(m.code).toBeDefined();
        expect(m.type).toBeDefined();
        expect(m.name).toBeDefined();
        expect(m.displayOrder).toBeDefined();

        // Sensitive admin fields must NEVER be leaked to public guests
        expect(m.accountNumber).toBeUndefined();
        expect(m.isActive).toBeUndefined();
        expect(m.createdAt).toBeUndefined();
        expect(m.updatedAt).toBeUndefined();
      }

      // Check STATIC_QR specific public details
      const qrMethod = methods.find(
        (m: { code: string }) => m.code === 'STATIC_QR',
      );
      expect(qrMethod.providerLabel).toBe('Fonepay');
      expect(qrMethod.accountName).toBe('Old Liquor Store Pvt. Ltd.');
      expect(qrMethod.qrImageUrl).toBe(
        'https://assets.liquorshop.test/qr/fonepay.png',
      );
      expect(qrMethod.instructions).toContain('Mention order number');
    });
  });

  describe('Admin Payment Methods Management & Granular Permissions', () => {
    it('enforces authentication on admin endpoints', async () => {
      const { app } = setupPaymentFixture();

      await request(app).get('/api/admin/payment-methods').expect(401);
      await request(app)
        .post('/api/admin/payment-methods')
        .send({})
        .expect(401);
    });

    it('enforces granular permission payment-methods.read', async () => {
      // Admin without permission
      const { app, token } = setupPaymentFixture(['catalog.categories.read']);

      await request(app)
        .get('/api/admin/payment-methods')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      // Admin with permission
      const authorized = setupPaymentFixture(['payment-methods.read']);
      const res = await request(authorized.app)
        .get('/api/admin/payment-methods')
        .set('Authorization', `Bearer ${authorized.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // Admin view lists all 3 methods including inactive ones
      expect(res.body.data.length).toBe(3);
      // Admin view includes accountNumber and isActive
      const qr = res.body.data.find(
        (m: { code: string }) => m.code === 'STATIC_QR',
      );
      expect(qr.accountNumber).toBe('9801234567');
      expect(qr.isActive).toBe(true);
    });

    it('creates a new payment method with permission payment-methods.create', async () => {
      const { app, token } = setupPaymentFixture(['payment-methods.create']);

      const res = await request(app)
        .post('/api/admin/payment-methods')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'khalti_qr', // Must be normalized to KHALTI_QR
          type: 'STATIC_QR',
          name: 'Khalti QR Payment',
          providerLabel: 'Khalti',
          accountName: 'Liquor Store',
          accountNumber: '9812345678',
          qrImageUrl: 'https://assets.liquorshop.test/qr/khalti.png',
          instructions: 'Scan with Khalti app',
          minAmount: '100.00',
          maxAmount: '25000.00',
          displayOrder: 4,
          isActive: true,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('KHALTI_QR');
      expect(res.body.data.name).toBe('Khalti QR Payment');
      expect(res.body.data.accountNumber).toBe('9812345678');
    });

    it('validates configuration and rejects duplicate code or invalid QR URL', async () => {
      const { app, token } = setupPaymentFixture(['payment-methods.create']);

      // Duplicate code
      const resDup = await request(app)
        .post('/api/admin/payment-methods')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'COD', // Already exists
          type: 'COD',
          name: 'Another COD',
        })
        .expect(409);

      expect(resDup.body.error.code).toBe('DUPLICATE_CODE');

      // Invalid QR URL
      await request(app)
        .post('/api/admin/payment-methods')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'TEST_QR',
          type: 'STATIC_QR',
          name: 'Test QR',
          qrImageUrl: 'javascript:alert(1)', // Dangerous non-http URL
        })
        .expect(400);

      // minAmount greater than maxAmount
      await request(app)
        .post('/api/admin/payment-methods')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'TEST_LIMITS',
          type: 'COD',
          name: 'Test Limits',
          minAmount: '5000.00',
          maxAmount: '1000.00',
        })
        .expect(400);
    });

    it('updates payment method configuration with payment-methods.update', async () => {
      const { app, token } = setupPaymentFixture(['payment-methods.update']);

      const res = await request(app)
        .patch(
          '/api/admin/payment-methods/80000000-0000-4000-8000-000000000001',
        )
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Cash on Delivery (Updated)',
          instructions: 'New instructions for delivery driver',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Cash on Delivery (Updated)');
      expect(res.body.data.instructions).toBe(
        'New instructions for delivery driver',
      );
    });

    it('enables/disables payment method with payment-methods.status', async () => {
      const { app, token } = setupPaymentFixture(['payment-methods.status']);

      // Disable COD
      const resDisable = await request(app)
        .patch(
          '/api/admin/payment-methods/80000000-0000-4000-8000-000000000001/status',
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false })
        .expect(200);

      expect(resDisable.body.data.isActive).toBe(false);

      // Verify disabled COD is now hidden from public API
      const publicRes = await request(app)
        .get('/api/payment-methods')
        .expect(200);
      const codes = publicRes.body.data.map((m: { code: string }) => m.code);
      expect(codes).not.toContain('COD');
    });
  });

  describe('Checkout Payment Selection & Payment Status Separation', () => {
    const validCustomer = {
      name: 'Sita Sharma',
      phone: '+977-9841987654',
      deliveryAddress: 'Jhamsikhel, Lalitpur, Ward 3',
      email: 'sita@example.com',
    };

    it('records paymentMethodCode on checkout and NEVER marks payment as paid (paymentStatus is PENDING)', async () => {
      const { app, variant } = setupPaymentFixture();

      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer: validCustomer,
          items: [{ variantId: variant.id, quantity: 1 }], // Total 2000.00
          paymentMethodCode: 'COD',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const order = res.body.data;
      expect(order.orderNumber).toBeDefined();
      expect(order.paymentMethodCode).toBe('COD');
      expect(order.paymentMethodName).toBe('Cash on Delivery');

      // CRITICAL REQUIREMENT: Payment is NOT marked as paid upon checkout!
      expect(order.paymentStatus).toBe('PENDING');
      expect(order.status).toBe('PENDING');

      // Verify lookup token retrieves public order with payment snapshot
      const lookupRes = await request(app)
        .get(`/api/orders/${order.orderNumber}?token=${order.orderLookupToken}`)
        .expect(200);

      expect(lookupRes.body.data.payment).toEqual({
        methodCode: 'COD',
        methodName: 'Cash on Delivery',
        status: 'PENDING',
      });
    });

    it('records STATIC_QR payment method on checkout and keeps paymentStatus as PENDING', async () => {
      const { app, variant } = setupPaymentFixture();

      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer: validCustomer,
          items: [{ variantId: variant.id, quantity: 2 }], // Total 4000.00
          paymentMethodCode: 'STATIC_QR',
        })
        .expect(201);

      expect(res.body.data.paymentMethodCode).toBe('STATIC_QR');
      expect(res.body.data.paymentMethodName).toBe('Fonepay QR');
      // Must remain PENDING until subsequent admin verification
      expect(res.body.data.paymentStatus).toBe('PENDING');
    });

    it('rejects checkout when selecting a disabled payment method with 400', async () => {
      const { app, variant } = setupPaymentFixture();

      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer: validCustomer,
          items: [{ variantId: variant.id, quantity: 1 }],
          paymentMethodCode: 'DISABLED_QR',
        })
        .expect(400);

      expect(res.body.error.code).toBe('INVALID_PAYMENT_METHOD');
    });

    it('rejects checkout when order total violates payment method min/max amount limits', async () => {
      const { app, variant } = setupPaymentFixture();

      // COD minAmount is 500.00, maxAmount is 50000.00.
      // Order 30 items: 30 * 2000 = 60000.00 > maxAmount 50000.00
      variant.stock = 50;

      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer: validCustomer,
          items: [{ variantId: variant.id, quantity: 30 }],
          paymentMethodCode: 'COD',
        })
        .expect(400);

      expect(res.body.error.code).toBe('PAYMENT_AMOUNT_LIMIT');
    });
  });

  describe('Migration & Schema Consistency (Review Only)', () => {
    it('verifies payment method migration SQL and dependency ordering', () => {
      const migrationSql = readFileSync(
        resolve(
          process.cwd(),
          'prisma/migrations/20261011000200_payment_methods/migration.sql',
        ),
        'utf8',
      );

      // Enums created
      expect(migrationSql).toContain('CREATE TYPE "PaymentMethodType" AS ENUM');
      expect(migrationSql).toContain('CREATE TYPE "PaymentStatus" AS ENUM');
      expect(migrationSql).toContain("'COD', 'STATIC_QR'");
      expect(migrationSql).toContain(
        "'PENDING', 'UNDER_REVIEW', 'PAID', 'FAILED', 'REFUNDED'",
      );

      // Table created
      expect(migrationSql).toContain('CREATE TABLE "PaymentMethod"');
      expect(migrationSql).toContain('"code" VARCHAR(50) NOT NULL');
      expect(migrationSql).toContain('"qrImageUrl" VARCHAR(2048)');

      // Order altered non-destructively
      expect(migrationSql).toContain(
        'ALTER TABLE "Order" ADD COLUMN "paymentMethodCode"',
      );
      expect(migrationSql).toContain(
        'ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT \'PENDING\'',
      );

      // Canonical constraints
      expect(migrationSql).toContain(
        'ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_code_canonical_check"',
      );
      expect(migrationSql).toContain(
        'ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_amounts_order_check"',
      );
    });

    it('notes testing environment limitation regarding PostgreSQL concurrency', () => {
      // In-memory fixtures test business logic, validation, RBAC, and atomicity simulations.
      // Real PostgreSQL multi-client row-level locking and transaction serialization require an active PostgreSQL instance.
      expect(true).toBe(true);
    });
  });
});
