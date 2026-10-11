import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { MemoryAuditLogRepository } from '../src/modules/audit/memory-audit.repository';
import { MemoryGalleryRepository } from '../src/modules/gallery/memory-gallery.repository';
import type { GalleryItemRecord } from '../src/modules/gallery/gallery.types';
import { MemoryMediaReferenceChecker } from '../src/modules/media/media-reference-checker';
import { MemoryCloudinaryClient } from '../src/modules/media/cloudinary.client';
import { CloudinaryService } from '../src/modules/media/cloudinary.service';
import { testConfig } from './helpers';

interface GalleryTestContext {
  app: ReturnType<typeof createApp>;
  token: string;
  galleryRepo: MemoryGalleryRepository;
  auditRepo: MemoryAuditLogRepository;
  cloudinaryService: CloudinaryService;
}

function setupGalleryFixture(
  permissions: string[] = [
    'gallery.read',
    'gallery.create',
    'gallery.update',
    'gallery.delete',
    'media.upload',
  ],
  initialItems: GalleryItemRecord[] = [],
): GalleryTestContext {
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
  const galleryRepo = new MemoryGalleryRepository();
  galleryRepo.items = [...initialItems];

  const cloudinaryClient = new MemoryCloudinaryClient();
  const mediaRefChecker = new MemoryMediaReferenceChecker(
    undefined,
    undefined,
    undefined,
    [],
    undefined,
    galleryRepo,
  );
  const cloudinaryService = new CloudinaryService(
    config,
    cloudinaryClient,
    mediaRefChecker,
  );

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    galleryRepository: galleryRepo,
    auditRepository: auditRepo,
    cloudinaryService,
  });

  const token = createAdminAccessToken(config, adminId);

  return { app, token, galleryRepo, auditRepo, cloudinaryService };
}

