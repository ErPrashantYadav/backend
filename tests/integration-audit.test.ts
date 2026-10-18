import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { ADMIN_SYSTEM_PERMISSION } from '../src/modules/admin-management/admin-management.types';
import { MemoryAuditLogRepository } from '../src/modules/audit/memory-audit.repository';
import { MemoryBannerRepository } from '../src/modules/banners/memory-banners.repository';
import { MemoryCartRepository } from '../src/modules/cart/memory-cart.repository';
import { MemoryCheckoutRepository } from '../src/modules/checkout/memory-checkout.repository';
import { MemoryCustomerRepository } from '../src/modules/customers/memory-customers.repository';
import { MemoryDashboardRepository } from '../src/modules/dashboard/memory-dashboard.repository';
import { ConfigurableDeliveryFeePolicy } from '../src/modules/delivery/delivery-fee.policy';
import { RoutingDeliveryFeeEstimator } from '../src/modules/delivery/routing-delivery-fee.estimator';
import { MemoryGalleryRepository } from '../src/modules/gallery/memory-gallery.repository';
import { MemoryNotificationOutboxRepository } from '../src/modules/notifications/memory-notification-outbox.repository';
import { MemoryPaymentMethodRepository } from '../src/modules/payment-method/memory-payment-method.repository';
import { MemoryPaymentSubmissionRepository } from '../src/modules/payment-submission/memory-payment-submission.repository';
import { MemoryPromoCodeRepository } from '../src/modules/promo-code/memory-promo-code.repository';
import { MemoryRoutingProvider } from '../src/modules/routing/memory-routing.provider';
import { RoutingService } from '../src/modules/routing/routing.service';
import { MemorySocialMediaRepository } from '../src/modules/social-media/memory-social-media.repository';
import { MemoryStoreSettingsRepository } from '../src/modules/store-settings/memory-store-settings.repository';
import { testConfig } from './helpers';
import type {
  BrandRecord,
  CatalogRepository,
  CategoryRecord,
  ProductDetailRecord,
  ProductImageRecord,
  ProductImageWriteInput,
  ProductRecord,
  ProductVariantRecord,
  ProductVariantWriteInput,
  ProductWriteInput,
} from './test-catalog';

class MemoryIntegrationCatalogRepository implements CatalogRepository {
  categories: CategoryRecord[] = [];
  brands: BrandRecord[] = [];
  products: ProductRecord[] = [];
  variants: ProductVariantRecord[] = [];
  images: ProductImageRecord[] = [];
  private nextId = 100;

  private id(): string {
    this.nextId += 1;
    return `90000000-0000-4000-8000-${this.nextId.toString().padStart(12, '0')}`;
  }

  async listCategories() {
    return {
      items: this.categories.sort((a, b) => a.displayOrder - b.displayOrder),
      pagination: {
        page: 1,
        pageSize: 50,
        total: this.categories.length,
        totalPages: 1,
      },
    };
  }

  async findCategory(id: string) {
    return this.categories.find((c) => c.id === id) ?? null;
  }

