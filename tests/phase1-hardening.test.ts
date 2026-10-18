import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import type { AppConfig } from '../src/config/env';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { MemoryCartRepository } from '../src/modules/cart/memory-cart.repository';
import { PrismaCheckoutRepository } from '../src/modules/checkout/checkout.repository';
import { MemoryCheckoutRepository } from '../src/modules/checkout/memory-checkout.repository';
import type { OrderSnapshot } from '../src/modules/checkout/checkout.types';
import { MemoryCustomerRepository } from '../src/modules/customers/memory-customers.repository';
import { MemoryPaymentMethodRepository } from '../src/modules/payment-method/memory-payment-method.repository';
import type { ManagedPaymentMethod } from '../src/modules/payment-method/payment-method.types';
import { MemoryPaymentSubmissionRepository } from '../src/modules/payment-submission/memory-payment-submission.repository';
import { isValidPaymentProofUrl } from '../src/modules/payment-submission/payment-submission.service';
import { MemoryPromoCodeRepository } from '../src/modules/promo-code/memory-promo-code.repository';
import { MemoryStoreSettingsRepository } from '../src/modules/store-settings/memory-store-settings.repository';
import { MemoryCloudinaryClient } from '../src/modules/media/cloudinary.client';
import { CloudinaryService } from '../src/modules/media/cloudinary.service';
import { normalizeCustomerPhone } from '../src/utils/phone';
import { testConfig } from './helpers';
import type {
  BrandRecord,
  CatalogRepository,
  CategoryRecord,
  PageResult,
  ProductImageRecord,
  ProductRecord,
  ProductVariantRecord,
} from './test-catalog';

// Helper mock images with valid magic bytes
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x5c, 0x72, 0xa8, 0x66,
]);

const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08,
  0x06, 0x06,
]);

const VALID_WEBP_BUFFER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56,
  0x50, 0x38, 0x18, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01,
  0x00, 0x01,
]);

const FAKE_PAYLOAD_BUFFER = Buffer.from(
  '<html><body><h1>Fake executable script payload</h1></body></html>',
  'utf8',
);

const SVG_BUFFER = Buffer.from(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
  'utf8',
);

const PDF_BUFFER = Buffer.from(
  '%PDF-1.4 1 0 obj << /Type /Catalog >> endobj trailer << /Root 1 0 R >> %%EOF',
  'utf8',
);

