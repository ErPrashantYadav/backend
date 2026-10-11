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
import type { OrderSnapshot } from '../src/modules/checkout/checkout.types';
import type { InventoryMovementRecord } from '../src/modules/inventory/inventory.types';
import type { MemoryVariantItem } from '../src/modules/inventory/memory-inventory.repository';
import { MemoryDashboardRepository } from '../src/modules/dashboard/memory-dashboard.repository';
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

interface DashboardTestContext {
  app: ReturnType<typeof createApp>;
  token: string;
  checkoutRepo: MemoryCheckoutRepository;
  dashboardRepo: MemoryDashboardRepository;
  variants: MemoryVariantItem[];
}

function setupDashboardFixture(
  permissions: string[] = ['dashboard.read'],
  initialOrders: OrderSnapshot[] = [],
  initialVariants: MemoryVariantItem[] = [],
): DashboardTestContext {
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
        name: 'Dashboard Admin',
        passwordHash: '$argon2id$mock-hash',
        isActive: true,
        role: {
          id: roleId,
          name: 'Dashboard Role',
          isActive: true,
          permissions,
        },
      };
    },
  };

  const token = createAdminAccessToken(config, adminId);

  const cartRepo = new MemoryCartRepository();
  const movements: InventoryMovementRecord[] = [];
  const checkoutRepo = new MemoryCheckoutRepository(
    initialVariants,
    movements,
    cartRepo,
  );
  checkoutRepo.orders = [...initialOrders];

  const dashboardRepo = new MemoryDashboardRepository(
    checkoutRepo,
    initialVariants,
    initialOrders,
  );

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    catalogRepository: new TestCatalogRepo(),
    cartRepository: cartRepo,
    checkoutRepository: checkoutRepo,
    dashboardRepository: dashboardRepo,
  });

  return {
    app,
    token,
    checkoutRepo,
    dashboardRepo,
    variants: initialVariants,
  };
}

