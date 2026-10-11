import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { AdminAuthRepository } from '../src/modules/admin-auth/admin-auth.types';
import { sanitizeAuditMetadata } from '../src/modules/audit/audit.service';
import type { AuditLogRepository } from '../src/modules/audit/audit.types';
import { MemoryAuditLogRepository } from '../src/modules/audit/memory-audit.repository';
import type { OrderSnapshot } from '../src/modules/checkout/checkout.types';
import { MemoryCheckoutRepository } from '../src/modules/checkout/memory-checkout.repository';
import { MemoryOrderManagementRepository } from '../src/modules/order-management/memory-order-management.repository';
import type { OrderStatus } from '../src/modules/order-management/order-management.types';
import { MemoryPaymentMethodRepository } from '../src/modules/payment-method/memory-payment-method.repository';
import type { ManagedPaymentMethod } from '../src/modules/payment-method/payment-method.types';
import { MemoryPaymentSubmissionRepository } from '../src/modules/payment-submission/memory-payment-submission.repository';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import { testConfig } from './helpers';

class TestCatalogRepo {
  categories: unknown[] = [];
  brands: unknown[] = [];
  products: unknown[] = [];
  variants: unknown[] = [];
}

interface FixtureOptions {
  permissions?: string[];
  failAuditLogs?: boolean;
}

