import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type {
  AdminAuthRecord,
  AdminAuthRepository,
} from '../src/modules/auth/auth.types';
import { MemoryCartRepository } from '../src/modules/cart/memory-cart.repository';
import type {
  BrandRecord,
  CategoryRecord,
  CatalogRepository,
  PageResult,
  ProductImageRecord,
  ProductRecord,
  ProductVariantRecord,
} from '../src/modules/catalog/catalog.types';
import { MemoryCheckoutRepository } from '../src/modules/checkout/memory-checkout.repository';
import { MemoryOrderManagementRepository } from '../src/modules/order-management/memory-order-management.repository';
import { MemoryNotificationOutboxRepository } from '../src/modules/notifications/memory-notification-outbox.repository';
import {
  ELIGIBLE_EMAIL_STATUSES,
  isEligibleEmailStatus,
  NotificationOutboxService,
} from '../src/modules/notifications/notification-outbox.service';
import { MemoryEmailProvider } from '../src/modules/notifications/providers/memory-email.provider';
import { MemoryWhatsAppProvider } from '../src/modules/notifications/providers/memory-whatsapp.provider';
import {
  ConsoleEmailProvider,
  UnconfiguredEmailProvider,
} from '../src/modules/notifications/providers/email.provider';
import {
  ConsoleWhatsAppProvider,
  UnconfiguredWhatsAppProvider,
} from '../src/modules/notifications/providers/whatsapp.provider';
import { testConfig } from './helpers';

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

class TestAuthRepo implements AdminAuthRepository {
  public admin: AdminAuthRecord = {
    id: '40000000-0000-4000-8000-000000000001',
    email: 'admin@liquor-shop.test',
    name: 'Super Admin',
    passwordHash: 'argon2id-hash',
    isActive: true,
    role: {
      id: 'role-1',
      name: 'SUPER_ADMIN',
      isActive: true,
      permissions: ['orders.read', 'orders.update', 'orders.status'],
    },
  };

  async findByEmail(email: string) {
    return email === this.admin.email ? this.admin : null;
  }
  async findById(id: string) {
    return id === this.admin.id ? this.admin : null;
  }
}