  async createCategory(
    input: Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    const row: CategoryRecord = {
      ...input,
      id: this.id(),
      displayOrder: input.displayOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.categories.push(row);
    return row;
  }

  async updateCategory(
    id: string,
    input: Partial<Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ) {
    const row = this.categories.find((c) => c.id === id);
    if (!row) throw new Error('Category not found');
    Object.assign(row, input, { updatedAt: new Date() });
    return row;
  }

  async deleteCategory(id: string) {
    this.categories = this.categories.filter((c) => c.id !== id);
  }

  async listBrands() {
    return {
      items: this.brands.sort((a, b) => a.displayOrder - b.displayOrder),
      pagination: {
        page: 1,
        pageSize: 50,
        total: this.brands.length,
        totalPages: 1,
      },
    };
  }

  async findBrand(id: string) {
    return this.brands.find((b) => b.id === id) ?? null;
  }

  async createBrand(
    input: Omit<BrandRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    const row: BrandRecord = {
      ...input,
      id: this.id(),
      displayOrder: input.displayOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.brands.push(row);
    return row;
  }

  async updateBrand(
    id: string,
    input: Partial<Omit<BrandRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ) {
    const row = this.brands.find((b) => b.id === id);
    if (!row) throw new Error('Brand not found');
    Object.assign(row, input, { updatedAt: new Date() });
    return row;
  }

  async deleteBrand(id: string) {
    this.brands = this.brands.filter((b) => b.id !== id);
  }

  async reorderBrands(items: Array<{ id: string; displayOrder: number }>) {
    for (const item of items) {
      const b = this.brands.find((x) => x.id === item.id);
      if (b) {
        b.displayOrder = item.displayOrder;
        b.updatedAt = new Date();
      }
    }
  }

  async listProducts() {
    return {
      items: this.products.map((p) => ({
        ...p,
        category:
          this.categories.find((c) => c.id === p.categoryId) || p.category,
        brand: this.brands.find((b) => b.id === p.brandId) || p.brand,
        variants: this.variants.filter((v) => v.productId === p.id),
        images: this.images.filter((img) => img.productId === p.id),
      })),
      pagination: {
        page: 1,
        pageSize: 50,
        total: this.products.length,
        totalPages: 1,
      },
    };
  }

  async findProduct(id: string): Promise<ProductDetailRecord | null> {
    const p = this.products.find((prod) => prod.id === id || prod.slug === id);
    if (!p) return null;
    return {
      ...p,
      variants: this.variants.filter((v) => v.productId === p.id),
      images: this.images.filter((img) => img.productId === p.id),
    };
  }

  async createProduct(input: ProductWriteInput): Promise<ProductRecord> {
    const cat = this.categories.find((c) => c.id === input.categoryId);
    const brand = this.brands.find((b) => b.id === input.brandId);
    const row: ProductRecord = {
      ...input,
      id: this.id(),
      description: input.description ?? null,
      category: cat
        ? { id: cat.id, name: cat.name, slug: cat.slug }
        : undefined,
      brand: brand
        ? { id: brand.id, name: brand.name, slug: brand.slug }
        : undefined,
      images: [],
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.products.push(row);
    return row;
  }

  async updateProduct(id: string, input: Partial<ProductWriteInput>) {
    const row = this.products.find((p) => p.id === id);
    if (!row) throw new Error('Product not found');
    Object.assign(row, input, { updatedAt: new Date() });
    return row;
  }

  async deleteProduct(id: string) {
    this.products = this.products.filter((p) => p.id !== id);
  }

  async addProductVariant(productId: string, input: ProductVariantWriteInput) {
    const p = this.products.find((prod) => prod.id === productId);
    const row: ProductVariantRecord = {
      ...input,
      id: this.id(),
      productId,
      sizeMilliliters: 750,
      sizeLabel: input.size ?? '750 ml',
      product: p
        ? { id: p.id, name: p.name, slug: p.slug, isActive: p.isActive }
        : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.variants.push(row);
    return row;
  }

  async updateProductVariant(
    productId: string,
    variantId: string,
    input: Partial<ProductVariantWriteInput>,
  ) {
    const row = this.variants.find(
      (v) => v.id === variantId && v.productId === productId,
    );
    if (!row) throw new Error('Variant not found');
    Object.assign(row, input, { updatedAt: new Date() });
    return row;
  }

  async deactivateProductVariant(productId: string, variantId: string) {
    const row = this.variants.find(
      (v) => v.id === variantId && v.productId === productId,
    );
    if (row) row.isActive = false;
  }

  async addProductImages(productId: string, images: ProductImageWriteInput[]) {
    const created: ProductImageRecord[] = images.map((img, i) => ({
      ...img,
      id: this.id(),
      productId,
      sortOrder: i,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    this.images.push(...created);
    return created;
  }

  async deleteProductImage(productId: string, imageId: string) {
    this.images = this.images.filter(
      (img) => !(img.id === imageId && img.productId === productId),
    );
  }
}

function createIntegrationFixture() {
  const config = testConfig();
  const catalogRepo = new MemoryIntegrationCatalogRepository();
  const cartRepo = new MemoryCartRepository();
  const checkoutRepo = new MemoryCheckoutRepository(
    catalogRepo.variants,
    [],
    cartRepo,
  );
  const auditRepo = new MemoryAuditLogRepository();
  const outboxRepo = new MemoryNotificationOutboxRepository();
  const paymentRepo = new MemoryPaymentMethodRepository([
    {
      id: '80000000-0000-4000-8000-000000000001',
      code: 'CASH_ON_DELIVERY',
      name: 'Cash on Delivery',
      type: 'OFFLINE_MANUAL',
      instructions: 'Pay cash to the driver',
      qrImageUrl: null,
      accountDetails: null,
      displayOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  const submissionRepo = new MemoryPaymentSubmissionRepository(
    checkoutRepo,
    [],
    auditRepo,
  );
  const promoRepo = new MemoryPromoCodeRepository();
  const dashboardRepo = new MemoryDashboardRepository(checkoutRepo);
  const customerRepo = new MemoryCustomerRepository(checkoutRepo);
  const bannerRepo = new MemoryBannerRepository();
  const galleryRepo = new MemoryGalleryRepository();
  const socialRepo = new MemorySocialMediaRepository();
  const storeSettingsRepo = new MemoryStoreSettingsRepository();
  const routingProvider = new MemoryRoutingProvider({
    distanceMeters: 5000,
    durationSeconds: 600,
  });
  const routingService = new RoutingService(
    routingProvider,
    { latitude: 27.7172, longitude: 85.324 },
    30,
  );
  const deliveryPolicy = new ConfigurableDeliveryFeePolicy({
    mode: 'FIXED',
    baseAmount: 100,
    perKmAmount: 0,
    maxDistanceKm: 25,
    fallbackAmount: 100,
  });
  const deliveryEstimator = new RoutingDeliveryFeeEstimator(
    routingService,
    deliveryPolicy,
  );

  const adminId = '90000000-0000-4000-8000-000000000001';
  const roleId = '90000000-0000-4000-8000-000000000002';

  const authRepository: AdminAuthRepository = {
    async findByEmail() {
      return null;
    },
    async findById(id: string) {
      if (id !== adminId) return null;
      return {
        id: adminId,
        email: 'superadmin@liquor.test',
        name: 'Super Admin',
        passwordHash: 'dummy',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: {
          id: roleId,
          name: 'SUPER_ADMIN',
          isActive: true,
          permissions: [ADMIN_SYSTEM_PERMISSION],
        },
      };
    },
    async updatePassword() {},
  };

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    categoryRepository: catalogRepo,
    brandRepository: catalogRepo,
    productRepository: catalogRepo,
    catalogRepository: catalogRepo,
    cartRepository: cartRepo,
    checkoutRepository: checkoutRepo,
    auditRepository: auditRepo,
    notificationOutboxRepository: outboxRepo,
    paymentMethodRepository: paymentRepo,
    paymentSubmissionRepository: submissionRepo,
    promoCodeRepository: promoRepo,
    dashboardRepository: dashboardRepo,
    customerRepository: customerRepo,
    bannerRepository: bannerRepo,
    galleryRepository: galleryRepo,
    socialMediaRepository: socialRepo,
    storeSettingsRepository: storeSettingsRepo,
    routingProvider,
    routingService,
    deliveryFeePolicy: deliveryPolicy,
    deliveryFeeEstimator: deliveryEstimator,
  });

  const token = createAdminAccessToken(config, adminId);

  return {
    app,
    token,
    catalogRepo,
    cartRepo,
    checkoutRepo,
    promoRepo,
    bannerRepo,
    galleryRepo,
    socialRepo,
  };
}

describe('Task 34 — Final Backend Integration Check', () => {
  describe('Drag-and-Drop Ordering Restrictions Matrix', () => {
    it('allows reordering Brands (PUT /api/admin/brands/reorder)', async () => {
      const { app, token, catalogRepo } = createIntegrationFixture();
      const b1 = await catalogRepo.createBrand({
        name: 'Brand 1',
        slug: 'brand-1',
        displayOrder: 0,
        isActive: true,
      });
      const b2 = await catalogRepo.createBrand({
        name: 'Brand 2',
        slug: 'brand-2',
        displayOrder: 1,
        isActive: true,
      });

      const res = await request(app)
        .put('/api/admin/brands/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { id: b2.id, displayOrder: 0 },
            { id: b1.id, displayOrder: 1 },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows reordering Banners (PUT /api/admin/banners/reorder)', async () => {
      const { app, token, bannerRepo } = createIntegrationFixture();
      const ban1 = await bannerRepo.create({
        title: 'Banner 1',
        imageUrl: 'https://cdn.test/b1.jpg',
        displayOrder: 0,
        isActive: true,
      });
      const ban2 = await bannerRepo.create({
        title: 'Banner 2',
        imageUrl: 'https://cdn.test/b2.jpg',
        displayOrder: 1,
        isActive: true,
      });

      const res = await request(app)
        .put('/api/admin/banners/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { id: ban2.id, displayOrder: 0 },
            { id: ban1.id, displayOrder: 1 },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('strictly forbids Categories reorder endpoint (returns 404)', async () => {
      const { app, token } = createIntegrationFixture();
      const res = await request(app)
        .put('/api/admin/categories/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [] });
      expect(res.status).toBe(404);
    });

    it('strictly forbids Gallery reorder endpoint (returns 404)', async () => {
      const { app, token } = createIntegrationFixture();
      const res = await request(app)
        .put('/api/admin/gallery/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [] });
      expect(res.status).toBe(404);
    });

    it('strictly forbids Social Media reorder endpoint (returns 404)', async () => {
      const { app, token } = createIntegrationFixture();
      const res = await request(app)
        .put('/api/admin/social-media/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [] });
      expect(res.status).toBe(404);
    });

    it('strictly forbids Products reorder endpoint (returns 404)', async () => {
      const { app, token } = createIntegrationFixture();
      const res = await request(app)
        .put('/api/admin/products/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [] });
      expect(res.status).toBe(404);
    });
  });

  describe('End-to-End Cross-Module Customer, Order, Checkout, and Inventory Flow', () => {
    it('executes catalog creation -> cart -> promo -> checkout -> payment -> fulfillment seamlessly', async () => {
      const { app, token, catalogRepo, promoRepo } = createIntegrationFixture();

      // 1. Create Category and Brand
      const cat = await catalogRepo.createCategory({
        name: 'Single Malt Whiskey',
        slug: 'single-malt-whiskey',
        description: 'Premium whiskey collection',
        isActive: true,
      });

      const brand = await catalogRepo.createBrand({
        name: 'Macallan',
        slug: 'macallan',
        description: 'Speyside single malt',
        isActive: true,
      });

      // 2. Create Product and Variant
      const product = await catalogRepo.createProduct({
        name: 'Macallan 12 Year Double Cask',
        slug: 'macallan-12-year-double-cask',
        categoryId: cat.id,
        brandId: brand.id,
        description: 'Honey, citrus and ginger flavors',
        discountType: 'PERCENTAGE',
        discountValue: '10.00',
        isActive: true,
      });

      const variant = await catalogRepo.addProductVariant(product.id, {
        sku: 'MAC-12-750ML',
        size: '750 ml',
        purchasePrice: '400.00',
        sellingPrice: '500.00',
        stock: 50,
        lowStockThreshold: 5,
        isActive: true,
      });

      // 3. Create Promo Code
      await promoRepo.create({
        code: 'WELCOME10',
        description: 'Flat 10 dollars off for welcome orders',
        discountType: 'FIXED',
        discountValue: '10.00',
        minOrderAmount: '50.00',
        maxDiscountAmount: null,
        usageLimit: 100,
        usedCount: 0,
        isActive: true,
        startDate: null,
        endDate: null,
      });

      // 4. Cart flow
      const cartInitRes = await request(app).get('/api/cart');
      expect(cartInitRes.status).toBe(200);
      const cartId = cartInitRes.headers['x-cart-id'];
      expect(cartId).toBeDefined();

      const addRes = await request(app)
        .post('/api/cart/items')
        .set('x-cart-id', cartId)
        .send({
          variantId: variant.id,
          quantity: 2,
        });
      expect(addRes.status).toBe(200);

      // 5. Checkout flow with promo code and delivery
      const checkoutRes = await request(app)
        .post('/api/checkout')
        .set('x-cart-id', cartId)
        .send({
          customer: {
            name: 'Prakash Sharma',
            phone: '9841234567',
            email: 'prakash@example.test',
            deliveryAddress: 'Thamel, Kathmandu, Nepal',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
          paymentMethodCode: 'CASH_ON_DELIVERY',
          promoCode: 'WELCOME10',
        });
      expect(checkoutRes.status).toBe(201);
      const orderData = checkoutRes.body.data;
      expect(orderData.orderNumber).toBeDefined();
      expect(orderData.customerName).toBe('Prakash Sharma');
      expect(orderData.customerPhone).toBe('9841234567');
      expect(orderData.orderLookupToken).toBeDefined();

      // Check stock deduction
      expect(variant.stock).toBe(48); // 50 - 2 = 48

      // Check order summary pricing:
      // Selling price 500 * 2 = subtotal 1000.00
      // 10% product discount = 100.00 off + Promo discount 10.00 off -> discountTotal 110.00
      // Delivery fee: flat 100.00
      // Total: 1000 - 110 + 100 = 990.00
      expect(Number(orderData.subtotal)).toBe(1000);
      expect(Number(orderData.discountTotal)).toBe(110);
      expect(Number(orderData.deliveryFee)).toBe(100);
      expect(Number(orderData.total)).toBe(990);

      // 6. Public Order Lookup with Order Token
      const lookupRes = await request(app).get(
        `/api/orders/${orderData.orderNumber}?token=${orderData.orderLookupToken}`,
      );
      expect(lookupRes.status).toBe(200);
      expect(lookupRes.body.data.orderNumber).toBe(orderData.orderNumber);
      expect(lookupRes.body.data.customer.name).toBe('Prakash Sharma');

      // 7. Admin Customer Inspection
      const adminCustRes = await request(app)
        .get('/api/admin/customers')
        .set('Authorization', `Bearer ${token}`)
        .query({ search: '9841234567' });
      expect(adminCustRes.status).toBe(200);
      expect(adminCustRes.body.data.items.length).toBeGreaterThan(0);
      expect(adminCustRes.body.data.items[0].phone).toBe('+9779841234567');

      // 8. Admin Dashboard Summary reflects order
      const dashRes = await request(app)
        .get('/api/admin/dashboard/summary')
        .set('Authorization', `Bearer ${token}`);
      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data.totalOrders).toBe(1);
    });
  });
});
