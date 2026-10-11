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
import type { OrderSnapshot } from '../src/modules/checkout/checkout.types';
import { MemoryCustomerRepository } from '../src/modules/customers/memory-customers.repository';
import type { CustomerRecord } from '../src/modules/customers/customers.types';
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

interface CustomerTestContext {
  app: ReturnType<typeof createApp>;
  token: string;
  checkoutRepo: MemoryCheckoutRepository;
  customerRepo: MemoryCustomerRepository;
}

function setupCustomerFixture(
  permissions: string[] = ['customers.read'],
  initialOrders: OrderSnapshot[] = [],
  initialCustomers: CustomerRecord[] = [],
): CustomerTestContext {
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
        email: 'admin@liquorshop.local',
        passwordHash: 'hash',
        name: 'Admin Test',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: {
          id: roleId,
          name: 'Customer Manager Role',
          isActive: true,
          permissions,
        },
      };
    },
    async updatePassword() {},
  };

  const checkoutRepo = new MemoryCheckoutRepository([], []);
  checkoutRepo.orders = [...initialOrders];

  const customerRepo = new MemoryCustomerRepository(
    checkoutRepo,
    initialCustomers,
  );

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    catalogRepository: new TestCatalogRepo(),
    cartRepository: new MemoryCartRepository(),
    checkoutRepository: checkoutRepo,
    customerRepository: customerRepo,
  });

  const token = createAdminAccessToken(config, adminId);

  return { app, token, checkoutRepo, customerRepo };
}