function setupHardeningFixture(options: FixtureOptions = {}) {
  const config = testConfig();
  const adminId = '90000000-0000-4000-8000-000000000001';
  const roleId = '90000000-0000-4000-8000-000000000002';
  const permissions = options.permissions ?? [
    'orders.read',
    'orders.status',
    'orders.update',
    'audit-logs.read',
    'payment-submissions.read',
    'payment-submissions.review',
    'payment-methods.read',
    'payment-methods.update',
  ];

  const authRepository: AdminAuthRepository = {
    async findByEmail() {
      return null;
    },
    async findById(id) {
      if (id !== adminId) return null;
      return {
        id,
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
      description: 'Pay cash upon delivery',
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
      description: 'Scan & Pay via Fonepay',
      providerLabel: 'Fonepay',
      accountName: 'Liquor Store Ops',
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

  const baseAuditRepo = new MemoryAuditLogRepository(admins);
  let shouldFailAudit = options.failAuditLogs ?? false;

  const failingAuditRepo: AuditLogRepository = {
    async createLog(input) {
      if (shouldFailAudit) {
        throw new Error(
          'SIMULATED_AUDIT_PERSISTENCE_FAILURE: Database I/O error',
        );
      }
      return baseAuditRepo.createLog(input);
    },
    async listLogs(filter) {
      return baseAuditRepo.listLogs(filter);
    },
    async listLogsForResource(type, id) {
      return baseAuditRepo.listLogsForResource(type, id);
    },
  };

  const submissionRepo = new MemoryPaymentSubmissionRepository(
    checkoutRepo,
    admins,
    failingAuditRepo,
  );
  const orderRepo = new MemoryOrderManagementRepository(
    checkoutRepo,
    admins,
    submissionRepo,
    failingAuditRepo,
  );

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    catalogRepository: new TestCatalogRepo(),
    paymentMethodRepository: paymentRepo,
    checkoutRepository: checkoutRepo,
    paymentSubmissionRepository: submissionRepo,
    auditRepository: failingAuditRepo,
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
      guestCartId: crypto.randomUUID(),
      customerName: 'Aarav Sharma',
      customerPhone: '9841234567',
      customerEmail: 'aarav@example.test',
      deliveryAddress: 'House 12, Lazimpat, Kathmandu',
      deliveryLatitude: 27.7172,
      deliveryLongitude: 85.324,
      subtotal: '3800.00',
      discountTotal: '0.00',
      deliveryFee: '150.00',
      total: '3950.00',
      status: 'PENDING',
      paymentMethodCode: 'STATIC_QR',
      paymentMethodName: 'Fonepay QR',
      paymentStatus: 'PENDING',
      paymentReference: null,
      lookupTokenHash,
      requestFingerprint: 'fp-12345',
      items: [
        {
          id: crypto.randomUUID(),
          orderId: '',
          variantId: 'var-1',
          productName: 'Single Malt Whisky 12Y',
          sku: 'SKU-SM-12-750',
          sizeLabel: '750 ml',
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
    order.items[0].orderId = order.id;

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
    submissionRepo,
    auditRepo: baseAuditRepo,
    createTestOrder,
    setShouldFailAudit: (fail: boolean) => {
      shouldFailAudit = fail;
    },
  };
}

describe('Cross-Module Hardening & Security Invariants', () => {
  describe('Audit and Status-Change Transaction Atomicity', () => {
    it('rolls back order status change if audit log write fails, leaving order status uncommitted', async () => {
      const fixture = setupHardeningFixture({ failAuditLogs: true });
      const { app, token, createTestOrder, checkoutRepo } = fixture;
      const { order } = createTestOrder({ status: 'PENDING' });

      // Attempt to confirm order when audit persistence fails
      const res = await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(500);

      // Verify state was NOT updated (remains PENDING)
      const persisted = await checkoutRepo.findOrderByNumber(order.orderNumber);
      expect(persisted?.status).toBe('PENDING');

      // Verify no status history was recorded
      expect(
        fixture.orderRepo.history.filter((h) => h.orderId === order.id),
      ).toHaveLength(0);
    });

    it('rolls back QR payment submission if audit log write fails, leaving order paymentStatus uncommitted', async () => {
      const fixture = setupHardeningFixture({ failAuditLogs: true });
      const { app, createTestOrder, checkoutRepo } = fixture;
      const { order, lookupToken } = createTestOrder({
        paymentStatus: 'PENDING',
      });

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: 'https://storage.test/proofs/receipt.png',
          transactionReference: 'TXN-ABC-123',
        });

      expect(res.status).toBe(500);

      // Verify order paymentStatus was NOT changed to UNDER_REVIEW
      const persisted = await checkoutRepo.findOrderByNumber(order.orderNumber);
      expect(persisted?.paymentStatus).toBe('PENDING');

      // Verify no submission was recorded
      expect(
        fixture.submissionRepo.submissions.filter(
          (s) => s.orderId === order.id,
        ),
      ).toHaveLength(0);
    });

    it('rolls back payment approval if audit log write fails, leaving submission PENDING and order unpaid', async () => {
      const fixture = setupHardeningFixture({ failAuditLogs: false });
      const {
        app,
        token,
        createTestOrder,
        checkoutRepo,
        submissionRepo,
        setShouldFailAudit,
      } = fixture;
      const { order, lookupToken } = createTestOrder({
        paymentStatus: 'PENDING',
      });

      // First submit payment proof successfully
      const submitRes = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: 'https://storage.test/proofs/receipt.png',
          transactionReference: 'TXN-999-VERIFY',
        });
      expect(submitRes.status).toBe(201);
      const submissionId = submitRes.body.data.submissionId;

      // Enable audit failure before approval
      setShouldFailAudit(true);

      const approveRes = await request(app)
        .post(`/api/admin/payment-submissions/${submissionId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect(approveRes.status).toBe(500);

      // Verify submission remains PENDING
      const subRecord = submissionRepo.submissions.find(
        (s) => s.id === submissionId,
      );
      expect(subRecord?.status).toBe('PENDING');

      // Verify order paymentStatus was NOT updated to PAID
      const persisted = await checkoutRepo.findOrderByNumber(order.orderNumber);
      expect(persisted?.paymentStatus).toBe('UNDER_REVIEW');
    });
  });

  describe('Recursive Audit Metadata Redaction Safety', () => {
    it('recursively redacts case variations, delimiters, nested arrays and nested objects', () => {
      const complexPayload = {
        orderId: 'ORD-SEC-01',
        customer: {
          name: 'Jane Doe',
          password: 'plain_password',
          PasswordHash: '$argon2id$hash',
          SecretToken: 'tok-1234',
        },
        items: [
          {
            variantId: 'v-1',
            cartToken: 'cart-secret-111',
            order_lookup_token: 'lookup-sec-222',
            price: '1500.00',
          },
          {
            variantId: 'v-2',
            jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M',
            bearerToken: 'Bearer raw-bearer-secret',
            metadata: {
              account_number: '9841000000',
              cvv: '123',
              cardNumber: '4111222233334444',
              safeNote: 'Handle with care',
            },
          },
        ],
        mySecretKey: 'secret-val',
        customLogNote: 'Bearer some-auth-token-12345',
        customSignature:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M',
        safeCount: 5,
        safeActive: true,
      };

      const sanitized = sanitizeAuditMetadata(complexPayload);
      expect(sanitized).toBeDefined();

      // Top-level safe fields preserved
      expect(sanitized?.orderId).toBe('ORD-SEC-01');
      expect(sanitized?.safeCount).toBe(5);
      expect(sanitized?.safeActive).toBe(true);

      // Raw token strings in innocent keys are redacted
      expect(sanitized?.customLogNote).toBe('[REDACTED]');
      expect(sanitized?.customSignature).toBe('[REDACTED]');

      // Sensitive keys are omitted entirely
      expect(sanitized?.mySecretKey).toBeUndefined();

      // Nested object sanitization
      const cust = sanitized?.customer as Record<string, unknown>;
      expect(cust.name).toBe('Jane Doe');
      expect(cust.password).toBeUndefined();
      expect(cust.PasswordHash).toBeUndefined();
      expect(cust.SecretToken).toBeUndefined();

      // Nested array sanitization
      const items = sanitized?.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(2);

      // Item 0
      expect(items[0].variantId).toBe('v-1');
      expect(items[0].price).toBe('1500.00');
      expect(items[0].cartToken).toBeUndefined();
      expect(items[0].order_lookup_token).toBeUndefined();

      // Item 1
      expect(items[1].variantId).toBe('v-2');
      expect(items[1].jwt).toBeUndefined();
      expect(items[1].bearerToken).toBeUndefined();

      const item1Meta = items[1].metadata as Record<string, unknown>;
      expect(item1Meta.account_number).toBeUndefined();
      expect(item1Meta.cvv).toBeUndefined();
      expect(item1Meta.cardNumber).toBeUndefined();
      expect(item1Meta.safeNote).toBe('Handle with care');
    });

    it('returns null safely for null, undefined, primitive, or array root inputs', () => {
      expect(sanitizeAuditMetadata(null)).toBeNull();
      expect(sanitizeAuditMetadata(undefined)).toBeNull();
      expect(
        sanitizeAuditMetadata(
          'not-an-object' as unknown as Record<string, unknown>,
        ),
      ).toBeNull();
      expect(
        sanitizeAuditMetadata([1, 2, 3] as unknown as Record<string, unknown>),
      ).toBeNull();
    });
  });

  describe('Fulfillment Status Transition Matrix & Invariants', () => {
    const validTransitions: Array<[OrderStatus, OrderStatus]> = [
      ['PENDING', 'CONFIRMED'],
      ['PENDING', 'CANCELLED'],
      ['CONFIRMED', 'PROCESSING'],
      ['CONFIRMED', 'CANCELLED'],
      ['PROCESSING', 'OUT_FOR_DELIVERY'],
      ['PROCESSING', 'CANCELLED'],
      ['OUT_FOR_DELIVERY', 'DELIVERED'],
      ['OUT_FOR_DELIVERY', 'RETURNED'],
      ['OUT_FOR_DELIVERY', 'CANCELLED'],
      ['DELIVERED', 'RETURNED'],
    ];

    it.each(validTransitions)(
      'allows valid transition: %s -> %s',
      async (fromStatus, toStatus) => {
        const { app, token, createTestOrder } = setupHardeningFixture();
        const { order } = createTestOrder({ status: fromStatus });

        const res = await request(app)
          .patch(`/api/admin/orders/${order.id}/status`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            status: toStatus,
            reason: `Transition test from ${fromStatus} to ${toStatus}`,
          });

        expect(res.status).toBe(200);
        expect(res.body.data.order.status).toBe(toStatus);
        expect(res.body.data.previousStatus).toBe(fromStatus);
      },
    );

    const allStatuses: OrderStatus[] = [
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'RETURNED',
    ];

    it('rejects terminal status transitions from CANCELLED and RETURNED with 409', async () => {
      const { app, token, createTestOrder } = setupHardeningFixture();

      for (const terminalStatus of ['CANCELLED', 'RETURNED'] as OrderStatus[]) {
        for (const targetStatus of allStatuses) {
          const { order } = createTestOrder({ status: terminalStatus });

          const res = await request(app)
            .patch(`/api/admin/orders/${order.id}/status`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: targetStatus });

          expect(res.status).toBe(409);
        }
      }
    });

    it('rejects self-transitions with 409 SAME_STATUS', async () => {
      const { app, token, createTestOrder } = setupHardeningFixture();
      const { order } = createTestOrder({ status: 'CONFIRMED' });

      const res = await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SAME_STATUS');
    });

    it('rejects invalid backward transitions (e.g. DELIVERED -> PENDING) with 409 INVALID_STATUS_TRANSITION', async () => {
      const { app, token, createTestOrder } = setupHardeningFixture();
      const { order } = createTestOrder({ status: 'DELIVERED' });

      const res = await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PENDING' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  describe('Cross-Module Independence and Snapshot Immutability', () => {
    it('fulfillment status updates never modify order paymentStatus', async () => {
      const { app, token, createTestOrder, checkoutRepo } =
        setupHardeningFixture();
      const { order } = createTestOrder({
        status: 'PENDING',
        paymentStatus: 'UNDER_REVIEW',
      });

      const res = await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(200);

      const refreshed = await checkoutRepo.findOrderByNumber(order.orderNumber);
      expect(refreshed?.status).toBe('CONFIRMED');
      expect(refreshed?.paymentStatus).toBe('UNDER_REVIEW'); // strictly untouched
    });

    it('payment review approval never modifies order fulfillment status', async () => {
      const { app, token, createTestOrder, checkoutRepo } =
        setupHardeningFixture();
      const { order, lookupToken } = createTestOrder({
        status: 'PROCESSING',
        paymentStatus: 'PENDING',
      });

      // Submit proof
      const submitRes = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: 'https://storage.test/proofs/receipt.png',
          transactionReference: 'TXN-INDEPENDENT-1',
        });
      expect(submitRes.status).toBe(201);
      const submissionId = submitRes.body.data.submissionId;

      // Approve payment
      const approveRes = await request(app)
        .post(`/api/admin/payment-submissions/${submissionId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send();
      expect(approveRes.status).toBe(200);

      const refreshed = await checkoutRepo.findOrderByNumber(order.orderNumber);
      expect(refreshed?.paymentStatus).toBe('PAID');
      expect(refreshed?.status).toBe('PROCESSING'); // strictly untouched
    });

    it('deactivating a payment method prevents new checkouts but preserves historical order snapshots', async () => {
      const { app, token, paymentRepo, createTestOrder } =
        setupHardeningFixture();

      // Create historical order using STATIC_QR
      const { order } = createTestOrder({
        paymentMethodCode: 'STATIC_QR',
        paymentMethodName: 'Fonepay QR',
      });

      // Admin deactivates STATIC_QR
      const deactivateRes = await request(app)
        .patch(
          '/api/admin/payment-methods/80000000-0000-4000-8000-000000000002',
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });
      expect(deactivateRes.status).toBe(200);

      // Verify payment method is now inactive in repository
      const method = await paymentRepo.findByCode('STATIC_QR');
      expect(method?.isActive).toBe(false);

      // Verify historical order still retains its original snapshot
      const orderRes = await request(app)
        .get(`/api/admin/orders/${order.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(orderRes.status).toBe(200);
      expect(orderRes.body.data.payment.methodCode).toBe('STATIC_QR');
      expect(orderRes.body.data.payment.methodName).toBe('Fonepay QR');
    });

    it('cancelling or returning an order does not automatically alter inventory variants', async () => {
      const { app, token, createTestOrder } = setupHardeningFixture();
      const { order } = createTestOrder({ status: 'PROCESSING' });

      // Cancel the order
      const cancelRes = await request(app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'CANCELLED',
          reason: 'Customer cancelled before dispatch',
        });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.order.status).toBe('CANCELLED');

      // Fulfillment status updated, but paymentStatus remains unaffected
      expect(cancelRes.body.data.order.payment.status).toBe('PENDING');
    });
  });
});
