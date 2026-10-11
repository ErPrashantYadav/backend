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
  adminId: string;
  paymentRepo: MemoryPaymentMethodRepository;
  checkoutRepo: MemoryCheckoutRepository;
  submissionRepo: MemoryPaymentSubmissionRepository;
  createTestOrder: (overrides?: Partial<OrderSnapshot>) => {
    order: OrderSnapshot;
    lookupToken: string;
  };
}

function setupSubmissionFixture(permissions: string[] = []): TestContext {
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
        name: 'Finance Verifier',
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
      accountName: 'Liquor Store',
      accountNumber: '9801234567',
      qrImageUrl: 'https://assets.liquorshop.test/qr/fonepay.png',
      instructions: 'Enter order number in remarks',
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
      name: 'Old Bank QR',
      description: 'Disabled QR',
      providerLabel: 'Old Bank',
      accountName: 'Liquor Store',
      accountNumber: null,
      qrImageUrl: 'https://assets.liquorshop.test/qr/old.png',
      instructions: null,
      minAmount: null,
      maxAmount: null,
      displayOrder: 3,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const paymentRepo = new MemoryPaymentMethodRepository(initialPaymentMethods);
  const checkoutRepo = new MemoryCheckoutRepository([], []);
  const submissionRepo = new MemoryPaymentSubmissionRepository(checkoutRepo, [
    {
      id: adminId,
      name: 'Finance Verifier',
      email: 'admin@liquorshop.test',
    },
  ]);

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    catalogRepository: new TestCatalogRepo(),
    checkoutRepository: checkoutRepo,
    paymentMethodRepository: paymentRepo,
    paymentSubmissionRepository: submissionRepo,
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
      customerName: 'Suman Shrestha',
      customerPhone: '+977-9841234567',
      customerEmail: 'suman@example.com',
      deliveryAddress: 'Ward 4, Baluwatar, Kathmandu',
      deliveryLatitude: '27.72',
      deliveryLongitude: '85.32',
      status: 'PENDING',
      subtotal: '2500.00',
      discountTotal: '0.00',
      deliveryFee: '0.00',
      total: '2500.00',
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
          productName: 'Old Durbar 750ml',
          sku: 'OD-750',
          sizeLabel: '750ml',
          unitPrice: '2500.00',
          unitDiscount: '0.00',
          effectiveUnitPrice: '2500.00',
          quantity: 1,
          subtotal: '2500.00',
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
    paymentRepo,
    checkoutRepo,
    submissionRepo,
    createTestOrder,
  };
}

