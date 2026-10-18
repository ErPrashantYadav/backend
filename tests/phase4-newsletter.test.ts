import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type {
  AdminAuthRecord,
  AdminAuthRepository,
} from '../src/modules/auth/auth.types';
import { MemoryAuditLogRepository } from '../src/modules/audit/memory-audit.repository';
import { AuditService } from '../src/modules/audit/audit.service';
import { MemoryNewsletterRepository } from '../src/modules/newsletter/memory-newsletter.repository';
import { NewsletterService } from '../src/modules/newsletter/newsletter.service';
import { testConfig } from './helpers';

class TestNewsletterAuthRepo implements AdminAuthRepository {
  public superAdmin: AdminAuthRecord = {
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
      permissions: ['newsletter.read', 'newsletter.delete'],
    },
  };

  public readOnlyAdmin: AdminAuthRecord = {
    id: '40000000-0000-4000-8000-000000000002',
    email: 'reader@liquor-shop.test',
    passwordHash: 'argon2id-hash',
    name: 'Reader Admin',
    isActive: true,
    roleId: 'role-reader',
    role: {
      id: 'role-reader',
      name: 'Reader Admin',
      isActive: true,
      permissions: ['newsletter.read'],
    },
  };

  public unprivilegedAdmin: AdminAuthRecord = {
    id: '40000000-0000-4000-8000-000000000003',
    email: 'unprivileged@liquor-shop.test',
    passwordHash: 'argon2id-hash',
    name: 'Unprivileged Admin',
    isActive: true,
    roleId: 'role-unprivileged',
    role: {
      id: 'role-unprivileged',
      name: 'Unprivileged',
      isActive: true,
      permissions: ['orders.read'],
    },
  };

  async findByEmail(email: string): Promise<AdminAuthRecord | null> {
    if (email === this.superAdmin.email) return this.superAdmin;
    if (email === this.readOnlyAdmin.email) return this.readOnlyAdmin;
    if (email === this.unprivilegedAdmin.email) return this.unprivilegedAdmin;
    return null;
  }

  async findById(id: string): Promise<AdminAuthRecord | null> {
    if (id === this.superAdmin.id) return this.superAdmin;
    if (id === this.readOnlyAdmin.id) return this.readOnlyAdmin;
    if (id === this.unprivilegedAdmin.id) return this.unprivilegedAdmin;
    return null;
  }
}

function createTestApp() {
  const config = testConfig();
  const authRepo = new TestNewsletterAuthRepo();
  const auditRepo = new MemoryAuditLogRepository();
  const auditService = new AuditService(auditRepo);
  const newsletterRepo = new MemoryNewsletterRepository();
  const newsletterService = new NewsletterService(newsletterRepo, auditService);

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepo,
    auditRepository: auditRepo,
    newsletterRepository: newsletterRepo,
    newsletterService,
  });

  const superAdminToken = createAdminAccessToken(
    config,
    authRepo.superAdmin.id,
  );

  const readOnlyToken = createAdminAccessToken(
    config,
    authRepo.readOnlyAdmin.id,
  );

  const unprivilegedToken = createAdminAccessToken(
    config,
    authRepo.unprivilegedAdmin.id,
  );

  return {
    app,
    authRepo,
    auditRepo,
    auditService,
    newsletterRepo,
    newsletterService,
    superAdminToken,
    readOnlyToken,
    unprivilegedToken,
  };
}

