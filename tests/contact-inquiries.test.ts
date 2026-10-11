import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { MemoryAuditLogRepository } from '../src/modules/audit/memory-audit.repository';
import { MemoryContactInquiryRepository } from '../src/modules/contact-inquiry/memory-contact-inquiry.repository';
import type { ContactInquiryRecord } from '../src/modules/contact-inquiry/contact-inquiry.types';
import { testConfig } from './helpers';

interface ContactTestContext {
  app: ReturnType<typeof createApp>;
  token: string;
  inquiryRepo: MemoryContactInquiryRepository;
  auditRepo: MemoryAuditLogRepository;
}

function setupContactFixture(
  permissions: string[] = [
    'contact-inquiries.read',
    'contact-inquiries.update',
  ],
  initialInquiries: ContactInquiryRecord[] = [],
): ContactTestContext {
  const config = testConfig();
  const adminId = '80000000-0000-4000-8000-000000000001';
  const roleId = '80000000-0000-4000-8000-000000000002';

  const authRepository: AdminAuthRepository = {
    async findByEmail() {
      return null;
    },
    async findById(id) {
      if (id !== adminId) return null;
      return {
        id: adminId,
        email: 'staff@liquorshop.local',
        passwordHash: 'hash',
        name: 'Staff Support',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: {
          id: roleId,
          name: 'Support Role',
          isActive: true,
          permissions,
        },
      };
    },
    async updatePassword() {},
  };

  const auditRepo = new MemoryAuditLogRepository();
  const inquiryRepo = new MemoryContactInquiryRepository(initialInquiries);

  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    contactInquiryRepository: inquiryRepo,
    auditRepository: auditRepo,
  });

  const token = createAdminAccessToken(config, adminId);

  return { app, token, inquiryRepo, auditRepo };
}