function createHarness(
  options: {
    storeOwnerWhatsApp?: string;
    emailProvider?: MemoryEmailProvider;
    whatsappProvider?: MemoryWhatsAppProvider;
    outboxRepo?: MemoryNotificationOutboxRepository;
  } = {},
) {
  const variantId = '50000000-0000-4000-8000-000000000001';
  const productId = '50000000-0000-4000-8000-000000000002';

  const variant: ProductVariantRecord = {
    id: variantId,
    productId,
    sku: 'RUM-OLD-MONK',
    sizeLabel: '750ml',
    costPrice: '1200.00',
    sellingPrice: '1800.00',
    stock: 20,
    lowStockThreshold: 2,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const product: ProductRecord = {
    id: productId,
    categoryId: '50000000-0000-4000-8000-000000000003',
    brandId: '50000000-0000-4000-8000-000000000004',
    name: 'Old Monk XXX Rum',
    slug: 'old-monk-xxx-rum',
    description: 'Dark Rum',
    discountType: 'NONE',
    discountValue: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: '50000000-0000-4000-8000-000000000003',
      name: 'Rum',
      slug: 'rum',
      isActive: true,
    },
    brand: {
      id: '50000000-0000-4000-8000-000000000004',
      name: 'Old Monk',
      slug: 'old-monk',
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

  const authRepo = new TestAuthRepo();
  const outboxRepo =
    options.outboxRepo ?? new MemoryNotificationOutboxRepository();
  const emailProvider = options.emailProvider ?? new MemoryEmailProvider();
  const whatsappProvider =
    options.whatsappProvider ?? new MemoryWhatsAppProvider();

  const storeOwnerWhatsApp = options.storeOwnerWhatsApp ?? '+9779801234567';

  const notificationService = new NotificationOutboxService(
    outboxRepo,
    emailProvider,
    whatsappProvider,
    storeOwnerWhatsApp,
    'Old Liquor <orders@oldliquor.com>',
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

  const config = testConfig({
    STORE_OWNER_WHATSAPP_NUMBER: storeOwnerWhatsApp,
  });

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepo,
    catalogRepository: catalogRepo,
    cartRepository: cartRepo,
    checkoutRepository: checkoutRepo,
    orderManagementRepository: orderManagementRepo,
    notificationOutboxRepository: outboxRepo,
    emailProvider,
    whatsappProvider,
    notificationOutboxService: notificationService,
  });

  const adminToken = createAdminAccessToken(config, authRepo.admin.id);

  return {
    app,
    catalogRepo,
    cartRepo,
    checkoutRepo,
    orderManagementRepo,
    outboxRepo,
    emailProvider,
    whatsappProvider,
    notificationService,
    authRepo,
    adminToken,
    variant,
  };
}

describe('Task 23: Reliable Email & WhatsApp Notifications', () => {
  describe('Notification Rules & Order Lifecycle Integration', () => {
    it('enqueues WhatsApp owner alert upon successful order creation, but NO customer email', async () => {
      const harness = createHarness();

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Bibek Sharma',
            phone: '+977-9841112233',
            email: 'bibek@example.com',
            deliveryAddress: 'New Baneshwor, Kathmandu',
          },
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const order = res.body.data;

      // 1. WhatsApp notification for shop owner must be enqueued
      const notifications = await harness.outboxRepo.listByOrderId(order.id);
      expect(notifications.length).toBe(1);

      const waNotification = notifications[0];
      expect(waNotification.channel).toBe('WHATSAPP');
      expect(waNotification.eventType).toBe('ORDER_CREATED_OWNER_ALERT');
      expect(waNotification.recipient).toBe('+9779801234567');
      expect(waNotification.status).toBe('PENDING');
      expect(waNotification.payload).toMatchObject({
        orderNumber: order.orderNumber,
        customerName: 'Bibek Sharma',
        customerPhone: '+977-9841112233',
        total: '1800.00',
      });

      // 2. Strict Rule: DO NOT send email merely because an order was created
      const emailNotifications = notifications.filter(
        (n) => n.channel === 'EMAIL',
      );
      expect(emailNotifications.length).toBe(0);
    });

    it('skips WhatsApp owner alert if STORE_OWNER_WHATSAPP_NUMBER is not configured', async () => {
      const harness = createHarness({ storeOwnerWhatsApp: '' });

      const res = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'No Owner Phone Customer',
            phone: '+977-9841112233',
            email: 'test@example.com',
            deliveryAddress: 'Thamel, Kathmandu',
          },
        })
        .expect(201);

      const notifications = await harness.outboxRepo.listByOrderId(
        res.body.data.id,
      );
      expect(notifications.length).toBe(0);
    });

    it('enqueues customer email ONLY for eligible status transitions: CONFIRMED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED', async () => {
      const harness = createHarness();

      // Create initial PENDING order
      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Aayush Karki',
            phone: '+977-9849998877',
            email: 'aayush@example.com',
            deliveryAddress: 'Sanepa, Lalitpur',
          },
        })
        .expect(201);

      const orderId = checkoutRes.body.data.id;

      // Transition PENDING -> CONFIRMED (Eligible!)
      await request(harness.app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({
          status: 'CONFIRMED',
          reason: 'Payment verified and verified age',
        })
        .expect(200);

      let notifications = await harness.outboxRepo.listByOrderId(orderId);
      const confirmedEmail = notifications.find(
        (n) => n.channel === 'EMAIL' && n.payload.toStatus === 'CONFIRMED',
      );
      expect(confirmedEmail).toBeDefined();
      expect(confirmedEmail?.recipient).toBe('aayush@example.com');
      expect(confirmedEmail?.status).toBe('PENDING');

      // Transition CONFIRMED -> PROCESSING (Ineligible for customer email!)
      await request(harness.app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ status: 'PROCESSING', reason: 'Packing items at warehouse' })
        .expect(200);

      notifications = await harness.outboxRepo.listByOrderId(orderId);
      const processingEmail = notifications.find(
        (n) => n.channel === 'EMAIL' && n.payload.toStatus === 'PROCESSING',
      );
      expect(processingEmail).toBeUndefined(); // No email for PROCESSING

      // Transition PROCESSING -> OUT_FOR_DELIVERY (Eligible!)
      await request(harness.app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ status: 'OUT_FOR_DELIVERY', reason: 'Handed to driver' })
        .expect(200);

      notifications = await harness.outboxRepo.listByOrderId(orderId);
      const outEmail = notifications.find(
        (n) =>
          n.channel === 'EMAIL' && n.payload.toStatus === 'OUT_FOR_DELIVERY',
      );
      expect(outEmail).toBeDefined();

      // Transition OUT_FOR_DELIVERY -> DELIVERED (Eligible!)
      await request(harness.app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ status: 'DELIVERED', reason: 'Delivered and signed' })
        .expect(200);

      notifications = await harness.outboxRepo.listByOrderId(orderId);
      const deliveredEmail = notifications.find(
        (n) => n.channel === 'EMAIL' && n.payload.toStatus === 'DELIVERED',
      );
      expect(deliveredEmail).toBeDefined();

      // Verify all eligible statuses match the requirement specification
      expect(ELIGIBLE_EMAIL_STATUSES).toEqual([
        'CONFIRMED',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
      ]);
      expect(isEligibleEmailStatus('CONFIRMED')).toBe(true);
      expect(isEligibleEmailStatus('PENDING')).toBe(false);
    });

    it('enqueues customer email when order is CANCELLED', async () => {
      const harness = createHarness();

      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Cancelled Customer',
            phone: '+977-9840000000',
            email: 'cancelled@example.com',
            deliveryAddress: 'Baluwatar, Kathmandu',
          },
        })
        .expect(201);

      const orderId = checkoutRes.body.data.id;

      await request(harness.app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({
          status: 'CANCELLED',
          reason: 'Customer requested cancellation',
        })
        .expect(200);

      const notifications = await harness.outboxRepo.listByOrderId(orderId);
      const cancelEmail = notifications.find(
        (n) => n.channel === 'EMAIL' && n.payload.toStatus === 'CANCELLED',
      );
      expect(cancelEmail).toBeDefined();
      expect(cancelEmail?.recipient).toBe('cancelled@example.com');
    });

    it('gracefully skips email notification when customer email is absent (null/empty)', async () => {
      const harness = createHarness();

      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Phone Only Guest',
            phone: '+977-9849991111',
            email: null, // No email provided
            deliveryAddress: 'Patan, Lalitpur',
          },
        })
        .expect(201);

      const orderId = checkoutRes.body.data.id;

      await request(harness.app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ status: 'CONFIRMED', reason: 'Order confirmed' })
        .expect(200);

      const notifications = await harness.outboxRepo.listByOrderId(orderId);
      const emailNotifications = notifications.filter(
        (n) => n.channel === 'EMAIL',
      );
      expect(emailNotifications.length).toBe(0); // Gracefully skipped!
    });
  });

  describe('Deduplication & Idempotency', () => {
    it('prevents duplicate outbox notifications on duplicate checkout retries with the same idempotency key', async () => {
      const harness = createHarness();
      const idempotencyKey = 'checkout-idempotency-key-001';

      const payload = {
        idempotencyKey,
        items: [{ variantId: harness.variant.id, quantity: 1 }],
        customer: {
          name: 'Idempotent Buyer',
          phone: '+977-9842223344',
          email: 'buyer@example.com',
          deliveryAddress: 'Naxal, Kathmandu',
        },
      };

      // First submission
      const res1 = await request(harness.app)
        .post('/api/checkout')
        .send(payload)
        .expect(201);
      // Retry with same payload and idempotency key
      const res2 = await request(harness.app)
        .post('/api/checkout')
        .send(payload)
        .expect(201);

      expect(res1.body.data.orderNumber).toBe(res2.body.data.orderNumber);

      const notifications = await harness.outboxRepo.listByOrderId(
        res1.body.data.id,
      );
      // Exactly 1 owner WhatsApp alert enqueued, not duplicated
      expect(notifications.length).toBe(1);
    });

    it('prevents duplicate status email notifications on duplicate status update requests', async () => {
      const harness = createHarness();

      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Deduplication Tester',
            phone: '+977-9843334455',
            email: 'dedup@example.com',
            deliveryAddress: 'Maitighar, Kathmandu',
          },
        })
        .expect(201);

      const orderId = checkoutRes.body.data.id;

      // First transition PENDING -> CONFIRMED
      await request(harness.app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ status: 'CONFIRMED', reason: 'Confirmed' })
        .expect(200);

      // Re-invoking enqueue directly with the same idempotency key
      const duplicateResult =
        await harness.notificationService.enqueueOrderStatusEmail(
          checkoutRes.body.data,
          'PENDING',
          'CONFIRMED',
        );
      expect(duplicateResult).toBeDefined();

      const notifications = await harness.outboxRepo.listByOrderId(orderId);
      const confirmedEmails = notifications.filter(
        (n) => n.channel === 'EMAIL' && n.payload.toStatus === 'CONFIRMED',
      );
      expect(confirmedEmails.length).toBe(1);
    });
  });

  describe('Asynchronous Processing, Retries & Worker Claiming', () => {
    it('processes pending notifications asynchronously outside database transactions', async () => {
      const harness = createHarness();

      // Enqueue 1 WhatsApp alert via checkout
      await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Worker Test Customer',
            phone: '+977-9845556677',
            email: 'worker@example.com',
            deliveryAddress: 'Thamel, Kathmandu',
          },
        })
        .expect(201);

      expect(harness.whatsappProvider.sentMessages.length).toBe(0); // Not sent yet!

      // Run worker explicitly
      const workerResult =
        await harness.notificationService.processPendingNotifications();

      expect(workerResult.processed).toBe(1);
      expect(workerResult.delivered).toBe(1);
      expect(workerResult.failed).toBe(0);

      // Provider received the WhatsApp message
      expect(harness.whatsappProvider.sentMessages.length).toBe(1);
      expect(harness.whatsappProvider.sentMessages[0].to).toBe(
        '+9779801234567',
      );
      expect(harness.whatsappProvider.sentMessages[0].message).toContain(
        'New Liquor Shop Order Placed',
      );

      // Record in outbox is DELIVERED
      const records = await harness.outboxRepo.claimBatch(10);
      expect(records.length).toBe(0); // Nothing left pending/processing
    });

    it('retries transient provider failures with exponential backoff and increments attemptCount', async () => {
      const harness = createHarness();

      // Configure WhatsApp provider to fail for the first 2 attempts
      harness.whatsappProvider.setSimulatedError(
        new Error('Network gateway timeout (504)'),
        2,
      );

      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Retry Customer',
            phone: '+977-9846667788',
            email: 'retry@example.com',
            deliveryAddress: 'Dillibazar, Kathmandu',
          },
        })
        .expect(201);

      const orderId = checkoutRes.body.data.id;

      // Attempt 1 -> fails
      const batch1 =
        await harness.notificationService.processPendingNotifications();
      expect(batch1.processed).toBe(1);
      expect(batch1.delivered).toBe(0);
      expect(batch1.failed).toBe(1);

      let record = (await harness.outboxRepo.listByOrderId(orderId))[0];
      expect(record.status).toBe('PENDING');
      expect(record.attemptCount).toBe(1);
      expect(record.errorMessage).toContain('Network gateway timeout');
      expect(record.nextRetryAt.getTime()).toBeGreaterThan(Date.now());

      // Attempt 2 (simulate nextRetryAt arrived)
      const batch2 =
        await harness.notificationService.processPendingNotifications({
          now: new Date(Date.now() + 10_000),
        });
      expect(batch2.failed).toBe(1);

      record = (await harness.outboxRepo.listByOrderId(orderId))[0];
      expect(record.attemptCount).toBe(2);

      // Attempt 3 -> succeeds!
      const batch3 =
        await harness.notificationService.processPendingNotifications({
          now: new Date(Date.now() + 20_000),
        });
      expect(batch3.delivered).toBe(1);

      record = (await harness.outboxRepo.listByOrderId(orderId))[0];
      expect(record.status).toBe('DELIVERED');
      expect(record.processedAt).toBeDefined();
    });

    it('marks notification as FAILED when max retry attempts are exhausted', async () => {
      const harness = createHarness();
      harness.emailProvider.setSimulatedError(
        new Error('Persistent SMTP connection refused'),
        999,
      );

      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Exhausted Retry Customer',
            phone: '+977-9847778899',
            email: 'exhaust@example.com',
            deliveryAddress: 'Baneshwor, Kathmandu',
          },
        })
        .expect(201);

      const orderId = checkoutRes.body.data.id;

      // Trigger CONFIRMED email
      await request(harness.app)
        .patch(`/api/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${harness.adminToken}`)
        .send({ status: 'CONFIRMED', reason: 'Confirmed' })
        .expect(200);

      const notifications = await harness.outboxRepo.listByOrderId(orderId);
      const emailRecord = notifications.find((n) => n.channel === 'EMAIL')!;

      // Run 5 attempts until maxAttempts (5) is exhausted
      let simTime = Date.now();
      for (let i = 1; i <= 5; i++) {
        simTime += 60_000;
        await harness.notificationService.processPendingNotifications({
          now: new Date(simTime),
        });
      }

      const updated = await harness.outboxRepo.findById(emailRecord.id);
      expect(updated?.status).toBe('FAILED');
      expect(updated?.attemptCount).toBe(5);
      expect(updated?.errorMessage).toContain(
        'Persistent SMTP connection refused',
      );
    });

    it('prevents concurrent workers from double-processing the same notification', async () => {
      const harness = createHarness();

      // Enqueue 3 notifications
      for (let i = 1; i <= 3; i++) {
        await harness.outboxRepo.enqueue({
          channel: 'WHATSAPP',
          eventType: 'ORDER_CREATED_OWNER_ALERT',
          recipient: '+9779801234567',
          payload: { orderNumber: `ORD-CONCUR-${i}` },
          idempotencyKey: `test:concur:${i}`,
        });
      }

      // Worker 1 claims batch of 2
      const worker1Claimed = await harness.outboxRepo.claimBatch(2);
      expect(worker1Claimed.length).toBe(2);

      // Worker 2 concurrently claims next batch
      const worker2Claimed = await harness.outboxRepo.claimBatch(2);
      // Only the 1 remaining record is available, never the ones claimed by worker 1!
      expect(worker2Claimed.length).toBe(1);
      expect(worker2Claimed[0].id).not.toBe(worker1Claimed[0].id);
      expect(worker2Claimed[0].id).not.toBe(worker1Claimed[1].id);
    });
  });

  describe('Provider Safety, Secret Redaction & Unconfigured Configuration', () => {
    it('throws NOTIFICATION_PROVIDER_UNCONFIGURED and never silently marks delivered when unconfigured', async () => {
      const unconfiguredEmail = new UnconfiguredEmailProvider();
      await expect(
        unconfiguredEmail.sendEmail({
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Test',
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 500,
          code: 'NOTIFICATION_PROVIDER_UNCONFIGURED',
        }),
      );

      const unconfiguredWhatsApp = new UnconfiguredWhatsAppProvider();
      await expect(
        unconfiguredWhatsApp.sendWhatsApp({
          to: '+9779801234567',
          message: 'Test',
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 500,
          code: 'NOTIFICATION_PROVIDER_UNCONFIGURED',
        }),
      );
    });

    it('redacts sensitive API tokens, passwords, and secrets from outbox error messages', async () => {
      const harness = createHarness();
      const secretApiToken = 'EAABwzSecretMetaToken1234567890';

      harness.whatsappProvider.setSimulatedError(
        new Error(
          `Provider call to https://graph.facebook.com/v19.0?key=${secretApiToken} failed`,
        ),
        1,
      );

      const checkoutRes = await request(harness.app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: harness.variant.id, quantity: 1 }],
          customer: {
            name: 'Secret Redaction Test',
            phone: '+977-9840001122',
            email: 'secret@example.com',
            deliveryAddress: 'Kathmandu',
          },
        })
        .expect(201);

      await harness.notificationService.processPendingNotifications();

      const records = await harness.outboxRepo.listByOrderId(
        checkoutRes.body.data.id,
      );
      const record = records[0];

      expect(record.errorMessage).toBeDefined();
      // Verify raw secret token is NOT leaked in the database error message
      expect(record.errorMessage).not.toContain(secretApiToken);
      expect(record.errorMessage).toContain('[REDACTED]');
    });

    it('supports console providers for local development without errors', async () => {
      const consoleEmail = new ConsoleEmailProvider();
      const emailResult = await consoleEmail.sendEmail({
        to: 'dev@example.com',
        subject: 'Dev order',
        text: 'Order dev text',
      });
      expect(emailResult.messageId).toContain('console-email');

      const consoleWA = new ConsoleWhatsAppProvider();
      const waResult = await consoleWA.sendWhatsApp({
        to: '+9779801234567',
        message: 'Dev WA text',
      });
      expect(waResult.messageId).toContain('console-wa');
    });
  });
});
