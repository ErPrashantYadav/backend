import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { MemoryAuditLogRepository } from '../src/modules/audit/memory-audit.repository';
import { MemorySocialMediaRepository } from '../src/modules/social-media/memory-social-media.repository';
import type { SocialMediaRecord } from '../src/modules/social-media/social-media.types';
import { MemoryMediaReferenceChecker } from '../src/modules/media/media-reference-checker';
import { MemoryCloudinaryClient } from '../src/modules/media/cloudinary.client';
import { CloudinaryService } from '../src/modules/media/cloudinary.service';
import { testConfig } from './helpers';

interface SocialMediaTestContext {
  app: ReturnType<typeof createApp>;
  token: string;
  socialMediaRepo: MemorySocialMediaRepository;
  auditRepo: MemoryAuditLogRepository;
  cloudinaryService: CloudinaryService;
}

function setupSocialMediaFixture(
  permissions: string[] = [
    'social-media.read',
    'social-media.create',
    'social-media.update',
    'social-media.delete',
    'media.upload',
  ],
  initialRecords: SocialMediaRecord[] = [],
): SocialMediaTestContext {
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
  const socialMediaRepo = new MemorySocialMediaRepository(initialRecords);

  const cloudinaryClient = new MemoryCloudinaryClient();
  const mediaRefChecker = new MemoryMediaReferenceChecker(
    undefined,
    undefined,
    undefined,
    [],
    undefined,
    undefined,
    socialMediaRepo,
  );
  const cloudinaryService = new CloudinaryService(
    config,
    cloudinaryClient,
    mediaRefChecker,
  );

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    auditRepository: auditRepo,
    socialMediaRepository: socialMediaRepo,
    cloudinaryService,
  });

  const token = createAdminAccessToken(config, adminId);

  return {
    app,
    token,
    socialMediaRepo,
    auditRepo,
    cloudinaryService,
  };
}

const mockSocialItems: SocialMediaRecord[] = [
  {
    id: '11111111-0000-4000-8000-000000000001',
    platform: 'INSTAGRAM',
    url: 'https://instagram.com/p/reel1',
    type: 'video',
    label: 'Whiskey Tasting Reel 1',
    thumbnailUrl: 'https://cdn.example.com/thumb1.jpg',
    publicId: 'liquor_shop/gallery/thumb1',
    displayOrder: 1,

    isActive: true,
    createdAt: new Date('2026-10-01T10:00:00Z'),
    updatedAt: new Date('2026-10-01T10:00:00Z'),
  },
  {
    id: '11111111-0000-4000-8000-000000000002',
    platform: 'INSTAGRAM',
    url: 'https://instagram.com/p/reel2',
    type: 'video',
    label: 'Vodka Cocktail Guide',
    thumbnailUrl: 'https://cdn.example.com/thumb2.jpg',
    publicId: 'social/thumb2',
    displayOrder: 2,
    isActive: true,
    createdAt: new Date('2026-10-02T10:00:00Z'),
    updatedAt: new Date('2026-10-02T10:00:00Z'),
  },
  {
    id: '11111111-0000-4000-8000-000000000003',
    platform: 'YOUTUBE',
    url: 'https://youtube.com/watch?v=abc1234',
    type: 'video',
    label: 'Bourbon Review Episode 10',
    thumbnailUrl: 'https://cdn.example.com/yt_thumb.jpg',
    publicId: 'social/yt_thumb',
    displayOrder: 3,
    isActive: true,
    createdAt: new Date('2026-10-03T10:00:00Z'),
    updatedAt: new Date('2026-10-03T10:00:00Z'),
  },
  {
    id: '11111111-0000-4000-8000-000000000004',
    platform: 'TIKTOK',
    url: 'https://tiktok.com/@oldliquor/video/1',
    type: 'video',
    label: 'Behind The Bar Quick Tip',
    thumbnailUrl: 'https://cdn.example.com/tt1.jpg',
    publicId: 'social/tt1',
    displayOrder: 4,
    isActive: false, // inactive
    createdAt: new Date('2026-10-04T10:00:00Z'),
    updatedAt: new Date('2026-10-04T10:00:00Z'),
  },
  {
    id: '11111111-0000-4000-8000-000000000005',
    platform: 'FACEBOOK',
    url: 'https://facebook.com/oldliquorshop',
    type: 'profile',
    label: 'Official Facebook Page',
    thumbnailUrl: null,
    publicId: null,
    displayOrder: 1,
    isActive: true,
    createdAt: new Date('2026-10-05T10:00:00Z'),
    updatedAt: new Date('2026-10-05T10:00:00Z'),
  },
  {
    id: '11111111-0000-4000-8000-000000000006',
    platform: 'INSTAGRAM',
    url: 'https://instagram.com/oldliquorshop',
    type: 'profile',
    label: 'Official Instagram Handle',
    thumbnailUrl: null,
    publicId: null,
    displayOrder: 2,
    isActive: true,
    createdAt: new Date('2026-10-06T10:00:00Z'),
    updatedAt: new Date('2026-10-06T10:00:00Z'),
  },
];

