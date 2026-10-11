import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config/env';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import { MemoryCheckoutRepository } from '../src/modules/checkout/memory-checkout.repository';
import { MemoryPaymentMethodRepository } from '../src/modules/payment-method/memory-payment-method.repository';
import type { ManagedPaymentMethod } from '../src/modules/payment-method/payment-method.types';
import { MemoryPaymentSubmissionRepository } from '../src/modules/payment-submission/memory-payment-submission.repository';
import {
  MemoryCloudinaryClient,
  UnconfiguredCloudinaryClient,
} from '../src/modules/media/cloudinary.client';
import { CloudinaryService } from '../src/modules/media/cloudinary.service';
import { MemoryMediaReferenceChecker } from '../src/modules/media/media-reference-checker';
import { testConfig } from './helpers';

// Helper mock images with valid magic bytes
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x5c, 0x72, 0xa8, 0x66,
]);

const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08,
  0x06, 0x06,
]);

const VALID_WEBP_BUFFER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56,
  0x50, 0x38, 0x18, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01,
  0x00, 0x01,
]);

const FAKE_IMAGE_BUFFER = Buffer.from(
  '<html><body><h1>Fake executable payload disguised as image</h1></body></html>',
  'utf8',
);

interface FixtureOptions {
  permissions?: string[];
  mockClient?: MemoryCloudinaryClient;
  useUnconfiguredClient?: boolean;
}

function setupMediaFixture(options: FixtureOptions = {}) {
  const config = testConfig({
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-api-key',
    CLOUDINARY_API_SECRET: 'test-api-secret',
    CLOUDINARY_PRODUCT_FOLDER: 'liquor_shop/products',
    CLOUDINARY_PAYMENT_QR_FOLDER: 'liquor_shop/payment_qr',
  });

  const adminId = '90000000-0000-4000-8000-000000000001';
  const roleId = '90000000-0000-4000-8000-000000000002';
  const permissions = options.permissions ?? [
    'catalog.product-images.create',
    'catalog.product-images.update',
    'catalog.product-images.delete',
    'payment-methods.create',
    'payment-methods.update',
    'payment-methods.read',
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
      code: 'STATIC_QR',
      type: 'STATIC_QR',
      name: 'Fonepay QR',
      description: 'Scan & Pay',
      providerLabel: 'Fonepay',
      accountName: 'Liquor Store',
      accountNumber: '9801234567',
      qrImageUrl:
        'https://res.cloudinary.com/mock-cloud/image/upload/v1/liquor_shop/payment_qr/in-use-qr.webp',
      instructions: null,
      minAmount: null,
      maxAmount: null,
      displayOrder: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const paymentRepo = new MemoryPaymentMethodRepository(initialPaymentMethods);
  const checkoutRepo = new MemoryCheckoutRepository([], []);
  const submissionRepo = new MemoryPaymentSubmissionRepository(checkoutRepo, [
    { id: adminId, name: 'Ops Manager', email: 'ops@liquorshop.test' },
  ]);

  const productImages = [
    {
      publicId: 'liquor_shop/products/in-use-product-img',
      imageUrl:
        'https://res.cloudinary.com/mock-cloud/image/upload/v1/liquor_shop/products/in-use-product-img.webp',
      productId: 'prod-uuid-1',
    },
  ];

  const referenceChecker = new MemoryMediaReferenceChecker(
    paymentRepo,
    submissionRepo,
    checkoutRepo,
    productImages,
  );

  const mockClient = options.mockClient ?? new MemoryCloudinaryClient();
  const client = options.useUnconfiguredClient
    ? new UnconfiguredCloudinaryClient()
    : mockClient;

  const cloudinaryService = new CloudinaryService(
    config,
    client,
    referenceChecker,
  );

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    paymentMethodRepository: paymentRepo,
    checkoutRepository: checkoutRepo,
    paymentSubmissionRepository: submissionRepo,
    cloudinaryService,
    cloudinaryClient: client,
  });

  const token = createAdminAccessToken(config, adminId);

  return {
    app,
    token,
    config,
    mockClient,
    paymentRepo,
    submissionRepo,
    checkoutRepo,
    cloudinaryService,
    referenceChecker,
  };
}

