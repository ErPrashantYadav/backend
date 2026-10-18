import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Logger } from 'pino';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { AuditService } from '../src/modules/audit/audit.service';
import { MemoryAuditLogRepository } from '../src/modules/audit/memory-audit.repository';
import { MemoryCartRepository } from '../src/modules/cart/memory-cart.repository';
import { MemoryCheckoutRepository } from '../src/modules/checkout/memory-checkout.repository';
import { ConfigurableDeliveryFeePolicy } from '../src/modules/delivery/delivery-fee.policy';
import { RoutingDeliveryFeeEstimator } from '../src/modules/delivery/routing-delivery-fee.estimator';
import {
  MemoryGeocodingProvider,
  MemoryRoutingProvider,
} from '../src/modules/routing/memory-routing.provider';
import { RoutingService } from '../src/modules/routing/routing.service';
import { MemoryStoreSettingsRepository } from '../src/modules/store-settings/memory-store-settings.repository';
import { StoreSettingsService } from '../src/modules/store-settings/store-settings.service';
import {
  resolveEffectiveDeliveryFreeThreshold,
  type StoreSettingsRecord,
} from '../src/modules/store-settings/store-settings.types';
import type { CatalogRepository } from './test-catalog';
import { testConfig } from './helpers';

class DummyCatalogRepo {
  async listCategories() {
    return {
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
    };
  }
  async findCategory() {
    return null;
  }
  async createCategory() {
    throw new Error('Not implemented');
  }
  async updateCategory() {
    throw new Error('Not implemented');
  }
  async deleteCategory() {
    throw new Error('Not implemented');
  }
  async listBrands() {
    return {
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
    };
  }
  async findBrand() {
    return null;
  }
  async createBrand() {
    throw new Error('Not implemented');
  }
  async updateBrand() {
    throw new Error('Not implemented');
  }
  async deleteBrand() {
    throw new Error('Not implemented');
  }
  async listProducts() {
    return {
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    };
  }
  async findProductById() {
    return null;
  }
  async findProductBySlug() {
    return null;
  }
  async createProduct() {
    throw new Error('Not implemented');
  }
  async updateProduct() {
    throw new Error('Not implemented');
  }
  async deleteProduct() {
    throw new Error('Not implemented');
  }
  async listVariants() {
    return [];
  }
  async findVariantById() {
    return null;
  }
  async createVariant() {
    throw new Error('Not implemented');
  }
  async updateVariant() {
    throw new Error('Not implemented');
  }
  async deleteVariant() {
    throw new Error('Not implemented');
  }
}

function buildTestContext(settingsOverrides?: Partial<StoreSettingsRecord>) {
  const config = testConfig({
    STORE_ORIGIN_LATITUDE: 27.7172,
    STORE_ORIGIN_LONGITUDE: 85.324,
    DELIVERY_FEE_MODE: 'PER_KM',
    DELIVERY_FEE_BASE_AMOUNT: 100,
    DELIVERY_FEE_PER_KM_AMOUNT: 25,
    DELIVERY_FEE_FREE_THRESHOLD: 5000,
    DELIVERY_MAX_DISTANCE_KM: 25,
    DELIVERY_FALLBACK_AMOUNT: 0,
  });

  const adminId = '11111111-2222-4000-8000-333333333333';
  const authRepo: AdminAuthRepository = {
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
      return null;
    },
    async updatePassword() {},
  };

  const adminToken = createAdminAccessToken(config, adminId);
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
    config.CURRENCY,
    false,
    settingsRepo,
  );

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepo,
    catalogRepository: new DummyCatalogRepo() as unknown as CatalogRepository,
    cartRepository: new MemoryCartRepository(),
    checkoutRepository: new MemoryCheckoutRepository([], 100),
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
    settingsRepo,
    deliveryFeeEstimator,
    config,
  };
}

