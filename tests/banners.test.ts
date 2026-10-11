import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { MemoryAuditLogRepository } from '../src/modules/audit/memory-audit.repository';
import { MemoryBannerRepository } from '../src/modules/banners/memory-banners.repository';
import type { BannerRecord } from '../src/modules/banners/banners.types';
import { MemoryMediaReferenceChecker } from '../src/modules/media/media-reference-checker';
import { MemoryCloudinaryClient } from '../src/modules/media/cloudinary.client';
import { CloudinaryService } from '../src/modules/media/cloudinary.service';
import { testConfig } from './helpers';

interface BannerTestContext {
  app: ReturnType<typeof createApp>;
  token: string;
  bannerRepo: MemoryBannerRepository;
  auditRepo: MemoryAuditLogRepository;
  cloudinaryService: CloudinaryService;
}

function setupBannerFixture(
  permissions: string[] = [
    'banners.read',
    'banners.create',
    'banners.update',
    'banners.delete',
    'media.upload',
  ],
  initialBanners: BannerRecord[] = [],
): BannerTestContext {
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
        name: 'Admin User',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: {
          id: roleId,
          name: 'Manager Role',
          isActive: true,
          permissions,
        },
      };
    },
    async updatePassword() {},
  };

  const auditRepo = new MemoryAuditLogRepository();
  const bannerRepo = new MemoryBannerRepository();
  bannerRepo.items = [...initialBanners];

  const cloudinaryClient = new MemoryCloudinaryClient();
  const mediaRefChecker = new MemoryMediaReferenceChecker(
    undefined,
    undefined,
    undefined,
    [],
    bannerRepo,
  );
  const cloudinaryService = new CloudinaryService(
    config,
    cloudinaryClient,
    mediaRefChecker,
  );

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    bannerRepository: bannerRepo,
    auditRepository: auditRepo,
    cloudinaryService,
  });

  const token = createAdminAccessToken(config, adminId);

  return { app, token, bannerRepo, auditRepo, cloudinaryService };
}