describe('Admin Customer Management & Order History', () => {
  it('requires authentication for customer endpoints', async () => {
    const { app } = setupCustomerFixture(['customers.read']);

    const res = await request(app).get('/api/admin/customers');
    expect(res.status).toBe(401);
  });

  it('rejects admin lacking customers.read permission', async () => {
    const { app, token } = setupCustomerFixture(['orders.read']); // missing customers.read

    const res = await request(app)
      .get('/api/admin/customers')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns empty customer list and pagination when no customers exist', async () => {
    const { app, token } = setupCustomerFixture(['customers.read']);

    const res = await request(app)
      .get('/api/admin/customers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('lists customers with aggregated order count, total spending and latest order date', async () => {
    const customer1: CustomerRecord = {
      id: 'cust-1',
      name: 'Ram Bahadur',
      phone: '+9779841111111',
      deliveryAddress: 'Thamel, Kathmandu',
      email: 'ram@example.com',
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    };
    const customer2: CustomerRecord = {
      id: 'cust-2',
      name: 'Sita Sharma',
      phone: '+9779842222222',
      deliveryAddress: 'Patan, Lalitpur',
      email: 'sita@example.com',
      createdAt: new Date('2026-10-02T10:00:00.000Z'),
      updatedAt: new Date('2026-10-02T10:00:00.000Z'),
    };

    const order1: OrderSnapshot = {
      id: 'ord-1',
      orderNumber: 'ORD-001',
      customerId: 'cust-1',
      customerName: 'Ram Bahadur',
      customerPhone: '+9779841111111',
      customerEmail: 'ram@example.com',
      deliveryAddress: 'Thamel, Kathmandu',
      deliveryLatitude: null,
      deliveryLongitude: null,
      status: 'DELIVERED',
      subtotal: '2500.00',
      discountTotal: '0.00',
      deliveryFee: '100.00',
      total: '2600.00',
      promoCode: null,
      promoDiscount: '0.00',
      lookupTokenHash: 'secret-hash-1',
      orderLookupToken: 'secret-token-1',
      idempotencyKey: 'idemp-1',
      requestFingerprint: 'fingerprint-1',
      paymentMethodCode: 'COD',
      paymentMethodName: 'Cash on Delivery',
      paymentStatus: 'PAID',
      paymentReference: null,
      createdAt: new Date('2026-10-05T12:00:00.000Z'),
      updatedAt: new Date('2026-10-05T12:00:00.000Z'),
      items: [
        {
          id: 'item-1',
          orderId: 'ord-1',
          variantId: 'v-1',
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
    };

    const order2: OrderSnapshot = {
      id: 'ord-2',
      orderNumber: 'ORD-002',
      customerId: 'cust-1',
      customerName: 'Ram Bahadur',
      customerPhone: '+9779841111111',
      customerEmail: 'ram@example.com',
      deliveryAddress: 'Thamel, Kathmandu',
      deliveryLatitude: null,
      deliveryLongitude: null,
      status: 'CANCELLED', // Cancelled order should NOT be added to totalSpent
      subtotal: '5000.00',
      discountTotal: '0.00',
      deliveryFee: '100.00',
      total: '5100.00',
      promoCode: null,
      promoDiscount: '0.00',
      lookupTokenHash: 'secret-hash-2',
      orderLookupToken: 'secret-token-2',
      idempotencyKey: 'idemp-2',
      requestFingerprint: 'fingerprint-2',
      paymentMethodCode: 'COD',
      paymentMethodName: 'Cash on Delivery',
      paymentStatus: 'FAILED',
      paymentReference: null,
      createdAt: new Date('2026-10-08T12:00:00.000Z'),
      updatedAt: new Date('2026-10-08T12:00:00.000Z'),
      items: [],
    };

    const { app, token } = setupCustomerFixture(
      ['customers.read'],
      [order1, order2],
      [customer1, customer2],
    );

    const res = await request(app)
      .get('/api/admin/customers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(2);

    const ram = res.body.data.items.find(
      (c: { id: string }) => c.id === 'cust-1',
    );
    expect(ram).toBeDefined();
    expect(ram.orderCount).toBe(2);
    expect(ram.totalSpent).toBe('2600.00'); // excludes cancelled order of 5100.00
    expect(ram.latestOrderAt).toBe('2026-10-08T12:00:00.000Z');

    const sita = res.body.data.items.find(
      (c: { id: string }) => c.id === 'cust-2',
    );
    expect(sita).toBeDefined();
    expect(sita.orderCount).toBe(0);
    expect(sita.totalSpent).toBe('0.00');
    expect(sita.latestOrderAt).toBeNull();
  });

  it('searches customers by name, phone, or email', async () => {
    const customers: CustomerRecord[] = [
      {
        id: 'cust-1',
        name: 'Hari Prasad',
        phone: '+9779841112233',
        deliveryAddress: 'Baneshwor',
        email: 'hari@nepal.com',
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        updatedAt: new Date('2026-10-01T10:00:00.000Z'),
      },
      {
        id: 'cust-2',
        name: 'Gita Devi',
        phone: '+9779849998877',
        deliveryAddress: 'Lazimpat',
        email: 'gita@kathmandu.org',
        createdAt: new Date('2026-10-02T10:00:00.000Z'),
        updatedAt: new Date('2026-10-02T10:00:00.000Z'),
      },
    ];

    const { app, token } = setupCustomerFixture(
      ['customers.read'],
      [],
      customers,
    );

    // Search by name
    const resName = await request(app)
      .get('/api/admin/customers?search=HARI')
      .set('Authorization', `Bearer ${token}`);
    expect(resName.status).toBe(200);
    expect(resName.body.data.items).toHaveLength(1);
    expect(resName.body.data.items[0].id).toBe('cust-1');

    // Search by phone
    const resPhone = await request(app)
      .get('/api/admin/customers?search=99988')
      .set('Authorization', `Bearer ${token}`);
    expect(resPhone.status).toBe(200);
    expect(resPhone.body.data.items).toHaveLength(1);
    expect(resPhone.body.data.items[0].id).toBe('cust-2');

    // Search by email
    const resEmail = await request(app)
      .get('/api/admin/customers?search=kathmandu.org')
      .set('Authorization', `Bearer ${token}`);
    expect(resEmail.status).toBe(200);
    expect(resEmail.body.data.items).toHaveLength(1);
    expect(resEmail.body.data.items[0].id).toBe('cust-2');

    // Non-matching search
    const resNone = await request(app)
      .get('/api/admin/customers?search=nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(resNone.status).toBe(200);
    expect(resNone.body.data.items).toHaveLength(0);
  });

  it('paginates and sorts customer listings properly', async () => {
    const customers: CustomerRecord[] = [
      {
        id: 'c-1',
        name: 'Alpha Customer',
        phone: '111',
        deliveryAddress: 'Addr 1',
        email: 'alpha@test.com',
        createdAt: new Date('2026-10-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z'),
      },
      {
        id: 'c-2',
        name: 'Beta Customer',
        phone: '222',
        deliveryAddress: 'Addr 2',
        email: 'beta@test.com',
        createdAt: new Date('2026-10-02T00:00:00Z'),
        updatedAt: new Date('2026-10-02T00:00:00Z'),
      },
      {
        id: 'c-3',
        name: 'Gamma Customer',
        phone: '333',
        deliveryAddress: 'Addr 3',
        email: 'gamma@test.com',
        createdAt: new Date('2026-10-03T00:00:00Z'),
        updatedAt: new Date('2026-10-03T00:00:00Z'),
      },
    ];

    const { app, token } = setupCustomerFixture(
      ['customers.read'],
      [],
      customers,
    );

    const res = await request(app)
      .get('/api/admin/customers?page=2&limit=2&sortBy=name&sortOrder=asc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('Gamma Customer');
  });

  it('handles duplicate phone numbers across guest orders without automatically merging them', async () => {
    // Two guest orders placed with the exact same phone number, creating two separate customer records
    const customer1: CustomerRecord = {
      id: 'guest-cust-a',
      name: 'Guest A Order',
      phone: '+9779800000000',
      deliveryAddress: 'Address 1',
      email: 'a@guest.com',
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    };
    const customer2: CustomerRecord = {
      id: 'guest-cust-b',
      name: 'Guest B Order (Same Phone)',
      phone: '+9779800000000',
      deliveryAddress: 'Address 2',
      email: null,
      createdAt: new Date('2026-10-02T10:00:00.000Z'),
      updatedAt: new Date('2026-10-02T10:00:00.000Z'),
    };

    const orderA: OrderSnapshot = {
      id: 'ord-a',
      orderNumber: 'ORD-A',
      customerId: 'guest-cust-a',
      customerName: 'Guest A Order',
      customerPhone: '+9779800000000',
      customerEmail: 'a@guest.com',
      deliveryAddress: 'Address 1',
      deliveryLatitude: null,
      deliveryLongitude: null,
      status: 'DELIVERED',
      subtotal: '1000.00',
      discountTotal: '0.00',
      deliveryFee: '50.00',
      total: '1050.00',
      promoCode: null,
      promoDiscount: '0.00',
      lookupTokenHash: 'hash-a',
      orderLookupToken: 'token-a',
      idempotencyKey: null,
      requestFingerprint: null,
      paymentMethodCode: 'COD',
      paymentMethodName: 'Cash on Delivery',
      paymentStatus: 'PAID',
      paymentReference: null,
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      updatedAt: new Date('2026-10-01T10:00:00.000Z'),
      items: [],
    };

    const orderB: OrderSnapshot = {
      id: 'ord-b',
      orderNumber: 'ORD-B',
      customerId: 'guest-cust-b',
      customerName: 'Guest B Order (Same Phone)',
      customerPhone: '+9779800000000',
      customerEmail: null,
      deliveryAddress: 'Address 2',
      deliveryLatitude: null,
      deliveryLongitude: null,
      status: 'CONFIRMED',
      subtotal: '2000.00',
      discountTotal: '0.00',
      deliveryFee: '50.00',
      total: '2050.00',
      promoCode: null,
      promoDiscount: '0.00',
      lookupTokenHash: 'hash-b',
      orderLookupToken: 'token-b',
      idempotencyKey: null,
      requestFingerprint: null,
      paymentMethodCode: 'COD',
      paymentMethodName: 'Cash on Delivery',
      paymentStatus: 'PENDING',
      paymentReference: null,
      createdAt: new Date('2026-10-02T10:00:00.000Z'),
      updatedAt: new Date('2026-10-02T10:00:00.000Z'),
      items: [],
    };

    const { app, token } = setupCustomerFixture(
      ['customers.read'],
      [orderA, orderB],
      [customer1, customer2],
    );

    const searchRes = await request(app)
      .get('/api/admin/customers?search=+9779800000000')
      .set('Authorization', `Bearer ${token}`);

    expect(searchRes.status).toBe(200);
    // Both separate guest customer records must be returned without being merged
    expect(searchRes.body.data.items).toHaveLength(2);
    const ids = searchRes.body.data.items.map((c: { id: string }) => c.id);
    expect(ids).toContain('guest-cust-a');
    expect(ids).toContain('guest-cust-b');

    // Customer A only sees their own order
    const custARes = await request(app)
      .get('/api/admin/customers/guest-cust-a')
      .set('Authorization', `Bearer ${token}`);
    expect(custARes.status).toBe(200);
    expect(custARes.body.data.summary.orderCount).toBe(1);
    expect(custARes.body.data.summary.totalSpent).toBe('1050.00');

    // Customer B only sees their own order
    const custBRes = await request(app)
      .get('/api/admin/customers/guest-cust-b')
      .set('Authorization', `Bearer ${token}`);
    expect(custBRes.status).toBe(200);
    expect(custBRes.body.data.summary.orderCount).toBe(1);
    expect(custBRes.body.data.summary.totalSpent).toBe('2050.00');
  });

  it('views a customer profile with summary metrics and recent orders', async () => {
    const customer: CustomerRecord = {
      id: 'cust-profile',
      name: 'Bikash Thapa',
      phone: '+9779812345678',
      deliveryAddress: 'Dharan, Sunsari',
      email: 'bikash@example.com',
      createdAt: new Date('2026-09-01T00:00:00Z'),
      updatedAt: new Date('2026-09-01T00:00:00Z'),
    };

    const orderDelivered: OrderSnapshot = {
      id: 'ord-del',
      orderNumber: 'ORD-DEL',
      customerId: 'cust-profile',
      customerName: 'Bikash Thapa',
      customerPhone: '+9779812345678',
      customerEmail: 'bikash@example.com',
      deliveryAddress: 'Dharan, Sunsari',
      deliveryLatitude: null,
      deliveryLongitude: null,
      status: 'DELIVERED',
      subtotal: '3000.00',
      discountTotal: '0.00',
      deliveryFee: '150.00',
      total: '3150.00',
      promoCode: null,
      promoDiscount: '0.00',
      lookupTokenHash: 'hash-del',
      orderLookupToken: 'token-del',
      idempotencyKey: null,
      requestFingerprint: null,
      paymentMethodCode: 'COD',
      paymentMethodName: 'Cash on Delivery',
      paymentStatus: 'PAID',
      paymentReference: null,
      createdAt: new Date('2026-09-05T00:00:00Z'),
      updatedAt: new Date('2026-09-05T00:00:00Z'),
      items: [
        {
          id: 'i-1',
          orderId: 'ord-del',
          variantId: 'v-1',
          productName: 'Khukri Rum 750ml',
          sku: 'KR-750',
          sizeLabel: '750 ml',
          unitPrice: '1500.00',
          unitDiscount: '0.00',
          effectiveUnitPrice: '1500.00',
          quantity: 2,
          subtotal: '3000.00',
        },
      ],
    };

    const orderPending: OrderSnapshot = {
      id: 'ord-pen',
      orderNumber: 'ORD-PEN',
      customerId: 'cust-profile',
      customerName: 'Bikash Thapa',
      customerPhone: '+9779812345678',
      customerEmail: 'bikash@example.com',
      deliveryAddress: 'Dharan, Sunsari',
      deliveryLatitude: null,
      deliveryLongitude: null,
      status: 'PENDING',
      subtotal: '1500.00',
      discountTotal: '0.00',
      deliveryFee: '150.00',
      total: '1650.00',
      promoCode: null,
      promoDiscount: '0.00',
      lookupTokenHash: 'hash-pen',
      orderLookupToken: 'token-pen',
      idempotencyKey: null,
      requestFingerprint: null,
      paymentMethodCode: 'STATIC_QR',
      paymentMethodName: 'Fonepay QR',
      paymentStatus: 'PENDING',
      paymentReference: null,
      createdAt: new Date('2026-09-10T00:00:00Z'),
      updatedAt: new Date('2026-09-10T00:00:00Z'),
      items: [],
    };

    const { app, token } = setupCustomerFixture(
      ['customers.read'],
      [orderDelivered, orderPending],
      [customer],
    );

    const res = await request(app)
      .get('/api/admin/customers/cust-profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('cust-profile');
    expect(res.body.data.name).toBe('Bikash Thapa');
    expect(res.body.data.summary).toEqual({
      orderCount: 2,
      totalSpent: '4800.00',
      latestOrderAt: '2026-09-10T00:00:00.000Z',
      firstOrderAt: '2026-09-05T00:00:00.000Z',
      completedOrderCount: 1,
      pendingOrderCount: 1,
      cancelledOrderCount: 0,
    });
    expect(res.body.data.recentOrders).toHaveLength(2);
  });

  it('returns 404 when viewing non-existent customer', async () => {
    const { app, token } = setupCustomerFixture(['customers.read']);

    const res = await request(app)
      .get('/api/admin/customers/non-existent-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CUSTOMER_NOT_FOUND');
  });

  it('handles customer with empty order history properly', async () => {
    const customer: CustomerRecord = {
      id: 'cust-empty',
      name: 'No Orders Yet',
      phone: '9840000000',
      deliveryAddress: 'Kathmandu',
      email: 'empty@test.com',
      createdAt: new Date('2026-10-01T00:00:00Z'),
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    };

    const { app, token } = setupCustomerFixture(
      ['customers.read'],
      [],
      [customer],
    );

    const res = await request(app)
      .get('/api/admin/customers/cust-empty')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({
      orderCount: 0,
      totalSpent: '0.00',
      latestOrderAt: null,
      firstOrderAt: null,
      completedOrderCount: 0,
      pendingOrderCount: 0,
      cancelledOrderCount: 0,
    });
    expect(res.body.data.recentOrders).toEqual([]);
  });

  it('filters customer orders by status, paymentStatus, and date range', async () => {
    const customer: CustomerRecord = {
      id: 'cust-history',
      name: 'Filter Test',
      phone: '9841122334',
      deliveryAddress: 'Biratnagar',
      email: 'filter@test.com',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    const orderDelivered: OrderSnapshot = {
      id: 'ord-1',
      orderNumber: 'ORD-FILTER-1',
      customerId: 'cust-history',
      customerName: 'Filter Test',
      customerPhone: '9841122334',
      customerEmail: 'filter@test.com',
      deliveryAddress: 'Biratnagar',
      deliveryLatitude: null,
      deliveryLongitude: null,
      status: 'DELIVERED',
      subtotal: '1000.00',
      discountTotal: '0.00',
      deliveryFee: '0.00',
      total: '1000.00',
      promoCode: null,
      promoDiscount: '0.00',
      lookupTokenHash: 'hash-1',
      orderLookupToken: 'token-1',
      idempotencyKey: null,
      requestFingerprint: null,
      paymentMethodCode: 'COD',
      paymentMethodName: 'Cash on Delivery',
      paymentStatus: 'PAID',
      paymentReference: null,
      createdAt: new Date('2026-05-01T10:00:00Z'),
      updatedAt: new Date('2026-05-01T10:00:00Z'),
      items: [
        {
          id: 'i-1',
          orderId: 'ord-1',
          variantId: 'v-1',
          productName: 'Tuborg Beer',
          sku: 'TB-650',
          sizeLabel: '650 ml',
          unitPrice: '500.00',
          unitDiscount: '0.00',
          effectiveUnitPrice: '500.00',
          quantity: 2,
          subtotal: '1000.00',
        },
      ],
    };

    const orderPending: OrderSnapshot = {
      id: 'ord-2',
      orderNumber: 'ORD-FILTER-2',
      customerId: 'cust-history',
      customerName: 'Filter Test',
      customerPhone: '9841122334',
      customerEmail: 'filter@test.com',
      deliveryAddress: 'Biratnagar',
      deliveryLatitude: null,
      deliveryLongitude: null,
      status: 'PENDING',
      subtotal: '2000.00',
      discountTotal: '0.00',
      deliveryFee: '0.00',
      total: '2000.00',
      promoCode: null,
      promoDiscount: '0.00',
      lookupTokenHash: 'hash-2',
      orderLookupToken: 'token-2',
      idempotencyKey: null,
      requestFingerprint: null,
      paymentMethodCode: 'STATIC_QR',
      paymentMethodName: 'eSewa QR',
      paymentStatus: 'UNDER_REVIEW',
      paymentReference: null,
      createdAt: new Date('2026-06-01T10:00:00Z'),
      updatedAt: new Date('2026-06-01T10:00:00Z'),
      items: [],
    };

    const { app, token } = setupCustomerFixture(
      ['customers.read'],
      [orderDelivered, orderPending],
      [customer],
    );

    // Filter by status=DELIVERED
    const resStatus = await request(app)
      .get('/api/admin/customers/cust-history/orders?status=DELIVERED')
      .set('Authorization', `Bearer ${token}`);
    expect(resStatus.status).toBe(200);
    expect(resStatus.body.data.items).toHaveLength(1);
    expect(resStatus.body.data.items[0].orderNumber).toBe('ORD-FILTER-1');

    // Filter by paymentStatus=UNDER_REVIEW
    const resPayment = await request(app)
      .get(
        '/api/admin/customers/cust-history/orders?paymentStatus=UNDER_REVIEW',
      )
      .set('Authorization', `Bearer ${token}`);
    expect(resPayment.status).toBe(200);
    expect(resPayment.body.data.items).toHaveLength(1);
    expect(resPayment.body.data.items[0].orderNumber).toBe('ORD-FILTER-2');

    // Filter by date range (only month of May)
    const resDate = await request(app)
      .get(
        '/api/admin/customers/cust-history/orders?startDate=2026-05-01T00:00:00Z&endDate=2026-05-31T23:59:59Z',
      )
      .set('Authorization', `Bearer ${token}`);
    expect(resDate.status).toBe(200);
    expect(resDate.body.data.items).toHaveLength(1);
    expect(resDate.body.data.items[0].orderNumber).toBe('ORD-FILTER-1');

    // Reject invalid date range where startDate > endDate
    const resInvalidDate = await request(app)
      .get(
        '/api/admin/customers/cust-history/orders?startDate=2026-07-01T00:00:00Z&endDate=2026-05-01T00:00:00Z',
      )
      .set('Authorization', `Bearer ${token}`);
    expect(resInvalidDate.status).toBe(400);
    expect(resInvalidDate.body.error.code).toBe('INVALID_DATE_RANGE');
  });

  it('strictly excludes sensitive lookup tokens, hashes, idempotency keys, and fingerprints', async () => {
    const customer: CustomerRecord = {
      id: 'cust-secure',
      name: 'Security Test',
      phone: '9801122334',
      deliveryAddress: 'Pokhara',
      email: 'sec@test.com',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    const order: OrderSnapshot = {
      id: 'ord-sec',
      orderNumber: 'ORD-SEC-001',
      customerId: 'cust-secure',
      customerName: 'Security Test',
      customerPhone: '9801122334',
      customerEmail: 'sec@test.com',
      deliveryAddress: 'Pokhara',
      deliveryLatitude: null,
      deliveryLongitude: null,
      status: 'DELIVERED',
      subtotal: '1000.00',
      discountTotal: '0.00',
      deliveryFee: '0.00',
      total: '1000.00',
      promoCode: null,
      promoDiscount: '0.00',
      lookupTokenHash: 'VERY_SECRET_LOOKUP_HASH',
      orderLookupToken: 'VERY_SECRET_LOOKUP_TOKEN',
      idempotencyKey: 'VERY_SECRET_IDEMPOTENCY_KEY',
      requestFingerprint: 'VERY_SECRET_FINGERPRINT',
      paymentMethodCode: 'COD',
      paymentMethodName: 'Cash on Delivery',
      paymentStatus: 'PAID',
      paymentReference: null,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-01T10:00:00Z'),
      items: [],
    };

    const { app, token } = setupCustomerFixture(
      ['customers.read'],
      [order],
      [customer],
    );

    // 1. Check customer list response
    const listRes = await request(app)
      .get('/api/admin/customers')
      .set('Authorization', `Bearer ${token}`);
    const listJson = JSON.stringify(listRes.body);
    expect(listJson).not.toContain('VERY_SECRET_LOOKUP_HASH');
    expect(listJson).not.toContain('VERY_SECRET_LOOKUP_TOKEN');
    expect(listJson).not.toContain('VERY_SECRET_IDEMPOTENCY_KEY');
    expect(listJson).not.toContain('VERY_SECRET_FINGERPRINT');
    expect(listJson).not.toContain('lookupTokenHash');
    expect(listJson).not.toContain('idempotencyKey');

    // 2. Check customer profile detail response
    const detailRes = await request(app)
      .get('/api/admin/customers/cust-secure')
      .set('Authorization', `Bearer ${token}`);
    const detailJson = JSON.stringify(detailRes.body);
    expect(detailJson).not.toContain('VERY_SECRET_LOOKUP_HASH');
    expect(detailJson).not.toContain('VERY_SECRET_LOOKUP_TOKEN');
    expect(detailJson).not.toContain('VERY_SECRET_IDEMPOTENCY_KEY');
    expect(detailJson).not.toContain('VERY_SECRET_FINGERPRINT');
    expect(detailJson).not.toContain('lookupTokenHash');
    expect(detailJson).not.toContain('idempotencyKey');

    // 3. Check customer order history response
    const ordersRes = await request(app)
      .get('/api/admin/customers/cust-secure/orders')
      .set('Authorization', `Bearer ${token}`);
    const ordersJson = JSON.stringify(ordersRes.body);
    expect(ordersJson).not.toContain('VERY_SECRET_LOOKUP_HASH');
    expect(ordersJson).not.toContain('VERY_SECRET_LOOKUP_TOKEN');
    expect(ordersJson).not.toContain('VERY_SECRET_IDEMPOTENCY_KEY');
    expect(ordersJson).not.toContain('VERY_SECRET_FINGERPRINT');
    expect(ordersJson).not.toContain('lookupTokenHash');
    expect(ordersJson).not.toContain('idempotencyKey');
  });

  it('automatically captures customer from guest checkout and allows admin inspection', async () => {
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
          email: 'admin@liquorshop.local',
          passwordHash: 'hash',
          name: 'Admin Test',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          role: {
            id: roleId,
            name: 'Customer Manager Role',
            isActive: true,
            permissions: ['customers.read'],
          },
        };
      },
      async updatePassword() {},
    };

    const variantId = '70000000-0000-4000-8000-000000000001';
    const productId = '70000000-0000-4000-8000-000000000002';
    const categoryId = '70000000-0000-4000-8000-000000000003';
    const brandId = '70000000-0000-4000-8000-000000000004';

    const catalogRepo = new TestCatalogRepo(
      [
        {
          id: categoryId,
          name: 'Whisky',
          slug: 'whisky',
          description: null,
          imageUrl: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        {
          id: brandId,
          name: 'Signature',
          slug: 'signature',
          logoUrl: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        {
          id: productId,
          categoryId,
          brandId,
          name: 'Signature Premier',
          slug: 'signature-premier',
          description: null,
          discountType: null,
          discountValue: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: {
            id: categoryId,
            name: 'Whisky',
            slug: 'whisky',
            isActive: true,
          },
          brand: {
            id: brandId,
            name: 'Signature',
            slug: 'signature',
            isActive: true,
          },
          images: [],
          variants: [
            {
              id: variantId,
              productId,
              sku: 'SIG-750',
              sizeLabel: '750 ml',
              sizeMilliliters: 750,
              purchasePrice: '1500.00',
              sellingPrice: '2000.00',
              stock: 10,
              lowStockThreshold: 2,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ],
    );

    const checkoutRepo = new MemoryCheckoutRepository(
      [
        {
          id: variantId,
          productId,
          sku: 'SIG-750',
          sizeLabel: '750 ml',
          sizeMilliliters: 750,
          purchasePrice: '1500.00',
          sellingPrice: '2000.00',
          stock: 10,
          lowStockThreshold: 2,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: {
            id: productId,
            categoryId,
            brandId,
            name: 'Signature Premier',
            slug: 'signature-premier',
            description: null,
            discountType: null,
            discountValue: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            images: [],
            variants: [],
          },
        },
      ],
      [],
    );

    const customerRepo = new MemoryCustomerRepository(checkoutRepo);

    const app = createApp(config, async () => {}, {
      adminAuthRepository: authRepository,
      catalogRepository: catalogRepo,
      checkoutRepository: checkoutRepo,
      customerRepository: customerRepo,
    });

    const token = createAdminAccessToken(config, adminId);

    // 1. Guest user performs checkout
    const checkoutRes = await request(app)
      .post('/api/checkout')
      .send({
        customer: {
          name: 'EndToEnd Guest',
          phone: '+9779899999999',
          deliveryAddress: 'Jawalakhel, Lalitpur',
          email: 'guest.e2e@example.com',
        },
        items: [
          {
            variantId,
            quantity: 2,
          },
        ],
      });

    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.success).toBe(true);
    const orderData = checkoutRes.body.data;
    expect(orderData.orderNumber).toBeDefined();

    // 2. Admin searches for the newly created guest customer
    const listRes = await request(app)
      .get('/api/admin/customers?search=guest.e2e@example.com')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(1);
    const customer = listRes.body.data.items[0];
    expect(customer.name).toBe('EndToEnd Guest');
    expect(customer.phone).toBe('+9779899999999');
    expect(customer.orderCount).toBe(1);
    expect(customer.totalSpent).toBe('4000.00');

    // 3. Admin views customer detail profile
    const detailRes = await request(app)
      .get(`/api/admin/customers/${customer.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.name).toBe('EndToEnd Guest');
    expect(detailRes.body.data.summary.orderCount).toBe(1);
    expect(detailRes.body.data.summary.totalSpent).toBe('4000.00');
    expect(detailRes.body.data.recentOrders).toHaveLength(1);
    expect(detailRes.body.data.recentOrders[0].orderNumber).toBe(
      orderData.orderNumber,
    );

    // 4. Admin views customer order history endpoint
    const historyRes = await request(app)
      .get(`/api/admin/customers/${customer.id}/orders`)
      .set('Authorization', `Bearer ${token}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.items).toHaveLength(1);
    expect(historyRes.body.data.items[0].items[0].sku).toBe('SIG-750');
    expect(historyRes.body.data.items[0].items[0].quantity).toBe(2);
  });
});
