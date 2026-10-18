import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { MemoryAuditLogRepository } from '../src/modules/audit/memory-audit.repository';
import { MemoryStoreSettingsRepository } from '../src/modules/store-settings/memory-store-settings.repository';
import type { StoreSettingsRecord } from '../src/modules/store-settings/store-settings.types';
import { testConfig } from './helpers';

interface SettingsTestContext {
  app: ReturnType<typeof createApp>;
  token: string;
  settingsRepo: MemoryStoreSettingsRepository;
  auditRepo: MemoryAuditLogRepository;
}

function setupSettingsFixture(
  permissions: string[] = ['settings.read', 'settings.update'],
  initialSettings?: Partial<StoreSettingsRecord>,
): SettingsTestContext {
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
  const settingsRepo = new MemoryStoreSettingsRepository(initialSettings);

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    storeSettingsRepository: settingsRepo,
    auditRepository: auditRepo,
  });

  const token = createAdminAccessToken(config, adminId);

  return { app, token, settingsRepo, auditRepo };
}

describe('Store Settings & Business Hours (Task 31)', () => {
  describe('Public Storefront Settings', () => {
    it('returns default public settings and strips internal database fields', async () => {
      const { app } = setupSettingsFixture();

      const res = await request(app).get('/api/settings');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.storeName).toBe('Old Liquor');
      expect(res.body.data.primaryPhone).toBe('+977-9801234567');
      expect(res.body.data.supportEmail).toBe('support@oldliquor.com');
      expect(res.body.data.address).toBe('Kathmandu, Nepal');
      expect(res.body.data.city).toBe('Kathmandu');
      expect(res.body.data.timezone).toBe('Asia/Kathmandu');
      expect(res.body.data.minOrderSubtotal).toBe('800.00');
      expect(Array.isArray(res.body.data.businessHours)).toBe(true);
      expect(res.body.data.businessHours.length).toBe(7);

      // Verify internal fields are NEVER exposed in public output
      expect(res.body.data.id).toBeUndefined();
      expect(res.body.data.createdAt).toBeUndefined();
      expect(res.body.data.updatedAt).toBeUndefined();
      expect(res.body.data.announcementStartDate).toBeUndefined();
      expect(res.body.data.announcementEndDate).toBeUndefined();
      expect(res.body.data.announcementActive).toBeUndefined();
    });

    it('returns public announcement only when active and within scheduled dates', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const farPast = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      // 1. Active and within dates
      const { app: appActive } = setupSettingsFixture([], {
        announcementText: 'Festival Flash Sale: 10% off all whiskies tonight!',
        announcementActive: true,
        announcementStartDate: past,
        announcementEndDate: future,
      });

      const resActive = await request(appActive).get('/api/settings');
      expect(resActive.status).toBe(200);
      expect(resActive.body.data.announcement).toEqual({
        text: 'Festival Flash Sale: 10% off all whiskies tonight!',
        active: true,
      });

      // 2. Inactive announcement
      const { app: appInactive } = setupSettingsFixture([], {
        announcementText: 'Inactive message',
        announcementActive: false,
        announcementStartDate: past,
        announcementEndDate: future,
      });

      const resInactive = await request(appInactive).get('/api/settings');
      expect(resInactive.status).toBe(200);
      expect(resInactive.body.data.announcement).toBeNull();

      // 3. Expired announcement
      const { app: appExpired } = setupSettingsFixture([], {
        announcementText: 'Expired promo',
        announcementActive: true,
        announcementStartDate: farPast,
        announcementEndDate: past,
      });

      const resExpired = await request(appExpired).get('/api/settings');
      expect(resExpired.status).toBe(200);
      expect(resExpired.body.data.announcement).toBeNull();

      // 4. Future scheduled announcement
      const { app: appFuture } = setupSettingsFixture([], {
        announcementText: 'Future promo',
        announcementActive: true,
        announcementStartDate: future,
        announcementEndDate: new Date(future.getTime() + 86400000),
      });

      const resFuture = await request(appFuture).get('/api/settings');
      expect(resFuture.status).toBe(200);
      expect(resFuture.body.data.announcement).toBeNull();
    });
  });

  describe('Admin Authentication & RBAC', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const { app } = setupSettingsFixture([]);

      const getRes = await request(app).get('/api/admin/settings');
      expect(getRes.status).toBe(401);

      const putRes = await request(app).put('/api/admin/settings').send({
        storeName: 'Unauthorized Update',
      });
      expect(putRes.status).toBe(401);
    });

    it('rejects admins lacking required permissions with 403', async () => {
      const { app, token } = setupSettingsFixture(['catalog.read']);

      const getRes = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(403);

      const patchRes = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ storeName: 'Forbidden Store Name' });
      expect(patchRes.status).toBe(403);
    });
  });

  describe('Admin Settings Management & Audit Logging', () => {
    it('retrieves full settings for authorized admin', async () => {
      const { app, token } = setupSettingsFixture();

      const res = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('default');
      expect(res.body.data.storeName).toBe('Old Liquor');
      expect(res.body.data.createdAt).toBeDefined();
      expect(res.body.data.updatedAt).toBeDefined();
    });

    it('updates store metadata, contact details, social links, and records audit log', async () => {
      const { app, token, auditRepo } = setupSettingsFixture();

      const payload = {
        storeName: 'Old Liquor Nepal Express',
        storeTagline: 'Curated Fine Wines & Spirits Delivered across Valley',
        primaryPhone: '+977-9809999999',
        secondaryPhone: '+977-01-4444444',
        supportEmail: 'orders@oldliquor.com.np',
        address: 'Durbar Marg, Ward 1',
        city: 'Kathmandu',
        locationUrl: 'https://maps.google.com/?q=27.7172,85.3240',
        socialLinks: {
          facebook: 'https://facebook.com/oldliquornepal',
          instagram: 'https://instagram.com/oldliquornepal',
          whatsapp: '+9779809999999',
          tiktok: null,
          youtube: null,
        },
        announcementText: 'Extended delivery hours until 1 AM on weekends',
        announcementActive: true,
      };

      const res = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.storeName).toBe(payload.storeName);
      expect(res.body.data.storeTagline).toBe(payload.storeTagline);
      expect(res.body.data.primaryPhone).toBe(payload.primaryPhone);
      expect(res.body.data.secondaryPhone).toBe(payload.secondaryPhone);
      expect(res.body.data.supportEmail).toBe(payload.supportEmail);
      expect(res.body.data.address).toBe(payload.address);
      expect(res.body.data.locationUrl).toBe(payload.locationUrl);
      expect(res.body.data.socialLinks.facebook).toBe(
        'https://facebook.com/oldliquornepal',
      );
      expect(res.body.data.announcementText).toBe(payload.announcementText);
      expect(res.body.data.announcementActive).toBe(true);

      // Verify audit logging
      const auditLog = auditRepo.logs.find(
        (l) =>
          l.action === 'settings.update' && l.resourceType === 'store_settings',
      );
      expect(auditLog).toBeDefined();
      expect(auditLog?.resourceId).toBe('default');
      expect(auditLog?.actorAdminId).toBe(
        '90000000-0000-4000-8000-000000000001',
      );
    });
  });

  describe('Business Hours & Scheduling Validation', () => {
    it('supports custom hours, closed days, and overnight hours', async () => {
      const { app, token } = setupSettingsFixture();

      const customBusinessHours = [
        { day: 'MONDAY', isOpen: true, openTime: '11:00', closeTime: '23:00' },
        { day: 'TUESDAY', isOpen: true, openTime: '11:00', closeTime: '23:00' },
        {
          day: 'WEDNESDAY',
          isOpen: true,
          openTime: '11:00',
          closeTime: '23:00',
        },
        {
          day: 'THURSDAY',
          isOpen: true,
          openTime: '11:00',
          closeTime: '23:00',
        },
        // Friday & Saturday have overnight hours (closing past midnight at 02:00)
        { day: 'FRIDAY', isOpen: true, openTime: '11:00', closeTime: '02:00' },
        {
          day: 'SATURDAY',
          isOpen: true,
          openTime: '11:00',
          closeTime: '02:00',
        },
        // Sunday is closed
        { day: 'SUNDAY', isOpen: false, openTime: null, closeTime: null },
      ];

      const res = await request(app)
        .put('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ businessHours: customBusinessHours });

      expect(res.status).toBe(200);
      expect(res.body.data.businessHours).toEqual(customBusinessHours);

      // Verify public storefront reflects updated business hours
      const pubRes = await request(app).get('/api/settings');
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.businessHours).toEqual(customBusinessHours);
    });

    it('rejects invalid business hours (malformed 24h format, open day missing times)', async () => {
      const { app, token } = setupSettingsFixture();

      // 1. Invalid time format
      const resBadFormat = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          businessHours: [
            {
              day: 'MONDAY',
              isOpen: true,
              openTime: '25:00',
              closeTime: '22:00',
            },
          ],
        });
      expect(resBadFormat.status).toBe(400);

      // 2. Open day with missing openTime
      const resMissingTime = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          businessHours: [
            { day: 'MONDAY', isOpen: true, openTime: null, closeTime: '22:00' },
          ],
        });
      expect(resMissingTime.status).toBe(400);
    });

    it('rejects invalid email, phone number, and timezone', async () => {
      const { app, token } = setupSettingsFixture();

      // Invalid email
      const resEmail = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ supportEmail: 'not-an-email' });
      expect(resEmail.status).toBe(400);

      // Invalid phone
      const resPhone = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ primaryPhone: '123' }); // too short
      expect(resPhone.status).toBe(400);

      // Invalid timezone
      const resTz = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ timezone: 'Invalid/NonExistentZone' });
      expect(resTz.status).toBe(400);
    });

    it('rejects when announcementStartDate is later than announcementEndDate', async () => {
      const { app, token } = setupSettingsFixture();

      const res = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          announcementStartDate: '2026-12-31T00:00:00.000Z',
          announcementEndDate: '2026-12-01T00:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
