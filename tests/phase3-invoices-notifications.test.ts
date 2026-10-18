import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type {
  AdminAuthRecord,
  AdminAuthRepository,
} from '../src/modules/auth/auth.types';
import { MemoryCartRepository } from '../src/modules/cart/memory-cart.repository';
import { MemoryCheckoutRepository } from '../src/modules/checkout/memory-checkout.repository';
import { MemoryContactInquiryRepository } from '../src/modules/contact-inquiry/memory-contact-inquiry.repository';
import { ContactInquiryService } from '../src/modules/contact-inquiry/contact-inquiry.service';
import { invoiceGeneratorService } from '../src/modules/invoices/invoice-generator.service';
import type {
  InvoiceOrderData,
  InvoiceStoreInfo,
} from '../src/modules/invoices/invoice.types';
import { MemoryNotificationOutboxRepository } from '../src/modules/notifications/memory-notification-outbox.repository';
import { NotificationOutboxService } from '../src/modules/notifications/notification-outbox.service';
import { MemoryEmailProvider } from '../src/modules/notifications/providers/memory-email.provider';
import { MemoryWhatsAppProvider } from '../src/modules/notifications/providers/memory-whatsapp.provider';
import { MemoryOrderManagementRepository } from '../src/modules/order-management/memory-order-management.repository';
import { MemoryPaymentMethodRepository } from '../src/modules/payment-method/memory-payment-method.repository';
import { MemoryStoreSettingsRepository } from '../src/modules/store-settings/memory-store-settings.repository';
import { testConfig } from './helpers';
import type {
  BrandRecord,
  CategoryRecord,
  CatalogRepository,
  PageResult,
  ProductRecord,
} from './test-catalog';

class TestCatalogRepo implements CatalogRepository {
  products: ProductRecord[] = [];
  constructor(products: ProductRecord[]) {
    this.products = products;
  }
  async listCategories(): Promise<PageResult<CategoryRecord>> {
    return {
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
    };
  }
  async findCategory(): Promise<CategoryRecord | null> {
    return null;
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
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
    };
  }
  async findBrand(): Promise<BrandRecord | null> {
    return null;
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
  async deleteProduct(): Promise<void> {
    throw new Error('Not implemented');
  }
}

class TestAuthRepo implements AdminAuthRepository {
  public admin: AdminAuthRecord = {
    id: '40000000-0000-4000-8000-000000000001',
    email: 'admin@liquor-shop.test',
    passwordHash: 'argon2id-hash',
    name: 'Super Admin',
    isActive: true,
    roleId: 'role-super-admin',
    role: {
      id: 'role-super-admin',
      name: 'Super Admin',
      isActive: true,
      permissions: [
        'orders.read',
        'orders.update',
        'orders.status',
        'contact_inquiries.read',
        'contact_inquiries.write',
      ],
    },
  };

  public restrictedAdmin: AdminAuthRecord = {
    id: '40000000-0000-4000-8000-000000000002',
    email: 'restricted@liquor-shop.test',
    passwordHash: 'argon2id-hash',
    name: 'No Orders Admin',
    isActive: true,
    roleId: 'role-no-orders',
    role: {
      id: 'role-no-orders',
      name: 'No Orders',
      isActive: true,
      permissions: ['contact_inquiries.read'],
    },
  };

  async findByEmail(email: string): Promise<AdminAuthRecord | null> {
    if (email === this.admin.email) return this.admin;
    if (email === this.restrictedAdmin.email) return this.restrictedAdmin;
    return null;
  }
  async findById(id: string): Promise<AdminAuthRecord | null> {
    if (id === this.admin.id) return this.admin;
    if (id === this.restrictedAdmin.id) return this.restrictedAdmin;
    return null;
  }
  async updateLastLogin(): Promise<void> {}
  async listRoles() {
    return [];
  }
}

