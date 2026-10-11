import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { AppError } from '../src/errors/app-error';
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
import { ConfigurableDeliveryFeePolicy } from '../src/modules/delivery/delivery-fee.policy';
import { RoutingDeliveryFeeEstimator } from '../src/modules/delivery/routing-delivery-fee.estimator';
import { GoogleMapsRoutingProvider } from '../src/modules/routing/google-maps.provider';
import { MemoryRoutingProvider } from '../src/modules/routing/memory-routing.provider';
import { RoutingService } from '../src/modules/routing/routing.service';
import {
  redactSensitiveText,
  redactSensitiveUrl,
} from '../src/modules/routing/routing.types';
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
    return {
      items: this.products,
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

function createCheckoutTestHarness(options: {
  routingProvider?: MemoryRoutingProvider;
  baseAmount?: number;
  perKmAmount?: number;
  freeThreshold?: number;
  maxDistanceKm?: number;
}) {
  const variantId = '30000000-0000-4000-8000-000000000001';
  const productId = '30000000-0000-4000-8000-000000000002';

  const variant: ProductVariantRecord = {
    id: variantId,
    productId,
    sku: 'WHISKEY-750ML',
    sizeLabel: '750ml',
    costPrice: '1500.00',
    sellingPrice: '2000.00',
    stock: 50,
    lowStockThreshold: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const product: ProductRecord = {
    id: productId,
    categoryId: '30000000-0000-4000-8000-000000000003',
    brandId: '30000000-0000-4000-8000-000000000004',
    name: 'Single Malt 12YO',
    slug: 'single-malt-12yo',
    description: 'Highland Single Malt',
    discountType: 'NONE',
    discountValue: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: '30000000-0000-4000-8000-000000000003',
      name: 'Single Malt',
      slug: 'single-malt',
      isActive: true,
    },
    brand: {
      id: '30000000-0000-4000-8000-000000000004',
      name: 'Highland Spirits',
      slug: 'highland-spirits',
      isActive: true,
    },
    images: [],
    variants: [variant],
  };

  const catalogRepo = new TestCatalogRepo([product]);
  const cartRepo = new MemoryCartRepository();
  const checkoutRepo = new MemoryCheckoutRepository(
    [variant as unknown as { id: string; sku: string; stock: number }],
    [],
    cartRepo,
  );

  const routingProvider =
    options.routingProvider ??
    new MemoryRoutingProvider({
      distanceMeters: 6000, // 6 km
      durationSeconds: 1200, // 20 mins
    });

  const config = testConfig({
    DELIVERY_FEE_MODE: 'PER_KM',
    DELIVERY_FEE_BASE_AMOUNT: options.baseAmount ?? 100,
    DELIVERY_FEE_PER_KM_AMOUNT: options.perKmAmount ?? 25,
    DELIVERY_FEE_FREE_THRESHOLD: options.freeThreshold,
    DELIVERY_MAX_DISTANCE_KM: options.maxDistanceKm ?? 25,
  });

  const app = createApp(config, async () => {}, {
    catalogRepository: catalogRepo,
    cartRepository: cartRepo,
    checkoutRepository: checkoutRepo,
    routingProvider,
  });

  return {
    app,
    catalogRepo,
    cartRepo,
    checkoutRepo,
    routingProvider,
    variant,
    product,
  };
}

describe('Task 22: Google Maps Routing & Configurable Delivery Fee Foundation', () => {
  describe('Secret Redaction Utilities', () => {
    it('redacts Google Maps API key from URLs and query parameters', () => {
      const urlWithKey =
        'https://maps.googleapis.com/maps/api/distancematrix/json?origins=27.7,85.3&destinations=27.72,85.32&key=AIzaSySecretApiKey123456';
      const sanitized = redactSensitiveUrl(urlWithKey);

      expect(sanitized).not.toContain('AIzaSySecretApiKey123456');
      expect(sanitized).toContain('key=[REDACTED]');
    });

    it('redacts secret keys and occurrences from raw error messages', () => {
      const secret = 'AIzaSySecretApiKey999';
      const rawError = `Request to https://maps.googleapis.com?key=${secret} failed with code 500 for token ${secret}`;
      const sanitized = redactSensitiveText(rawError, secret);

      expect(sanitized).not.toContain(secret);
      expect(sanitized).toContain('[REDACTED]');
    });
  });

  describe('GoogleMapsRoutingProvider', () => {
    it('rejects initialization with empty or whitespace-only API key', () => {
      expect(() => new GoogleMapsRoutingProvider('')).toThrow(
        /Google Maps API key is required/,
      );
      expect(() => new GoogleMapsRoutingProvider('   ')).toThrow(
        /Google Maps API key is required/,
      );
    });

    it('returns normalized distance in meters and duration in seconds on successful API response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          rows: [
            {
              elements: [
                {
                  status: 'OK',
                  distance: { value: 7420, text: '7.4 km' },
                  duration: { value: 1350, text: '23 mins' },
                },
              ],
            },
          ],
        }),
      });

      vi.stubGlobal('fetch', mockFetch);

      const provider = new GoogleMapsRoutingProvider('mock-key-12345');
      const result = await provider.getRoute(
        { latitude: 27.7172, longitude: 85.324 },
        { latitude: 27.73, longitude: 85.34 },
      );

      expect(result.distanceMeters).toBe(7420);
      expect(result.durationSeconds).toBe(1350);

      vi.unstubAllGlobals();
    });

    it('handles ZERO_RESULTS / NOT_FOUND by throwing ROUTE_NOT_FOUND (404)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          rows: [
            {
              elements: [
                {
                  status: 'ZERO_RESULTS',
                },
              ],
            },
          ],
        }),
      });

      vi.stubGlobal('fetch', mockFetch);

      const provider = new GoogleMapsRoutingProvider('mock-key-12345');
      await expect(
        provider.getRoute(
          { latitude: 27.7172, longitude: 85.324 },
          { latitude: 27.9, longitude: 86.5 },
        ),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 404,
          code: 'ROUTE_NOT_FOUND',
        }),
      );

      vi.unstubAllGlobals();
    });

    it('handles OVER_QUERY_LIMIT with 429 ROUTING_RATE_LIMITED', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OVER_QUERY_LIMIT',
          error_message: 'Daily quota reached',
        }),
      });

      vi.stubGlobal('fetch', mockFetch);

      const provider = new GoogleMapsRoutingProvider('mock-key-12345');
      await expect(
        provider.getRoute(
          { latitude: 27.7172, longitude: 85.324 },
          { latitude: 27.72, longitude: 85.33 },
        ),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 429,
          code: 'ROUTING_RATE_LIMITED',
        }),
      );

      vi.unstubAllGlobals();
    });

    it('handles provider timeout by throwing 504 ROUTING_TIMEOUT', async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      vi.stubGlobal('fetch', mockFetch);

      const provider = new GoogleMapsRoutingProvider('mock-key-12345', 100);
      await expect(
        provider.getRoute(
          { latitude: 27.7172, longitude: 85.324 },
          { latitude: 27.72, longitude: 85.33 },
        ),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 504,
          code: 'ROUTING_TIMEOUT',
        }),
      );

      vi.unstubAllGlobals();
    });
  });

  describe('RoutingService Validation & Bounds', () => {
    const memoryProvider = new MemoryRoutingProvider({
      distanceMeters: 4500,
      durationSeconds: 900,
    });

    const storeOrigin = { latitude: 27.7172, longitude: 85.324 };

    it('validates coordinates: rejects NaN, Infinity, and out-of-range latitude/longitude', async () => {
      const service = new RoutingService(memoryProvider, storeOrigin, 25);

      // Invalid latitude
      await expect(
        service.calculateRoute(storeOrigin, { latitude: 95, longitude: 85.32 }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: 'INVALID_COORDINATES',
        }),
      );

      // Invalid longitude
      await expect(
        service.calculateRoute(storeOrigin, { latitude: 27.7, longitude: 185 }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: 'INVALID_COORDINATES',
        }),
      );

      // Non-finite
      await expect(
        service.calculateRoute(storeOrigin, {
          latitude: Number.NaN,
          longitude: 85.32,
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: 'INVALID_COORDINATES',
        }),
      );
    });

    it('enforces geographic service bounds when configured', async () => {
      // Kathmandu Valley bounding box
      const service = new RoutingService(memoryProvider, storeOrigin, 30, {
        minLatitude: 27.55,
        maxLatitude: 27.85,
        minLongitude: 85.15,
        maxLongitude: 85.55,
      });

      // Inside valley
      const inside = await service.calculateRoute(storeOrigin, {
        latitude: 27.7,
        longitude: 85.3,
      });
      expect(inside.distanceMeters).toBe(4500);

      // Outside valley (e.g. Pokhara: lat 28.2, lng 83.9)
      await expect(
        service.calculateRoute(storeOrigin, {
          latitude: 28.2,
          longitude: 83.98,
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: 'OUT_OF_SERVICE_AREA',
        }),
      );
    });

    it('enforces maximum serviceable distance radius limit', async () => {
      const farProvider = new MemoryRoutingProvider({
        distanceMeters: 32_000, // 32 km
        durationSeconds: 3600,
      });

      const service = new RoutingService(farProvider, storeOrigin, 25);

      await expect(
        service.calculateRoute(storeOrigin, {
          latitude: 27.6,
          longitude: 85.2,
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: 'MAX_DISTANCE_EXCEEDED',
        }),
      );
    });
  });

  describe('ConfigurableDeliveryFeePolicy', () => {
    it('calculates PER_KM distance-based delivery fee accurately with 2 decimal rounding', () => {
      const policy = new ConfigurableDeliveryFeePolicy({
        mode: 'PER_KM',
        baseAmount: 100, // NPR 100 base
        perKmAmount: 25, // NPR 25 per km
        maxDistanceKm: 25,
      });

      // 4.5 km -> 100 + 4.5 * 25 = 100 + 112.5 = 212.50
      const result = policy.calculate({
        distanceMeters: 4500,
        subtotal: '2500.00',
      });

      expect(result.fee).toBe('212.50');
      expect(result.currency).toBe('NPR');
      expect(result.isFreeDelivery).toBe(false);
      expect(result.breakdown.distanceKm).toBe('4.50');
      expect(result.breakdown.distanceFee).toBe('112.50');
    });

    it('calculates FIXED delivery fee regardless of distance', () => {
      const policy = new ConfigurableDeliveryFeePolicy({
        mode: 'FIXED',
        baseAmount: 150,
        perKmAmount: 0,
        maxDistanceKm: 25,
      });

      const result = policy.calculate({
        distanceMeters: 12000,
        subtotal: '3000.00',
      });

      expect(result.fee).toBe('150.00');
    });

    it('calculates TIERED distance delivery fee bands', () => {
      const policy = new ConfigurableDeliveryFeePolicy({
        mode: 'TIERED',
        baseAmount: 100,
        perKmAmount: 0,
        maxDistanceKm: 25,
      });

      // <= 5 km: base = 100
      expect(
        policy.calculate({ distanceMeters: 3000, subtotal: '1000.00' }).fee,
      ).toBe('100.00');

      // 5-15 km: base + 100 = 200
      expect(
        policy.calculate({ distanceMeters: 8000, subtotal: '1000.00' }).fee,
      ).toBe('200.00');

      // > 15 km: base + 250 = 350
      expect(
        policy.calculate({ distanceMeters: 18000, subtotal: '1000.00' }).fee,
      ).toBe('350.00');
    });

    it('applies free delivery when subtotal meets or exceeds freeDeliveryThreshold', () => {
      const policy = new ConfigurableDeliveryFeePolicy({
        mode: 'PER_KM',
        baseAmount: 100,
        perKmAmount: 25,
        freeDeliveryThreshold: 5000,
        maxDistanceKm: 25,
      });

      // Subtotal 4999.00 -> not free
      const nonFree = policy.calculate({
        distanceMeters: 6000,
        subtotal: '4999.00',
      });
      expect(nonFree.fee).toBe('250.00'); // 100 + 6*25
      expect(nonFree.isFreeDelivery).toBe(false);

      // Subtotal 5000.00 -> free!
      const free = policy.calculate({
        distanceMeters: 6000,
        subtotal: '5000.00',
      });
      expect(free.fee).toBe('0.00');
      expect(free.isFreeDelivery).toBe(true);
    });

    it('falls back to fallbackAmount when coordinates/distance are omitted', () => {
      const policy = new ConfigurableDeliveryFeePolicy({
        mode: 'PER_KM',
        baseAmount: 100,
        perKmAmount: 25,
        maxDistanceKm: 25,
        fallbackAmount: 75,
      });

      const result = policy.calculate({
        distanceMeters: undefined,
        subtotal: '2000.00',
      });

      expect(result.fee).toBe('75.00');
    });

    it('documents unresolved delivery policy decisions in result breakdown', () => {
      const policy = new ConfigurableDeliveryFeePolicy({
        mode: 'PER_KM',
        baseAmount: 100,
        perKmAmount: 25,
        maxDistanceKm: 25,
      });

      const result = policy.calculate({
        distanceMeters: 3000,
        subtotal: '1500.00',
      });

      expect(result.breakdown.unresolvedPolicyNotes).toBeDefined();
      expect(result.breakdown.unresolvedPolicyNotes?.length).toBeGreaterThan(0);
      expect(result.breakdown.unresolvedPolicyNotes?.join(' ')).toContain(
        'Free delivery threshold',
      );
    });
  });

  describe('RoutingDeliveryFeeEstimator', () => {
    it('throws COORDINATES_REQUIRED when requireCoordinates=true and no coordinates passed', async () => {
      const routingProvider = new MemoryRoutingProvider();
      const service = new RoutingService(routingProvider);
      const policy = new ConfigurableDeliveryFeePolicy({
        mode: 'PER_KM',
        baseAmount: 100,
        perKmAmount: 25,
        maxDistanceKm: 25,
      });

      const estimator = new RoutingDeliveryFeeEstimator(
        service,
        policy,
        'NPR',
        true, // requireCoordinates
      );

      await expect(
        estimator.estimateFee({
          address: 'Thamel, Kathmandu',
          coordinates: undefined,
          subtotal: '1000.00',
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          code: 'COORDINATES_REQUIRED',
        }),
      );
    });
  });

  describe('Checkout Integration & Total Decimal Reconciliation', () => {
    it('calculates server-side delivery fee and strictly reconciles subtotal + deliveryFee - discountTotal = total', async () => {
      const memoryRouting = new MemoryRoutingProvider({
        distanceMeters: 8000, // 8 km
        durationSeconds: 1500,
      });

      // Base 100 + 8 km * 25 = 300.00 delivery fee
      const harness = createCheckoutTestHarness({
        routingProvider: memoryRouting,
        baseAmount: 100,
        perKmAmount: 25,
      });

      const customer = {
        name: 'Hari Sharma',
        phone: '+977-9801234567',
        deliveryAddress: 'Jawalakhel, Lalitpur',
        coordinates: { latitude: 27.67, longitude: 85.31 },
      };

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 2 }],
          customer,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const order = res.body.data;

      // 2 bottles @ 2000.00 = 4000.00 subtotal, 0 discount, 300.00 delivery fee -> 4300.00 total
      expect(order.subtotal).toBe('4000.00');
      expect(order.discountTotal).toBe('0.00');
      expect(order.deliveryFee).toBe('300.00');
      expect(order.total).toBe('4300.00');

      // Stored snapshot preserves destination coordinates
      expect(order.deliveryLatitude).toBe('27.67');
      expect(order.deliveryLongitude).toBe('85.31');
    });

    it('ignores client-submitted delivery fees and calculates trusted fee on the server', async () => {
      const memoryRouting = new MemoryRoutingProvider({
        distanceMeters: 4000, // 4 km
        durationSeconds: 900,
      });

      // Base 100 + 4 km * 25 = 200.00 delivery fee
      const harness = createCheckoutTestHarness({
        routingProvider: memoryRouting,
        baseAmount: 100,
        perKmAmount: 25,
      });

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Client Hacker',
            phone: '+977-9812345678',
            deliveryAddress: 'Lazimpat, Kathmandu',
            coordinates: { latitude: 27.72, longitude: 85.32 },
          },
          // Malicious client tries to spoof zero fee or override total
          deliveryFee: '0.00',
          total: '2000.00',
        })
        .expect(201);

      const order = res.body.data;
      // Server must calculate 200.00 delivery fee, NOT trust client's 0.00!
      expect(order.deliveryFee).toBe('200.00');
      expect(order.total).toBe('2200.00');
    });

    it('enforces idempotency and prevents duplicate routing provider calls on retry', async () => {
      const memoryRouting = new MemoryRoutingProvider({
        distanceMeters: 5000,
        durationSeconds: 1000,
      });

      const harness = createCheckoutTestHarness({
        routingProvider: memoryRouting,
        baseAmount: 100,
        perKmAmount: 25,
      });

      const idempotencyKey = 'task22-idempotent-test-key-001';
      const checkoutPayload = {
        idempotencyKey,
        items: [{ variantId: harness.variant.id, quantity: 1 }],
        customer: {
          name: 'Sita Devi',
          phone: '+977-9851234567',
          deliveryAddress: 'Baluwatar, Kathmandu',
          coordinates: { latitude: 27.73, longitude: 85.33 },
        },
      };

      // Initial checkout call
      const res1 = await request(harness.app)
        .post('/api/checkout')
        .send(checkoutPayload)
        .expect(201);

      expect(res1.body.data.orderNumber).toBeDefined();
      expect(memoryRouting.callCount).toBe(1);

      // Retry with identical idempotencyKey
      const res2 = await request(harness.app)
        .post('/api/checkout')
        .send(checkoutPayload)
        .expect(201);

      expect(res2.body.data.orderNumber).toBe(res1.body.data.orderNumber);

      // Verify routing provider call count was NOT incremented on idempotent retry!
      expect(memoryRouting.callCount).toBe(1);
    });

    it('rejects checkout when destination exceeds maximum serviceable delivery radius', async () => {
      const memoryRouting = new MemoryRoutingProvider({
        distanceMeters: 28_000, // 28 km (> 25 km max)
        durationSeconds: 3600,
      });

      const harness = createCheckoutTestHarness({
        routingProvider: memoryRouting,
        maxDistanceKm: 25,
      });

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Far Customer',
            phone: '+977-9800000000',
            deliveryAddress: 'Dhulikhel, Kavrepalanchok',
            coordinates: { latitude: 27.62, longitude: 85.55 },
          },
        })
        .expect(400);

      expect(res.body.error.code).toBe('MAX_DISTANCE_EXCEEDED');
      expect(res.body.error.message).toContain('exceeds maximum');
    });

    it('handles routing provider downtime safely with 502 error and never leaks API keys', async () => {
      const failingRouting = new MemoryRoutingProvider();
      const secretKey = 'AIzaSySecretLeakPreventionTestKey';
      failingRouting.setSimulatedError(
        new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          `Failed request with key=${secretKey}`,
        ),
      );

      const harness = createCheckoutTestHarness({
        routingProvider: failingRouting,
      });

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Customer During Downtime',
            phone: '+977-9844444444',
            deliveryAddress: 'Thamel, Kathmandu',
            coordinates: { latitude: 27.71, longitude: 85.31 },
          },
        })
        .expect(502);

      expect(res.body.error.code).toBe('ROUTING_PROVIDER_ERROR');
      // Verify raw API key is never leaked to response
      expect(JSON.stringify(res.body)).not.toContain(secretKey);
    });
  });
});