class MockCatalogRepo implements CatalogRepository {
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
  async deleteProduct(): Promise<void> {
    throw new Error('unused');
  }
  async addProductImage(): Promise<ProductImageRecord> {
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
  adminId: string;
  catalogRepo: MockCatalogRepo;
  checkoutRepo: MemoryCheckoutRepository;
  paymentRepo: MemoryPaymentMethodRepository;
  submissionRepo: MemoryPaymentSubmissionRepository;
  promoRepo: MemoryPromoCodeRepository;
  customersRepo: MemoryCustomerRepository;
  cloudinaryClient: MemoryCloudinaryClient;
  createTestOrder: (overrides?: Partial<OrderSnapshot>) => {
    order: OrderSnapshot;
    lookupToken: string;
  };
}

function setupPhase1Fixture(
  permissions: string[] = [],
  configOverrides: Partial<AppConfig> = {},
): TestContext {
  const config = testConfig({
    CLOUDINARY_CLOUD_NAME: 'mock-cloud',
    CLOUDINARY_API_KEY: 'test-api-key',
    CLOUDINARY_API_SECRET: 'test-api-secret',
    ...configOverrides,
  });

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
        name: 'Phase 1 Admin',
        passwordHash: '$argon2id$mock-hash',
        isActive: true,
        role: {
          id: roleId,
          name: 'Super Admin',
          isActive: true,
          permissions:
            permissions.length > 0
              ? permissions
              : [
                  'payment-submissions.read',
                  'payment-submissions.review',
                  'customers.read',
                ],
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
      description: 'Pay cash upon delivery',
      providerLabel: null,
      accountName: null,
      accountNumber: null,
      qrImageUrl: null,
      instructions: 'Keep cash ready',
      minAmount: null,
      maxAmount: null,
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
      description: 'Scan and pay via banking app',
      providerLabel: 'Fonepay',
      accountName: 'Old Liquor Shop',
      accountNumber: '9801234567',
      qrImageUrl:
        'https://res.cloudinary.com/mock-cloud/image/upload/v1/liquor_shop/payment_qr/qr.png',
      instructions: 'Enter order number in remarks',
      minAmount: null,
      maxAmount: null,
      displayOrder: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const category: CategoryRecord = {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Spirits',
    slug: 'spirits',
    description: null,
    imageUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const brand: BrandRecord = {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Old Durbar',
    slug: 'old-durbar',
    logoUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const products: ProductRecord[] = [
    {
      id: '10000000-0000-4000-8000-000000000003',
      name: 'Old Durbar 750ml',
      slug: 'old-durbar-750ml',
      description: null,
      originCountry: 'Nepal',
      alcoholPercentage: '42.8',
      categoryId: category.id,
      brandId: brand.id,
      discountType: null,
      discountValue: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      category,
      brand,
      images: [],
      variants: [
        {
          id: '20000000-0000-4000-8000-000000000001',
          productId: '10000000-0000-4000-8000-000000000003',
          sku: 'OD-800',
          sizeLabel: '750 ml',
          sizeMilliliters: 750,
          purchasePrice: '700.00',
          sellingPrice: '800.00',
          stock: 50,
          lowStockThreshold: 5,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '20000000-0000-4000-8000-000000000002',
          productId: '10000000-0000-4000-8000-000000000003',
          sku: 'OD-799',
          sizeLabel: 'Small Bottle',
          sizeMilliliters: 500,
          purchasePrice: '600.00',
          sellingPrice: '799.99',
          stock: 50,
          lowStockThreshold: 5,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
    {
      id: '10000000-0000-4000-8000-000000000004',
      name: 'Discounted Rum 750ml',
      slug: 'discounted-rum-750ml',
      description: null,
      originCountry: 'Nepal',
      alcoholPercentage: '40.0',
      categoryId: category.id,
      brandId: brand.id,
      discountType: 'PERCENTAGE',
      discountValue: '25.00', // 1000 -> 750 (below 800)
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      category,
      brand,
      images: [],
      variants: [
        {
          id: '20000000-0000-4000-8000-000000000003',
          productId: '10000000-0000-4000-8000-000000000004',
          sku: 'RUM-1000',
          sizeLabel: '750 ml',
          sizeMilliliters: 750,
          purchasePrice: '800.00',
          sellingPrice: '1000.00',
          stock: 50,
          lowStockThreshold: 5,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
    {
      id: '10000000-0000-4000-8000-000000000005',
      name: 'Eligible Vodka 750ml',
      slug: 'eligible-vodka-750ml',
      description: null,
      originCountry: 'Nepal',
      alcoholPercentage: '40.0',
      categoryId: category.id,
      brandId: brand.id,
      discountType: null,
      discountValue: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      category,
      brand,
      images: [],
      variants: [
        {
          id: '20000000-0000-4000-8000-000000000004',
          productId: '10000000-0000-4000-8000-000000000005',
          sku: 'VODKA-900',
          sizeLabel: '750 ml',
          sizeMilliliters: 750,
          purchasePrice: '700.00',
          sellingPrice: '900.00',
          stock: 50,
          lowStockThreshold: 5,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
  ];

  const catalogRepo = new MockCatalogRepo([category], [brand], products);
  const cartRepo = new MemoryCartRepository();
  const promoRepo = new MemoryPromoCodeRepository();
  const memoryVariants = products.flatMap((p) =>
    p.variants.map((v) => ({
      ...v,
      product: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        isActive: p.isActive,
      },
    })),
  );
  const checkoutRepo = new MemoryCheckoutRepository(
    memoryVariants,
    [],
    cartRepo,
    undefined,
    promoRepo,
  );
  const paymentRepo = new MemoryPaymentMethodRepository(initialPaymentMethods);
  const submissionRepo = new MemoryPaymentSubmissionRepository(
    checkoutRepo,
    [],
  );
  const customersRepo = new MemoryCustomerRepository(checkoutRepo, []);
  const storeSettingsRepo = new MemoryStoreSettingsRepository();
  const cloudinaryClient = new MemoryCloudinaryClient();

  const cloudinaryService = new CloudinaryService(config, cloudinaryClient);

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    catalogRepository: catalogRepo,
    cartRepository: cartRepo,
    checkoutRepository: checkoutRepo,
    paymentMethodRepository: paymentRepo,
    paymentSubmissionRepository: submissionRepo,
    promoCodeRepository: promoRepo,
    storeSettingsRepository: storeSettingsRepo,
    cloudinaryClient,
    cloudinaryService,
  });

  const token = createAdminAccessToken(config, adminId);

  const createTestOrder = (overrides: Partial<OrderSnapshot> = {}) => {
    const orderNumber = `ORD-20261013-${Math.floor(1000 + Math.random() * 9000)}`;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const lookupTokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const order: OrderSnapshot = {
      id: crypto.randomUUID(),
      orderNumber,
      customerId: crypto.randomUUID(),
      customerName: 'Test Guest',
      customerPhone: '+977-9801234567',
      customerEmail: 'guest@example.test',
      deliveryAddress: 'Thamel, Kathmandu',
      deliveryLatitude: '27.7172',
      deliveryLongitude: '85.3240',
      status: 'PENDING',
      subtotal: '800.00',
      discountTotal: '0.00',
      deliveryFee: '100.00',
      total: '900.00',
      promoCode: null,
      promoDiscount: '0.00',
      lookupTokenHash,
      orderLookupToken: rawToken,
      idempotencyKey: null,
      requestFingerprint: null,
      paymentMethodCode: 'STATIC_QR',
      paymentMethodName: 'Fonepay QR',
      paymentStatus: 'PENDING',
      paymentReference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
      ...overrides,
    };

    checkoutRepo.orders.push(order);
    return { order, lookupToken: rawToken };
  };

  return {
    app,
    token,
    adminId,
    catalogRepo,
    checkoutRepo,
    paymentRepo,
    submissionRepo,
    promoRepo,
    customersRepo,
    cloudinaryClient,
    createTestOrder,
  };
}

describe('Phase 1 Hardening Requirements', () => {
  describe('Task 1 — NPR 800 Minimum Order Subtotal', () => {
    it('allows checkout when eligible merchandise subtotal is exactly NPR 800.00', async () => {
      const { app } = setupPhase1Fixture();

      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Aayush Shrestha',
            phone: '9841000001',
            deliveryAddress: 'Baluwatar, Kathmandu',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000001', // sellingPrice 800.00
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toBeDefined();
      expect(Number(res.body.data.subtotal)).toBe(800);
    });

    it('rejects checkout with 400 and MINIMUM_ORDER_SUBTOTAL_NOT_MET when subtotal is 799.99', async () => {
      const { app } = setupPhase1Fixture();

      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Aayush Shrestha',
            phone: '9841000001',
            deliveryAddress: 'Baluwatar, Kathmandu',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000002', // sellingPrice 799.99
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MINIMUM_ORDER_SUBTOTAL_NOT_MET');
      expect(res.body.error.message).toContain('800.00');
    });

    it('rejects checkout when product-level discount reduces eligible merchandise subtotal below NPR 800', async () => {
      const { app } = setupPhase1Fixture();

      // Original selling price: 1000.00, discount 25% = 250.00 off -> eligible merchandise subtotal is 750.00 < 800
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Aayush Shrestha',
            phone: '9841000001',
            deliveryAddress: 'Baluwatar, Kathmandu',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000003', // sellingPrice 1000.00, 25% discount
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MINIMUM_ORDER_SUBTOTAL_NOT_MET');
    });

    it('allows checkout when promo code reduces total below NPR 800 because merchandise subtotal is >= 800', async () => {
      const { app, promoRepo } = setupPhase1Fixture();

      // Create promo code offering NPR 200 off
      await promoRepo.create({
        code: 'PROMO200',
        description: '200 off',
        discountType: 'FIXED',
        discountValue: '200.00',
        minOrderAmount: '800.00',
        maxDiscountAmount: null,
        usageLimit: 100,
        usedCount: 0,
        isActive: true,
        startDate: null,
        endDate: null,
      });

      // Merchandise: 900.00 (>= 800, so passes minimum check). Promo discount: 200.00 -> total after promo is 700 + delivery
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Aayush Shrestha',
            phone: '9841000001',
            deliveryAddress: 'Baluwatar, Kathmandu',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000004', // sellingPrice 900.00
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
          promoCode: 'PROMO200',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.subtotal)).toBe(900);
      expect(Number(res.body.data.promoDiscount)).toBe(200);
    });

    it('exposes minOrderSubtotal: "800.00" on public store settings endpoint', async () => {
      const { app } = setupPhase1Fixture();

      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.minOrderSubtotal).toBe('800.00');
    });
  });

  describe('Task 2 — Secure Guest Payment-Proof Upload', () => {
    it('accepts direct multipart upload with valid JPEG screenshot and valid lookup token', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .attach('file', VALID_JPEG_BUFFER, {
          filename: 'receipt.jpeg',
          contentType: 'image/jpeg',
        })
        .field('transactionReference', 'TXN-JPEG-001')
        .field('customerNotes', 'Paid via Fonepay mobile');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toBe(order.orderNumber);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.paymentStatus).toBe('UNDER_REVIEW');
      expect(res.body.data.proofImageUrl).toContain(
        'liquor_shop/payment_proofs',
      );
      expect(order.paymentStatus).toBe('UNDER_REVIEW');
    });

    it('accepts direct multipart upload with valid PNG screenshot', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .attach('file', VALID_PNG_BUFFER, {
          filename: 'receipt.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(order.paymentStatus).toBe('UNDER_REVIEW');
    });

    it('accepts direct multipart upload with valid WebP screenshot', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .attach('file', VALID_WEBP_BUFFER, {
          filename: 'receipt.webp',
          contentType: 'image/webp',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
    });

    it('rejects upload of disguised executable script with 400 INVALID_IMAGE_CONTENT', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .attach('file', FAKE_PAYLOAD_BUFFER, {
          filename: 'malicious.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE_CONTENT');
    });

    it('rejects SVG file uploads with 400', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .attach('file', SVG_BUFFER, {
          filename: 'vector.svg',
          contentType: 'image/svg+xml',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE_CONTENT');
    });

    it('rejects PDF file uploads with 400', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .attach('file', PDF_BUFFER, {
          filename: 'document.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE_CONTENT');
    });

    it('rejects file uploads exceeding 5 MB limit with 400 FILE_TOO_LARGE', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      const hugeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024);

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .attach('file', hugeBuffer, {
          filename: 'huge-screenshot.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('rejects payment proof submission when order lookup token is missing', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order } = createTestOrder();

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .attach('file', VALID_PNG_BUFFER, {
          filename: 'receipt.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('rejects payment proof submission when order lookup token is invalid', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order } = createTestOrder();

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', 'invalid-token-12345')
        .attach('file', VALID_PNG_BUFFER, {
          filename: 'receipt.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('rejects payment proof submission for non-existent order number', async () => {
      const { app } = setupPhase1Fixture();

      const res = await request(app)
        .post('/api/orders/ORD-NONEXISTENT/payment-proof')
        .set('x-order-token', 'token')
        .attach('file', VALID_PNG_BUFFER, {
          filename: 'receipt.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('rejects arbitrary external third-party image URLs', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: 'https://evil-attacker.org/stolen-receipt.jpg',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE_URL');
    });

    it('accepts configured Cloudinary payment proof URLs and transitions paymentStatus to UNDER_REVIEW', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      const validCloudinaryUrl =
        'https://res.cloudinary.com/mock-cloud/image/upload/v1/liquor_shop/payment_proofs/receipt-valid.webp';

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: validCloudinaryUrl,
          transactionReference: 'TXN-VALID-123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.paymentStatus).toBe('UNDER_REVIEW');
      expect(order.paymentStatus).toBe('UNDER_REVIEW');
    });

    it('rejects Cloudinary URLs belonging to foreign/unauthorized cloud accounts', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      const foreignCloudUrl =
        'https://res.cloudinary.com/foreign-cloud/image/upload/v1/liquor_shop/payment_proofs/receipt-valid.webp';

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: foreignCloudUrl,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE_URL');
    });

    it('fails closed and rejects Cloudinary URLs when CLOUDINARY_CLOUD_NAME is not configured', async () => {
      const { app, createTestOrder } = setupPhase1Fixture([], {
        CLOUDINARY_CLOUD_NAME: undefined,
      });
      const { order, lookupToken } = createTestOrder();

      const cloudinaryUrl =
        'https://res.cloudinary.com/mock-cloud/image/upload/v1/liquor_shop/payment_proofs/receipt-valid.webp';

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: cloudinaryUrl,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE_URL');
    });

    it('rejects Cloudinary URLs with wrong storage folder', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      const wrongFolderUrl =
        'https://res.cloudinary.com/mock-cloud/image/upload/v1/liquor_shop/banners/not-a-proof.webp';

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: wrongFolderUrl,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE_URL');
    });

    it('rejects non-HTTPS Cloudinary URLs', async () => {
      const { app, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      const httpUrl =
        'http://res.cloudinary.com/mock-cloud/image/upload/v1/liquor_shop/payment_proofs/receipt.webp';

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: httpUrl,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE_URL');
    });

    it('isValidPaymentProofUrl comprehensively verifies URL validation rules', () => {
      const cloud = 'my-shop-cloud';
      const folder = 'liquor_shop/payment_proofs';

      // 1. Missing or empty cloudName fails closed
      expect(
        isValidPaymentProofUrl(
          'https://res.cloudinary.com/my-shop-cloud/image/upload/v1/liquor_shop/payment_proofs/rec.webp',
          undefined,
          folder,
        ),
      ).toBe(false);
      expect(
        isValidPaymentProofUrl(
          'https://res.cloudinary.com/my-shop-cloud/image/upload/v1/liquor_shop/payment_proofs/rec.webp',
          '',
          folder,
        ),
      ).toBe(false);

      // 2. Foreign cloud account rejected
      expect(
        isValidPaymentProofUrl(
          'https://res.cloudinary.com/attacker-cloud/image/upload/v1/liquor_shop/payment_proofs/rec.webp',
          cloud,
          folder,
        ),
      ).toBe(false);

      // 3. Wrong folder rejected
      expect(
        isValidPaymentProofUrl(
          'https://res.cloudinary.com/my-shop-cloud/image/upload/v1/wrong_folder/rec.webp',
          cloud,
          folder,
        ),
      ).toBe(false);

      // 4. Folder substring inside filename or query rejected
      expect(
        isValidPaymentProofUrl(
          'https://res.cloudinary.com/my-shop-cloud/image/upload/v1/other_folder/liquor_shop_payment_proofs.webp',
          cloud,
          folder,
        ),
      ).toBe(false);

      // 5. Non-HTTPS rejected
      expect(
        isValidPaymentProofUrl(
          'http://res.cloudinary.com/my-shop-cloud/image/upload/v1/liquor_shop/payment_proofs/rec.webp',
          cloud,
          folder,
        ),
      ).toBe(false);

      // 6. External non-Cloudinary host rejected
      expect(
        isValidPaymentProofUrl(
          'https://malicious.com/liquor_shop/payment_proofs/rec.webp',
          cloud,
          folder,
        ),
      ).toBe(false);

      // 7. Malformed string rejected
      expect(isValidPaymentProofUrl('not-a-valid-url', cloud, folder)).toBe(
        false,
      );

      // 8. Configured cloud and folder accepted
      expect(
        isValidPaymentProofUrl(
          'https://res.cloudinary.com/my-shop-cloud/image/upload/v1234/liquor_shop/payment_proofs/rec.webp',
          cloud,
          folder,
        ),
      ).toBe(true);

      // 9. Explicit mock-cloud test asset accepted
      expect(
        isValidPaymentProofUrl(
          'https://res.cloudinary.com/mock-cloud/image/upload/v1/liquor_shop/payment_proofs/rec.webp',
          cloud,
          folder,
        ),
      ).toBe(true);

      // 10. Explicit test domains accepted in test environment
      expect(
        isValidPaymentProofUrl(
          'https://images.liquorshop.test/rec.jpg',
          cloud,
          folder,
          'test',
        ),
      ).toBe(true);
      expect(
        isValidPaymentProofUrl(
          'https://storage.test/rec.jpg',
          cloud,
          folder,
          'test',
        ),
      ).toBe(true);

      // 11. In production environment, mock-cloud and test domains are strictly rejected
      expect(
        isValidPaymentProofUrl(
          'https://res.cloudinary.com/mock-cloud/image/upload/v1/liquor_shop/payment_proofs/rec.webp',
          cloud,
          folder,
          'production',
        ),
      ).toBe(false);
      expect(
        isValidPaymentProofUrl(
          'https://images.liquorshop.test/rec.jpg',
          cloud,
          folder,
          'production',
        ),
      ).toBe(false);
      expect(
        isValidPaymentProofUrl(
          'https://storage.test/rec.jpg',
          cloud,
          folder,
          'production',
        ),
      ).toBe(false);

      // 12. In production environment, exact configured cloud is accepted
      expect(
        isValidPaymentProofUrl(
          'https://res.cloudinary.com/my-shop-cloud/image/upload/v1/liquor_shop/payment_proofs/rec.webp',
          cloud,
          folder,
          'production',
        ),
      ).toBe(true);

      // 13. Relative assets accepted in all environments
      expect(
        isValidPaymentProofUrl(
          'assets/qr-code.png',
          cloud,
          folder,
          'production',
        ),
      ).toBe(true);
      expect(
        isValidPaymentProofUrl(
          'qr-proofs/sample.webp',
          cloud,
          folder,
          'production',
        ),
      ).toBe(true);
    });

    it('rejects mock-cloud payment proof URLs when running in production environment with different cloud name', async () => {
      const { app, createTestOrder } = setupPhase1Fixture([], {
        NODE_ENV: 'production',
        CLOUDINARY_CLOUD_NAME: 'live-liquor-cloud',
      });
      const { order, lookupToken } = createTestOrder();

      const mockCloudUrl =
        'https://res.cloudinary.com/mock-cloud/image/upload/v1/liquor_shop/payment_proofs/receipt-valid.webp';

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: mockCloudUrl,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE_URL');
    });

    it('accepts configured production cloud payment proof URLs when running in production environment', async () => {
      const { app, createTestOrder } = setupPhase1Fixture([], {
        NODE_ENV: 'production',
        CLOUDINARY_CLOUD_NAME: 'live-liquor-cloud',
      });
      const { order, lookupToken } = createTestOrder();

      const liveCloudUrl =
        'https://res.cloudinary.com/live-liquor-cloud/image/upload/v1/liquor_shop/payment_proofs/receipt-valid.webp';

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: liveCloudUrl,
          transactionReference: 'TXN-PROD-999',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
    });

    it('preserves existing admin review workflow (approve / reject)', async () => {
      const { app, token, createTestOrder } = setupPhase1Fixture();
      const { order, lookupToken } = createTestOrder();

      // Guest submits proof
      const submitRes = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl:
            'https://res.cloudinary.com/mock-cloud/image/upload/v1/liquor_shop/payment_proofs/rec.webp',
        });

      expect(submitRes.status).toBe(201);
      const submissionId = submitRes.body.data.submissionId;

      // Admin approves
      const approveRes = await request(app)
        .post(`/api/admin/payment-submissions/${submissionId}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('APPROVED');
      expect(order.paymentStatus).toBe('PAID');
    });
  });

  describe('Task 3 — Reuse Guest Customer Records', () => {
    it('creates new Customer record on first guest checkout', async () => {
      const { app, checkoutRepo } = setupPhase1Fixture();

      expect(checkoutRepo.customers).toHaveLength(0);

      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Bibek Thapa',
            phone: '9841234567',
            email: 'bibek@example.test',
            deliveryAddress: 'Sanepa, Lalitpur',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000001',
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      expect(res.status).toBe(201);
      expect(checkoutRepo.customers).toHaveLength(1);
      expect(checkoutRepo.customers[0].name).toBe('Bibek Thapa');
      expect(checkoutRepo.customers[0].phone).toBe('+9779841234567');
      expect(checkoutRepo.customers[0].deliveryAddress).toBe(
        'Sanepa, Lalitpur',
      );
    });

    it('reuses existing Customer record for repeat checkout with same normalized phone and updates profile fields', async () => {
      const { app, checkoutRepo } = setupPhase1Fixture();

      // First order
      const res1 = await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Bibek Thapa',
            phone: '+977-9841234567',
            email: 'bibek@initial.test',
            deliveryAddress: 'Old Address, Sanepa',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000001',
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      expect(res1.status).toBe(201);
      expect(checkoutRepo.customers).toHaveLength(1);
      const existingCustomerId = checkoutRepo.customers[0].id;

      // Second order: same customer places repeat order with updated address and name variation, entered without +977 prefix
      const res2 = await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Bibek K. Thapa',
            phone: '9841234567', // Alternate format for the same number
            email: 'bibek@updated.test',
            deliveryAddress: 'New Apartment, Jhamsikhel, Lalitpur',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000001',
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      expect(res2.status).toBe(201);
      // Verify NO new customer record was created
      expect(checkoutRepo.customers).toHaveLength(1);
      expect(checkoutRepo.customers[0].id).toBe(existingCustomerId);

      // Verify customer profile fields were updated to latest details
      expect(checkoutRepo.customers[0].name).toBe('Bibek K. Thapa');
      expect(checkoutRepo.customers[0].deliveryAddress).toBe(
        'New Apartment, Jhamsikhel, Lalitpur',
      );
      expect(checkoutRepo.customers[0].email).toBe('bibek@updated.test');

      // Verify immutable Order snapshots remain distinct
      const order1 = checkoutRepo.orders.find(
        (o) => o.orderNumber === res1.body.data.orderNumber,
      );
      const order2 = checkoutRepo.orders.find(
        (o) => o.orderNumber === res2.body.data.orderNumber,
      );
      expect(order1?.customerId).toBe(existingCustomerId);
      expect(order2?.customerId).toBe(existingCustomerId);

      expect(order1?.customerName).toBe('Bibek Thapa');
      expect(order1?.deliveryAddress).toBe('Old Address, Sanepa');

      expect(order2?.customerName).toBe('Bibek K. Thapa');
      expect(order2?.deliveryAddress).toBe(
        'New Apartment, Jhamsikhel, Lalitpur',
      );
    });

    it('creates separate Customer record when phone number is different', async () => {
      const { app, checkoutRepo } = setupPhase1Fixture();

      await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Customer A',
            phone: '9841111111',
            deliveryAddress: 'Thamel',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000001',
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Customer B',
            phone: '9842222222',
            deliveryAddress: 'Patan',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000001',
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      expect(checkoutRepo.customers).toHaveLength(2);
      expect(checkoutRepo.customers[0].phone).toBe('+9779841111111');
      expect(checkoutRepo.customers[1].phone).toBe('+9779842222222');
    });

    it('never merges customers with identical names but different phone numbers', async () => {
      const { app, checkoutRepo } = setupPhase1Fixture();

      // First customer named "Ram Sharma"
      await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Ram Sharma',
            phone: '9841112233',
            deliveryAddress: 'Kathmandu',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000001',
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      // Different customer also named "Ram Sharma"
      await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Ram Sharma',
            phone: '9849998877',
            deliveryAddress: 'Pokhara',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000001',
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      expect(checkoutRepo.customers).toHaveLength(2);
      expect(checkoutRepo.customers[0].id).not.toBe(
        checkoutRepo.customers[1].id,
      );
    });

    it('Customer LTV (totalSpent) excludes CANCELLED, RETURNED, and REFUNDED orders', async () => {
      const { customersRepo } = setupPhase1Fixture();
      const customerId = '30000000-0000-4000-8000-000000000001';

      customersRepo.customers.push({
        id: customerId,
        name: 'LTV Test Customer',
        phone: '+9779800000001',
        deliveryAddress: 'Kathmandu',
        email: 'ltv@test.local',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 1. Delivered order: total 1500.00 -> INCLUDED
      customersRepo.orders.push({
        id: crypto.randomUUID(),
        orderNumber: 'ORD-LTV-1',
        customerId,
        customerName: 'LTV Test Customer',
        customerPhone: '+9779800000001',
        customerEmail: 'ltv@test.local',
        deliveryAddress: 'Kathmandu',
        deliveryLatitude: null,
        deliveryLongitude: null,
        status: 'DELIVERED',
        subtotal: '1400.00',
        discountTotal: '0.00',
        deliveryFee: '100.00',
        total: '1500.00',
        promoCode: null,
        promoDiscount: '0.00',
        lookupTokenHash: 'hash',
        orderLookupToken: 'tok',
        idempotencyKey: null,
        requestFingerprint: null,
        paymentMethodCode: 'COD',
        paymentMethodName: 'Cash',
        paymentStatus: 'PAID',
        paymentReference: null,
        createdAt: new Date('2026-10-01'),
        updatedAt: new Date('2026-10-01'),
        items: [],
      });

      // 2. Pending order: total 1000.00 -> INCLUDED
      customersRepo.orders.push({
        id: crypto.randomUUID(),
        orderNumber: 'ORD-LTV-2',
        customerId,
        customerName: 'LTV Test Customer',
        customerPhone: '+9779800000001',
        customerEmail: 'ltv@test.local',
        deliveryAddress: 'Kathmandu',
        deliveryLatitude: null,
        deliveryLongitude: null,
        status: 'PENDING',
        subtotal: '900.00',
        discountTotal: '0.00',
        deliveryFee: '100.00',
        total: '1000.00',
        promoCode: null,
        promoDiscount: '0.00',
        lookupTokenHash: 'hash',
        orderLookupToken: 'tok',
        idempotencyKey: null,
        requestFingerprint: null,
        paymentMethodCode: 'COD',
        paymentMethodName: 'Cash',
        paymentStatus: 'PENDING',
        paymentReference: null,
        createdAt: new Date('2026-10-02'),
        updatedAt: new Date('2026-10-02'),
        items: [],
      });

      // 3. Cancelled order: total 5000.00 -> MUST BE EXCLUDED
      customersRepo.orders.push({
        id: crypto.randomUUID(),
        orderNumber: 'ORD-LTV-3',
        customerId,
        customerName: 'LTV Test Customer',
        customerPhone: '+9779800000001',
        customerEmail: 'ltv@test.local',
        deliveryAddress: 'Kathmandu',
        deliveryLatitude: null,
        deliveryLongitude: null,
        status: 'CANCELLED',
        subtotal: '4900.00',
        discountTotal: '0.00',
        deliveryFee: '100.00',
        total: '5000.00',
        promoCode: null,
        promoDiscount: '0.00',
        lookupTokenHash: 'hash',
        orderLookupToken: 'tok',
        idempotencyKey: null,
        requestFingerprint: null,
        paymentMethodCode: 'COD',
        paymentMethodName: 'Cash',
        paymentStatus: 'FAILED',
        paymentReference: null,
        createdAt: new Date('2026-10-03'),
        updatedAt: new Date('2026-10-03'),
        items: [],
      });

      // 4. Returned order: total 2000.00 -> MUST BE EXCLUDED
      customersRepo.orders.push({
        id: crypto.randomUUID(),
        orderNumber: 'ORD-LTV-4',
        customerId,
        customerName: 'LTV Test Customer',
        customerPhone: '+9779800000001',
        customerEmail: 'ltv@test.local',
        deliveryAddress: 'Kathmandu',
        deliveryLatitude: null,
        deliveryLongitude: null,
        status: 'RETURNED',
        subtotal: '1900.00',
        discountTotal: '0.00',
        deliveryFee: '100.00',
        total: '2000.00',
        promoCode: null,
        promoDiscount: '0.00',
        lookupTokenHash: 'hash',
        orderLookupToken: 'tok',
        idempotencyKey: null,
        requestFingerprint: null,
        paymentMethodCode: 'COD',
        paymentMethodName: 'Cash',
        paymentStatus: 'REFUNDED',
        paymentReference: null,
        createdAt: new Date('2026-10-04'),
        updatedAt: new Date('2026-10-04'),
        items: [],
      });

      // 5. Order marked REFUNDED: total 3000.00 -> MUST BE EXCLUDED
      customersRepo.orders.push({
        id: crypto.randomUUID(),
        orderNumber: 'ORD-LTV-5',
        customerId,
        customerName: 'LTV Test Customer',
        customerPhone: '+9779800000001',
        customerEmail: 'ltv@test.local',
        deliveryAddress: 'Kathmandu',
        deliveryLatitude: null,
        deliveryLongitude: null,
        status: 'DELIVERED',
        subtotal: '2900.00',
        discountTotal: '0.00',
        deliveryFee: '100.00',
        total: '3000.00',
        promoCode: null,
        promoDiscount: '0.00',
        lookupTokenHash: 'hash',
        orderLookupToken: 'tok',
        idempotencyKey: null,
        requestFingerprint: null,
        paymentMethodCode: 'STATIC_QR',
        paymentMethodName: 'QR',
        paymentStatus: 'REFUNDED',
        paymentReference: null,
        createdAt: new Date('2026-10-05'),
        updatedAt: new Date('2026-10-05'),
        items: [],
      });

      const summary = await customersRepo.getCustomerSummary(customerId);
      // Valid orders: ORD-LTV-1 (1500) + ORD-LTV-2 (1000) = 2500.00
      expect(summary.totalSpent).toBe('2500.00');
      expect(summary.orderCount).toBe(5);
      expect(summary.completedOrderCount).toBe(2);
      expect(summary.cancelledOrderCount).toBe(2); // CANCELLED + RETURNED

      const list = await customersRepo.listCustomers({ page: 1, limit: 10 });
      const customerItem = list.items.find((c) => c.id === customerId);
      expect(customerItem?.totalSpent).toBe('2500.00');
    });

    it('normalizeCustomerPhone handles various Nepal and international formats safely', () => {
      expect(normalizeCustomerPhone('+977-9841234567')).toBe('+9779841234567');
      expect(normalizeCustomerPhone('9841234567')).toBe('+9779841234567');
      expect(normalizeCustomerPhone('984-123-4567')).toBe('+9779841234567');
      expect(normalizeCustomerPhone('(977) 9841234567')).toBe('+9779841234567');
      expect(normalizeCustomerPhone('00977 9841234567')).toBe('+9779841234567');
      expect(normalizeCustomerPhone('9779841234567')).toBe('+9779841234567');
      expect(normalizeCustomerPhone('+1 (555) 123-4567')).toBe('+15551234567');
    });
  });

  describe('Phase 1 Concurrency Hardening — Customer Advisory Locking & Concurrency Protection', () => {
    it('MemoryCheckoutRepository records lock acquisition on normalized phone format', async () => {
      const { app, checkoutRepo } = setupPhase1Fixture();

      expect(checkoutRepo.acquiredLocks).toHaveLength(0);

      // Perform checkout with unnormalized format
      const res = await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Bibek Lock Test',
            phone: '984-123-4567',
            deliveryAddress: 'Sanepa, Lalitpur',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000001',
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      expect(res.status).toBe(201);
      // Verify lock was recorded using canonical normalized key
      expect(checkoutRepo.acquiredLocks).toContain(
        'liquor_customer:+9779841234567',
      );
    });

    it('serializes repeated checkouts with same normalized phone under consistent lock key', async () => {
      const { app, checkoutRepo } = setupPhase1Fixture();

      // First checkout: local 10-digit
      await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Repeat Customer',
            phone: '9841112233',
            deliveryAddress: 'Address 1',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000001',
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      // Second checkout: +977 format
      await request(app)
        .post('/api/checkout')
        .send({
          customer: {
            name: 'Repeat Customer',
            phone: '+977-984-111-2233',
            deliveryAddress: 'Address 2',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          items: [
            {
              variantId: '20000000-0000-4000-8000-000000000001',
              quantity: 1,
            },
          ],
          paymentMethodCode: 'COD',
        });

      // Both checkouts acquired the exact same canonical lock key
      const matchingLocks = checkoutRepo.acquiredLocks.filter(
        (k) => k === 'liquor_customer:+9779841112233',
      );
      expect(matchingLocks).toHaveLength(2);
      // And only 1 customer was created
      expect(checkoutRepo.customers).toHaveLength(1);
    });

    it('PrismaCheckoutRepository acquires PostgreSQL transaction advisory lock before looking up customer', async () => {
      const prismaRepo = new PrismaCheckoutRepository();

      const callOrder: string[] = [];
      let executedSql = '';
      let lockedPhoneParam = '';

      const mockTx = {
        order: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi
            .fn()
            .mockImplementation(
              async (args: { data: Record<string, unknown> }) => {
                callOrder.push('order.create');
                return {
                  id: 'order-123',
                  orderNumber: args.data.orderNumber as string,
                  customerId: args.data.customerId as string,
                  customerName: args.data.customerName as string,
                  customerPhone: args.data.customerPhone as string,
                  customerEmail: args.data.customerEmail as string | null,
                  deliveryAddress: args.data.deliveryAddress as string,
                  deliveryLatitude: null,
                  deliveryLongitude: null,
                  status: 'PENDING',
                  subtotal: new Prisma.Decimal('800.00'),
                  discountTotal: new Prisma.Decimal('0.00'),
                  deliveryFee: new Prisma.Decimal('0.00'),
                  total: new Prisma.Decimal('800.00'),
                  promoCode: null,
                  promoDiscount: new Prisma.Decimal('0.00'),
                  promoCodeId: null,
                  lookupTokenHash: 'hash',
                  idempotencyKey: null,
                  requestFingerprint: null,
                  paymentMethodCode: 'COD',
                  paymentMethodName: 'Cash',
                  paymentStatus: 'PENDING',
                  paymentReference: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  items: [],
                };
              },
            ),
        },
        productVariant: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'var-1',
            sku: 'SKU-1',
            isActive: true,
            stock: 20,
            sellingPrice: new Prisma.Decimal('800.00'),
            purchasePrice: new Prisma.Decimal('600.00'),
            product: {
              isActive: true,
              category: { isActive: true },
              brand: { isActive: true },
            },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        inventoryMovement: {
          create: vi.fn().mockResolvedValue({}),
        },
        $executeRaw: vi
          .fn()
          .mockImplementation(
            async (strings: TemplateStringsArray, ...values: unknown[]) => {
              callOrder.push('tx.$executeRaw');
              executedSql = strings.join('?');
              lockedPhoneParam = String(values[0] ?? '');
              return 1;
            },
          ),
        customer: {
          findFirst: vi.fn().mockImplementation(async () => {
            callOrder.push('customer.findFirst');
            return null; // Simulate new customer
          }),
          create: vi.fn().mockImplementation(
            async (args: {
              data: {
                name: string;
                phone: string;
                deliveryAddress: string;
                email: string | null;
              };
            }) => {
              callOrder.push('customer.create');
              return {
                id: 'new-cust-id',
                name: args.data.name,
                phone: args.data.phone,
                deliveryAddress: args.data.deliveryAddress,
                email: args.data.email,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            },
          ),
        },
      };

      const txSpy = vi
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (callback: unknown) => {
          const fn = callback as (tx: unknown) => Promise<unknown>;
          return fn(mockTx);
        });

      try {
        const orderSnapshot = await prismaRepo.createOrderWithStockDeduction({
          orderNumber: 'ORD-LOCK-TEST-1',
          customer: {
            name: 'Concurrency Test',
            phone: '984-123-9999', // Delimited phone
            deliveryAddress: 'Patan, Lalitpur',
          },
          orderLookupToken: 'test-lookup-token',
          items: [
            {
              variantId: 'var-1',
              sku: 'SKU-1',
              productName: 'Liquor',
              sizeLabel: '750ml',
              quantity: 1,
              unitPrice: '800.00',
              unitDiscount: '0.00',
              effectiveUnitPrice: '800.00',
              subtotal: '800.00',
            },
          ],
          subtotal: '800.00',
          discountTotal: '0.00',
          deliveryFee: '0.00',
          total: '800.00',
          lookupTokenHash: 'hash',
        });

        expect(orderSnapshot).toBeDefined();
        expect(orderSnapshot.customerId).toBe('new-cust-id');

        // Verify advisory lock SQL query was executed
        expect(executedSql).toContain('pg_advisory_xact_lock');
        expect(executedSql).toContain("hashtext('liquor_customer')");
        // Verify normalized phone was supplied as parameter
        expect(lockedPhoneParam).toBe('+9779841239999');

        // Verify STRICT ORDERING: $executeRaw (lock) MUST happen BEFORE customer.findFirst
        const lockIndex = callOrder.indexOf('tx.$executeRaw');
        const findIndex = callOrder.indexOf('customer.findFirst');
        const createIndex = callOrder.indexOf('customer.create');

        expect(lockIndex).toBeGreaterThanOrEqual(0);
        expect(findIndex).toBeGreaterThanOrEqual(0);
        expect(createIndex).toBeGreaterThanOrEqual(0);

        expect(lockIndex).toBeLessThan(findIndex);
        expect(findIndex).toBeLessThan(createIndex);
      } finally {
        txSpy.mockRestore();
      }
    });

    it('PrismaCheckoutRepository propagates error and aborts transaction on customer failure, triggering PostgreSQL automatic lock release', async () => {
      const prismaRepo = new PrismaCheckoutRepository();

      const mockTx = {
        order: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        productVariant: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'var-1',
            sku: 'SKU-1',
            isActive: true,
            stock: 20,
            sellingPrice: new Prisma.Decimal('800.00'),
            purchasePrice: new Prisma.Decimal('600.00'),
            product: {
              isActive: true,
              category: { isActive: true },
              brand: { isActive: true },
            },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        inventoryMovement: {
          create: vi.fn().mockResolvedValue({}),
        },
        $executeRaw: vi.fn().mockResolvedValue(1),
        customer: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi
            .fn()
            .mockRejectedValue(
              new Error('Simulated DB customer creation failure'),
            ),
        },
      };

      const txSpy = vi
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (callback: unknown) => {
          const fn = callback as (tx: unknown) => Promise<unknown>;
          return fn(mockTx);
        });

      try {
        await expect(
          prismaRepo.createOrderWithStockDeduction({
            orderNumber: 'ORD-ERR-TEST',
            customer: {
              name: 'Error Case',
              phone: '9841230000',
              deliveryAddress: 'Kathmandu',
            },
            orderLookupToken: 'test-lookup-token',
            items: [
              {
                variantId: 'var-1',
                sku: 'SKU-1',
                productName: 'Liquor',
                sizeLabel: '750ml',
                quantity: 1,
                unitPrice: '800.00',
                unitDiscount: '0.00',
                effectiveUnitPrice: '800.00',
                subtotal: '800.00',
              },
            ],
            subtotal: '800.00',
            discountTotal: '0.00',
            deliveryFee: '0.00',
            total: '800.00',
            lookupTokenHash: 'hash',
          }),
        ).rejects.toThrow('Simulated DB customer creation failure');
      } finally {
        txSpy.mockRestore();
      }
    });
  });
});