describe('Gallery Management (Task 30)', () => {
  describe('Public Storefront Endpoints', () => {
    it('returns only active gallery items in display order and filters by category', async () => {
      const now = new Date();
      const initialItems: GalleryItemRecord[] = [
        {
          id: 'g-active-1',
          title: 'Storefront Wine Tasting Event',
          description: 'A glimpse of our annual French wine tasting night',
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/event1.jpg',
          publicId: 'liquor_shop/gallery/event1',
          category: 'events',
          displayOrder: 2,
          isActive: true,
          createdAt: new Date(now.getTime() - 1000),
          updatedAt: new Date(now.getTime() - 1000),
        },
        {
          id: 'g-active-2',
          title: 'Premium Single Malt Cellar Display',
          description:
            'Our rare Japanese and Scotch whisky collection on display',
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/cellar1.jpg',
          publicId: 'liquor_shop/gallery/cellar1',
          category: 'store',
          displayOrder: 1,
          isActive: true,
          createdAt: new Date(now.getTime() - 2000),
          updatedAt: new Date(now.getTime() - 2000),
        },
        {
          id: 'g-inactive',
          title: 'Under Construction Corner',
          description: null,
          imageUrl:
            'https://res.cloudinary.com/demo/image/upload/renovation.jpg',
          publicId: 'liquor_shop/gallery/renovation',
          category: 'store',
          displayOrder: 0,
          isActive: false, // inactive
          createdAt: new Date(now.getTime() - 3000),
          updatedAt: new Date(now.getTime() - 3000),
        },
      ];

      const { app } = setupGalleryFixture([], initialItems);

      // 1. Fetch all active
      const resAll = await request(app).get('/api/gallery');
      expect(resAll.status).toBe(200);
      expect(resAll.body.success).toBe(true);
      expect(Array.isArray(resAll.body.data)).toBe(true);

      const allItems = resAll.body.data;
      expect(allItems.length).toBe(2);
      expect(allItems[0].id).toBe('g-active-2'); // displayOrder 1
      expect(allItems[1].id).toBe('g-active-1'); // displayOrder 2

      const returnedIds = allItems.map((g: GalleryItemRecord) => g.id);
      expect(returnedIds).not.toContain('g-inactive');

      // 2. Filter by category='events'
      const resEvents = await request(app).get('/api/gallery?category=events');
      expect(resEvents.status).toBe(200);
      expect(resEvents.body.data.length).toBe(1);
      expect(resEvents.body.data[0].id).toBe('g-active-1');
      expect(resEvents.body.data[0].category).toBe('events');
    });
  });

  describe('Admin RBAC & Authentication', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const { app } = setupGalleryFixture([]);

      const listRes = await request(app).get('/api/admin/gallery');
      expect(listRes.status).toBe(401);

      const createRes = await request(app).post('/api/admin/gallery').send({
        title: 'Unauthorized Item',
        imageUrl: 'https://res.cloudinary.com/demo/g.jpg',
      });
      expect(createRes.status).toBe(401);
    });

    it('rejects users lacking required permissions with 403', async () => {
      const { app, token } = setupGalleryFixture(['catalog.read']);

      const listRes = await request(app)
        .get('/api/admin/gallery')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(403);

      const createRes = await request(app)
        .post('/api/admin/gallery')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Forbidden Item',
          imageUrl: 'https://res.cloudinary.com/demo/g.jpg',
        });
      expect(createRes.status).toBe(403);

      const updateRes = await request(app)
        .patch('/api/admin/gallery/123')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Title' });
      expect(updateRes.status).toBe(403);

      const statusRes = await request(app)
        .patch('/api/admin/gallery/123/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });
      expect(statusRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete('/api/admin/gallery/123')
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(403);
    });
  });

  describe('Admin CRUD Operations', () => {
    it('creates a gallery item with full attributes and records audit event', async () => {
      const { app, token, auditRepo } = setupGalleryFixture();

      const payload = {
        title: 'Grand Cellar Opening Ceremony',
        description: 'Ribbon cutting ceremony attended by distinguished guests',
        imageUrl:
          'https://res.cloudinary.com/demo/image/upload/v1/gallery/opening.jpg',
        publicId: 'liquor_shop/gallery/opening',
        category: 'milestones',
        displayOrder: 3,
        isActive: true,
      };

      const res = await request(app)
        .post('/api/admin/gallery')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe(payload.title);
      expect(res.body.data.description).toBe(payload.description);
      expect(res.body.data.imageUrl).toBe(payload.imageUrl);
      expect(res.body.data.publicId).toBe(payload.publicId);
      expect(res.body.data.category).toBe(payload.category);
      expect(res.body.data.displayOrder).toBe(3);
      expect(res.body.data.isActive).toBe(true);

      // Verify audit log entry
      const createLog = auditRepo.logs.find(
        (l) =>
          l.action === 'gallery.create' && l.resourceId === res.body.data.id,
      );
      expect(createLog).toBeDefined();
      expect(createLog?.resourceType).toBe('gallery');
      expect(createLog?.actorAdminId).toBe(
        '90000000-0000-4000-8000-000000000001',
      );
    });

    it('lists gallery items with pagination, search, category, and active filtering', async () => {
      const { app, token, galleryRepo } = setupGalleryFixture();

      await galleryRepo.create({
        title: 'Cocktail Mixing Masterclass',
        description: 'Bartending training session',
        category: 'events',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/cocktail.jpg',
        isActive: true,
        displayOrder: 1,
      });

      await galleryRepo.create({
        title: 'Boutique Store Interior',
        description: 'Display shelving and lounge',
        category: 'interior',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/interior.jpg',
        isActive: false,
        displayOrder: 2,
      });

      // 1. List all
      const allRes = await request(app)
        .get('/api/admin/gallery')
        .set('Authorization', `Bearer ${token}`);
      expect(allRes.status).toBe(200);
      expect(allRes.body.data.total).toBe(2);
      expect(allRes.body.data.items.length).toBe(2);

      // 2. Filter isActive=true
      const activeRes = await request(app)
        .get('/api/admin/gallery?isActive=true')
        .set('Authorization', `Bearer ${token}`);
      expect(activeRes.status).toBe(200);
      expect(activeRes.body.data.total).toBe(1);
      expect(activeRes.body.data.items[0].title).toBe(
        'Cocktail Mixing Masterclass',
      );

      // 3. Filter category=interior
      const catRes = await request(app)
        .get('/api/admin/gallery?category=interior')
        .set('Authorization', `Bearer ${token}`);
      expect(catRes.status).toBe(200);
      expect(catRes.body.data.total).toBe(1);
      expect(catRes.body.data.items[0].title).toBe('Boutique Store Interior');

      // 4. Search query
      const searchRes = await request(app)
        .get('/api/admin/gallery?search=Masterclass')
        .set('Authorization', `Bearer ${token}`);
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.total).toBe(1);
      expect(searchRes.body.data.items[0].title).toBe(
        'Cocktail Mixing Masterclass',
      );
    });

    it('gets gallery item details by ID and returns 404 for non-existent item', async () => {
      const { app, token, galleryRepo } = setupGalleryFixture();

      const created = await galleryRepo.create({
        title: 'Vintage Champagne Rack',
        imageUrl: 'https://res.cloudinary.com/demo/champagne.jpg',
      });

      const getRes = await request(app)
        .get(`/api/admin/gallery/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(created.id);
      expect(getRes.body.data.title).toBe('Vintage Champagne Rack');

      const notFoundRes = await request(app)
        .get('/api/admin/gallery/non-existent-id')
        .set('Authorization', `Bearer ${token}`);
      expect(notFoundRes.status).toBe(404);
      expect(notFoundRes.body.error.code).toBe('GALLERY_ITEM_NOT_FOUND');
    });

    it('updates gallery item and toggles status with audit logging', async () => {
      const { app, token, galleryRepo, auditRepo } = setupGalleryFixture();

      const item = await galleryRepo.create({
        title: 'Initial Title',
        imageUrl: 'https://res.cloudinary.com/demo/item.jpg',
        category: 'misc',
        displayOrder: 1,
        isActive: true,
      });

      // Update fields
      const updateRes = await request(app)
        .patch(`/api/admin/gallery/${item.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Updated Modern Bar Setup',
          category: 'bar',
          displayOrder: 10,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Updated Modern Bar Setup');
      expect(updateRes.body.data.category).toBe('bar');
      expect(updateRes.body.data.displayOrder).toBe(10);

      const updateLog = auditRepo.logs.find(
        (l) => l.action === 'gallery.update' && l.resourceId === item.id,
      );
      expect(updateLog).toBeDefined();

      // Toggle status
      const statusRes = await request(app)
        .patch(`/api/admin/gallery/${item.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.isActive).toBe(false);

      const statusLog = auditRepo.logs.find(
        (l) => l.action === 'gallery.update_status' && l.resourceId === item.id,
      );
      expect(statusLog).toBeDefined();
    });

    it('deletes gallery item and records audit event', async () => {
      const { app, token, galleryRepo, auditRepo } = setupGalleryFixture();

      const item = await galleryRepo.create({
        title: 'Old Pop-up Tasting Booth',
        imageUrl: 'https://res.cloudinary.com/demo/booth.jpg',
      });

      const deleteRes = await request(app)
        .delete(`/api/admin/gallery/${item.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      const check = await galleryRepo.findById(item.id);
      expect(check).toBeNull();

      const deleteLog = auditRepo.logs.find(
        (l) => l.action === 'gallery.delete' && l.resourceId === item.id,
      );
      expect(deleteLog).toBeDefined();
    });

    it('does not expose PUT /api/admin/gallery/reorder', async () => {
      const { app, token } = setupGalleryFixture();
      const res = await request(app)
        .put('/api/admin/gallery/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [] });
      expect(res.status).toBe(404);
    });
  });

  describe('Validation & Boundary Rules', () => {
    it('rejects invalid title (empty or exceeds 180 characters)', async () => {
      const { app, token } = setupGalleryFixture();

      const emptyRes = await request(app)
        .post('/api/admin/gallery')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '   ',
          imageUrl: 'https://res.cloudinary.com/demo/g.jpg',
        });
      expect(emptyRes.status).toBe(400);

      const tooLongRes = await request(app)
        .post('/api/admin/gallery')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'G'.repeat(181),
          imageUrl: 'https://res.cloudinary.com/demo/g.jpg',
        });
      expect(tooLongRes.status).toBe(400);
    });

    it('rejects invalid image URL', async () => {
      const { app, token } = setupGalleryFixture();

      const res = await request(app)
        .post('/api/admin/gallery')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Valid Title',
          imageUrl: 'ftp://not-supported-scheme.com/img.jpg',
        });
      expect(res.status).toBe(400);
    });

    it('rejects category exceeding 100 characters', async () => {
      const { app, token } = setupGalleryFixture();

      const res = await request(app)
        .post('/api/admin/gallery')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Valid Title',
          imageUrl: 'https://res.cloudinary.com/demo/g.jpg',
          category: 'C'.repeat(101),
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Cloudinary Integration & Reference Protection', () => {
    it('allows GALLERY_IMAGE upload with gallery permissions', async () => {
      const { app, token } = setupGalleryFixture(['gallery.create']);

      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('purpose', 'GALLERY_IMAGE')
        .attach('file', pngBuffer, 'tasting-night.png');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.purpose).toBe('GALLERY_IMAGE');
      expect(res.body.data.folder).toBe('liquor_shop/gallery');
      expect(res.body.data.secureUrl).toMatch(/^https:\/\//);
    });

    it('rejects GALLERY_IMAGE upload if admin lacks gallery/media permissions', async () => {
      const { app, token } = setupGalleryFixture(['catalog.read']);

      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );

      const res = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('purpose', 'GALLERY_IMAGE')
        .attach('file', pngBuffer, 'tasting-night.png');

      expect(res.status).toBe(403);
    });

    it('prevents asset deletion when referenced by an existing gallery item', async () => {
      const { galleryRepo, cloudinaryService } = setupGalleryFixture();

      const publicId = 'liquor_shop/gallery/exclusive-cellar-2026';
      const secureUrl =
        'https://res.cloudinary.com/demo/image/upload/exclusive-cellar-2026.jpg';

      await galleryRepo.create({
        title: 'Exclusive Cellar Display',
        imageUrl: secureUrl,
        publicId,
      });

      await expect(cloudinaryService.delete({ publicId })).rejects.toThrowError(
        /referenced by gallery item/,
      );
    });
  });
});