function createPhase3Harness(
  options: {
    storeOrderEmail?: string;
    storeContactEmail?: string;
    storeOwnerWhatsApp?: string;
    throwOnOutboxEnqueue?: boolean;
  } = {},
) {
  const storeOrderEmail =
    options.storeOrderEmail !== undefined
      ? options.storeOrderEmail
      : 'admin-orders@liquor-shop.test';
  const storeContactEmail =
    options.storeContactEmail !== undefined
      ? options.storeContactEmail
      : 'admin-contact@liquor-shop.test';
  const storeOwnerWhatsApp =
    options.storeOwnerWhatsApp !== undefined
      ? options.storeOwnerWhatsApp
      : '+9779801234567';

  const variantId = '50000000-0000-4000-8000-000000000001';
  const productId = '50000000-0000-4000-8000-000000000002';
  const categoryId = '50000000-0000-4000-8000-000000000003';
  const brandId = '50000000-0000-4000-8000-000000000004';

  const variant = {
    id: variantId,
    productId,
    sku: 'WHISKY-750ML',
    sizeLabel: '750ml',
    costPrice: '1200.00',
    sellingPrice: '1800.00',
    stock: 50,
    lowStockThreshold: 2,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    product: {
      id: productId,
      name: 'Old Durbar 750ml <Special & Rare>',
      slug: 'old-durbar-750ml',
      isActive: true,
    },
  };

  const product: ProductRecord = {
    id: productId,
    name: 'Old Durbar 750ml <Special & Rare>',
    slug: 'old-durbar-750ml',
    description: 'Blended Scotch Whisky',
    categoryId,
    brandId,
    discountType: 'NONE',
    discountValue: null,
    isFeatured: true,
    isActive: true,
    category: {
      id: categoryId,
      name: 'Whisky',
      slug: 'whisky',
      isActive: true,
    },
    brand: {
      id: brandId,
      name: 'Old Durbar',
      slug: 'old-durbar',
      isActive: true,
    },
    variants: [variant],
    images: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const catalogRepo = new TestCatalogRepo([product]);
  const cartRepo = new MemoryCartRepository();
  const checkoutRepo = new MemoryCheckoutRepository(
    [variant as unknown as { id: string; sku: string; stock: number }],
    [],
    cartRepo,
  );

  const authRepo = new TestAuthRepo();
  const baseOutboxRepo = new MemoryNotificationOutboxRepository();

  let outboxRepo = baseOutboxRepo;
  if (options.throwOnOutboxEnqueue) {
    outboxRepo = new Proxy(baseOutboxRepo, {
      get(target, prop, receiver) {
        if (prop === 'enqueue') {
          return async () => {
            throw new Error(
              'Database connection failure during notification enqueue',
            );
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  const emailProvider = new MemoryEmailProvider();
  const whatsappProvider = new MemoryWhatsAppProvider();
  const storeSettingsRepo = new MemoryStoreSettingsRepository();

  const notificationService = new NotificationOutboxService(
    outboxRepo,
    emailProvider,
    whatsappProvider,
    storeOwnerWhatsApp,
    'Old Liquor <orders@oldliquor.com>',
    undefined,
    storeOrderEmail,
    storeContactEmail,
    storeSettingsRepo,
  );

  checkoutRepo.setNotificationOutboxService(notificationService);

  const orderManagementRepo = new MemoryOrderManagementRepository(
    checkoutRepo,
    [
      {
        id: authRepo.admin.id,
        name: authRepo.admin.name,
        email: authRepo.admin.email,
      },
    ],
  );
  orderManagementRepo.setNotificationOutboxService(notificationService);

  const contactInquiryRepo = new MemoryContactInquiryRepository();
  const contactInquiryService = new ContactInquiryService(
    contactInquiryRepo,
    undefined,
    notificationService,
  );

  const paymentMethodRepo = new MemoryPaymentMethodRepository([
    {
      id: 'pm-cod',
      code: 'COD',
      name: 'Cash on Delivery',
      description: 'Pay on arrival',
      instructions: null,
      isActive: true,
      displayOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  const config = testConfig({
    STORE_OWNER_WHATSAPP_NUMBER: storeOwnerWhatsApp,
    STORE_ORDER_NOTIFICATION_EMAIL: storeOrderEmail,
    STORE_CONTACT_NOTIFICATION_EMAIL: storeContactEmail,
  });

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepo,
    catalogRepository: catalogRepo,
    cartRepository: cartRepo,
    checkoutRepository: checkoutRepo,
    paymentMethodRepository: paymentMethodRepo,
    orderManagementRepository: orderManagementRepo,
    storeSettingsRepository: storeSettingsRepo,
    notificationOutboxRepository: outboxRepo,
    contactInquiryRepository: contactInquiryRepo,
    contactInquiryService,
    emailProvider,
    whatsappProvider,
    notificationOutboxService: notificationService,
  });

  const adminToken = createAdminAccessToken(config, authRepo.admin.id);
  const restrictedAdminToken = createAdminAccessToken(
    config,
    authRepo.restrictedAdmin.id,
  );

  return {
    app,
    catalogRepo,
    cartRepo,
    checkoutRepo,
    orderManagementRepo,
    contactInquiryRepo,
    outboxRepo: baseOutboxRepo,
    emailProvider,
    whatsappProvider,
    notificationService,
    storeSettingsRepo,
    authRepo,
    adminToken,
    restrictedAdminToken,
    variant,
  };
}

describe('Phase 3: Invoices, Notifications & Contact Email Integration', () => {
  describe('Task 1 — Admin New-Order Email Notification', () => {
    it('enqueues ORDER_CREATED_ADMIN_ALERT email to configured STORE_ORDER_NOTIFICATION_EMAIL on guest checkout', async () => {
      const harness = createPhase3Harness({
        storeOrderEmail: 'admin-orders@liquor-shop.test',
      });

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Prajwol & Sons <VIP>',
            phone: '+977-9841234567',
            email: 'prajwol@example.com',
            deliveryAddress: 'House 42, "Baneshwor", Kathmandu & Patan',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const order = res.body.data;

      const notifications = await harness.outboxRepo.listByOrderId(order.id);
      const adminEmailNotif = notifications.find(
        (n) =>
          n.channel === 'EMAIL' && n.eventType === 'ORDER_CREATED_ADMIN_ALERT',
      );

      expect(adminEmailNotif).toBeDefined();
      expect(adminEmailNotif?.recipient).toBe('admin-orders@liquor-shop.test');
      expect(adminEmailNotif?.subject).toBe(
        `New Order Received - ${order.orderNumber}`,
      );
      expect(adminEmailNotif?.idempotencyKey).toBe(
        `email:order-created-admin:${order.orderNumber}`,
      );
      expect(adminEmailNotif?.status).toBe('PENDING');

      // Verify payload contains full order pricing and details
      expect(adminEmailNotif?.payload).toMatchObject({
        orderNumber: order.orderNumber,
        customerName: 'Prajwol & Sons <VIP>',
        customerPhone: '+977-9841234567',
        customerEmail: 'prajwol@example.com',
        total: order.total,
      });

      // Dispatch via outbox processor
      const processResult =
        await harness.notificationService.processPendingNotifications();
      expect(processResult.delivered).toBeGreaterThanOrEqual(1);

      // Verify dispatched email content and HTML escaping
      const sentAdminEmail = harness.emailProvider.sentEmails.find(
        (e) => e.to === 'admin-orders@liquor-shop.test',
      );
      expect(sentAdminEmail).toBeDefined();
      expect(sentAdminEmail?.subject).toBe(
        `New Order Received - ${order.orderNumber}`,
      );
      expect(sentAdminEmail?.from).toBe('Old Liquor <orders@oldliquor.com>');
      expect(sentAdminEmail?.text).toContain(order.orderNumber);
      expect(sentAdminEmail?.text).toContain('Prajwol & Sons <VIP>');
      expect(sentAdminEmail?.text).toContain(order.total);

      // Verify HTML escaping of special characters in customer input
      expect(sentAdminEmail?.html).toContain('&lt;VIP&gt;');
      expect(sentAdminEmail?.html).toContain('&amp; Patan');
      expect(sentAdminEmail?.html).not.toContain('<VIP>');
    });

    it('skips admin email notification gracefully if STORE_ORDER_NOTIFICATION_EMAIL is not configured', async () => {
      const harness = createPhase3Harness({
        storeOrderEmail: '',
      });

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'No Admin Email Customer',
            phone: '+977-9841112233',
            email: 'test@example.com',
            deliveryAddress: 'Thamel, Kathmandu',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
        })
        .expect(201);

      const notifications = await harness.outboxRepo.listByOrderId(
        res.body.data.id,
      );
      const adminEmailNotif = notifications.find(
        (n) =>
          n.channel === 'EMAIL' && n.eventType === 'ORDER_CREATED_ADMIN_ALERT',
      );
      expect(adminEmailNotif).toBeUndefined();
    });

    it('prevents duplicate admin new-order emails on retried checkout with same idempotency key', async () => {
      const harness = createPhase3Harness();

      const idempotencyKey = 'admin-email-idemp-123';
      const payload = {
        idempotencyKey,
        items: [{ variantId: harness.variant.id, quantity: 1 }],
        customer: {
          name: 'Idempotent Customer',
          phone: '+977-9849998877',
          email: 'idempotent@example.com',
          deliveryAddress: 'Pulchowk, Lalitpur',
          coordinates: { latitude: 27.7172, longitude: 85.324 },
        },
      };

      const res1 = await request(harness.app)
        .post('/api/checkout')
        .send(payload)
        .expect(201);

      const res2 = await request(harness.app)
        .post('/api/checkout')
        .send(payload)
        .expect(201);

      expect(res1.body.data.orderNumber).toBe(res2.body.data.orderNumber);

      const notifications = await harness.outboxRepo.listByOrderId(
        res1.body.data.id,
      );
      const adminEmails = notifications.filter(
        (n) =>
          n.channel === 'EMAIL' && n.eventType === 'ORDER_CREATED_ADMIN_ALERT',
      );
      expect(adminEmails.length).toBe(1);
    });
  });

  describe('Task 2 — Contact Us Email Notifications', () => {
    it('enqueues CONTACT_INQUIRY_ADMIN_ALERT and CONTACT_INQUIRY_CUSTOMER_ACK on public inquiry submission', async () => {
      const harness = createPhase3Harness({
        storeContactEmail: 'admin-contact@liquor-shop.test',
      });

      const res = await request(harness.app)
        .post('/api/contact')
        .send({
          name: 'Suman Shrestha & Family <Test>',
          phone: '+977-9801122334',
          email: 'suman@example.com',
          subject: 'Event bulk order enquiry & pricing',
          message:
            'Hello, do you support wholesale pricing for weddings? <script>alert(1)</script>',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const inquiryId = res.body.data.id;
      expect(inquiryId).toBeDefined();

      const allRecords = await harness.outboxRepo.claimBatch(10);
      expect(allRecords.length).toBeGreaterThanOrEqual(2);

      const adminAlert = allRecords.find(
        (r) => r.eventType === 'CONTACT_INQUIRY_ADMIN_ALERT',
      );
      expect(adminAlert).toBeDefined();
      expect(adminAlert?.recipient).toBe('admin-contact@liquor-shop.test');
      expect(adminAlert?.idempotencyKey).toBe(
        `email:contact-inquiry-admin:${inquiryId}`,
      );

      const customerAck = allRecords.find(
        (r) => r.eventType === 'CONTACT_INQUIRY_CUSTOMER_ACK',
      );
      expect(customerAck).toBeDefined();
      expect(customerAck?.recipient).toBe('suman@example.com');
      expect(customerAck?.idempotencyKey).toBe(
        `email:contact-inquiry-customer:${inquiryId}`,
      );

      // Dispatch notifications
      // Reset claim so processPendingNotifications can process them
      for (const r of allRecords) {
        await harness.outboxRepo.markFailed(r.id, {
          errorMessage: 're-queue for test',
          attemptCount: 0,
          nextRetryAt: new Date(Date.now() - 1000),
          isPermanent: false,
        });
      }

      await harness.notificationService.processPendingNotifications();

      const sentAdmin = harness.emailProvider.sentEmails.find(
        (e) => e.to === 'admin-contact@liquor-shop.test',
      );
      expect(sentAdmin).toBeDefined();
      expect(sentAdmin?.subject).toContain(
        'Event bulk order enquiry & pricing',
      );
      expect(sentAdmin?.html).toContain(
        '&lt;script&gt;alert(1)&lt;/script&gt;',
      );
      expect(sentAdmin?.html).not.toContain('<script>alert(1)</script>');

      const sentCustomer = harness.emailProvider.sentEmails.find(
        (e) => e.to === 'suman@example.com',
      );
      expect(sentCustomer).toBeDefined();
      expect(sentCustomer?.html).toContain(
        'Suman Shrestha &amp; Family &lt;Test&gt;',
      );
    });

    it('skips customer acknowledgement when inquiry is submitted without an email address', async () => {
      const harness = createPhase3Harness({
        storeContactEmail: 'admin-contact@liquor-shop.test',
      });

      const res = await request(harness.app)
        .post('/api/contact')
        .send({
          name: 'Phone Only Customer',
          phone: '+977-9801122334',
          subject: 'Store opening hours inquiry',
          message: 'Are you open on Saturdays and late nights?',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const inquiryId = res.body.data.id;

      const records = await harness.outboxRepo.claimBatch(10);
      const adminAlert = records.find(
        (r) =>
          r.eventType === 'CONTACT_INQUIRY_ADMIN_ALERT' &&
          r.payload.inquiryId === inquiryId,
      );
      const customerAck = records.find(
        (r) =>
          r.eventType === 'CONTACT_INQUIRY_CUSTOMER_ACK' &&
          r.payload.inquiryId === inquiryId,
      );

      expect(adminAlert).toBeDefined();
      expect(customerAck).toBeUndefined();
    });

    it('remains resilient and persists inquiry successfully even if outbox notification fails', async () => {
      const harness = createPhase3Harness({
        throwOnOutboxEnqueue: true,
      });

      const res = await request(harness.app)
        .post('/api/contact')
        .send({
          name: 'Resilient Contact Submission',
          phone: '+977-9801122334',
          email: 'resilient@example.com',
          subject: 'Testing resilience',
          message:
            'Will this submission succeed if notification service throws?',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Resilient Contact Submission');

      // Verify inquiry was persisted in repository
      const savedInquiry = await harness.contactInquiryRepo.findById(
        res.body.data.id,
      );
      expect(savedInquiry).toBeDefined();
      expect(savedInquiry?.name).toBe('Resilient Contact Submission');
    });
  });

  describe('Task 3 — PDF Invoice Generation Service & Admin Endpoint', () => {
    it('generates a valid, deterministic PDF buffer with InvoiceGeneratorService', async () => {
      const invoiceData: InvoiceOrderData = {
        orderNumber: 'ORD-TEST-001',
        createdAt: new Date('2026-10-14T10:00:00Z'),
        customer: {
          name: 'Prajwol Shrestha',
          phone: '+977-9841234567',
          email: 'prajwol@example.com',
          deliveryAddress: 'Baneshwor, Kathmandu',
        },
        items: [
          {
            productName: 'Old Durbar 750ml',
            sku: 'OD-750',
            sizeLabel: '750ml',
            quantity: 2,
            unitPrice: '1800.00',
            subtotal: '3600.00',
          },
        ],
        pricing: {
          subtotal: '3600.00',
          discountTotal: '0.00',
          deliveryFee: '100.00',
          total: '3700.00',
        },
        payment: {
          methodName: 'Cash on Delivery',
          status: 'PENDING',
        },
        status: 'CONFIRMED',
      };

      const storeInfo: InvoiceStoreInfo = {
        storeName: 'Old Liquor Test Store',
        primaryPhone: '+977-9800000000',
        supportEmail: 'support@oldliquor.test',
        address: 'Baneshwor Height',
        city: 'Kathmandu',
      };

      const pdfBuffer = await invoiceGeneratorService.generateInvoicePdf(
        invoiceData,
        storeInfo,
      );

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(500);
      // Valid PDF files start with the magic header '%PDF-'
      expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('returns 200 and application/pdf on GET /api/admin/orders/:id/invoice with orders.read permission', async () => {
      const harness = createPhase3Harness();

      // Create an order first
      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 2 }],
          customer: {
            name: 'Invoice Download Customer',
            phone: '+977-9841234567',
            email: 'invoice@example.com',
            deliveryAddress: 'Thamel, Kathmandu',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
        })
        .expect(201);

      const order = checkoutRes.body.data;

      const res = await request(harness.app)
        .get(`/api/admin/orders/${order.id}/invoice`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toBe(
        `inline; filename="invoice-${order.orderNumber}.pdf"`,
      );
      expect(Number(res.headers['content-length'])).toBeGreaterThan(500);

      // Verify PDF binary payload
      const buffer = res.body as Buffer;
      expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('enforces RBAC and authentication on GET /api/admin/orders/:id/invoice', async () => {
      const harness = createPhase3Harness();

      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Auth Test Customer',
            phone: '+977-9841234567',
            email: 'auth@example.com',
            deliveryAddress: 'Jawalakhel, Lalitpur',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
        })
        .expect(201);

      const orderId = checkoutRes.body.data.id;

      // 401 Unauthenticated
      await request(harness.app)
        .get(`/api/admin/orders/${orderId}/invoice`)
        .expect(401);

      // 403 Forbidden when admin lacks orders.read
      await request(harness.app)
        .get(`/api/admin/orders/${orderId}/invoice`)
        .set('Authorization', `Bearer ${harness.restrictedAdminToken}`)
        .expect(403);

      // 404 on nonexistent order ID
      await request(harness.app)
        .get(`/api/admin/orders/non-existent-order-id/invoice`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .expect(404);
    });
  });

  describe('Task 4 — Customer Email with PDF Invoice Attachment', () => {
    it('enqueues ORDER_CONFIRMED_CUSTOMER_INVOICE and attaches PDF invoice when order status transitions to CONFIRMED', async () => {
      const harness = createPhase3Harness();

      // Create initial order
      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Anup Bista',
            phone: '+977-9841998877',
            email: 'anup@example.com',
            deliveryAddress: 'Baluwatar, Kathmandu',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
        })
        .expect(201);

      const order = checkoutRes.body.data;

      // Admin transitions status PENDING -> CONFIRMED
      await request(harness.app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({
          status: 'CONFIRMED',
          reason: 'Age and inventory verified',
        })
        .expect(200);

      // Verify outbox record exists
      const notifications = await harness.outboxRepo.listByOrderId(order.id);
      const invoiceNotif = notifications.find(
        (n) =>
          n.channel === 'EMAIL' &&
          n.eventType === 'ORDER_CONFIRMED_CUSTOMER_INVOICE',
      );

      expect(invoiceNotif).toBeDefined();
      expect(invoiceNotif?.recipient).toBe('anup@example.com');
      expect(invoiceNotif?.subject).toBe(
        `Order Confirmation - ${order.orderNumber}`,
      );

      // Verify outbox payload stores order metadata (NO large binary PDF blob in DB JSON payload)
      expect(invoiceNotif?.payload).toMatchObject({
        orderNumber: order.orderNumber,
        customerName: 'Anup Bista',
        customerEmail: 'anup@example.com',
      });
      expect(
        (invoiceNotif?.payload as Record<string, unknown>).pdfBuffer,
      ).toBeUndefined();
      expect(
        (invoiceNotif?.payload as Record<string, unknown>).attachments,
      ).toBeUndefined();

      // Process outbox notifications
      await harness.notificationService.processPendingNotifications();

      // Verify dispatched customer confirmation email has the PDF attachment
      const sentCustomerEmail = harness.emailProvider.sentEmails.find(
        (e) => e.to === 'anup@example.com',
      );
      expect(sentCustomerEmail).toBeDefined();
      expect(sentCustomerEmail?.subject).toBe(
        `Order Confirmation - ${order.orderNumber}`,
      );
      expect(sentCustomerEmail?.attachments).toBeDefined();
      expect(sentCustomerEmail?.attachments?.length).toBe(1);

      const attachment = sentCustomerEmail?.attachments?.[0];
      expect(attachment?.filename).toBe(`invoice-${order.orderNumber}.pdf`);
      expect(attachment?.contentType).toBe('application/pdf');
      expect(attachment?.content).toBeInstanceOf(Buffer);

      // Verify attachment buffer is a valid PDF
      const pdfContent = Buffer.isBuffer(attachment?.content)
        ? attachment.content
        : Buffer.from(attachment!.content as string);
      expect(pdfContent.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('safely regenerates PDF attachment during outbox worker retry after transient failure', async () => {
      const harness = createPhase3Harness();

      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Retry Customer',
            phone: '+977-9841998877',
            email: 'retry-cust@example.com',
            deliveryAddress: 'Naxal, Kathmandu',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
        })
        .expect(201);

      const order = checkoutRes.body.data;

      // Status -> CONFIRMED
      await request(harness.app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      // Simulate transient email failure on first attempt
      harness.emailProvider.setSimulatedError(
        new Error('SMTP connection reset'),
        1,
      );

      // First run: fails
      const batch1 =
        await harness.notificationService.processPendingNotifications();
      expect(batch1.failed).toBeGreaterThanOrEqual(1);

      // Second run: succeeds
      const batch2 =
        await harness.notificationService.processPendingNotifications({
          now: new Date(Date.now() + 60_000),
        });
      expect(batch2.delivered).toBeGreaterThanOrEqual(1);

      const sentEmail = harness.emailProvider.sentEmails.find(
        (e) => e.to === 'retry-cust@example.com',
      );
      expect(sentEmail).toBeDefined();
      expect(sentEmail?.attachments?.[0].filename).toBe(
        `invoice-${order.orderNumber}.pdf`,
      );
    });

    it('skips confirmation email gracefully if customer omitted email on order', async () => {
      const harness = createPhase3Harness();

      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'No Email Customer',
            phone: '+977-9841998877',
            deliveryAddress: 'Maharajgunj, Kathmandu',
            coordinates: { latitude: 27.7172, longitude: 85.324 },
          },
        })
        .expect(201);

      const order = checkoutRes.body.data;

      await request(harness.app)
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      const notifications = await harness.outboxRepo.listByOrderId(order.id);
      const invoiceNotifs = notifications.filter(
        (n) =>
          n.channel === 'EMAIL' &&
          n.eventType === 'ORDER_CONFIRMED_CUSTOMER_INVOICE',
      );
      expect(invoiceNotifs.length).toBe(0);
    });
  });
});