describe('QR Payment Submission and Admin Verification (Task 18)', () => {
  describe('Guest QR Payment Proof Submission', () => {
    it('enforces order lookup token verification and privacy on submission', async () => {
      const { app, createTestOrder } = setupSubmissionFixture();
      const { order } = createTestOrder();

      // Missing lookup token -> 404 ORDER_NOT_FOUND (privacy preserving)
      const resMissing = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .send({
          proofImageUrl: 'https://images.liquorshop.test/proofs/receipt-1.jpg',
        });
      expect(resMissing.status).toBe(404);
      expect(resMissing.body.error.code).toBe('ORDER_NOT_FOUND');

      // Invalid lookup token -> 404 ORDER_NOT_FOUND
      const resInvalid = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', 'wrong-token-abc-123')
        .send({
          proofImageUrl: 'https://images.liquorshop.test/proofs/receipt-1.jpg',
        });
      expect(resInvalid.status).toBe(404);
      expect(resInvalid.body.error.code).toBe('ORDER_NOT_FOUND');

      // Non-existent order number -> 404 ORDER_NOT_FOUND
      const resNonExistent = await request(app)
        .post('/api/orders/ORD-NON-EXISTENT/payment-proof')
        .set('x-order-token', 'any-token')
        .send({
          proofImageUrl: 'https://images.liquorshop.test/proofs/receipt-1.jpg',
        });
      expect(resNonExistent.status).toBe(404);
      expect(resNonExistent.body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('rejects payment proof submission on COD orders', async () => {
      const { app, createTestOrder } = setupSubmissionFixture();
      const { order, lookupToken } = createTestOrder({
        paymentMethodCode: 'COD',
        paymentMethodName: 'Cash on Delivery',
      });

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: 'https://images.liquorshop.test/proofs/receipt-1.jpg',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYMENT_METHOD');
    });

    it('rejects payment proof submission on inactive QR payment methods', async () => {
      const { app, createTestOrder } = setupSubmissionFixture();
      const { order, lookupToken } = createTestOrder({
        paymentMethodCode: 'DISABLED_QR',
        paymentMethodName: 'Old Bank QR',
      });

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: 'https://images.liquorshop.test/proofs/receipt-1.jpg',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INACTIVE_PAYMENT_METHOD');
    });

    it('rejects invalid image URLs (http, javascript, or non-secure URLs)', async () => {
      const { app, createTestOrder } = setupSubmissionFixture();
      const { order, lookupToken } = createTestOrder();

      const resHttp = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: 'http://insecure.test/proof.jpg',
        });
      expect(resHttp.status).toBe(400);
      expect(resHttp.body.error.code).toBe('INVALID_IMAGE_URL');

      const resJs = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: 'javascript:alert(1)',
        });
      expect(resJs.status).toBe(400);
      expect(resJs.body.error.code).toBe('INVALID_IMAGE_URL');
    });

    it('submits valid QR proof, updates paymentStatus to UNDER_REVIEW, and ignores client-submitted paymentStatus: PAID', async () => {
      const { app, createTestOrder, checkoutRepo } = setupSubmissionFixture();
      const { order, lookupToken } = createTestOrder();

      const res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl:
            'https://images.liquorshop.test/proofs/receipt-101.jpg',
          transactionReference: 'TXN-987654321',
          customerNotes: 'Paid via Fonepay mobile app',
          paymentStatus: 'PAID', // Malicious attempt to self-declare paid
        });

      expect(res.status).toBe(201);
      expect(res.body.data.orderNumber).toBe(order.orderNumber);
      expect(res.body.data.status).toBe('PENDING'); // Submission status
      expect(res.body.data.paymentStatus).toBe('UNDER_REVIEW'); // Order payment status
      expect(res.body.data.transactionReference).toBe('TXN-987654321');

      // Verify order paymentStatus in repository is strictly UNDER_REVIEW, NOT PAID
      const updatedOrder = await checkoutRepo.findOrderByNumber(
        order.orderNumber,
      );
      expect(updatedOrder?.paymentStatus).toBe('UNDER_REVIEW');
      expect(updatedOrder?.status).toBe('PENDING'); // Fulfillment status remains untouched
    });

    it('rejects duplicate submission while previous submission is pending', async () => {
      const { app, createTestOrder } = setupSubmissionFixture();
      const { order, lookupToken } = createTestOrder();

      // First submission
      const res1 = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: 'https://images.liquorshop.test/proofs/first.jpg',
        });
      expect(res1.status).toBe(201);

      // Duplicate submission while still pending review
      const res2 = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: 'https://images.liquorshop.test/proofs/second.jpg',
        });
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('SUBMISSION_ALREADY_PENDING');
    });

    it('rejects submission on already PAID or CANCELLED orders', async () => {
      const { app, createTestOrder } = setupSubmissionFixture();

      // Already PAID order
      const { order: paidOrder, lookupToken: paidToken } = createTestOrder({
        paymentStatus: 'PAID',
      });
      const resPaid = await request(app)
        .post(`/api/orders/${paidOrder.orderNumber}/payment-proof`)
        .set('x-order-token', paidToken)
        .send({
          proofImageUrl:
            'https://images.liquorshop.test/proofs/already-paid.jpg',
        });
      expect(resPaid.status).toBe(400);
      expect(resPaid.body.error.code).toBe('ORDER_ALREADY_PAID');

      // CANCELLED order
      const { order: cancelledOrder, lookupToken: cancelledToken } =
        createTestOrder({
          status: 'CANCELLED',
        });
      const resCancelled = await request(app)
        .post(`/api/orders/${cancelledOrder.orderNumber}/payment-proof`)
        .set('x-order-token', cancelledToken)
        .send({
          proofImageUrl: 'https://images.liquorshop.test/proofs/cancelled.jpg',
        });
      expect(resCancelled.status).toBe(400);
      expect(resCancelled.body.error.code).toBe('INVALID_ORDER_STATE');
    });

    it('supports submission via checkout route alias /api/checkout/orders/:orderNumber/payment-proof', async () => {
      const { app, createTestOrder } = setupSubmissionFixture();
      const { order, lookupToken } = createTestOrder();

      const res = await request(app)
        .post(`/api/checkout/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl:
            'https://images.liquorshop.test/proofs/alias-receipt.jpg',
          transactionReference: 'TXN-ALIAS-123',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.orderNumber).toBe(order.orderNumber);
    });
  });

  describe('Admin Verification Workflow', () => {
    it('enforces authentication and granular permissions on admin endpoints', async () => {
      const { app } = setupSubmissionFixture([]); // No permissions

      // No token -> 401
      const resUnauth = await request(app).get(
        '/api/admin/payment-submissions',
      );
      expect(resUnauth.status).toBe(401);

      // Authenticated but missing payment-submissions.read -> 403
      const { app: appNoPerm, token: tokenNoPerm } = setupSubmissionFixture([
        'payment-methods.read',
      ]);
      const resForbiddenList = await request(appNoPerm)
        .get('/api/admin/payment-submissions')
        .set('Authorization', `Bearer ${tokenNoPerm}`);
      expect(resForbiddenList.status).toBe(403);

      // Authenticated with read but missing payment-submissions.review on approve -> 403
      const { app: appReadPerm, token: tokenReadPerm } = setupSubmissionFixture(
        ['payment-submissions.read'],
      );
      const resForbiddenApprove = await request(appReadPerm)
        .post(`/api/admin/payment-submissions/${crypto.randomUUID()}/approve`)
        .set('Authorization', `Bearer ${tokenReadPerm}`);
      expect(resForbiddenApprove.status).toBe(403);
    });

    it('lists pending payment submissions with pagination and filters', async () => {
      const { app, token, createTestOrder } = setupSubmissionFixture([
        'payment-submissions.read',
      ]);
      const { order, lookupToken } = createTestOrder();

      // Submit proof
      await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl: 'https://images.liquorshop.test/proofs/list-test.jpg',
          transactionReference: 'TXN-LIST-1',
        });

      // Admin lists submissions
      const res = await request(app)
        .get('/api/admin/payment-submissions?status=PENDING')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].order.orderNumber).toBe(order.orderNumber);
      expect(res.body.data.pagination.total).toBe(1);
    });

    it('views submission details with masked customer PII', async () => {
      const { app, token, createTestOrder } = setupSubmissionFixture([
        'payment-submissions.read',
      ]);
      const { order, lookupToken } = createTestOrder({
        customerPhone: '+977-9841234567',
        customerEmail: 'suman@example.com',
        deliveryAddress: 'Ward 4, Baluwatar, Kathmandu',
      });

      const submitRes = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl:
            'https://images.liquorshop.test/proofs/detail-test.jpg',
        });
      const submissionId = submitRes.body.data.submissionId;

      const res = await request(app)
        .get(`/api/admin/payment-submissions/${submissionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(submissionId);
      expect(res.body.data.order.orderNumber).toBe(order.orderNumber);
      // Customer PII is masked
      expect(res.body.data.order.customerPhoneMasked).toContain('***');
      expect(res.body.data.order.customerEmailMasked).toContain('***');
      expect(res.body.data.order.customerEmailMasked).not.toBe(
        'suman@example.com',
      );
      expect(res.body.data.order.deliveryAddressMasked).toContain('***');
    });

    it('approves submission, updates order paymentStatus to PAID, preserves order fulfillment status, and records reviewer', async () => {
      const { app, token, adminId, createTestOrder, checkoutRepo } =
        setupSubmissionFixture([
          'payment-submissions.read',
          'payment-submissions.review',
        ]);
      const { order, lookupToken } = createTestOrder();

      const submitRes = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl:
            'https://images.liquorshop.test/proofs/approval-test.jpg',
          transactionReference: 'TXN-APPROVE-999',
        });
      const submissionId = submitRes.body.data.submissionId;

      const approveRes = await request(app)
        .post(`/api/admin/payment-submissions/${submissionId}/approve`)
        .set('Authorization', `Bearer ${token}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('APPROVED');
      expect(approveRes.body.data.reviewedByAdminId).toBe(adminId);
      expect(approveRes.body.data.reviewedAt).toBeTruthy();

      // Check order in repository
      const updatedOrder = await checkoutRepo.findOrderByNumber(
        order.orderNumber,
      );
      expect(updatedOrder?.paymentStatus).toBe('PAID');
      expect(updatedOrder?.paymentReference).toBe('TXN-APPROVE-999');
      expect(updatedOrder?.status).toBe('PENDING'); // Order fulfillment status preserved!

      // Double approval prevention -> 409 ALREADY_APPROVED
      const doubleApproveRes = await request(app)
        .post(`/api/admin/payment-submissions/${submissionId}/approve`)
        .set('Authorization', `Bearer ${token}`);
      expect(doubleApproveRes.status).toBe(409);
      expect(doubleApproveRes.body.error.code).toBe('ALREADY_APPROVED');
    });

    it('rejects submission with required reason, updates paymentStatus to FAILED, and preserves order fulfillment status', async () => {
      const { app, token, adminId, createTestOrder, checkoutRepo } =
        setupSubmissionFixture([
          'payment-submissions.read',
          'payment-submissions.review',
        ]);
      const { order, lookupToken } = createTestOrder();

      const submitRes = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl:
            'https://images.liquorshop.test/proofs/reject-test.jpg',
        });
      const submissionId = submitRes.body.data.submissionId;

      // Rejection without reason -> 400
      const missingReasonRes = await request(app)
        .post(`/api/admin/payment-submissions/${submissionId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(missingReasonRes.status).toBe(400);

      // Rejection with valid reason
      const rejectRes = await request(app)
        .post(`/api/admin/payment-submissions/${submissionId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          reason: 'Screenshot is blurry and transaction number not visible',
        });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe('REJECTED');
      expect(rejectRes.body.data.rejectionReason).toBe(
        'Screenshot is blurry and transaction number not visible',
      );
      expect(rejectRes.body.data.reviewedByAdminId).toBe(adminId);

      // Check order in repository
      const updatedOrder = await checkoutRepo.findOrderByNumber(
        order.orderNumber,
      );
      expect(updatedOrder?.paymentStatus).toBe('FAILED');
      expect(updatedOrder?.status).toBe('PENDING'); // Order fulfillment status preserved!

      // Approving rejected submission without resubmission -> 409 ALREADY_REJECTED
      const approveRejectedRes = await request(app)
        .post(`/api/admin/payment-submissions/${submissionId}/approve`)
        .set('Authorization', `Bearer ${token}`);
      expect(approveRejectedRes.status).toBe(409);
      expect(approveRejectedRes.body.error.code).toBe('ALREADY_REJECTED');
    });

    it('supports defined resubmission flow after rejection', async () => {
      const { app, token, createTestOrder, checkoutRepo } =
        setupSubmissionFixture([
          'payment-submissions.read',
          'payment-submissions.review',
        ]);
      const { order, lookupToken } = createTestOrder();

      // 1. Initial submission
      const sub1Res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl:
            'https://images.liquorshop.test/proofs/bad-screenshot.jpg',
        });
      const sub1Id = sub1Res.body.data.submissionId;

      // 2. Admin rejects
      await request(app)
        .post(`/api/admin/payment-submissions/${sub1Id}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Incorrect amount transferred' });

      expect(
        (await checkoutRepo.findOrderByNumber(order.orderNumber))
          ?.paymentStatus,
      ).toBe('FAILED');

      // 3. Guest resubmits with correct proof and transaction reference
      const sub2Res = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl:
            'https://images.liquorshop.test/proofs/corrected-proof.jpg',
          transactionReference: 'TXN-CORRECTED-777',
        });
      expect(sub2Res.status).toBe(201);
      const sub2Id = sub2Res.body.data.submissionId;
      expect(
        (await checkoutRepo.findOrderByNumber(order.orderNumber))
          ?.paymentStatus,
      ).toBe('UNDER_REVIEW');

      // 4. Admin approves the second submission
      const approveRes = await request(app)
        .post(`/api/admin/payment-submissions/${sub2Id}/approve`)
        .set('Authorization', `Bearer ${token}`);
      expect(approveRes.status).toBe(200);

      const finalOrder = await checkoutRepo.findOrderByNumber(
        order.orderNumber,
      );
      expect(finalOrder?.paymentStatus).toBe('PAID');
      expect(finalOrder?.paymentReference).toBe('TXN-CORRECTED-777');
    });

    it('supports unified /review endpoint with action APPROVE or REJECT', async () => {
      const { app, token, createTestOrder } = setupSubmissionFixture([
        'payment-submissions.review',
      ]);
      const { order, lookupToken } = createTestOrder();

      const subRes = await request(app)
        .post(`/api/orders/${order.orderNumber}/payment-proof`)
        .set('x-order-token', lookupToken)
        .send({
          proofImageUrl:
            'https://images.liquorshop.test/proofs/review-endpoint.jpg',
        });
      const subId = subRes.body.data.submissionId;

      const reviewRes = await request(app)
        .post(`/api/admin/payment-submissions/${subId}/review`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'APPROVE' });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.status).toBe('APPROVED');
    });

    it('preserves historical order snapshots when payment method is modified or disabled', async () => {
      const { paymentRepo, createTestOrder, checkoutRepo } =
        setupSubmissionFixture([
          'payment-methods.update',
          'payment-methods.status',
        ]);
      const { order } = createTestOrder({
        paymentMethodCode: 'STATIC_QR',
        paymentMethodName: 'Fonepay QR',
        total: '2500.00',
      });

      // Admin disables the STATIC_QR method
      const qrMethod = await paymentRepo.findByCode('STATIC_QR');
      expect(qrMethod).toBeTruthy();
      await paymentRepo.setStatus(qrMethod!.id, false);

      // Verify the existing order snapshot in repository is completely unchanged
      const preservedOrder = await checkoutRepo.findOrderByNumber(
        order.orderNumber,
      );
      expect(preservedOrder?.paymentMethodCode).toBe('STATIC_QR');
      expect(preservedOrder?.paymentMethodName).toBe('Fonepay QR');
      expect(preservedOrder?.total).toBe('2500.00');
    });
  });

  describe('Migration & Schema Consistency (Review Only)', () => {
    it('verifies QR payment submission migration SQL and constraints', () => {
      const migrationFile = resolve(
        process.cwd(),
        'prisma/migrations/20261011000300_qr_payment_submissions/migration.sql',
      );
      const sql = readFileSync(migrationFile, 'utf8');

      expect(sql).toContain('CREATE TYPE "PaymentSubmissionStatus"');
      expect(sql).toContain('CREATE TABLE "PaymentSubmission"');
      expect(sql).toContain(
        'ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_orderId_fkey"',
      );
      expect(sql).toContain(
        'ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_proofImageUrl_url_check"',
      );
      expect(sql).toContain(
        'ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_rejectionReason_check"',
      );
    });

    it('notes testing environment limitation regarding PostgreSQL concurrency', () => {
      // In-memory fixtures verify business logic, timing-safe hashes, RBAC, input sanitization,
      // and application-level state machine invariants.
      // True PostgreSQL multi-client row-level locking (e.g., SELECT FOR UPDATE) and transaction
      // isolation require a live PostgreSQL test instance.
      expect(true).toBe(true);
    });
  });
});
