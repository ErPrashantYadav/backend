import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Logger } from 'pino';
import { createApp } from '../src/app';
import { AppError } from '../src/errors/app-error';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { AuditService } from '../src/modules/audit/audit.service';
import { MemoryAuditLogRepository } from '../src/modules/audit/memory-audit.repository';
import { MemoryCartRepository } from '../src/modules/cart/memory-cart.repository';
import type {
  BrandRecord,
  CatalogRepository,
  CategoryRecord,
  PageResult,
  ProductImageRecord,
  ProductRecord,
  ProductVariantRecord,
} from './test-catalog';
import { MemoryCheckoutRepository } from '../src/modules/checkout/memory-checkout.repository';
import type { MemoryVariantItem } from '../src/modules/inventory/memory-inventory.repository';
import { ConfigurableDeliveryFeePolicy } from '../src/modules/delivery/delivery-fee.policy';
import { RoutingDeliveryFeeEstimator } from '../src/modules/delivery/routing-delivery-fee.estimator';
import {
  MemoryGeocodingProvider,
  MemoryRoutingProvider,
} from '../src/modules/routing/memory-routing.provider';
import { RoutingService } from '../src/modules/routing/routing.service';
import { MemoryStoreSettingsRepository } from '../src/modules/store-settings/memory-store-settings.repository';
import { StoreSettingsService } from '../src/modules/store-settings/store-settings.service';
import type {
  DaySchedule,
  StoreSettingsRecord,
} from '../src/modules/store-settings/store-settings.types';
import { isStoreOpenAt } from '../src/utils/business-hours';
import { testConfig } from './helpers';

class TestCatalogRepo implements CatalogRepository {
  products: ProductRecord[] = [];
  categories: CategoryRecord[] = [];
  brands: BrandRecord[] = [];