describe('Delivery Free-Threshold Precedence and Consistency', () => {
  describe('resolveEffectiveDeliveryFreeThreshold unit tests', () => {
    it('returns env fallback when hasExplicitDeliveryFeeFreeThreshold is false/falsy', () => {
      // Legacy unconfigured row with null in DB
      expect(
        resolveEffectiveDeliveryFreeThreshold(
          {
            deliveryFeeFreeThreshold: null,
            hasExplicitDeliveryFeeFreeThreshold: false,
          },
          5000,
        ),
      ).toBe(5000);

      // Legacy row with string env fallback
      expect(
        resolveEffectiveDeliveryFreeThreshold(
          {
            deliveryFeeFreeThreshold: null,
            hasExplicitDeliveryFeeFreeThreshold: false,
          },
          '3500.50',
        ),
      ).toBe(3500.5);

      // Omitting hasExplicitDeliveryFeeFreeThreshold defaults to falsy
      expect(
        resolveEffectiveDeliveryFreeThreshold(
          { deliveryFeeFreeThreshold: null },
          5000,
        ),
      ).toBe(5000);

      // If env is also null/undefined, returns null
      expect(
        resolveEffectiveDeliveryFreeThreshold(
          {
            deliveryFeeFreeThreshold: null,
            hasExplicitDeliveryFeeFreeThreshold: false,
          },
          null,
        ),
      ).toBeNull();
    });

    it('returns explicit DB threshold when hasExplicitDeliveryFeeFreeThreshold is true', () => {
      expect(
        resolveEffectiveDeliveryFreeThreshold(
          {
            deliveryFeeFreeThreshold: '7500.00',
            hasExplicitDeliveryFeeFreeThreshold: true,
          },
          5000,
        ),
      ).toBe(7500);

      expect(
        resolveEffectiveDeliveryFreeThreshold(
          {
            deliveryFeeFreeThreshold: 2500,
            hasExplicitDeliveryFeeFreeThreshold: true,
          },
          5000,
        ),
      ).toBe(2500);
    });

    it('returns null (disabled) when hasExplicitDeliveryFeeFreeThreshold is true and deliveryFeeFreeThreshold is null', () => {
      // Admin explicitly saved null to disable free delivery -> env fallback must NOT take over!
      expect(
        resolveEffectiveDeliveryFreeThreshold(
          {
            deliveryFeeFreeThreshold: null,
            hasExplicitDeliveryFeeFreeThreshold: true,
          },
          5000,
        ),
      ).toBeNull();

      expect(
        resolveEffectiveDeliveryFreeThreshold(
          {
            deliveryFeeFreeThreshold: '',
            hasExplicitDeliveryFeeFreeThreshold: true,
          },
          5000,
        ),
      ).toBeNull();
    });
  });

  describe('Scenario 1: Legacy unconfigured settings (hasExplicit=false)', () => {
    it('public settings and checkout fee both use the environment fallback threshold', async () => {
      // Initial state: deliveryFeeFreeThreshold is null, hasExplicit is false (simulating unmigrated/default state)
      const { app, deliveryFeeEstimator } = buildTestContext({
        deliveryFeeFreeThreshold: null,
        hasExplicitDeliveryFeeFreeThreshold: false,
      });

      // 1. Public settings check
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      expect(res.body.data.deliveryPricing.freeDeliveryThreshold).toBe(
        '5000.00',
      );

      // 2. Checkout fee estimation check
      // For subtotal 4000 (< 5000): incurs standard fee
      const feeBelow = await deliveryFeeEstimator.estimateFee({
        address: 'Baneshwor, Kathmandu',
        coordinates: { latitude: 27.6915, longitude: 85.342 },
        subtotal: '4000.00',
      });
      expect(Number(feeBelow.fee)).toBeGreaterThan(0);

      // For subtotal 5000 (>= 5000): qualifies for free delivery
      const feeAt = await deliveryFeeEstimator.estimateFee({
        address: 'Baneshwor, Kathmandu',
        coordinates: { latitude: 27.6915, longitude: 85.342 },
        subtotal: '5000.00',
      });
      expect(feeAt.fee).toBe('0.00');

      // For subtotal 6000 (> 5000): qualifies for free delivery
      const feeAbove = await deliveryFeeEstimator.estimateFee({
        address: 'Baneshwor, Kathmandu',
        coordinates: { latitude: 27.6915, longitude: 85.342 },
        subtotal: '6000.00',
      });
      expect(feeAbove.fee).toBe('0.00');
    });
  });

  describe('Scenario 2: Admin configures explicit numeric threshold', () => {
    it('overrides environment fallback in both public settings and checkout fee calculation', async () => {
      const { app, adminToken, deliveryFeeEstimator } = buildTestContext({
        deliveryFeeFreeThreshold: null,
        hasExplicitDeliveryFeeFreeThreshold: false,
      });

      // Admin sets explicit threshold of NPR 7500
      const updateRes = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deliveryFeeFreeThreshold: 7500,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.deliveryFeeFreeThreshold).toBe('7500.00');
      expect(updateRes.body.data.hasExplicitDeliveryFeeFreeThreshold).toBe(
        true,
      );

      // Public settings must now return 7500.00 (not 5000.00)
      const settingsRes = await request(app).get('/api/settings');
      expect(settingsRes.status).toBe(200);
      expect(settingsRes.body.data.deliveryPricing.freeDeliveryThreshold).toBe(
        '7500.00',
      );

      // Subtotal 6000: qualified under old env (5000), but now incurs fee under DB threshold (7500)
      const fee6000 = await deliveryFeeEstimator.estimateFee({
        address: 'Baneshwor, Kathmandu',
        coordinates: { latitude: 27.6915, longitude: 85.342 },
        subtotal: '6000.00',
      });
      expect(Number(fee6000.fee)).toBeGreaterThan(0);

      // Subtotal 7500: qualifies for free delivery
      const fee7500 = await deliveryFeeEstimator.estimateFee({
        address: 'Baneshwor, Kathmandu',
        coordinates: { latitude: 27.6915, longitude: 85.342 },
        subtotal: '7500.00',
      });
      expect(fee7500.fee).toBe('0.00');

      // Subtotal 8000: qualifies for free delivery
      const fee8000 = await deliveryFeeEstimator.estimateFee({
        address: 'Baneshwor, Kathmandu',
        coordinates: { latitude: 27.6915, longitude: 85.342 },
        subtotal: '8000.00',
      });
      expect(fee8000.fee).toBe('0.00');
    });
  });

  describe('Scenario 3: Admin explicitly disables free delivery (saves NULL)', () => {
    it('disables free delivery in both public settings and checkout fee calculation', async () => {
      const { app, adminToken, deliveryFeeEstimator } = buildTestContext({
        deliveryFeeFreeThreshold: null,
        hasExplicitDeliveryFeeFreeThreshold: false,
      });

      // Admin explicitly disables free delivery by passing null
      const updateRes = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deliveryFeeFreeThreshold: null,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.deliveryFeeFreeThreshold).toBeNull();
      expect(updateRes.body.data.hasExplicitDeliveryFeeFreeThreshold).toBe(
        true,
      );

      // Public settings must return null for freeDeliveryThreshold
      const settingsRes = await request(app).get('/api/settings');
      expect(settingsRes.status).toBe(200);
      expect(
        settingsRes.body.data.deliveryPricing.freeDeliveryThreshold,
      ).toBeNull();

      // Even a large subtotal of NPR 15000 must NOT get free delivery
      const feeLarge = await deliveryFeeEstimator.estimateFee({
        address: 'Baneshwor, Kathmandu',
        coordinates: { latitude: 27.6915, longitude: 85.342 },
        subtotal: '15000.00',
      });
      expect(Number(feeLarge.fee)).toBeGreaterThan(0);
    });
  });

  describe('Scenario 4: Admin resets / restores environment fallback', () => {
    it('falls back to environment threshold after hasExplicitDeliveryFeeFreeThreshold is set to false', async () => {
      const { app, adminToken, deliveryFeeEstimator } = buildTestContext({
        deliveryFeeFreeThreshold: '10000.00',
        hasExplicitDeliveryFeeFreeThreshold: true,
      });

      // Admin restores environment fallback
      const updateRes = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          hasExplicitDeliveryFeeFreeThreshold: false,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.hasExplicitDeliveryFeeFreeThreshold).toBe(
        false,
      );
      expect(updateRes.body.data.deliveryFeeFreeThreshold).toBeNull();

      // Public settings must fall back to 5000.00
      const settingsRes = await request(app).get('/api/settings');
      expect(settingsRes.status).toBe(200);
      expect(settingsRes.body.data.deliveryPricing.freeDeliveryThreshold).toBe(
        '5000.00',
      );

      // Subtotal 5000 qualifies again
      const fee5000 = await deliveryFeeEstimator.estimateFee({
        address: 'Baneshwor, Kathmandu',
        coordinates: { latitude: 27.6915, longitude: 85.342 },
        subtotal: '5000.00',
      });
      expect(fee5000.fee).toBe('0.00');
    });
  });
});