describe('Banners & Promotions Management (Task 29)', () => {
  describe('Public Storefront Endpoints', () => {
    it('returns only active banners within their scheduled timeframe, sorted by displayOrder ASC', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const farPast = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const initialBanners: BannerRecord[] = [
        {
          id: 'b-active-1',
          title: 'Dashain Festival Mega Sale',
          description: 'Huge discounts on premium whisky',
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/b1.jpg',
          publicId: 'b1',
          linkUrl: '/catalog?category=whisky',
          displayOrder: 2,
          isActive: true,
          startDate: past,
          endDate: future,
          createdAt: new Date(now.getTime() - 1000),
          updatedAt: new Date(now.getTime() - 1000),
        },
        {
          id: 'b-active-2',
          title: 'Welcome New Arrivals',
          description: 'Explore our craft beers collection',
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/b2.jpg',
          publicId: 'b2',
          linkUrl: 'https://example.com/craft-beers',
          displayOrder: 1,
          isActive: true,
          startDate: null,
          endDate: null,
          createdAt: new Date(now.getTime() - 2000),
          updatedAt: new Date(now.getTime() - 2000),
        },
        {
          id: 'b-inactive',
          title: 'Inactive Flash Promo',
          description: null,
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/b3.jpg',
          publicId: 'b3',
          linkUrl: null,
          displayOrder: 0,
          isActive: false, // inactive
          startDate: past,
          endDate: future,
          createdAt: new Date(now.getTime() - 3000),
          updatedAt: new Date(now.getTime() - 3000),
        },
        {
          id: 'b-future',
          title: 'Tihar Special Offers',
          description: 'Starting next week',
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/b4.jpg',
          publicId: 'b4',
          linkUrl: null,
          displayOrder: 0,
          isActive: true,
          startDate: future, // future schedule
          endDate: new Date(future.getTime() + 86400000),
          createdAt: new Date(now.getTime() - 4000),
          updatedAt: new Date(now.getTime() - 4000),
        },
        {
          id: 'b-expired',
          title: 'Expired Clearance Promo',
          description: 'Old sale',
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/b5.jpg',
          publicId: 'b5',
          linkUrl: null,
          displayOrder: 0,
          isActive: true,
          startDate: farPast,
          endDate: past, // expired
          createdAt: new Date(now.getTime() - 5000),
          updatedAt: new Date(now.getTime() - 5000),
        },
      ];

      const { app } = setupBannerFixture([], initialBanners);

      const response = await request(app).get('/api/banners');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      const items = response.body.data;
      expect(items.length).toBe(2);

      // Verify ordering: displayOrder 1 before displayOrder 2
      expect(items[0].id).toBe('b-active-2');
      expect(items[0].displayOrder).toBe(1);
      expect(items[1].id).toBe('b-active-1');
      expect(items[1].displayOrder).toBe(2);

      // Ensure inactive, future, and expired banners are not present
      const returnedIds = items.map((b: BannerRecord) => b.id);
      expect(returnedIds).not.toContain('b-inactive');
      expect(returnedIds).not.toContain('b-future');
      expect(returnedIds).not.toContain('b-expired');
    });
  });

  describe('Admin RBAC & Authentication', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const { app } = setupBannerFixture([]);

      const listRes = await request(app).get('/api/admin/banners');
      expect(listRes.status).toBe(401);

      const createRes = await request(app).post('/api/admin/banners').send({
        title: 'Unauthorized Banner',
        imageUrl: 'https://res.cloudinary.com/demo/b.jpg',
      });
      expect(createRes.status).toBe(401);
    });

    it('rejects users lacking required permissions with 403', async () => {
      // User has no banners permissions
      const { app, token } = setupBannerFixture(['catalog.read']);

      const listRes = await request(app)
        .get('/api/admin/banners')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(403);

      const createRes = await request(app)
        .post('/api/admin/banners')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Forbidden Banner',
          imageUrl: 'https://res.cloudinary.com/demo/b.jpg',
        });
      expect(createRes.status).toBe(403);

      const updateRes = await request(app)
        .patch('/api/admin/banners/123')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Title' });
      expect(updateRes.status).toBe(403);

      const statusRes = await request(app)
        .patch('/api/admin/banners/123/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });
      expect(statusRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete('/api/admin/banners/123')
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(403);
    });
  });

  describe('Admin CRUD Operations', () => {
    it('creates a banner with full attributes and records audit log', async () => {
      const { app, token, auditRepo } = setupBannerFixture();

      const payload = {
        title: 'New Year 2027 Champagne Bash',
        description: 'Celebrate New Year with free delivery on Moët & Chandon',
        imageUrl:
          'https://res.cloudinary.com/demo/image/upload/v1/banners/bash.png',
        publicId: 'banners/bash',
        linkUrl: '/catalog?category=champagne',
        displayOrder: 5,
        isActive: true,
        startDate: '2026-12-25T00:00:00.000Z',
        endDate: '2027-01-05T23:59:59.000Z',
      };

      const res = await request(app)
        .post('/api/admin/banners')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe(payload.title);
      expect(res.body.data.description).toBe(payload.description);
      expect(res.body.data.imageUrl).toBe(payload.imageUrl);
      expect(res.body.data.publicId).toBe(payload.publicId);
      expect(res.body.data.linkUrl).toBe(payload.linkUrl);
      expect(res.body.data.displayOrder).toBe(5);
      expect(res.body.data.isActive).toBe(true);

      // Verify audit log entry
      const auditLogs = auditRepo.logs;
      const createLog = auditLogs.find(
        (l) =>
          l.action === 'banner.create' && l.resourceId === res.body.data.id,
      );
      expect(createLog).toBeDefined();
      expect(createLog?.resourceType).toBe('banner');
      expect(createLog?.actorAdminId).toBe(
        '90000000-0000-4000-8000-000000000001',
      );
    });

    it('lists banners with pagination, search, and active filtering', async () => {
      const { app, token, bannerRepo } = setupBannerFixture();

      await bannerRepo.create({
        title: 'Summer Gin & Tonic',
        description: 'Refreshing botanicals',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/gin.jpg',
        isActive: true,
        displayOrder: 1,
      });

      await bannerRepo.create({
        title: 'Winter Rum Fest',
        description: 'Spiced warmth',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/rum.jpg',
        isActive: false,
        displayOrder: 2,
      });

      // List all
      const allRes = await request(app)
        .get('/api/admin/banners')
        .set('Authorization', `Bearer ${token}`);
      expect(allRes.status).toBe(200);
      expect(allRes.body.data.total).toBe(2);
      expect(allRes.body.data.items.length).toBe(2);

      // Filter by isActive=true
      const activeRes = await request(app)
        .get('/api/admin/banners?isActive=true')
        .set('Authorization', `Bearer ${token}`);
      expect(activeRes.status).toBe(200);
      expect(activeRes.body.data.total).toBe(1);
      expect(activeRes.body.data.items[0].title).toBe('Summer Gin & Tonic');

      // Filter by search term
      const searchRes = await request(app)
        .get('/api/admin/banners?search=Rum')
        .set('Authorization', `Bearer ${token}`);
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.total).toBe(1);
      expect(searchRes.body.data.items[0].title).toBe('Winter Rum Fest');
    });

    it('gets banner details by ID or returns 404 for non-existent banner', async () => {
      const { app, token, bannerRepo } = setupBannerFixture();

      const created = await bannerRepo.create({
        title: 'Special Vodka Offer',
        imageUrl: 'https://res.cloudinary.com/demo/vodka.jpg',
      });

      const getRes = await request(app)
        .get(`/api/admin/banners/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(created.id);
      expect(getRes.body.data.title).toBe('Special Vodka Offer');

      const notFoundRes = await request(app)
        .get('/api/admin/banners/non-existent-id')
        .set('Authorization', `Bearer ${token}`);
      expect(notFoundRes.status).toBe(404);
      expect(notFoundRes.body.error.code).toBe('BANNER_NOT_FOUND');
    });

    it('updates banner details and toggles active status with audit logging', async () => {
      const { app, token, bannerRepo, auditRepo } = setupBannerFixture();

      const banner = await bannerRepo.create({
        title: 'Initial Banner Title',
        imageUrl: 'https://res.cloudinary.com/demo/initial.jpg',
        displayOrder: 1,
        isActive: true,
      });

      // Update title and displayOrder
      const updateRes = await request(app)
        .patch(`/api/admin/banners/${banner.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Updated Festive Banner Title',
          displayOrder: 10,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Updated Festive Banner Title');
      expect(updateRes.body.data.displayOrder).toBe(10);

      const updateLog = auditRepo.logs.find(
        (l) => l.action === 'banner.update' && l.resourceId === banner.id,
      );
      expect(updateLog).toBeDefined();

      // Toggle status to inactive
      const statusRes = await request(app)
        .patch(`/api/admin/banners/${banner.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.isActive).toBe(false);

      const statusLog = auditRepo.logs.find(
        (l) =>
          l.action === 'banner.update_status' && l.resourceId === banner.id,
      );
      expect(statusLog).toBeDefined();
    });

    it('deletes banner and records audit event', async () => {
      const { app, token, bannerRepo, auditRepo } = setupBannerFixture();

      const banner = await bannerRepo.create({
        title: 'Temporary Flash Banner',
        imageUrl: 'https://res.cloudinary.com/demo/flash.jpg',
      });

      const deleteRes = await request(app)
        .delete(`/api/admin/banners/${banner.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      const check = await bannerRepo.findById(banner.id);
      expect(check).toBeNull();

      const deleteLog = auditRepo.logs.find(
        (l) => l.action === 'banner.delete' && l.resourceId === banner.id,
      );
      expect(deleteLog).toBeDefined();
    });

    it('PUT /api/admin/banners/reorder updates persistent displayOrder, logs audit, and reflects in public listing', async () => {
      const { app, token, bannerRepo, auditRepo } = setupBannerFixture();

      const b1 = await bannerRepo.create({
        title: 'Banner One',
        imageUrl: 'https://res.cloudinary.com/demo/b1.jpg',
        displayOrder: 0,
      });
      const b2 = await bannerRepo.create({
        title: 'Banner Two',
        imageUrl: 'https://res.cloudinary.com/demo/b2.jpg',
        displayOrder: 1,
      });

      // Reorder b2 to 0, b1 to 10
      const reorderRes = await request(app)
        .put('/api/admin/banners/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { id: b2.id, displayOrder: 0 },
            { id: b1.id, displayOrder: 10 },
          ],
        });

      expect(reorderRes.status).toBe(200);
      expect(reorderRes.body.success).toBe(true);

      const updatedB1 = await bannerRepo.findById(b1.id);
      const updatedB2 = await bannerRepo.findById(b2.id);
      expect(updatedB2?.displayOrder).toBe(0);
      expect(updatedB1?.displayOrder).toBe(10);

      // Audit log
      const reorderLog = auditRepo.logs.find(
        (l) => l.action === 'banner.reorder',
      );
      expect(reorderLog).toBeDefined();

      // Public listing order
      const publicRes = await request(app).get('/api/banners');
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.data[0].id).toBe(b2.id);
      expect(publicRes.body.data[1].id).toBe(b1.id);

      // Reject duplicate IDs
      const duplicateRes = await request(app)
        .put('/api/admin/banners/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { id: b1.id, displayOrder: 0 },
            { id: b1.id, displayOrder: 1 },
          ],
        });
      expect(duplicateRes.status).toBe(400);
      expect(duplicateRes.body.error.code).toBe('VALIDATION_ERROR');

      // Reject non-existent ID
      const notFoundRes = await request(app)
        .put('/api/admin/banners/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { id: '99999999-0000-4000-8000-000000000099', displayOrder: 0 },
          ],
        });
      expect(notFoundRes.status).toBe(404);
      expect(notFoundRes.body.error.code).toBe('BANNER_NOT_FOUND');

      // RBAC check
      const { app: unauthorizedApp, token: unauthorizedToken } =
        setupBannerFixture(['banners.read']);
      const forbiddenRes = await request(unauthorizedApp)
        .put('/api/admin/banners/reorder')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({
          items: [{ id: b1.id, displayOrder: 0 }],
        });
      expect(forbiddenRes.status).toBe(403);
    });
  });

  describe('Validation & Boundary Rules', () => {
    it('rejects invalid title (empty or exceeds 180 characters)', async () => {
      const { app, token } = setupBannerFixture();

      const emptyRes = await request(app)
        .post('/api/admin/banners')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '   ',
          imageUrl: 'https://res.cloudinary.com/demo/image.jpg',
        });
      expect(emptyRes.status).toBe(400);

      const tooLongRes = await request(app)
        .post('/api/admin/banners')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'A'.repeat(181),
          imageUrl: 'https://res.cloudinary.com/demo/image.jpg',
        });
      expect(tooLongRes.status).toBe(400);
    });

    it('rejects invalid image URL', async () => {
      const { app, token } = setupBannerFixture();

      const res = await request(app)
        .post('/api/admin/banners')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Valid Title',
          imageUrl: 'not-a-valid-url',
        });
      expect(res.status).toBe(400);
    });

    it('rejects when startDate is later than endDate', async () => {
      const { app, token } = setupBannerFixture();

      const res = await request(app)
        .post('/api/admin/banners')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Invalid Date Banner',
          imageUrl: 'https://res.cloudinary.com/demo/banner.jpg',
          startDate: '2026-12-31T00:00:00.000Z',
          endDate: '2026-12-01T00:00:00.000Z', // earlier than startDate
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Secure Cloudinary Media Integration', () => {
    it('allows BANNER_IMAGE upload with banner permissions', async () => {
      const { app, token } = setupBannerFixture(['banners.create']);

      // 1x1 transparent PNG buffer
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('purpose', 'BANNER_IMAGE')
        .attach('file', pngBuffer, 'hero-banner.png');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.purpose).toBe('BANNER_IMAGE');
      expect(res.body.data.folder).toBe('liquor_shop/banners');
      expect(res.body.data.secureUrl).toMatch(/^https:\/\//);
    });

    it('rejects BANNER_IMAGE upload if admin lacks banner/media permissions', async () => {
      const { app, token } = setupBannerFixture(['catalog.read']);

      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('purpose', 'BANNER_IMAGE')
        .attach('file', pngBuffer, 'hero-banner.png');

      expect(res.status).toBe(403);
    });

    it('prevents asset deletion when referenced by an existing banner', async () => {
      const { bannerRepo, cloudinaryService } = setupBannerFixture();

      const publicId = 'liquor_shop/banners/holiday-promo-101';
      const secureUrl = 'https://res.cloudinary.com/demo/holiday-promo-101.jpg';

      await bannerRepo.create({
        title: 'Holiday Promo 2026',
        imageUrl: secureUrl,
        publicId,
      });

      // Attempt deletion via cloudinary service
      await expect(cloudinaryService.delete({ publicId })).rejects.toThrowError(
        /referenced by banner/,
      );
    });
  });
});