  constructor(products: ProductRecord[]) {
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
    throw new Error('Not implemented');
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
  async createBrand(): Promise<BrandRecord> {
    throw new Error('Not implemented');
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
}

interface TestHarness {
  app: ReturnType<typeof createApp>;
  adminToken: string;
  readOnlyToken: string;
  settingsRepo: MemoryStoreSettingsRepository;
  routingProvider: MemoryRoutingProvider;
  geocodingProvider: MemoryGeocodingProvider;
  routingService: RoutingService;
  storeSettingsService: StoreSettingsService;
  variantId: string;
  variantSellingPrice: string;
}

function setupPhase2Harness(
  settingsOverrides?: Partial<StoreSettingsRecord>,
): TestHarness {
  const adminId = '11111111-2222-4000-8000-333333333333';
  const readOnlyAdminId = '22222222-3333-4000-8000-444444444444';
  const config = testConfig({
    STORE_ORIGIN_LATITUDE: 27.7172,
    STORE_ORIGIN_LONGITUDE: 85.324,
    DELIVERY_FEE_MODE: 'PER_KM',
    DELIVERY_FEE_BASE_AMOUNT: 100,
    DELIVERY_FEE_PER_KM_AMOUNT: 25,
    DELIVERY_MAX_DISTANCE_KM: 25,
    DELIVERY_FALLBACK_AMOUNT: 0,
  });

  const authRepository: AdminAuthRepository = {
    async findByEmail() {
      return null;
    },
    async findById(id) {
      if (id === adminId) {
        return {
          id: adminId,
          email: 'admin@liquorshop.local',
          passwordHash: 'hash',
          name: 'Super Admin',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          role: {
            id: 'role-admin',
            name: 'Admin',
            isActive: true,
            permissions: ['settings.read', 'settings.update'],
          },
        };
      }
      if (id === readOnlyAdminId) {
        return {
          id: readOnlyAdminId,
          email: 'readonly@liquorshop.local',
          passwordHash: 'hash',
          name: 'Viewer Admin',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          role: {
            id: 'role-viewer',
            name: 'Viewer',
            isActive: true,
            permissions: ['settings.read'],
          },
        };
      }
      return null;
    },
    async updatePassword() {},
  };

  const adminToken = createAdminAccessToken(config, adminId);
  const readOnlyToken = createAdminAccessToken(config, readOnlyAdminId);

  const settingsRepo = new MemoryStoreSettingsRepository(
    settingsOverrides,
    config,
  );
  const auditRepo = new MemoryAuditLogRepository();
  const auditService = new AuditService(auditRepo, {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  } as unknown as Logger);
  const storeSettingsService = new StoreSettingsService(
    settingsRepo,
    auditService,
    config,
  );

  const routingProvider = new MemoryRoutingProvider();
  const geocodingProvider = new MemoryGeocodingProvider();

  const routingService = new RoutingService(
    routingProvider,
    {
      latitude: config.STORE_ORIGIN_LATITUDE,
      longitude: config.STORE_ORIGIN_LONGITUDE,
    },
    config.DELIVERY_MAX_DISTANCE_KM,
  );

  const deliveryFeePolicy = new ConfigurableDeliveryFeePolicy({
    mode: config.DELIVERY_FEE_MODE,
    baseAmount: config.DELIVERY_FEE_BASE_AMOUNT,
    perKmAmount: config.DELIVERY_FEE_PER_KM_AMOUNT,
    freeDeliveryThreshold: config.DELIVERY_FEE_FREE_THRESHOLD,
    maxDistanceKm: config.DELIVERY_MAX_DISTANCE_KM,
    fallbackAmount: config.DELIVERY_FALLBACK_AMOUNT,
  });

  const deliveryFeeEstimator = new RoutingDeliveryFeeEstimator(
    routingService,
    deliveryFeePolicy,
    'NPR',
    false,
    settingsRepo,
  );

  const variantId = '55555555-6666-4000-8000-777777777777';
  const variantSellingPrice = '1200.00';
  const memoryVariants = [
    {
      id: variantId,
      productId: '44444444-5555-4000-8000-666666666666',
      sku: 'TEST-WHISKY-750',
      sizeLabel: '750ml',
      sizeMilliliters: 750,
      purchasePrice: '900.00',
      sellingPrice: variantSellingPrice,
      stock: 50,
      lowStockThreshold: 5,
      isActive: true,
      product: {
        id: '44444444-5555-4000-8000-666666666666',
        name: 'Highland Park 12',
        slug: 'highland-park-12',
        isActive: true,
      },
    },
  ];

  const product: ProductRecord = {
    id: '44444444-5555-4000-8000-666666666666',
    categoryId: '33333333-4444-4000-8000-555555555555',
    brandId: '22222222-3333-4000-8000-444444444444',
    name: 'Highland Park 12',
    slug: 'highland-park-12',
    description: null,
    discountType: null,
    discountValue: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: '33333333-4444-4000-8000-555555555555',
      name: 'Whisky',
      slug: 'whisky',
      isActive: true,
    },
    brand: {
      id: '22222222-3333-4000-8000-444444444444',
      name: 'Highland Park',
      slug: 'highland-park',
      isActive: true,
    },
    images: [],
    variants: memoryVariants as unknown as ProductVariantRecord[],
  };

  const cartRepo = new MemoryCartRepository();
  const checkoutRepo = new MemoryCheckoutRepository(
    memoryVariants as unknown as MemoryVariantItem[],
    [],
    cartRepo,
  );
  const catalogRepo = new TestCatalogRepo([product]);

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    catalogRepository: catalogRepo,
    cartRepository: cartRepo,
    checkoutRepository: checkoutRepo,
    storeSettingsRepository: settingsRepo,
    storeSettingsService,
    routingProvider,
    geocodingProvider,
    routingService,
    deliveryFeeEstimator,
  });

  return {
    app,
    adminToken,
    readOnlyToken,
    settingsRepo,
    routingProvider,
    geocodingProvider,
    routingService,
    storeSettingsService,
    variantId,
    variantSellingPrice,
  };
}