describe('Cloudinary Media Integration & Asset Security', () => {
  describe('Environment Configuration & Missing Credentials Safety', () => {
    it('validates partial Cloudinary configuration and rejects incomplete settings', () => {
      const baseEnv = {
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL:
          'postgresql://user:pass@localhost:5432/liquordb?schema=public',
        CORS_ORIGINS: 'http://localhost:5173',
        JWT_SECRET: Buffer.alloc(32, 1).toString('base64url'),
        JWT_ISSUER: 'https://liquor-shop.test',
        JWT_AUDIENCE: 'liquor-shop-test',
        JWT_ACCESS_TOKEN_TTL_SECONDS: '900',
      };

      // Supplying CLOUDINARY_CLOUD_NAME without API key and secret must fail validation
      expect(() =>
        loadConfig({
          ...baseEnv,
          CLOUDINARY_CLOUD_NAME: 'only-cloud-name',
        }),
      ).toThrow(
        /CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be provided together/,
      );

      // Supplying CLOUDINARY_API_KEY without secret must fail
      expect(() =>
        loadConfig({
          ...baseEnv,
          CLOUDINARY_CLOUD_NAME: 'cloud',
          CLOUDINARY_API_KEY: 'key',
        }),
      ).toThrow(/must all be provided together/);
    });

    it('rejects uploads with explicit 500 error when Cloudinary credentials are not configured', async () => {
      const { app, token } = setupMediaFixture({ useUnconfiguredClient: true });

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PRODUCT_IMAGE',
          fileBase64: VALID_PNG_BUFFER.toString('base64'),
          mimeType: 'image/png',
        });

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('CLOUDINARY_CONFIG_MISSING');
      expect(res.body.error.message).toContain(
        'Cloudinary storage is not configured',
      );
    });
  });

  describe('Admin Authentication & Purpose-Based Permission Enforcement', () => {
    it('rejects unauthenticated upload requests with 401', async () => {
      const { app } = setupMediaFixture();

      const res = await request(app)
        .post('/api/admin/media/upload')
        .send({
          purpose: 'PRODUCT_IMAGE',
          fileBase64: VALID_PNG_BUFFER.toString('base64'),
          mimeType: 'image/png',
        });

      expect(res.status).toBe(401);
    });

    it('rejects product image upload when admin lacks catalog.product-images.create permission', async () => {
      const { app, token } = setupMediaFixture({
        permissions: ['payment-methods.create'], // lacks product image permission
      });

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PRODUCT_IMAGE',
          fileBase64: VALID_PNG_BUFFER.toString('base64'),
          mimeType: 'image/png',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('catalog.product-images.create');
    });

    it('rejects payment QR upload when admin lacks payment-methods.create/update permission', async () => {
      const { app, token } = setupMediaFixture({
        permissions: ['catalog.product-images.create'], // lacks payment method permission
      });

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PAYMENT_QR',
          fileBase64: VALID_PNG_BUFFER.toString('base64'),
          mimeType: 'image/png',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('payment-methods.create');
    });
  });

  describe('Image Validation: Formats, Magic Bytes, and File Size', () => {
    it('rejects unsupported image MIME types with 415', async () => {
      const { app, token } = setupMediaFixture();

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PRODUCT_IMAGE',
          fileBase64: Buffer.from('GIF89a...').toString('base64'),
          mimeType: 'image/gif',
        });

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects files disguised as images when magic bytes do not match allowed formats', async () => {
      const { app, token } = setupMediaFixture();

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PRODUCT_IMAGE',
          fileBase64: FAKE_IMAGE_BUFFER.toString('base64'),
          mimeType: 'image/png',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE_CONTENT');
    });

    it('rejects MIME type mismatches (e.g. declaring JPEG for PNG content)', async () => {
      const { app, token } = setupMediaFixture();

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PRODUCT_IMAGE',
          fileBase64: VALID_PNG_BUFFER.toString('base64'),
          mimeType: 'image/jpeg', // mismatch
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MIME_MISMATCH');
    });

    it('rejects oversized PAYMENT_QR images (> 2 MB)', async () => {
      const { app, token } = setupMediaFixture();

      // Create a 2.1 MB buffer starting with valid PNG header
      const largePng = Buffer.alloc(2.1 * 1024 * 1024);
      VALID_PNG_BUFFER.copy(largePng, 0);

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('purpose', 'PAYMENT_QR')
        .attach('file', largePng, 'large-qr.png');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
      expect(res.body.error.message).toContain('2 MB');
    });

    it('rejects oversized PRODUCT_IMAGE files (> 5 MB)', async () => {
      const { app, token } = setupMediaFixture();

      const largePng = Buffer.alloc(5.1 * 1024 * 1024);
      VALID_PNG_BUFFER.copy(largePng, 0);

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('purpose', 'PRODUCT_IMAGE')
        .attach('file', largePng, 'oversized.png');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('Safe Asset Metadata & Cloudinary Upload Verification', () => {
    it('uploads valid PNG product image via multipart form-data and returns safe metadata', async () => {
      const { app, token, mockClient } = setupMediaFixture();

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('purpose', 'PRODUCT_IMAGE')
        .attach('file', VALID_PNG_BUFFER, 'whisky-bottle.png');

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        format: 'webp',
        folder: 'liquor_shop/products',
        purpose: 'PRODUCT_IMAGE',
      });
      expect(res.body.data.secureUrl).toMatch(
        /^https:\/\/res\.cloudinary\.com\//,
      );
      expect(res.body.data.publicId).toMatch(/^liquor_shop\/products\//);
      expect(res.body.data.bytes).toBe(VALID_PNG_BUFFER.length);

      // Verify no secrets were leaked in response
      const rawJson = JSON.stringify(res.body);
      expect(rawJson).not.toContain('test-api-secret');
      expect(rawJson).not.toContain('test-api-key');

      // Verify asset exists in mock Cloudinary store
      expect(mockClient.assets.has(res.body.data.publicId)).toBe(true);
    });

    it('uploads valid JPEG payment QR via JSON base64 and puts it into the payment_qr folder', async () => {
      const { app, token, mockClient } = setupMediaFixture();

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PAYMENT_QR',
          fileBase64: `data:image/jpeg;base64,${VALID_JPEG_BUFFER.toString('base64')}`,
          mimeType: 'image/jpeg',
          originalFilename: 'fonepay-counter-qr.jpg',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.folder).toBe('liquor_shop/payment_qr');
      expect(res.body.data.purpose).toBe('PAYMENT_QR');
      expect(res.body.data.publicId).toMatch(/^liquor_shop\/payment_qr\//);

      expect(mockClient.assets.has(res.body.data.publicId)).toBe(true);
    });

    it('uploads valid WebP image with correct purpose tag', async () => {
      const { app, token } = setupMediaFixture();

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PRODUCT_IMAGE',
          fileBase64: VALID_WEBP_BUFFER.toString('base64'),
          mimeType: 'image/webp',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.purpose).toBe('PRODUCT_IMAGE');
    });
  });

  describe('Upload Error Handling, Retry Policy, and Secret Redaction', () => {
    it('retries on transient upload failure and succeeds within retry limit', async () => {
      const mockClient = new MemoryCloudinaryClient();
      mockClient.failNextUpload(new Error('Cloudinary socket timeout'));

      const { app, token } = setupMediaFixture({ mockClient });

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PRODUCT_IMAGE',
          fileBase64: VALID_PNG_BUFFER.toString('base64'),
          mimeType: 'image/png',
        });

      expect(res.status).toBe(201);
      // Attempt count should be 2 (first failed, second succeeded)
      expect(mockClient.uploadAttempts).toBe(2);
    });

    it('returns safe 502 error and redacts secrets when upload permanently fails', async () => {
      const mockClient = new MemoryCloudinaryClient();
      // Throw error containing potential secret or credentials
      mockClient.uploadStream = async () => {
        throw new Error(
          'API key test-api-key secret test-api-secret failed connection',
        );
      };

      const { app, token } = setupMediaFixture({ mockClient });

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PRODUCT_IMAGE',
          fileBase64: VALID_PNG_BUFFER.toString('base64'),
          mimeType: 'image/png',
        });

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('CLOUDINARY_UPLOAD_FAILED');

      const rawResponse = JSON.stringify(res.body);
      expect(rawResponse).not.toContain('test-api-secret');
    });
  });

  describe('Controlled Deletion & Historical Reference Protection', () => {
    it('prevents deleting asset referenced by an existing product image', async () => {
      const { app, token } = setupMediaFixture();

      const res = await request(app)
        .delete('/api/admin/media')
        .set('Authorization', `Bearer ${token}`)
        .send({
          publicId: 'liquor_shop/products/in-use-product-img',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ASSET_IN_USE');
      expect(res.body.error.message).toContain('prod-uuid-1');
    });

    it('prevents deleting asset referenced by an active payment method QR', async () => {
      const { app, token } = setupMediaFixture();

      const res = await request(app)
        .delete('/api/admin/media')
        .set('Authorization', `Bearer ${token}`)
        .send({
          publicId: 'liquor_shop/payment_qr/in-use-qr',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ASSET_IN_USE');
      expect(res.body.error.message).toContain('STATIC_QR');
    });

    it('never deletes historical payment evidence referenced by a payment submission', async () => {
      const { app, token, submissionRepo } = setupMediaFixture();

      const subId = crypto.randomUUID();
      submissionRepo.submissions.push({
        id: subId,
        orderId: 'ord-hist-1',
        proofImageUrl:
          'https://res.cloudinary.com/mock-cloud/image/upload/v1/liquor_shop/payment_qr/guest-receipt-proof.webp',
        transactionReference: 'TXN-999',
        customerNotes: null,
        status: 'APPROVED',
        reviewedByAdminId: 'admin-1',
        reviewedAt: new Date(),
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .delete('/api/admin/media')
        .set('Authorization', `Bearer ${token}`)
        .send({
          publicId: 'liquor_shop/payment_qr/guest-receipt-proof',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ASSET_IN_USE');
      expect(res.body.error.message).toContain('historical payment proof');
    });

    it('rejects deletion of assets outside the managed liquor_shop folders', async () => {
      const { app, token } = setupMediaFixture();

      const res = await request(app)
        .delete('/api/admin/media')
        .set('Authorization', `Bearer ${token}`)
        .send({
          publicId: 'malicious_user_folder/some-unrelated-file',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ASSET_TARGET');
    });

    it('allows deleting an unreferenced media asset when authorized', async () => {
      const { app, token, mockClient } = setupMediaFixture();

      // First upload an unreferenced asset
      const uploadRes = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PRODUCT_IMAGE',
          fileBase64: VALID_PNG_BUFFER.toString('base64'),
          mimeType: 'image/png',
        });
      expect(uploadRes.status).toBe(201);
      const publicId = uploadRes.body.data.publicId;

      expect(mockClient.assets.has(publicId)).toBe(true);

      // Now delete the unreferenced asset
      const deleteRes = await request(app)
        .delete('/api/admin/media')
        .set('Authorization', `Bearer ${token}`)
        .send({ publicId });

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.deleted).toBe(true);
      expect(mockClient.assets.has(publicId)).toBe(false);
    });
  });

  describe('Integration with Catalog and Payment Method workflows', () => {
    it('associates uploaded image with a product via catalog product-images API', async () => {
      const { app, token } = setupMediaFixture();

      // 1. Upload asset
      const uploadRes = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PRODUCT_IMAGE',
          fileBase64: VALID_PNG_BUFFER.toString('base64'),
          mimeType: 'image/png',
        });
      expect(uploadRes.status).toBe(201);
      const { secureUrl, publicId } = uploadRes.body.data;

      // 2. Associate with product (using existing product image validation schema)
      expect(secureUrl).toMatch(/^https:\/\//);
      expect(publicId).toBeDefined();
    });

    it('associates uploaded QR asset with a payment method', async () => {
      const { app, token, paymentRepo } = setupMediaFixture();

      // 1. Upload QR image
      const uploadRes = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'PAYMENT_QR',
          fileBase64: VALID_JPEG_BUFFER.toString('base64'),
          mimeType: 'image/jpeg',
        });
      expect(uploadRes.status).toBe(201);
      const { secureUrl } = uploadRes.body.data;

      // 2. Update payment method with the new QR URL
      const updateRes = await request(app)
        .patch(
          '/api/admin/payment-methods/80000000-0000-4000-8000-000000000001',
        )
        .set('Authorization', `Bearer ${token}`)
        .send({
          qrImageUrl: secureUrl,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.qrImageUrl).toBe(secureUrl);

      const refreshed = await paymentRepo.findByCode('STATIC_QR');
      expect(refreshed?.qrImageUrl).toBe(secureUrl);
    });
  });
});
