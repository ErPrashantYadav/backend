import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
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
import { MemoryPaymentMethodRepository } from '../src/modules/payment-method/memory-payment-method.repository';
import type { ManagedPaymentMethod } from '../src/modules/payment-method/payment-method.types';
import { MemoryPaymentSubmissionRepository } from '../src/modules/payment-submission/memory-payment-submission.repository';
import { MemoryAuditLogRepository } from '../src/modules/audit/memory-audit.repository';
import { MemoryOrderManagementRepository } from '../src/modules/order-management/memory-order-management.repository';
import { sanitizeAuditMetadata } from '../src/modules/audit/audit.service';
import { testConfig } from './helpers';

class TestCatalogRepo implements CatalogRepository {
  categories: CategoryRecord[] = [];
  brands: BrandRecord[] = [];
  products: ProductRecord[] = [];

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
  adminId: string;
  checkoutRepo: MemoryCheckoutRepository;
  paymentRepo: MemoryPaymentMethodRepository;
  orderRepo: MemoryOrderManagementRepository;
  auditRepo: MemoryAuditLogRepository;
  createTestOrder: (overrides?: Partial<OrderSnapshot>) => {
    order: OrderSnapshot;
    lookupToken: string;
  };
}

function setupOrderFixture(permissions: string[] = []): TestContext {
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
        email: 'ops@liquorshop.test',
        name: 'Operations Manager',
        passwordHash: '$argon2id$mock-hash',
        isActive: true,
        role: {
          id: roleId,
          name: 'Operations Role',
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
      description: 'Pay cash',
      providerLabel: null,
      accountName: null,
      accountNumber: null,
      qrImageUrl: null,
      instructions: null,
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
      description: 'Scan & Pay',
      providerLabel: 'Fonepay',
      accountName: 'Liquor Store',
      accountNumber: '9801234567',
      qrImageUrl: 'https://assets.liquorshop.test/qr/fonepay.png',
      instructions: null,
      minAmount: null,
      maxAmount: null,
      displayOrder: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const admins = [
    {
      id: adminId,
      name: 'Operations Manager',
      email: 'ops@liquorshop.test',
    },
  ];

  const paymentRepo = new MemoryPaymentMethodRepository(initialPaymentMethods);
  const checkoutRepo = new MemoryCheckoutRepository([], []);
  const submissionRepo = new MemoryPaymentSubmissionRepository(
    checkoutRepo,
    admins,
  );
  const auditRepo = new MemoryAuditLogRepository(admins);
  const orderRepo = new MemoryOrderManagementRepository(
    checkoutRepo,
    admins,
    submissionRepo,
  );

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    catalogRepository: new TestCatalogRepo(),
    checkoutRepository: checkoutRepo,
    paymentMethodRepository: paymentRepo,
    paymentSubmissionRepository: submissionRepo,
    auditRepository: auditRepo,
    orderManagementRepository: orderRepo,
  });

  const token = createAdminAccessToken(config, adminId);

  const createTestOrder = (overrides?: Partial<OrderSnapshot>) => {
    const rawLookupToken = crypto.randomBytes(32).toString('hex');
    const lookupTokenHash = crypto
      .createHash('sha256')
      .update(rawLookupToken)
      .digest('hex');

    const order: OrderSnapshot = {
      id: crypto.randomUUID(),
      orderNumber: `ORD-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      customerId: null,
      customerName: 'Aarav Sharma',
      customerPhone: '+977-9841112233',
      customerEmail: 'aarav@example.com',
      deliveryAddress: 'House 12, Lazimpat, Kathmandu',
      deliveryLatitude: '27.719',
      deliveryLongitude: '85.319',
      status: 'PENDING',
      subtotal: '3800.00',
      discountTotal: '0.00',
      deliveryFee: '150.00',
      total: '3950.00',
      lookupTokenHash,
      idempotencyKey: null,
      requestFingerprint: null,
      paymentMethodCode: 'STATIC_QR',
      paymentMethodName: 'Fonepay QR',
      paymentStatus: 'PENDING',
      paymentReference: null,
      items: [
        {
          id: crypto.randomUUID(),
          orderId: 'temp',
          variantId: crypto.randomUUID(),
          productName: 'Khukri XXX Rum 750ml',
          sku: 'KR-750',
          sizeLabel: '750ml',
          unitPrice: '1900.00',
          unitDiscount: '0.00',
          effectiveUnitPrice: '1900.00',
          quantity: 2,
          subtotal: '3800.00',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };

    checkoutRepo.orders.push(order);
    return { order, lookupToken: rawLookupToken };
  };

  return {
    app,
    token,
    adminId,
    checkoutRepo,
    paymentRepo,
    orderRepo,
    auditRepo,
    createTestOrder,
  };
}

describe('Admin Order Management and Persistent Audit Trail (Task 19)', () => {
  describe('Order Listing and Query Filters', () => {
    it('enforces authentication and orders.read permission on order listing', async () => {
      const { app } = setupOrderFixture([]);

      // Unauthenticated -> 401
      const res401 = await request(app).get('/api/admin/orders');
      expect(res401.status).toBe(401);

      // Authenticated without orders.read -> 403
      const { app: appNoPerm, token: tokenNoPerm } = setupOrderFixture([
        'payment-methods.read',
      ]);
      const res403 = await request(appNoPerm)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${tokenNoPerm}`);
      expect(res403.status).toBe(403);
    });

    it('lists orders with pagination and filters by status, paymentStatus, and orderNumber', async () => {
      const { app, token, createTestOrder } = setupOrderFixture([
        'orders.read',
      ]);

      const { order: o1 } = createTestOrder({
        status: 'PENDING',
        paymentStatus: 'PENDING',
        orderNumber: 'ORD-20261011-AAA1',
      });
      createTestOrder({
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        orderNumber: 'ORD-20261011-BBB2',
      });
      createTestOrder({
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        orderNumber: 'ORD-20261011-CCC3',
      });

      // Filter by status=PENDING
      const resPending = await request(app)
        .get('/api/admin/orders?status=PENDING')
        .set('Authorization', `Bearer ${token}`);
      expect(resPending.status).toBe(200);
      expect(resPending.body.data.items).toHaveLength(1);
      expect(resPending.body.data.items[0].orderNumber).toBe(o1.orderNumber);

      // Filter by paymentStatus=PAID
      const resPaid = await request(app)
        .get('/api/admin/orders?paymentStatus=PAID')
        .set('Authorization', `Bearer ${token}`);
      expect(resPaid.status).toBe(200);
      expect(resPaid.body.data.items).toHaveLength(2);

      // Filter by orderNumber substring
      const resSearch = await request(app)
        .get('/api/admin/orders?orderNumber=AAA1')
        .set('Authorization', `Bearer ${token}`);
      expect(resSearch.status).toBe(200);
      expect(resPaid.body.data.pagination.page).toBe(1);
      expect(resSearch.body.data.items).toHaveLength(1);
      expect(resSearch.body.data.items[0].orderNumber).toBe(
        'ORD-20261011-AAA1',
      );
    });

    it('views full order details, item snapshots, pricing, and history', async () => {
      const { app, token, createTestOrder } = setupOrderFixture([
        'orders.read',
      ]);
      const { order } = createTestOrder();

      const res = await request(app)
        .get(`/api/admin/orders/${order.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(order.id);
      expect(res.body.data.orderNumber).toBe(order.orderNumber);
      expect(res.body.data.pricing.total).toBe('3950.00');
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].sku).toBe('KR-750');
      expect(res.body.data.items[0].unitPrice).toBe('1900.00');
      expect(res.body.data.statusHistory).toBeInstanceOf(Array);
    });

    it('returns 404 for non-existent order ID', async () => {
      const { app, token } = setupOrderFixture(['orders.read']);
      const res = await request(app)
        .get(`/api/admin/orders/${crypto.randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('Fulfillment Status Transition Policy', () => {
    it('enforces valid status transition pipeline and records history and audit trail', async () => {
      const { app, token, adminId, createTestOrder, auditRepo } =
        setupOrderFixture(['orders.read', 'orders.status']);
      const { order } = createTestOrder({ status: 'PENDING' });

      // 1. PENDING -> CONFIRMED
      const resConfirm = await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'CONFIRMED',
          reason: 'Customer verified by phone call',
        });
      expect(resConfirm.status).toBe(200);
      expect(resConfirm.body.data.order.status).toBe('CONFIRMED');
      expect(resConfirm.body.data.previousStatus).toBe('PENDING');
      expect(resConfirm.body.data.historyRecord.reason).toBe(
        'Customer verified by phone call',
      );
      expect(resConfirm.body.data.historyRecord.actorAdminId).toBe(adminId);

      // Verify audit log was persistently created
      const orderAudits = await auditRepo.listLogsForResource(
        'ORDER',
        order.id,
      );
      expect(orderAudits).toHaveLength(1);
      expect(orderAudits[0].action).toBe('ORDER_STATUS_UPDATED');
      expect(orderAudits[0].metadata?.toStatus).toBe('CONFIRMED');

      // 2. CONFIRMED -> PROCESSING
      const resProcess = await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PROCESSING' });
      expect(resProcess.status).toBe(200);
      expect(resProcess.body.data.order.status).toBe('PROCESSING');

      // 3. PROCESSING -> OUT_FOR_DELIVERY
      const resOut = await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'OUT_FOR_DELIVERY' });
      expect(resOut.status).toBe(200);
      expect(resOut.body.data.order.status).toBe('OUT_FOR_DELIVERY');

      // 4. OUT_FOR_DELIVERY -> DELIVERED
      const resDelivered = await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'DELIVERED' });
      expect(resDelivered.status).toBe(200);
      expect(resDelivered.body.data.order.status).toBe('DELIVERED');

      // 5. Check order status history endpoint
      const resHistory = await request(app)
        .get(`/api/admin/orders/${order.id}/history`)
        .set('Authorization', `Bearer ${token}`);
      expect(resHistory.status).toBe(200);
      expect(resHistory.body.data.statusHistory).toHaveLength(4);
    });

    it('keeps paymentStatus strictly unchanged during fulfillment updates', async () => {
      const { app, token, createTestOrder, checkoutRepo } = setupOrderFixture([
        'orders.read',
        'orders.status',
      ]);
      const { order } = createTestOrder({
        status: 'PENDING',
        paymentStatus: 'UNDER_REVIEW',
      });

      await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED' });

      const updated = await checkoutRepo.findOrderByNumber(order.orderNumber);
      expect(updated?.status).toBe('CONFIRMED');
      expect(updated?.paymentStatus).toBe('UNDER_REVIEW'); // Unchanged!
    });

    it('rejects invalid status transitions with 409 Conflict', async () => {
      const { app, token, createTestOrder } = setupOrderFixture([
        'orders.read',
        'orders.status',
      ]);

      // Direct jump: PENDING -> DELIVERED (invalid!)
      const { order: o1 } = createTestOrder({ status: 'PENDING' });
      const resInvalidJump = await request(app)
        .patch(`/api/admin/orders/${o1.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'DELIVERED' });
      expect(resInvalidJump.status).toBe(409);
      expect(resInvalidJump.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      // Backwards jump: DELIVERED -> PROCESSING (invalid!)
      const { order: o2 } = createTestOrder({ status: 'DELIVERED' });
      const resInvalidBack = await request(app)
        .patch(`/api/admin/orders/${o2.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PROCESSING' });
      expect(resInvalidBack.status).toBe(409);
      expect(resInvalidBack.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      // Terminal state jump: CANCELLED -> CONFIRMED (invalid!)
      const { order: o3 } = createTestOrder({ status: 'CANCELLED' });
      const resTerminal = await request(app)
        .patch(`/api/admin/orders/${o3.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED' });
      expect(resTerminal.status).toBe(409);
      expect(resTerminal.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      // Same status: PENDING -> PENDING (invalid!)
      const { order: o4 } = createTestOrder({ status: 'PENDING' });
      const resSame = await request(app)
        .patch(`/api/admin/orders/${o4.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PENDING' });
      expect(resSame.status).toBe(409);
      expect(resSame.body.error.code).toBe('SAME_STATUS');
    });

    it('detects and rejects concurrent conflicting status modifications', async () => {
      const { app, token, createTestOrder } = setupOrderFixture([
        'orders.read',
        'orders.status',
      ]);
      const { order } = createTestOrder({ status: 'PENDING' });

      // Admin 1 updates to CONFIRMED
      await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED' });

      // Admin 2 expected PENDING, but order is now CONFIRMED
      const resConflict = await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'CANCELLED',
          expectedPreviousStatus: 'PENDING',
        });

      expect(resConflict.status).toBe(409);
      expect(resConflict.body.error.code).toBe('CONCURRENT_STATUS_CONFLICT');
    });
  });

  describe('Persistent Audit Trail and Sanitization', () => {
    it('enforces audit-logs.read permission on audit trail queries', async () => {
      const { app } = setupOrderFixture([]);

      const res401 = await request(app).get('/api/admin/audit-logs');
      expect(res401.status).toBe(401);

      const { app: appNoPerm, token: tokenNoPerm } = setupOrderFixture([
        'orders.read',
      ]);
      const res403 = await request(appNoPerm)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${tokenNoPerm}`);
      expect(res403.status).toBe(403);
    });

    it('queries persistent audit records with pagination and action filter', async () => {
      const { app, token, auditRepo } = setupOrderFixture(['audit-logs.read']);

      await auditRepo.createLog({
        action: 'ORDER_STATUS_UPDATED',
        resourceType: 'ORDER',
        resourceId: 'ORD-1',
        metadata: { from: 'PENDING', to: 'CONFIRMED' },
      });
      await auditRepo.createLog({
        action: 'PAYMENT_SUBMISSION_APPROVED',
        resourceType: 'ORDER',
        resourceId: 'ORD-2',
        metadata: { submissionId: 'sub-1' },
      });

      const res = await request(app)
        .get('/api/admin/audit-logs?action=ORDER_STATUS_UPDATED')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].action).toBe('ORDER_STATUS_UPDATED');
    });

    it('sanitizes audit metadata to never store passwords, lookup tokens, or secret keys', () => {
      const sensitivePayload = {
        orderNumber: 'ORD-12345',
        password: 'plain-text-secret',
        passwordHash: '$argon2id$secret',
        token: 'secret-jwt',
        orderLookupToken: 'secret-lookup-token-64',
        lookupTokenHash: 'hash-abc',
        jwt_secret: 'base64-secret',
        accountNumber: '9801234567',
        safeData: {
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          authorization: 'Bearer secret-token',
        },
      };

      const sanitized = sanitizeAuditMetadata(sensitivePayload);
      expect(sanitized).toBeDefined();
      expect(sanitized?.orderNumber).toBe('ORD-12345');
      expect(sanitized?.password).toBeUndefined();
      expect(sanitized?.passwordHash).toBeUndefined();
      expect(sanitized?.token).toBeUndefined();
      expect(sanitized?.orderLookupToken).toBeUndefined();
      expect(sanitized?.lookupTokenHash).toBeUndefined();
      expect(sanitized?.jwt_secret).toBeUndefined();
      expect(sanitized?.accountNumber).toBeUndefined();
      expect(
        (sanitized?.safeData as Record<string, unknown>)?.authorization,
      ).toBeUndefined();
      expect((sanitized?.safeData as Record<string, unknown>)?.fromStatus).toBe(
        'PENDING',
      );
    });
  });

  describe('Historical Immutability and No Hard-Delete', () => {
    it('verifies that no hard-delete endpoint exists for historical orders or audit logs', async () => {
      const { app, token, createTestOrder } = setupOrderFixture([
        'orders.read',
        'orders.status',
        'orders.update',
        'audit-logs.read',
      ]);
      const { order } = createTestOrder();

      // Attempt DELETE /api/admin/orders/:id -> 404 (Route not found / method not allowed)
      const resDeleteOrder = await request(app)
        .delete(`/api/admin/orders/${order.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(resDeleteOrder.status).toBe(404);

      // Attempt DELETE /api/admin/audit-logs/:id -> 404
      const resDeleteAudit = await request(app)
        .delete(`/api/admin/audit-logs/${crypto.randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);
      expect(resDeleteAudit.status).toBe(404);
    });

    it('preserves historical line items, pricing, and customer snapshots across status updates', async () => {
      const { app, token, createTestOrder, checkoutRepo } = setupOrderFixture([
        'orders.read',
        'orders.status',
      ]);
      const { order } = createTestOrder({ status: 'PENDING' });

      // Transition order to CONFIRMED
      await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED' });

      const reFetched = await checkoutRepo.findOrderByNumber(order.orderNumber);
      expect(reFetched?.items[0].unitPrice).toBe('1900.00');
      expect(reFetched?.items[0].quantity).toBe(2);
      expect(reFetched?.total).toBe('3950.00');
      expect(reFetched?.customerName).toBe('Aarav Sharma');
      expect(reFetched?.deliveryAddress).toBe('House 12, Lazimpat, Kathmandu');
    });
  });

  describe('Migration and PostgreSQL Concurrency Notes (Review Only)', () => {
    it('verifies migration SQL for OrderStatusHistory and AuditLog', () => {
      const migrationFile = resolve(
        process.cwd(),
        'prisma/migrations/20261011000400_admin_orders_and_audit_trail/migration.sql',
      );
      const sql = readFileSync(migrationFile, 'utf8');

      expect(sql).toContain('CREATE TABLE "OrderStatusHistory"');
      expect(sql).toContain('CREATE TABLE "AuditLog"');
      expect(sql).toContain(
        'ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey"',
      );
      expect(sql).toContain(
        'ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_reason_length_check"',
      );
      expect(sql).toContain(
        'ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_action_nonblank_check"',
      );
    });

    it('notes testing environment limitation regarding PostgreSQL concurrency', () => {
      // In-memory test fixtures verify business logic, state-machine transitions, conflict handling,
      // and audit redaction.
      // True PostgreSQL row-level locks (e.g., SELECT FOR UPDATE) and serializable transaction
      // isolation require a live PostgreSQL test database.
      expect(true).toBe(true);
    });
  });
});