describe('Contact & Customer Inquiries Management', () => {
  describe('Public Submission & Validation', () => {
    it('successfully submits a contact inquiry without authentication', async () => {
      const { app } = setupContactFixture();

      const payload = {
        name: 'Kiran Shrestha',
        phone: '+977-9841234567',
        email: 'Kiran.S@Example.com',
        subject: 'Inquiry regarding bulk order for wedding',
        message:
          'Hello, I would like to inquire about ordering 50 bottles of Old Durbar for a reception next month. Do you offer bulk delivery?',
      };

      const res = await request(app).post('/api/contact').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Kiran Shrestha');
      expect(res.body.data.subject).toBe(payload.subject);
      expect(res.body.data.status).toBe('NEW');
      expect(res.body.data.createdAt).toBeDefined();
    });

    it('successfully submits an inquiry without optional email', async () => {
      const { app } = setupContactFixture();

      const payload = {
        name: 'Phone Only Customer',
        phone: '9841112233',
        subject: 'Delivery Hours Inquiry',
        message: 'Do you deliver after 9 PM in Patan area?',
      };

      const res = await request(app)
        .post('/api/contact-inquiries')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Phone Only Customer');
    });

    it('rejects submission with invalid phone number format', async () => {
      const { app } = setupContactFixture();

      const res = await request(app).post('/api/contact').send({
        name: 'Test Customer',
        phone: 'INVALID-PHONE-$$$$',
        subject: 'General Question',
        message: 'Hello, testing phone validation.',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects submission with invalid email format', async () => {
      const { app } = setupContactFixture();

      const res = await request(app).post('/api/contact').send({
        name: 'Test Customer',
        phone: '9841234567',
        email: 'not-an-email',
        subject: 'General Question',
        message: 'Hello, testing email validation.',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects submission with subject or message too short', async () => {
      const { app } = setupContactFixture();

      // Subject too short
      const resSubject = await request(app).post('/api/contact').send({
        name: 'Test Customer',
        phone: '9841234567',
        subject: 'A',
        message: 'Valid length message here',
      });
      expect(resSubject.status).toBe(400);

      // Message too short
      const resMsg = await request(app).post('/api/contact').send({
        name: 'Test Customer',
        phone: '9841234567',
        subject: 'Valid Subject',
        message: 'Hi',
      });
      expect(resMsg.status).toBe(400);
    });

    it('ignores client-supplied status, admin notes, or resolved dates', async () => {
      const { app, inquiryRepo } = setupContactFixture();

      const res = await request(app).post('/api/contact').send({
        name: 'Attacker',
        phone: '9841234567',
        subject: 'Tampering Attempt',
        message: 'Trying to inject admin fields.',
        status: 'RESOLVED',
        adminNote: 'Pre-approved note',
        resolvedAt: '2026-01-01T00:00:00Z',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('NEW');

      const saved = inquiryRepo.inquiries.find(
        (i) => i.id === res.body.data.id,
      );
      expect(saved).toBeDefined();
      expect(saved?.status).toBe('NEW');
      expect(saved?.adminNote).toBeNull();
      expect(saved?.resolvedAt).toBeNull();
    });
  });

  describe('Admin RBAC & Authentication', () => {
    it('requires authentication for admin inquiry endpoints', async () => {
      const { app } = setupContactFixture();

      const res = await request(app).get('/api/admin/contact-inquiries');
      expect(res.status).toBe(401);
    });

    it('rejects admin lacking contact-inquiries.read permission', async () => {
      const { app, token } = setupContactFixture(['orders.read']);

      const res = await request(app)
        .get('/api/admin/contact-inquiries')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects status update if admin lacks contact-inquiries.update permission', async () => {
      const inquiry: ContactInquiryRecord = {
        id: 'inq-1',
        name: 'Test User',
        phone: '9841111111',
        email: 'test@example.com',
        subject: 'Order Delay',
        message: 'My order has not arrived yet.',
        status: 'NEW',
        adminNote: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { app, token } = setupContactFixture(
        ['contact-inquiries.read'], // read only, no update
        [inquiry],
      );

      const res = await request(app)
        .patch('/api/admin/contact-inquiries/inq-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(403);
    });
  });

  describe('Admin Listing, Search & Filters', () => {
    const sampleInquiries: ContactInquiryRecord[] = [
      {
        id: 'inq-a',
        name: 'Aayush Karki',
        phone: '+9779841000001',
        email: 'aayush@nepal.com',
        subject: 'Wedding Package Inquiry',
        message: 'Please send catalog and price list for events.',
        status: 'NEW',
        adminNote: null,
        resolvedAt: null,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        updatedAt: new Date('2026-10-01T10:00:00Z'),
      },
      {
        id: 'inq-b',
        name: 'Bina Rai',
        phone: '+9779841000002',
        email: 'bina@biratnagar.com',
        subject: 'Delayed Refund Question',
        message: 'Still waiting on my refund verification.',
        status: 'IN_PROGRESS',
        adminNote: 'Checking with payments team',
        resolvedAt: null,
        createdAt: new Date('2026-10-05T10:00:00Z'),
        updatedAt: new Date('2026-10-05T12:00:00Z'),
      },
      {
        id: 'inq-c',
        name: 'Chirag KC',
        phone: '+9779841000003',
        email: 'chirag@pokhara.com',
        subject: 'Corporate Tasting Event',
        message: 'Corporate tasting session booking request.',
        status: 'RESOLVED',
        adminNote: 'Completed via phone call',
        resolvedAt: new Date('2026-10-09T15:00:00Z'),
        createdAt: new Date('2026-10-08T10:00:00Z'),
        updatedAt: new Date('2026-10-09T15:00:00Z'),
      },
    ];

    it('lists inquiries with pagination', async () => {
      const { app, token } = setupContactFixture(
        ['contact-inquiries.read'],
        sampleInquiries,
      );

      const res = await request(app)
        .get('/api/admin/contact-inquiries?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('searches inquiries by name, phone, email, or subject', async () => {
      const { app, token } = setupContactFixture(
        ['contact-inquiries.read'],
        sampleInquiries,
      );

      // Search by subject
      const resSubject = await request(app)
        .get('/api/admin/contact-inquiries?search=Wedding')
        .set('Authorization', `Bearer ${token}`);
      expect(resSubject.status).toBe(200);
      expect(resSubject.body.data.items).toHaveLength(1);
      expect(resSubject.body.data.items[0].id).toBe('inq-a');

      // Search by email
      const resEmail = await request(app)
        .get('/api/admin/contact-inquiries?search=biratnagar')
        .set('Authorization', `Bearer ${token}`);
      expect(resEmail.status).toBe(200);
      expect(resEmail.body.data.items).toHaveLength(1);
      expect(resEmail.body.data.items[0].id).toBe('inq-b');
    });

    it('filters inquiries by status', async () => {
      const { app, token } = setupContactFixture(
        ['contact-inquiries.read'],
        sampleInquiries,
      );

      const res = await request(app)
        .get('/api/admin/contact-inquiries?status=RESOLVED')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].id).toBe('inq-c');
    });

    it('filters inquiries by date range and validates boundaries', async () => {
      const { app, token } = setupContactFixture(
        ['contact-inquiries.read'],
        sampleInquiries,
      );

      // Filter between Oct 4 and Oct 6
      const resRange = await request(app)
        .get(
          '/api/admin/contact-inquiries?startDate=2026-10-04T00:00:00Z&endDate=2026-10-06T23:59:59Z',
        )
        .set('Authorization', `Bearer ${token}`);

      expect(resRange.status).toBe(200);
      expect(resRange.body.data.items).toHaveLength(1);
      expect(resRange.body.data.items[0].id).toBe('inq-b');

      // Reject startDate > endDate
      const resInvalid = await request(app)
        .get(
          '/api/admin/contact-inquiries?startDate=2026-10-10T00:00:00Z&endDate=2026-10-01T00:00:00Z',
        )
        .set('Authorization', `Bearer ${token}`);

      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.error.code).toBe('INVALID_DATE_RANGE');
    });
  });

  describe('Admin Details & Status Management', () => {
    it('views inquiry detail with admin notes', async () => {
      const inquiry: ContactInquiryRecord = {
        id: 'inq-detail-1',
        name: 'Deepak Sharma',
        phone: '9841999888',
        email: 'deepak@test.com',
        subject: 'Damaged item received',
        message: 'The seal was broken upon delivery.',
        status: 'IN_PROGRESS',
        adminNote: 'Requested photo verification from customer.',
        resolvedAt: null,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        updatedAt: new Date('2026-10-01T11:00:00Z'),
      };

      const { app, token } = setupContactFixture(
        ['contact-inquiries.read'],
        [inquiry],
      );

      const res = await request(app)
        .get('/api/admin/contact-inquiries/inq-detail-1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('inq-detail-1');
      expect(res.body.data.name).toBe('Deepak Sharma');
      expect(res.body.data.adminNote).toBe(
        'Requested photo verification from customer.',
      );
    });

    it('returns 404 for non-existent inquiry', async () => {
      const { app, token } = setupContactFixture(['contact-inquiries.read']);

      const res = await request(app)
        .get('/api/admin/contact-inquiries/non-existent-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INQUIRY_NOT_FOUND');
    });

    it('updates inquiry status, saves internal note and records audit event', async () => {
      const inquiry: ContactInquiryRecord = {
        id: 'inq-status-1',
        name: 'Anita Gurung',
        phone: '9841234567',
        email: 'anita@test.com',
        subject: 'Inquiry on wine availability',
        message: 'Do you have French Pinot Noir in stock?',
        status: 'NEW',
        adminNote: null,
        resolvedAt: null,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        updatedAt: new Date('2026-10-01T10:00:00Z'),
      };

      const { app, token, auditRepo } = setupContactFixture(
        ['contact-inquiries.read', 'contact-inquiries.update'],
        [inquiry],
      );

      const res = await request(app)
        .patch('/api/admin/contact-inquiries/inq-status-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'RESOLVED',
          adminNote:
            'Called customer; informed about new wine stock arriving Friday.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESOLVED');
      expect(res.body.data.adminNote).toBe(
        'Called customer; informed about new wine stock arriving Friday.',
      );
      expect(res.body.data.resolvedAt).toBeDefined();

      // Check audit log entry
      expect(auditRepo.logs).toHaveLength(1);
      expect(auditRepo.logs[0].action).toBe('contact_inquiry.update_status');
      expect(auditRepo.logs[0].resourceId).toBe('inq-status-1');
      expect(auditRepo.logs[0].metadata).toEqual({
        previousStatus: 'NEW',
        newStatus: 'RESOLVED',
        adminNote:
          'Called customer; informed about new wine stock arriving Friday.',
      });
    });

    it('deletes inquiry and records audit event', async () => {
      const inquiry: ContactInquiryRecord = {
        id: 'inq-del-1',
        name: 'Spam Sender',
        phone: '9841000000',
        email: 'spam@bot.com',
        subject: 'Casino Advertisement',
        message: 'Click this link to win cash.',
        status: 'CLOSED',
        adminNote: 'Spam submission',
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { app, token, inquiryRepo, auditRepo } = setupContactFixture(
        ['contact-inquiries.read', 'contact-inquiries.update'],
        [inquiry],
      );

      const res = await request(app)
        .delete('/api/admin/contact-inquiries/inq-del-1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(inquiryRepo.inquiries).toHaveLength(0);

      expect(auditRepo.logs).toHaveLength(1);
      expect(auditRepo.logs[0].action).toBe('contact_inquiry.delete');
      expect(auditRepo.logs[0].resourceId).toBe('inq-del-1');
    });
  });
});