describe('Phase 2 — Delivery Pricing, GPS Checkout, Ordering Switch, Business Hours', () => {
  describe('Task 1 — Store Location in Admin Settings', () => {
    it('validates and updates store origin coordinates via admin endpoint', async () => {
      const harness = setupPhase2Harness();

      const updateRes = await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({
          storeOriginLatitude: 27.700769,
          storeOriginLongitude: 85.30014,
        })
        .expect(200);

      expect(updateRes.body.success).toBe(true);
      expect(Number(updateRes.body.data.storeOriginLatitude)).toBeCloseTo(
        27.700769,
        5,
      );
      expect(Number(updateRes.body.data.storeOriginLongitude)).toBeCloseTo(
        85.30014,
        5,
      );

      const publicRes = await request(harness.app)
        .get('/api/store-settings')
        .expect(200);

      expect(Number(publicRes.body.data.storeOriginLatitude)).toBeCloseTo(
        27.700769,
        5,
      );
      expect(Number(publicRes.body.data.storeOriginLongitude)).toBeCloseTo(
        85.30014,
        5,
      );

      // Clearing coordinates with null falls back cleanly to environment coordinates
      const clearRes = await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({
          storeOriginLatitude: null,
          storeOriginLongitude: null,
        })
        .expect(200);

      expect(clearRes.body.data.storeOriginLatitude).toBeNull();
      expect(clearRes.body.data.storeOriginLongitude).toBeNull();

      const publicAfterClear = await request(harness.app)
        .get('/api/store-settings')
        .expect(200);

      expect(publicAfterClear.body.data.storeOriginLatitude).toBe(27.7172);
      expect(publicAfterClear.body.data.storeOriginLongitude).toBe(85.324);
    });

    it('rejects invalid or out-of-range origin coordinates with 400 VALIDATION_ERROR', async () => {
      const harness = setupPhase2Harness();

      // Latitude > 90
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ storeOriginLatitude: 95.0 })
        .expect(400);

      // Latitude < -90
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ storeOriginLatitude: -95.0 })
        .expect(400);

      // Longitude > 180
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ storeOriginLongitude: 185.0 })
        .expect(400);

      // Longitude < -180
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ storeOriginLongitude: -185.0 })
        .expect(400);

      // Non-numeric
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ storeOriginLatitude: 'invalid-coord' })
        .expect(400);
    });

    it('enforces RBAC on store location updates (401 unauthenticated, 403 unauthorized)', async () => {
      const harness = setupPhase2Harness();

      // 401 Unauthenticated
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .send({ storeOriginLatitude: 27.71 })
        .expect(401);

      // 403 Forbidden without settings.update permission
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.readOnlyToken}`)
        .send({ storeOriginLatitude: 27.71 })
        .expect(403);
    });

    it('updates delivery calculation origin dynamically without server restart', async () => {
      const harness = setupPhase2Harness();

      // Update origin to Patan Durbar Square
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({
          storeOriginLatitude: 27.6727,
          storeOriginLongitude: 85.3253,
        })
        .expect(200);

      // Configure mock route distance from new origin
      harness.routingProvider.setRoute(
        { latitude: 27.6727, longitude: 85.3253 },
        { latitude: 27.675, longitude: 85.33 },
        { distanceMeters: 2000, durationSeconds: 300 },
      );

      // Checkout using coordinates near the new origin
      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Patan Customer',
            phone: '+977-9841234567',
            coordinates: { latitude: 27.675, longitude: 85.33 },
          },
        })
        .expect(201);

      // 2km distance in PER_KM mode: 100 base + 2 * 25 = 150
      expect(checkoutRes.body.data.deliveryFee).toBe('150.00');
    });

    it('does not expose internal secrets or Google Maps API key on public or admin responses', async () => {
      const harness = setupPhase2Harness();

      const publicRes = await request(harness.app)
        .get('/api/store-settings')
        .expect(200);

      expect(JSON.stringify(publicRes.body)).not.toContain('API_KEY');
      expect(JSON.stringify(publicRes.body)).not.toContain('GOOGLE_MAPS');

      const adminRes = await request(harness.app)
        .get('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .expect(200);

      expect(JSON.stringify(adminRes.body)).not.toContain('API_KEY');
      expect(JSON.stringify(adminRes.body)).not.toContain('GOOGLE_MAPS');
    });
  });

  describe('Task 2 — Admin-Managed Delivery Fee Settings', () => {
    it('manages fee mode, baseAmount, perKmAmount, freeDeliveryThreshold, and maxDistanceKm', async () => {
      const harness = setupPhase2Harness();

      const updateRes = await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({
          deliveryFeeMode: 'FIXED',
          deliveryFeeBaseAmount: 150,
          deliveryFeeFreeThreshold: 5000,
          deliveryMaxDistanceKm: 30,
          deliveryFallbackAmount: 120,
        })
        .expect(200);

      expect(updateRes.body.data.deliveryFeeMode).toBe('FIXED');
      expect(updateRes.body.data.deliveryFeeBaseAmount).toBe('150.00');
      expect(updateRes.body.data.deliveryFeeFreeThreshold).toBe('5000.00');
      expect(updateRes.body.data.deliveryMaxDistanceKm).toBe('30.00');
      expect(updateRes.body.data.deliveryFallbackAmount).toBe('120.00');

      const publicRes = await request(harness.app)
        .get('/api/store-settings')
        .expect(200);

      expect(publicRes.body.data.deliveryPricing).toEqual({
        mode: 'FIXED',
        baseAmount: '150.00',
        perKmAmount: '25.00',
        freeDeliveryThreshold: '5000.00',
        maxDistanceKm: '30.00',
        fallbackAmount: '120.00',
      });
    });

    it('allows disabling free delivery by setting freeDeliveryThreshold to null', async () => {
      const harness = setupPhase2Harness();

      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({
          deliveryFeeFreeThreshold: null,
        })
        .expect(200);

      const publicRes = await request(harness.app)
        .get('/api/store-settings')
        .expect(200);

      expect(
        publicRes.body.data.deliveryPricing.freeDeliveryThreshold,
      ).toBeNull();
    });

    it('rejects invalid modes and negative amounts with 400 VALIDATION_ERROR', async () => {
      const harness = setupPhase2Harness();

      // Invalid mode
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ deliveryFeeMode: 'HOURLY' })
        .expect(400);

      // Negative baseAmount
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ deliveryFeeBaseAmount: -50 })
        .expect(400);

      // Negative perKmAmount
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ deliveryFeePerKmAmount: -10 })
        .expect(400);

      // Negative max distance
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ deliveryMaxDistanceKm: 0 })
        .expect(400);
    });

    it('applies FIXED fee mode calculation on checkout dynamically', async () => {
      const harness = setupPhase2Harness();

      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({
          deliveryFeeMode: 'FIXED',
          deliveryFeeBaseAmount: 200,
        })
        .expect(200);

      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Fixed Fee Buyer',
            phone: '+977-9841234567',
            coordinates: { latitude: 27.715, longitude: 85.31 },
          },
        })
        .expect(201);

      expect(checkoutRes.body.data.deliveryFee).toBe('200.00');
      // Subtotal 1200 + 200 fee = 1400.00
      expect(checkoutRes.body.data.total).toBe('1400.00');
    });

    it('applies free delivery when subtotal meets or exceeds threshold', async () => {
      const harness = setupPhase2Harness();

      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({
          deliveryFeeMode: 'FIXED',
          deliveryFeeBaseAmount: 150,
          deliveryFeeFreeThreshold: 2000,
        })
        .expect(200);

      // 1. Order below threshold (1 item = 1200 < 2000) -> incurs fee
      const res1 = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Small Buyer',
            phone: '+977-9841111111',
            coordinates: { latitude: 27.715, longitude: 85.31 },
          },
        })
        .expect(201);

      expect(res1.body.data.deliveryFee).toBe('150.00');

      // 2. Order meeting threshold (2 items = 2400 >= 2000) -> free delivery!
      const res2 = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 2 }],
          customer: {
            name: 'Big Buyer',
            phone: '+977-9842222222',
            coordinates: { latitude: 27.715, longitude: 85.31 },
          },
        })
        .expect(201);

      expect(res2.body.data.deliveryFee).toBe('0.00');
      expect(res2.body.data.total).toBe('2400.00');
    });

    it('strictly enforces maxDistanceKm and rejects locations beyond delivery radius', async () => {
      const harness = setupPhase2Harness();

      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({
          deliveryMaxDistanceKm: 15,
        })
        .expect(200);

      // Configure a far destination that calculates to 20km (20,000m)
      const farCoords = { latitude: 27.5, longitude: 85.1 };
      harness.routingProvider.setRoute(
        { latitude: 27.7172, longitude: 85.324 },
        farCoords,
        { distanceMeters: 20000, durationSeconds: 2400 },
      );

      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Far Buyer',
            phone: '+977-9843333333',
            coordinates: farCoords,
          },
        })
        .expect(400);

      expect(checkoutRes.body.error.code).toBe('MAX_DISTANCE_EXCEEDED');
      expect(checkoutRes.body.error.message).toContain('15 km');
    });
  });

  describe('Task 3 — GPS-Based Guest Checkout', () => {
    it('rejects guest checkout with 400 COORDINATES_REQUIRED when coordinates are omitted', async () => {
      const harness = setupPhase2Harness();

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'No GPS Customer',
            phone: '+977-9841234567',
            deliveryAddress: 'Thamel, Kathmandu',
          },
        })
        .expect(400);

      expect(res.body.error.code).toBe('COORDINATES_REQUIRED');
      expect(res.body.error.message).toContain('coordinates');
    });

    it('rejects invalid or non-finite coordinates with 400 INVALID_COORDINATES', async () => {
      const harness = setupPhase2Harness();

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Bad GPS Customer',
            phone: '+977-9841234567',
            coordinates: { latitude: 120, longitude: 85.324 },
          },
        })
        .expect(400);

      expect(res.body.error.code).toBe('INVALID_COORDINATES');
    });

    it('derives verified address from reverse geocoding when deliveryAddress is omitted by guest', async () => {
      const harness = setupPhase2Harness();

      harness.geocodingProvider.setAddress(
        { latitude: 27.715, longitude: 85.31 },
        'Durbar Marg, Ward 1, Kathmandu 44600, Nepal',
      );

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Derived Address Guest',
            phone: '+977-9841234567',
            coordinates: { latitude: 27.715, longitude: 85.31 },
            // deliveryAddress omitted!
          },
        })
        .expect(201);

      expect(res.body.data.deliveryAddress).toBe(
        'Durbar Marg, Ward 1, Kathmandu 44600, Nepal',
      );
    });

    it('preserves user manual delivery address notes when typed address is provided', async () => {
      const harness = setupPhase2Harness();

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Manual Address Guest',
            phone: '+977-9841234567',
            deliveryAddress: 'Apartment 4B, Silver Heights, Lazimpat',
            coordinates: { latitude: 27.715, longitude: 85.31 },
          },
        })
        .expect(201);

      expect(res.body.data.deliveryAddress).toBe(
        'Apartment 4B, Silver Heights, Lazimpat',
      );
    });

    it('returns 400 GEOCODING_FAILED when coordinates cannot be reverse geocoded', async () => {
      const harness = setupPhase2Harness();

      harness.geocodingProvider.setSimulatedError(
        new AppError(404, 'GEOCODING_FAILED', 'Address not found'),
      );

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Failed Geocode Guest',
            phone: '+977-9841234567',
            coordinates: { latitude: 27.715, longitude: 85.31 },
          },
        })
        .expect(400);

      expect(res.body.error.code).toBe('GEOCODING_FAILED');
      expect(res.body.error.message).toContain(
        'Unable to verify delivery address',
      );
    });

    it('returns 503 GEOCODING_UNAVAILABLE when geocoding service is unconfigured or downstream error', async () => {
      const harness = setupPhase2Harness();

      harness.geocodingProvider.setUnconfigured();

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Downstream Geocode Guest',
            phone: '+977-9841234567',
            coordinates: { latitude: 27.715, longitude: 85.31 },
          },
        })
        .expect(503);

      expect(res.body.error.code).toBe('GEOCODING_UNAVAILABLE');
    });
  });

  describe('Task 4 — Ordering Enable/Disable Switch', () => {
    it('pauses ordering and rejects new checkouts with 400 ORDERING_PAUSED', async () => {
      const harness = setupPhase2Harness();

      // Admin pauses ordering with custom toast message
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({
          isOrderingEnabled: false,
          orderingMessage:
            'Online ordering is paused for annual stock audit. We reopen at 10 AM tomorrow.',
        })
        .expect(200);

      // Verify public settings exposes paused status
      const publicRes = await request(harness.app)
        .get('/api/store-settings')
        .expect(200);

      expect(publicRes.body.data.isOrderingEnabled).toBe(false);
      expect(publicRes.body.data.orderingMessage).toBe(
        'Online ordering is paused for annual stock audit. We reopen at 10 AM tomorrow.',
      );

      // Attempt checkout -> rejected with ORDERING_PAUSED
      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Blocked Guest',
            phone: '+977-9841234567',
            coordinates: { latitude: 27.715, longitude: 85.31 },
          },
        })
        .expect(400);

      expect(checkoutRes.body.error.code).toBe('ORDERING_PAUSED');
      expect(checkoutRes.body.error.message).toContain('annual stock audit');
    });

    it('allows existing orders to be retrieved even when ordering is paused', async () => {
      const harness = setupPhase2Harness();

      // 1. Create order while open
      const initialRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Prior Customer',
            phone: '+977-9841234567',
            coordinates: { latitude: 27.715, longitude: 85.31 },
          },
        })
        .expect(201);

      const orderNumber = initialRes.body.data.orderNumber;
      const orderToken = initialRes.body.data.orderLookupToken;

      // 2. Pause ordering
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ isOrderingEnabled: false })
        .expect(200);

      // 3. Existing order lookup succeeds
      const lookupRes = await request(harness.app)
        .get(`/api/orders/${orderNumber}`)
        .set('x-order-token', orderToken)
        .expect(200);

      expect(lookupRes.body.data.orderNumber).toBe(orderNumber);
    });

    it('resumes accepting orders immediately when re-enabled', async () => {
      const harness = setupPhase2Harness({ isOrderingEnabled: false });

      // Re-enable
      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ isOrderingEnabled: true, orderingMessage: null })
        .expect(200);

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Resumed Customer',
            phone: '+977-9841234567',
            coordinates: { latitude: 27.715, longitude: 85.31 },
          },
        })
        .expect(201);

      expect(res.body.success).toBe(true);
    });
  });

  describe('Task 5 — Weekly Business Hours & Overnight Windows', () => {
    it('supports standard daytime window (10:00 to 22:00) with inclusive open and exclusive close', () => {
      const hours: DaySchedule[] = [
        { day: 'MONDAY', isOpen: true, openTime: '10:00', closeTime: '22:00' },
      ];

      // Monday 10:00:00 -> OPEN (inclusive)
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-12T10:00:00+05:45'),
        ),
      ).toBe(true);

      // Monday 15:30:00 -> OPEN
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-12T15:30:00+05:45'),
        ),
      ).toBe(true);

      // Monday 21:59:00 -> OPEN
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-12T21:59:00+05:45'),
        ),
      ).toBe(true);

      // Monday 22:00:00 -> CLOSED (exclusive boundary)
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-12T22:00:00+05:45'),
        ),
      ).toBe(false);

      // Monday 09:59:00 -> CLOSED
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-12T09:59:00+05:45'),
        ),
      ).toBe(false);
    });

    it('supports overnight operating windows (22:00 to 02:00) with midnight spillover', () => {
      const hours: DaySchedule[] = [
        { day: 'FRIDAY', isOpen: true, openTime: '22:00', closeTime: '02:00' },
        {
          day: 'SATURDAY',
          isOpen: true,
          openTime: '22:00',
          closeTime: '02:00',
        },
      ];

      // Friday 22:00 -> OPEN (inclusive start)
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-16T22:00:00+05:45'),
        ),
      ).toBe(true);

      // Friday 23:45 -> OPEN
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-16T23:45:00+05:45'),
        ),
      ).toBe(true);

      // Saturday 00:30 (next morning, spillover from Friday night) -> OPEN
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-17T00:30:00+05:45'),
        ),
      ).toBe(true);

      // Saturday 01:59 (still before Friday's 02:00 closing) -> OPEN
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-17T01:59:00+05:45'),
        ),
      ).toBe(true);

      // Saturday 02:00 -> CLOSED (exclusive closing boundary)
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-17T02:00:00+05:45'),
        ),
      ).toBe(false);

      // Saturday 03:00 -> CLOSED
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-17T03:00:00+05:45'),
        ),
      ).toBe(false);

      // Saturday 21:00 -> CLOSED (before Saturday night's 22:00 open)
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-17T21:00:00+05:45'),
        ),
      ).toBe(false);

      // Saturday 22:00 -> OPEN (Saturday window opens)
      expect(
        isStoreOpenAt(
          hours,
          'Asia/Kathmandu',
          new Date('2026-10-17T22:00:00+05:45'),
        ),
      ).toBe(true);
    });

    it('rejects ambiguous identical open and close times (e.g. 10:00 to 10:00) with 400 VALIDATION_ERROR', async () => {
      const harness = setupPhase2Harness();

      const invalidHours = [
        { day: 'MONDAY', isOpen: true, openTime: '10:00', closeTime: '10:00' },
      ];

      await request(harness.app)
        .patch('/api/admin/store-settings')
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ businessHours: invalidHours })
        .expect(400);
    });

    it('rejects checkout with 400 STORE_CLOSED when store is closed on that day or outside hours', async () => {
      // Store closed all days
      const closedSchedule: DaySchedule[] = [
        { day: 'MONDAY', isOpen: false },
        { day: 'TUESDAY', isOpen: false },
        { day: 'WEDNESDAY', isOpen: false },
        { day: 'THURSDAY', isOpen: false },
        { day: 'FRIDAY', isOpen: false },
        { day: 'SATURDAY', isOpen: false },
        { day: 'SUNDAY', isOpen: false },
      ];

      const harness = setupPhase2Harness({
        businessHours: closedSchedule,
      });

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variantId, quantity: 1 }],
          customer: {
            name: 'Closed Time Buyer',
            phone: '+977-9841234567',
            coordinates: { latitude: 27.715, longitude: 85.31 },
          },
        })
        .expect(400);

      expect(res.body.error.code).toBe('STORE_CLOSED');
      expect(res.body.error.message).toContain('Store is currently closed');
    });
  });
});