describe('Social Media Module (Task 31A parity & extensions)', () => {
  describe('Public Endpoints', () => {
    it('GET /api/social-media returns only active items ordered by displayOrder', async () => {
      const { app } = setupSocialMediaFixture(undefined, mockSocialItems);

      const res = await request(app).get('/api/social-media').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Items 1, 2, 3, 5, 6 are active (item 4 is inactive)
      expect(res.body.data.length).toBe(5);
      const ids = res.body.data.map((item: SocialMediaRecord) => item.id);
      expect(ids).not.toContain('11111111-0000-4000-8000-000000000004');
    });

    it('GET /api/social-media?type=video filters only active video content', async () => {
      const { app } = setupSocialMediaFixture(undefined, mockSocialItems);

      const res = await request(app)
        .get('/api/social-media?type=video')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(
        res.body.data.every((i: SocialMediaRecord) => i.type === 'video'),
      ).toBe(true);
    });

    it('GET /api/social-media?platform=INSTAGRAM filters by platform', async () => {
      const { app } = setupSocialMediaFixture(undefined, mockSocialItems);

      const res = await request(app)
        .get('/api/social-media?platform=INSTAGRAM')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(
        res.body.data.every(
          (i: SocialMediaRecord) => i.platform === 'INSTAGRAM',
        ),
      ).toBe(true);
    });

    it('GET /api/social-media/active works as an alias for active items', async () => {
      const { app } = setupSocialMediaFixture(undefined, mockSocialItems);

      const res = await request(app)
        .get('/api/social-media/active')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(5);
    });

    it('GET /api/social-media/profiles and /api/social-media-link return grouped profile links', async () => {
      const { app } = setupSocialMediaFixture(undefined, mockSocialItems);

      const res = await request(app).get('/api/social-media-link').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('facebook');
      expect(res.body.data).toHaveProperty('instagram');
      expect(res.body.data.facebook[0].url).toBe(
        'https://facebook.com/oldliquorshop',
      );
      expect(res.body.data.instagram[0].url).toBe(
        'https://instagram.com/oldliquorshop',
      );
    });

    it('GET /api/social-media-link/active returns active profiles', async () => {
      const { app } = setupSocialMediaFixture(undefined, mockSocialItems);

      const res = await request(app)
        .get('/api/social-media-link/active')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(
        res.body.data.every((i: SocialMediaRecord) => i.type === 'profile'),
      ).toBe(true);
    });
  });

  describe('Admin Management Endpoints', () => {
    it('GET /api/admin/social-media returns items with platformCounts for UI tabs', async () => {
      const { app, token } = setupSocialMediaFixture(
        undefined,
        mockSocialItems,
      );

      const res = await request(app)
        .get('/api/admin/social-media')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(6);
      expect(res.body.data.items.length).toBe(6);
      expect(res.body.data.platformCounts).toEqual({
        ALL: 6,
        FACEBOOK: 1,
        INSTAGRAM: 3,
        YOUTUBE: 1,
        TIKTOK: 1,
        OTHER: 0,
      });
    });

    it('GET /api/admin/social-media with filters (platform, isActive, search)', async () => {
      const { app, token } = setupSocialMediaFixture(
        undefined,
        mockSocialItems,
      );

      // Filter by platform
      const resPlatform = await request(app)
        .get('/api/admin/social-media?platform=TIKTOK')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(resPlatform.body.data.total).toBe(1);
      expect(resPlatform.body.data.items[0].platform).toBe('TIKTOK');

      // Filter by isActive
      const resInactive = await request(app)
        .get('/api/admin/social-media?isActive=false')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(resInactive.body.data.total).toBe(1);
      expect(resInactive.body.data.items[0].id).toBe(
        '11111111-0000-4000-8000-000000000004',
      );

      // Search term
      const resSearch = await request(app)
        .get('/api/admin/social-media?search=cocktail')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(resSearch.body.data.total).toBe(1);
      expect(resSearch.body.data.items[0].label).toBe('Vodka Cocktail Guide');
    });

    it('POST /api/admin/social-media creates a new social link and records audit log', async () => {
      const { app, token, auditRepo } = setupSocialMediaFixture();

      const newEntry = {
        platform: 'TIKTOK',
        url: 'https://tiktok.com/@oldliquor/video/99',
        type: 'video',
        label: 'Trending Cocktail Hack',
        thumbnailUrl: 'https://cdn.example.com/hack.jpg',
        publicId: 'social/hack',
        displayOrder: 10,
        isActive: true,
      };

      const res = await request(app)
        .post('/api/admin/social-media')
        .set('Authorization', `Bearer ${token}`)
        .send(newEntry)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.platform).toBe('TIKTOK');
      expect(res.body.data.label).toBe('Trending Cocktail Hack');

      const auditLogs = auditRepo.logs;
      expect(auditLogs.length).toBeGreaterThan(0);
      const createLog = auditLogs.find(
        (l) => l.action === 'social_media.create',
      );
      expect(createLog).toBeDefined();
      expect(createLog?.resourceId).toBe(res.body.data.id);
    });

    it('POST /api/admin/social-media/batch creates multiple entries and logs audit', async () => {
      const { app, token, auditRepo } = setupSocialMediaFixture();

      const batchEntries = [
        {
          platform: 'FACEBOOK',
          url: 'https://facebook.com/watch/video1',
          type: 'video',
          label: 'FB Video 1',
        },
        {
          platform: 'YOUTUBE',
          url: 'https://youtube.com/shorts/short1',
          type: 'video',
          label: 'YT Short 1',
        },
      ];

      const res = await request(app)
        .post('/api/admin/social-media/batch')
        .set('Authorization', `Bearer ${token}`)
        .send({ entries: batchEntries })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);

      const batchLog = auditRepo.logs.find(
        (l) => l.action === 'social_media.create' && l.resourceId === 'batch',
      );
      expect(batchLog).toBeDefined();
    });

    it('GET /api/admin/social-media/:id retrieves single entry and handles 404', async () => {
      const { app, token } = setupSocialMediaFixture(
        undefined,
        mockSocialItems,
      );

      const res = await request(app)
        .get('/api/admin/social-media/11111111-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.id).toBe('11111111-0000-4000-8000-000000000001');

      await request(app)
        .get('/api/admin/social-media/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('PUT/PATCH /api/admin/social-media/:id updates entry and records audit log', async () => {
      const { app, token, auditRepo } = setupSocialMediaFixture(
        undefined,
        mockSocialItems,
      );

      const updateData = {
        label: 'Updated Reel Title',
        url: 'https://instagram.com/p/reel_updated',
      };

      const res = await request(app)
        .patch('/api/admin/social-media/11111111-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(res.body.data.label).toBe('Updated Reel Title');
      expect(res.body.data.url).toBe('https://instagram.com/p/reel_updated');

      const updateLog = auditRepo.logs.find(
        (l) => l.action === 'social_media.update',
      );
      expect(updateLog).toBeDefined();
      expect(updateLog?.resourceId).toBe(
        '11111111-0000-4000-8000-000000000001',
      );
    });

    it('PATCH /api/admin/social-media/:id/status updates active status', async () => {
      const { app, token, auditRepo } = setupSocialMediaFixture(
        undefined,
        mockSocialItems,
      );

      const res = await request(app)
        .patch(
          '/api/admin/social-media/11111111-0000-4000-8000-000000000004/status',
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: true })
        .expect(200);

      expect(res.body.data.isActive).toBe(true);

      const statusLog = auditRepo.logs.find(
        (l) => l.action === 'social_media.update_status',
      );
      expect(statusLog).toBeDefined();
      expect(statusLog?.resourceId).toBe(
        '11111111-0000-4000-8000-000000000004',
      );
    });

    it('does not expose PUT /api/admin/social-media/reorder', async () => {
      const { app, token } = setupSocialMediaFixture(
        undefined,
        mockSocialItems,
      );
      const res = await request(app)
        .put('/api/admin/social-media/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [] });
      expect(res.status).toBe(404);
    });

    it('DELETE /api/admin/social-media/:id deletes entry and records audit log', async () => {
      const { app, token, socialMediaRepo, auditRepo } =
        setupSocialMediaFixture(undefined, mockSocialItems);

      const res = await request(app)
        .delete('/api/admin/social-media/11111111-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      const deletedItem = await socialMediaRepo.findById(
        '11111111-0000-4000-8000-000000000001',
      );
      expect(deletedItem).toBeNull();

      const deleteLog = auditRepo.logs.find(
        (l) => l.action === 'social_media.delete',
      );
      expect(deleteLog).toBeDefined();
      expect(deleteLog?.resourceId).toBe(
        '11111111-0000-4000-8000-000000000001',
      );
    });
  });

  describe('Validation & Error Handling', () => {
    it('rejects creation with missing or invalid URL', async () => {
      const { app, token } = setupSocialMediaFixture();

      await request(app)
        .post('/api/admin/social-media')
        .set('Authorization', `Bearer ${token}`)
        .send({
          platform: 'INSTAGRAM',
          url: 'not-a-valid-url',
        })
        .expect(400);
    });

    it('rejects creation with empty platform', async () => {
      const { app, token } = setupSocialMediaFixture();

      await request(app)
        .post('/api/admin/social-media')
        .set('Authorization', `Bearer ${token}`)
        .send({
          platform: '',
          url: 'https://instagram.com/valid',
        })
        .expect(400);
    });

    it('rejects creation with invalid type', async () => {
      const { app, token } = setupSocialMediaFixture();

      await request(app)
        .post('/api/admin/social-media')
        .set('Authorization', `Bearer ${token}`)
        .send({
          platform: 'INSTAGRAM',
          url: 'https://instagram.com/valid',
          type: 'invalid-type',
        })
        .expect(400);
    });
  });

  describe('RBAC & Authentication', () => {
    it('returns 401 when accessing admin endpoints without token', async () => {
      const { app } = setupSocialMediaFixture();

      await request(app).get('/api/admin/social-media').expect(401);
      await request(app).post('/api/admin/social-media').send({}).expect(401);
    });

    it('returns 403 when admin lacks required permissions', async () => {
      // Setup fixture with only 'social-media.read'
      const { app, token } = setupSocialMediaFixture(['social-media.read']);

      // Read is allowed
      await request(app)
        .get('/api/admin/social-media')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Create is forbidden
      await request(app)
        .post('/api/admin/social-media')
        .set('Authorization', `Bearer ${token}`)
        .send({
          platform: 'INSTAGRAM',
          url: 'https://instagram.com/valid',
        })
        .expect(403);

      // Delete is forbidden
      await request(app)
        .delete('/api/admin/social-media/11111111-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('Cloudinary Media Reference Protection', () => {
    it('prevents deleting Cloudinary asset when referenced by social media item', async () => {
      const { cloudinaryService } = setupSocialMediaFixture(
        undefined,
        mockSocialItems,
      );

      // Attempting to delete asset 'liquor_shop/gallery/thumb1' which is referenced in item 1
      await expect(
        cloudinaryService.delete({ publicId: 'liquor_shop/gallery/thumb1' }),
      ).rejects.toThrow(/Asset is referenced by social media item/);
    });
  });
});