describe('Phase 4: Newsletter Module Parity with Performance House', () => {
  describe('Public Newsletter Subscribe API', () => {
    it('successfully subscribes a new valid email address with 201 response', async () => {
      const { app, newsletterRepo } = createTestApp();

      const response = await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'drinker@example.com' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        'Successfully subscribed to newsletter',
      );
      expect(response.body.data).toMatchObject({
        email: 'drinker@example.com',
        isActive: true,
        unsubscribedAt: null,
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.subscribedAt).toBeDefined();

      const stored = await newsletterRepo.findByEmail('drinker@example.com');
      expect(stored).not.toBeNull();
      expect(stored?.isActive).toBe(true);
    });

    it('normalizes email casing and trims whitespace on subscribe', async () => {
      const { app, newsletterRepo } = createTestApp();

      const response = await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: '   WhIsKey.LOVER@Example.COM   ' });

      expect(response.status).toBe(201);
      expect(response.body.data.email).toBe('whiskey.lover@example.com');

      const stored = await newsletterRepo.findByEmail(
        'whiskey.lover@example.com',
      );
      expect(stored).not.toBeNull();
      expect(stored?.email).toBe('whiskey.lover@example.com');
    });

    it('rejects subscribing an already active subscriber with 400 and reference error message', async () => {
      const { app } = createTestApp();

      await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'active@example.com' });

      const duplicateResponse = await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'ACTIVE@example.com' });

      expect(duplicateResponse.status).toBe(400);
      expect(duplicateResponse.body.success).toBe(false);
      expect(duplicateResponse.body.error.message).toBe(
        'Email is already subscribed',
      );
    });

    it('reactivates a previously unsubscribed email on re-subscribe', async () => {
      const { app, newsletterRepo } = createTestApp();

      // Subscribe first
      await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'resubscribe@example.com' });

      // Unsubscribe
      await request(app)
        .post('/api/newsletter/unsubscribe')
        .send({ email: 'resubscribe@example.com' });

      const unsubscribedRecord = await newsletterRepo.findByEmail(
        'resubscribe@example.com',
      );
      expect(unsubscribedRecord?.isActive).toBe(false);
      expect(unsubscribedRecord?.unsubscribedAt).not.toBeNull();

      // Re-subscribe
      const resubscribeResponse = await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'resubscribe@example.com' });

      expect(resubscribeResponse.status).toBe(201);
      expect(resubscribeResponse.body.success).toBe(true);
      expect(resubscribeResponse.body.message).toBe(
        'Successfully subscribed to newsletter',
      );
      expect(resubscribeResponse.body.data.isActive).toBe(true);
      expect(resubscribeResponse.body.data.unsubscribedAt).toBeNull();

      const reactivatedRecord = await newsletterRepo.findByEmail(
        'resubscribe@example.com',
      );
      expect(reactivatedRecord?.isActive).toBe(true);
      expect(reactivatedRecord?.unsubscribedAt).toBeNull();
    });

    it('validates email format and rejects empty or malformed inputs with 400', async () => {
      const { app } = createTestApp();

      const emptyRes = await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: '' });
      expect(emptyRes.status).toBe(400);

      const invalidRes = await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'not-an-email' });
      expect(invalidRes.status).toBe(400);

      const missingRes = await request(app)
        .post('/api/newsletter/subscribe')
        .send({});
      expect(missingRes.status).toBe(400);
    });

    it('handles concurrent subscribe requests without crashing or duplicating records', async () => {
      const { app, newsletterRepo } = createTestApp();
      const testEmail = 'concurrent.user@example.com';

      const results = await Promise.all([
        request(app)
          .post('/api/newsletter/subscribe')
          .send({ email: testEmail }),
        request(app)
          .post('/api/newsletter/subscribe')
          .send({ email: testEmail }),
        request(app)
          .post('/api/newsletter/subscribe')
          .send({ email: testEmail }),
      ]);

      const successCount = results.filter((r) => r.status === 201).length;
      const alreadySubscribedCount = results.filter(
        (r) =>
          r.status === 400 &&
          r.body?.error?.message === 'Email is already subscribed',
      ).length;

      expect(successCount).toBe(1);
      expect(alreadySubscribedCount).toBe(2);

      const allRecords = await newsletterRepo.list();
      const matches = allRecords.filter((r) => r.email === testEmail);
      expect(matches.length).toBe(1);
    });
  });

  describe('Public Newsletter Unsubscribe API', () => {
    it('successfully unsubscribes an active subscriber with 200 response', async () => {
      const { app, newsletterRepo } = createTestApp();

      await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'unsub.test@example.com' });

      const response = await request(app)
        .post('/api/newsletter/unsubscribe')
        .send({ email: 'unsub.test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        'Successfully unsubscribed from newsletter',
      );

      const stored = await newsletterRepo.findByEmail('unsub.test@example.com');
      expect(stored?.isActive).toBe(false);
      expect(stored?.unsubscribedAt).not.toBeNull();
    });

    it('normalizes email casing and whitespace on unsubscribe', async () => {
      const { app, newsletterRepo } = createTestApp();

      await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'casing.test@example.com' });

      const response = await request(app)
        .post('/api/newsletter/unsubscribe')
        .send({ email: '   CASING.TEST@EXAMPLE.COM   ' });

      expect(response.status).toBe(200);

      const stored = await newsletterRepo.findByEmail(
        'casing.test@example.com',
      );
      expect(stored?.isActive).toBe(false);
    });

    it('returns 400 with reference message "Email not found" when email is not registered', async () => {
      const { app } = createTestApp();

      const response = await request(app)
        .post('/api/newsletter/unsubscribe')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Email not found');
    });

    it('returns 400 with reference message "Email is already unsubscribed" when already inactive', async () => {
      const { app } = createTestApp();

      await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'twice.unsub@example.com' });

      await request(app)
        .post('/api/newsletter/unsubscribe')
        .send({ email: 'twice.unsub@example.com' });

      const secondUnsub = await request(app)
        .post('/api/newsletter/unsubscribe')
        .send({ email: 'twice.unsub@example.com' });

      expect(secondUnsub.status).toBe(400);
      expect(secondUnsub.body.success).toBe(false);
      expect(secondUnsub.body.error.message).toBe(
        'Email is already unsubscribed',
      );
    });

    it('rejects invalid email inputs on unsubscribe with 400 validation error', async () => {
      const { app } = createTestApp();

      const response = await request(app)
        .post('/api/newsletter/unsubscribe')
        .send({ email: 'bad-email' });

      expect(response.status).toBe(400);
    });
  });

  describe('Admin Newsletter Management APIs', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const { app } = createTestApp();

      const getRes = await request(app).get(
        '/api/admin/newsletter/subscribers',
      );
      expect(getRes.status).toBe(401);

      const getActiveRes = await request(app).get(
        '/api/admin/newsletter/subscribers/active',
      );
      expect(getActiveRes.status).toBe(401);

      const deleteRes = await request(app).delete(
        '/api/admin/newsletter/subscribers/00000000-0000-0000-0000-000000000001',
      );
      expect(deleteRes.status).toBe(401);
    });

    it('rejects requests from an admin lacking newsletter permissions with 403', async () => {
      const { app, unprivilegedToken } = createTestApp();

      const getRes = await request(app)
        .get('/api/admin/newsletter/subscribers')
        .set('Authorization', `Bearer ${unprivilegedToken}`);
      expect(getRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete(
          '/api/admin/newsletter/subscribers/00000000-0000-0000-0000-000000000001',
        )
        .set('Authorization', `Bearer ${unprivilegedToken}`);
      expect(deleteRes.status).toBe(403);
    });

    it('lists all subscribers with 200 via GET /api/admin/newsletter/subscribers', async () => {
      const { app, readOnlyToken } = createTestApp();

      await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'sub1@example.com' });
      await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'sub2@example.com' });
      await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'sub3@example.com' });
      await request(app)
        .post('/api/newsletter/unsubscribe')
        .send({ email: 'sub2@example.com' });

      const response = await request(app)
        .get('/api/admin/newsletter/subscribers')
        .set('Authorization', `Bearer ${readOnlyToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Newsletter subscribers fetched');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(3);

      const emails = response.body.data.map((s: { email: string }) => s.email);
      expect(emails).toContain('sub1@example.com');
      expect(emails).toContain('sub2@example.com');
      expect(emails).toContain('sub3@example.com');
    });

    it('lists only active subscribers via GET /api/admin/newsletter/subscribers/active', async () => {
      const { app, readOnlyToken } = createTestApp();

      await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'active1@example.com' });
      await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'inactive1@example.com' });
      await request(app)
        .post('/api/newsletter/unsubscribe')
        .send({ email: 'inactive1@example.com' });

      const response = await request(app)
        .get('/api/admin/newsletter/subscribers/active')
        .set('Authorization', `Bearer ${readOnlyToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Active subscribers fetched');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].email).toBe('active1@example.com');
      expect(response.body.data[0].isActive).toBe(true);
    });

    it('supports query search on subscribers list', async () => {
      const { app, readOnlyToken } = createTestApp();

      await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'target.user@domain.com' });
      await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'other.person@somewhere.com' });

      const response = await request(app)
        .get('/api/admin/newsletter/subscribers?search=target')
        .set('Authorization', `Bearer ${readOnlyToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].email).toBe('target.user@domain.com');
    });

    it('allows admin with newsletter.delete to remove subscriber and writes audit log', async () => {
      const { app, superAdminToken, auditRepo, newsletterRepo } =
        createTestApp();

      const subRes = await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'delete.me@example.com' });
      const subscriberId = subRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/api/admin/newsletter/subscribers/${subscriberId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.message).toBe('Subscriber deleted');

      const lookup = await newsletterRepo.findById(subscriberId);
      expect(lookup).toBeNull();

      // Check audit log was recorded
      const logs = await auditRepo.listLogs({
        action: 'NEWSLETTER_SUBSCRIBER_DELETED',
        page: 1,
        limit: 10,
      });
      expect(logs.items.length).toBe(1);
      expect(logs.items[0].resourceType).toBe('NewsletterSubscriber');
      expect(logs.items[0].resourceId).toBe(subscriberId);
      expect(logs.items[0].actorAdminId).toBe(
        '40000000-0000-4000-8000-000000000001',
      );
      // Verify no raw PII in metadata
      expect(JSON.stringify(logs.items[0].metadata)).not.toContain(
        'delete.me@example.com',
      );
    });

    it('returns 404 with "Subscriber not found" when deleting non-existent subscriber ID', async () => {
      const { app, superAdminToken } = createTestApp();
      const nonExistentUuid = '99999999-9999-4999-a999-999999999999';

      const response = await request(app)
        .delete(`/api/admin/newsletter/subscribers/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Subscriber not found');
    });

    it('returns 400 validation error when deleting with invalid UUID format', async () => {
      const { app, superAdminToken } = createTestApp();

      const response = await request(app)
        .delete('/api/admin/newsletter/subscribers/not-a-valid-uuid')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects deletion with 403 when admin only has read-only permission', async () => {
      const { app, readOnlyToken } = createTestApp();

      const subRes = await request(app)
        .post('/api/newsletter/subscribe')
        .send({ email: 'cannot.delete@example.com' });
      const subscriberId = subRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/api/admin/newsletter/subscribers/${subscriberId}`)
        .set('Authorization', `Bearer ${readOnlyToken}`);

      expect(deleteRes.status).toBe(403);
    });
  });
});