describe('Admin Dashboard & Sales Analytics API (Task 26)', () => {
  describe('RBAC Authorization', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const { app } = setupDashboardFixture([]);
      const res = await request(app).get('/api/admin/dashboard/summary');
      expect(res.status).toBe(401);
    });

    it('rejects admins without dashboard.read permission with 403', async () => {
      const { app, token } = setupDashboardFixture(['orders.read']); // lacking dashboard.read
      const res = await request(app)
        .get('/api/admin/dashboard/summary')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('allows admins with dashboard.read permission', async () => {
      const { app, token } = setupDashboardFixture(['dashboard.read']);
      const res = await request(app)
        .get('/api/admin/dashboard/summary')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows system admins with admin.system.manage permission', async () => {
      const { app, token } = setupDashboardFixture(['admin.system.manage']);
      const res = await request(app)
        .get('/api/admin/dashboard/summary')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Empty State Handling', () => {
    it('returns clean zeroed metrics when no orders exist', async () => {
      const { app, token } = setupDashboardFixture(['dashboard.read'], []);

      // Summary / Overview
      const summaryRes = await request(app)
        .get('/api/admin/dashboard/summary')
        .set('Authorization', `Bearer ${token}`);
      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.data).toEqual({
        totalOrders: 0,
        todayOrders: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        processingOrders: 0,
        outForDeliveryOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        grossSales: '0.00',
        deliveredSales: '0.00',
        averageOrderValue: '0.00',
        paymentTotals: [],
      });

      // Sales analytics
      const salesRes = await request(app)
        .get('/api/admin/dashboard/sales')
        .set('Authorization', `Bearer ${token}`);
      expect(salesRes.status).toBe(200);
      expect(salesRes.body.data.totalOrders).toBe(0);
      expect(salesRes.body.data.totalSales).toBe('0.00');
      expect(salesRes.body.data.averageOrderValue).toBe('0.00');
      expect(salesRes.body.data.points).toEqual([]);

      // Status breakdown
      const breakdownRes = await request(app)
        .get('/api/admin/dashboard/order-status-breakdown')
        .set('Authorization', `Bearer ${token}`);
      expect(breakdownRes.status).toBe(200);
      expect(breakdownRes.body.data.totalOrders).toBe(0);
      expect(breakdownRes.body.data.breakdown).toEqual([]);

      // Top products
      const topRes = await request(app)
        .get('/api/admin/dashboard/top-products')
        .set('Authorization', `Bearer ${token}`);
      expect(topRes.status).toBe(200);
      expect(topRes.body.data).toEqual([]);
    });
  });

  describe('Populated Data & Calculations', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const mockVariants: MemoryVariantItem[] = [
      {
        id: 'var-1',
        productId: 'prod-1',
        sku: 'OD-750',
        sizeMilliliters: 750,
        sizeLabel: '750 ml',
        purchasePrice: '2000.00',
        sellingPrice: '2500.00',
        stock: 25,
        lowStockThreshold: 5,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        product: {
          id: 'prod-1',
          name: 'Old Durbar 750ml',
          slug: 'old-durbar-750ml',
          isActive: true,
          categoryId: 'cat-1',
          brandId: 'brand-1',
        },
      },
      {
        id: 'var-2',
        productId: 'prod-2',
        sku: 'JW-BL-1000',
        sizeMilliliters: 1000,
        sizeLabel: '1000 ml',
        purchasePrice: '5000.00',
        sellingPrice: '6500.00',
        stock: 3, // Low stock! (threshold 5)
        lowStockThreshold: 5,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        product: {
          id: 'prod-2',
          name: 'Johnnie Walker Black Label 1L',
          slug: 'jw-black-1l',
          isActive: true,
          categoryId: 'cat-1',
          brandId: 'brand-2',
        },
      },
      {
        id: 'var-3',
        productId: 'prod-3',
        sku: 'RUSLAN-750',
        sizeMilliliters: 750,
        sizeLabel: '750 ml',
        purchasePrice: '1000.00',
        sellingPrice: '1400.00',
        stock: 0, // Out of stock!
        lowStockThreshold: 10,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        product: {
          id: 'prod-3',
          name: 'Ruslan Vodka 750ml',
          slug: 'ruslan-vodka-750ml',
          isActive: true,
          categoryId: 'cat-2',
          brandId: 'brand-3',
        },
      },
    ];

    const mockOrders: OrderSnapshot[] = [
      // Order 1: Today, DELIVERED, PAID, 2500.00
      {
        id: 'ord-1',
        orderNumber: 'ORD-20261011-001',
        customerId: 'cust-1',
        customerName: 'Aarav Shrestha',
        customerPhone: '+977-9841000001',
        customerEmail: 'aarav@test.com',
        deliveryAddress: 'Thamel, Kathmandu',
        deliveryLatitude: null,
        deliveryLongitude: null,
        status: 'DELIVERED',
        subtotal: '2500.00',
        discountTotal: '0.00',
        deliveryFee: '0.00',
        total: '2500.00',
        promoCode: null,
        promoDiscount: '0.00',
        lookupTokenHash: 'hash-1',
        idempotencyKey: null,
        requestFingerprint: null,
        paymentMethodCode: 'COD',
        paymentMethodName: 'Cash on Delivery',
        paymentStatus: 'PAID',
        paymentReference: null,
        createdAt: now,
        updatedAt: now,
        items: [
          {
            id: 'item-1',
            orderId: 'ord-1',
            variantId: 'var-1',
            productName: 'Old Durbar 750ml',
            sku: 'OD-750',
            sizeLabel: '750 ml',
            unitPrice: '2500.00',
            unitDiscount: '0.00',
            effectiveUnitPrice: '2500.00',
            quantity: 1,
            subtotal: '2500.00',
          },
        ],
      },
      // Order 2: Yesterday, PENDING, PENDING payment, 6500.00
      {
        id: 'ord-2',
        orderNumber: 'ORD-20261010-002',
        customerId: 'cust-2',
        customerName: 'Bikash Gurung',
        customerPhone: '+977-9841000002',
        customerEmail: null,
        deliveryAddress: 'Jhamsikhel, Lalitpur',
        deliveryLatitude: null,
        deliveryLongitude: null,
        status: 'PENDING',
        subtotal: '6500.00',
        discountTotal: '0.00',
        deliveryFee: '0.00',
        total: '6500.00',
        promoCode: null,
        promoDiscount: '0.00',
        lookupTokenHash: 'hash-2',
        idempotencyKey: null,
        requestFingerprint: null,
        paymentMethodCode: 'STATIC_QR',
        paymentMethodName: 'Fonepay QR',
        paymentStatus: 'PENDING',
        paymentReference: null,
        createdAt: yesterday,
        updatedAt: yesterday,
        items: [
          {
            id: 'item-2',
            orderId: 'ord-2',
            variantId: 'var-2',
            productName: 'Johnnie Walker Black Label 1L',
            sku: 'JW-BL-1000',
            sizeLabel: '1000 ml',
            unitPrice: '6500.00',
            unitDiscount: '0.00',
            effectiveUnitPrice: '6500.00',
            quantity: 1,
            subtotal: '6500.00',
          },
        ],
      },
      // Order 3: Two days ago, CONFIRMED, PAID, 5000.00 (2x OD-750)
      {
        id: 'ord-3',
        orderNumber: 'ORD-20261009-003',
        customerId: 'cust-3',
        customerName: 'Chirag Thapa',
        customerPhone: '+977-9841000003',
        customerEmail: 'chirag@test.com',
        deliveryAddress: 'Baluwatar, Kathmandu',
        deliveryLatitude: null,
        deliveryLongitude: null,
        status: 'CONFIRMED',
        subtotal: '5000.00',
        discountTotal: '0.00',
        deliveryFee: '0.00',
        total: '5000.00',
        promoCode: null,
        promoDiscount: '0.00',
        lookupTokenHash: 'hash-3',
        idempotencyKey: null,
        requestFingerprint: null,
        paymentMethodCode: 'STATIC_QR',
        paymentMethodName: 'Fonepay QR',
        paymentStatus: 'PAID',
        paymentReference: 'REF-QR-001',
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
        items: [
          {
            id: 'item-3',
            orderId: 'ord-3',
            variantId: 'var-1',
            productName: 'Old Durbar 750ml',
            sku: 'OD-750',
            sizeLabel: '750 ml',
            unitPrice: '2500.00',
            unitDiscount: '0.00',
            effectiveUnitPrice: '2500.00',
            quantity: 2,
            subtotal: '5000.00',
          },
        ],
      },
      // Order 4: CANCELLED order, 1400.00 (Must NOT count toward grossSales)
      {
        id: 'ord-4',
        orderNumber: 'ORD-20261011-004',
        customerId: 'cust-4',
        customerName: 'Cancelled User',
        customerPhone: '+977-9841000004',
        customerEmail: null,
        deliveryAddress: 'New Road, Kathmandu',
        deliveryLatitude: null,
        deliveryLongitude: null,
        status: 'CANCELLED',
        subtotal: '1400.00',
        discountTotal: '0.00',
        deliveryFee: '0.00',
        total: '1400.00',
        promoCode: null,
        promoDiscount: '0.00',
        lookupTokenHash: 'hash-4',
        idempotencyKey: null,
        requestFingerprint: null,
        paymentMethodCode: 'COD',
        paymentMethodName: 'Cash on Delivery',
        paymentStatus: 'CANCELLED',
        paymentReference: null,
        createdAt: now,
        updatedAt: now,
        items: [
          {
            id: 'item-4',
            orderId: 'ord-4',
            variantId: 'var-3',
            productName: 'Ruslan Vodka 750ml',
            sku: 'RUSLAN-750',
            sizeLabel: '750 ml',
            unitPrice: '1400.00',
            unitDiscount: '0.00',
            effectiveUnitPrice: '1400.00',
            quantity: 1,
            subtotal: '1400.00',
          },
        ],
      },
    ];

    it('GET /summary calculates totals, counts, status breakdowns, and excludes cancelled orders from gross sales', async () => {
      const { app, token } = setupDashboardFixture(
        ['dashboard.read'],
        mockOrders,
        mockVariants,
      );

      const res = await request(app)
        .get('/api/admin/dashboard/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // 4 total orders
      expect(data.totalOrders).toBe(4);
      // 2 orders today (ord-1 and ord-4)
      expect(data.todayOrders).toBe(2);
      expect(data.pendingOrders).toBe(1);
      expect(data.confirmedOrders).toBe(1);
      expect(data.deliveredOrders).toBe(1);
      expect(data.cancelledOrders).toBe(1);

      // Gross sales = ord-1 (2500) + ord-2 (6500) + ord-3 (5000) = 14000.00 (ord-4 cancelled is excluded)
      expect(data.grossSales).toBe('14000.00');
      // Delivered sales = ord-1 = 2500.00
      expect(data.deliveredSales).toBe('2500.00');
      // Average order value = 14000 / 3 = 4666.67
      expect(data.averageOrderValue).toBe('4666.67');

      // Payment totals
      expect(data.paymentTotals).toBeDefined();
      const paidPayment = data.paymentTotals.find(
        (p: { status: string }) => p.status === 'PAID',
      );
      expect(paidPayment).toBeDefined();
      expect(paidPayment?.count).toBe(2);
      expect(paidPayment?.amount).toBe('7500.00'); // 2500 + 5000
    });

    it('GET /sales returns time-series analytics points and supports date filters', async () => {
      const { app, token } = setupDashboardFixture(
        ['dashboard.read'],
        mockOrders,
        mockVariants,
      );

      const res = await request(app)
        .get('/api/admin/dashboard/sales?groupBy=day')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.groupBy).toBe('day');
      expect(data.totalOrders).toBe(3); // 3 non-cancelled orders
      expect(data.totalSales).toBe('14000.00');
      expect(data.averageOrderValue).toBe('4666.67');
      expect(data.points.length).toBeGreaterThan(0);
    });

    it('GET /order-status-breakdown provides count and percentage per order status', async () => {
      const { app, token } = setupDashboardFixture(
        ['dashboard.read'],
        mockOrders,
        mockVariants,
      );

      const res = await request(app)
        .get('/api/admin/dashboard/order-status-breakdown')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.totalOrders).toBe(4);

      // 4 orders total: 1 DELIVERED (25%), 1 PENDING (25%), 1 CONFIRMED (25%), 1 CANCELLED (25%)
      const deliveredItem = data.breakdown.find(
        (b: { status: string }) => b.status === 'DELIVERED',
      );
      expect(deliveredItem).toBeDefined();
      expect(deliveredItem?.count).toBe(1);
      expect(deliveredItem?.totalAmount).toBe('2500.00');
      expect(deliveredItem?.percentageOfTotal).toBe('25.00');
    });

    it('GET /top-products ranks best sellers by quantitySold and excludes cancelled orders', async () => {
      const { app, token } = setupDashboardFixture(
        ['dashboard.read'],
        mockOrders,
        mockVariants,
      );

      const res = await request(app)
        .get('/api/admin/dashboard/top-products?limit=5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const list = res.body.data;
      expect(list.length).toBeGreaterThan(0);

      // OD-750 had 1 sold in ord-1 and 2 sold in ord-3 = 3 total sold
      const top = list[0];
      expect(top.variantId).toBe('var-1');
      expect(top.sku).toBe('OD-750');
      expect(top.quantitySold).toBe(3);
      expect(top.totalRevenue).toBe('7500.00');
      expect(top.currentStock).toBe(25);

      // Ruslan in ord-4 was CANCELLED, so it must NOT appear as sold
      expect(
        list.some((i: { variantId: string }) => i.variantId === 'var-3'),
      ).toBe(false);
    });

    it('GET /low-stock summarizes in-stock, low-stock, and out-of-stock variants with current thresholds', async () => {
      const { app, token } = setupDashboardFixture(
        ['dashboard.read'],
        mockOrders,
        mockVariants,
      );

      const res = await request(app)
        .get('/api/admin/dashboard/low-stock')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // 3 variants total:
      // var-1: stock 25, threshold 5 -> in stock
      // var-2: stock 3, threshold 5 -> low stock
      // var-3: stock 0, threshold 10 -> out of stock
      expect(data.totalVariants).toBe(3);
      expect(data.inStockCount).toBe(1);
      expect(data.lowStockCount).toBe(1);
      expect(data.outOfStockCount).toBe(1);

      // Items list contains out-of-stock first, then low-stock
      expect(data.items).toHaveLength(2);
      expect(data.items[0].sku).toBe('RUSLAN-750');
      expect(data.items[0].isOutOfStock).toBe(true);
      expect(data.items[1].sku).toBe('JW-BL-1000');
      expect(data.items[1].isOutOfStock).toBe(false);
    });
  });

  describe('Validation & Error Handling', () => {
    it('rejects invalid groupBy query parameter with 400', async () => {
      const { app, token } = setupDashboardFixture(['dashboard.read']);
      const res = await request(app)
        .get('/api/admin/dashboard/sales?groupBy=invalid_group')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid date formats with 400', async () => {
      const { app, token } = setupDashboardFixture(['dashboard.read']);
      const res = await request(app)
        .get('/api/admin/dashboard/sales?startDate=not-a-date')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects inverted date ranges (startDate > endDate) with 400', async () => {
      const { app, token } = setupDashboardFixture(['dashboard.read']);
      const res = await request(app)
        .get(
          '/api/admin/dashboard/sales?startDate=2026-10-15T00:00:00.000Z&endDate=2026-10-10T00:00:00.000Z',
        )
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-positive limit parameter with 400', async () => {
      const { app, token } = setupDashboardFixture(['dashboard.read']);
      const res = await request(app)
        .get('/api/admin/dashboard/top-products?limit=-5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
