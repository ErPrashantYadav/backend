import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/errors/app-error';
import { testConfig } from './helpers';
import {
  createEmailProvider,
  createWhatsAppProvider,
} from '../src/modules/notifications/providers/provider-factory';
import {
  ConsoleEmailProvider,
  UnconfiguredEmailProvider,
} from '../src/modules/notifications/providers/email.provider';
import {
  ConsoleWhatsAppProvider,
  UnconfiguredWhatsAppProvider,
} from '../src/modules/notifications/providers/whatsapp.provider';
import { MemoryEmailProvider } from '../src/modules/notifications/providers/memory-email.provider';
import { MemoryWhatsAppProvider } from '../src/modules/notifications/providers/memory-whatsapp.provider';
import { ResendEmailProvider } from '../src/modules/notifications/providers/resend-email.provider';
import { SmtpEmailProvider } from '../src/modules/notifications/providers/smtp-email.provider';
import { MetaWhatsAppProvider } from '../src/modules/notifications/providers/meta-whatsapp.provider';
import { MemoryNotificationOutboxRepository } from '../src/modules/notifications/memory-notification-outbox.repository';
import { NotificationOutboxService } from '../src/modules/notifications/notification-outbox.service';
import { NotificationWorker } from '../src/modules/notifications/notification-worker.runner';
import type { Transporter } from 'nodemailer';

describe('Task 24: Notification Worker Operational Readiness & Provider Integration', () => {
  describe('Provider Factory & Configuration Safety', () => {
    it('selects ResendEmailProvider when configured with RESEND and API key', () => {
      const config = testConfig({
        EMAIL_PROVIDER: 'RESEND',
        RESEND_API_KEY: 're_secret_123456789',
      });
      const provider = createEmailProvider(config, false);
      expect(provider).toBeInstanceOf(ResendEmailProvider);
    });

    it('returns UnconfiguredEmailProvider when EMAIL_PROVIDER=RESEND but RESEND_API_KEY is missing', async () => {
      const config = testConfig({
        EMAIL_PROVIDER: 'RESEND',
        RESEND_API_KEY: undefined,
      });
      const provider = createEmailProvider(config, false);
      expect(provider).toBeInstanceOf(UnconfiguredEmailProvider);

      await expect(
        provider.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          text: 'Hello',
        }),
      ).rejects.toThrow(
        'RESEND_API_KEY is required when EMAIL_PROVIDER=RESEND',
      );
    });

    it('selects SmtpEmailProvider when configured with SMTP and host/port', () => {
      const config = testConfig({
        EMAIL_PROVIDER: 'SMTP',
        SMTP_HOST: 'smtp.mailgun.org',
        SMTP_PORT: 587,
        SMTP_USER: 'user',
        SMTP_PASSWORD: 'password',
      });
      const provider = createEmailProvider(config, false);
      expect(provider).toBeInstanceOf(SmtpEmailProvider);
    });

    it('returns UnconfiguredEmailProvider when EMAIL_PROVIDER=SMTP but SMTP_HOST or SMTP_PORT is missing', async () => {
      const config = testConfig({
        EMAIL_PROVIDER: 'SMTP',
        SMTP_HOST: undefined,
        SMTP_PORT: undefined,
      });
      const provider = createEmailProvider(config, false);
      expect(provider).toBeInstanceOf(UnconfiguredEmailProvider);

      await expect(
        provider.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          text: 'Hello',
        }),
      ).rejects.toThrow(
        'SMTP_HOST and SMTP_PORT are required when EMAIL_PROVIDER=SMTP',
      );
    });

    it('selects ConsoleEmailProvider when EMAIL_PROVIDER=CONSOLE', () => {
      const config = testConfig({ EMAIL_PROVIDER: 'CONSOLE' });
      const provider = createEmailProvider(config, false);
      expect(provider).toBeInstanceOf(ConsoleEmailProvider);
    });

    it('selects MemoryEmailProvider when isMemoryMode=true', () => {
      const config = testConfig({ EMAIL_PROVIDER: 'RESEND' });
      const provider = createEmailProvider(config, true);
      expect(provider).toBeInstanceOf(MemoryEmailProvider);
    });

    it('selects MetaWhatsAppProvider when WhatsApp token and phone ID are configured', () => {
      const config = testConfig({
        WHATSAPP_API_TOKEN: 'meta_secret_token_123',
        WHATSAPP_PHONE_NUMBER_ID: '1000987654321',
      });
      const provider = createWhatsAppProvider(config, false);
      expect(provider).toBeInstanceOf(MetaWhatsAppProvider);
    });

    it('returns ConsoleWhatsAppProvider in development when WhatsApp credentials are missing', () => {
      const config = testConfig({
        NODE_ENV: 'development',
        WHATSAPP_API_TOKEN: undefined,
        WHATSAPP_PHONE_NUMBER_ID: undefined,
      });
      const provider = createWhatsAppProvider(config, false);
      expect(provider).toBeInstanceOf(ConsoleWhatsAppProvider);
    });

    it('returns UnconfiguredWhatsAppProvider in production when WhatsApp credentials are missing', async () => {
      const config = testConfig({
        NODE_ENV: 'production',
        WHATSAPP_API_TOKEN: undefined,
        WHATSAPP_PHONE_NUMBER_ID: undefined,
      });
      const provider = createWhatsAppProvider(config, false);
      expect(provider).toBeInstanceOf(UnconfiguredWhatsAppProvider);

      await expect(
        provider.sendWhatsApp({
          to: '+9779801234567',
          message: 'Hello',
        }),
      ).rejects.toThrow(
        'WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required',
      );
    });

    it('selects MemoryWhatsAppProvider when isMemoryMode=true', () => {
      const config = testConfig();
      const provider = createWhatsAppProvider(config, true);
      expect(provider).toBeInstanceOf(MemoryWhatsAppProvider);
    });
  });

  describe('ResendEmailProvider Adapter', () => {
    it('successfully sends email via HTTPS POST with authorization and returns messageId', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'resend_msg_abc123' }),
      } as Response);

      const provider = new ResendEmailProvider({
        apiKey: 're_valid_api_key_xyz',
        from: 'Old Liquor <orders@oldliquor.com>',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const res = await provider.sendEmail({
        to: 'customer@example.com',
        subject: 'Order Confirmed',
        text: 'Your order has been confirmed.',
      });

      expect(res.messageId).toBe('resend_msg_abc123');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect(init.method).toBe('POST');
      expect(init.headers['Authorization']).toBe('Bearer re_valid_api_key_xyz');
      expect(init.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(init.body as string);
      expect(body.from).toBe('Old Liquor <orders@oldliquor.com>');
      expect(body.to).toEqual(['customer@example.com']);
      expect(body.subject).toBe('Order Confirmed');
      expect(body.text).toBe('Your order has been confirmed.');
    });

    it('handles 429 rate limit response safely', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ message: 'Rate limit exceeded' }),
      } as Response);

      const provider = new ResendEmailProvider({
        apiKey: 're_secret_key',
        from: 'orders@oldliquor.com',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.sendEmail({
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello',
        }),
      ).rejects.toThrow('Resend rate limit exceeded (429)');
    });

    it('handles 400 validation rejection and sanitizes message', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          message: 'Invalid email address provided for key=re_secret_key',
        }),
      } as Response);

      const provider = new ResendEmailProvider({
        apiKey: 're_secret_key',
        from: 'orders@oldliquor.com',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.sendEmail({
          to: 'bad-email',
          subject: 'Test',
          text: 'Hello',
        }),
      ).rejects.toThrow('Resend rejection (400)');
    });

    it('handles network timeouts with 504 RESEND_TIMEOUT', async () => {
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'TimeoutError';

      const mockFetch = vi.fn().mockRejectedValue(timeoutError);

      const provider = new ResendEmailProvider({
        apiKey: 're_secret_key',
        from: 'orders@oldliquor.com',
        timeoutMs: 1000,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      try {
        await provider.sendEmail({
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello',
        });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err instanceof AppError).toBe(true);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(504);
        expect(appErr.code).toBe('RESEND_TIMEOUT');
      }
    });

    it('redacts sensitive API tokens from errors', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(
          new Error(
            'Failed connecting to https://api.resend.com?token=re_super_secret_token_abc',
          ),
        );

      const provider = new ResendEmailProvider({
        apiKey: 're_super_secret_token_abc',
        from: 'orders@oldliquor.com',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      try {
        await provider.sendEmail({
          to: 'customer@example.com',
          subject: 'Test',
          text: 'Hello',
        });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err instanceof Error).toBe(true);
        const error = err as Error;
        expect(error.message).not.toContain('re_super_secret_token_abc');
        expect(error.message).toContain('[REDACTED]');
      }
    });
  });

  describe('SmtpEmailProvider Adapter', () => {
    it('successfully delivers email via transporter and returns messageId', async () => {
      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: '<20261011.smtp.message.123@oldliquor.com>',
      });

      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const provider = new SmtpEmailProvider({
        host: 'smtp.example.com',
        port: 587,
        from: 'Old Liquor <orders@oldliquor.com>',
        transporter: mockTransporter,
      });

      const res = await provider.sendEmail({
        to: 'buyer@example.com',
        subject: 'Order Delivered',
        text: 'Your order was delivered.',
      });

      expect(res.messageId).toBe('<20261011.smtp.message.123@oldliquor.com>');
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'Old Liquor <orders@oldliquor.com>',
        to: 'buyer@example.com',
        subject: 'Order Delivered',
        text: 'Your order was delivered.',
      });
    });

    it('sanitizes SMTP transmission failure and redacts passwords', async () => {
      const mockSendMail = vi
        .fn()
        .mockRejectedValue(
          new Error(
            '535 5.7.8 Authentication failed with pass=super_secret_smtp_password_999',
          ),
        );

      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const provider = new SmtpEmailProvider({
        host: 'smtp.example.com',
        port: 587,
        from: 'orders@oldliquor.com',
        transporter: mockTransporter,
      });

      try {
        await provider.sendEmail({
          to: 'buyer@example.com',
          subject: 'Test',
          text: 'Hello',
        });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err instanceof AppError).toBe(true);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(502);
        expect(appErr.code).toBe('SMTP_SEND_FAILED');
        expect(appErr.message).not.toContain('super_secret_smtp_password_999');
        expect(appErr.message).toContain('[REDACTED]');
      }
    });
  });

  describe('MetaWhatsAppProvider Adapter', () => {
    it('normalizes recipient phone digits and sends message via Meta Graph API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: '9779801234567', wa_id: '9779801234567' }],
          messages: [{ id: 'wamid.HBgM123456789' }],
        }),
      } as Response);

      const provider = new MetaWhatsAppProvider({
        apiToken: 'EAAB_meta_access_token_abc',
        phoneNumberId: 'phone_100200300',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const res = await provider.sendWhatsApp({
        to: '+977-980-123-4567',
        message: 'New order #ORD-1001 placed!',
      });

      expect(res.messageId).toBe('wamid.HBgM123456789');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://graph.facebook.com/v21.0/phone_100200300/messages',
      );
      expect(init.method).toBe('POST');
      expect(init.headers['Authorization']).toBe(
        'Bearer EAAB_meta_access_token_abc',
      );

      const body = JSON.parse(init.body as string);
      expect(body.messaging_product).toBe('whatsapp');
      expect(body.recipient_type).toBe('individual');
      expect(body.to).toBe('9779801234567'); // Digits only, no +, -, or spaces
      expect(body.type).toBe('text');
      expect(body.text.body).toBe('New order #ORD-1001 placed!');
    });

    it('rejects invalid recipient phone format before network request', async () => {
      const mockFetch = vi.fn();
      const provider = new MetaWhatsAppProvider({
        apiToken: 'meta_token',
        phoneNumberId: 'phone_123',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.sendWhatsApp({
          to: 'invalid-phone',
          message: 'Hello',
        }),
      ).rejects.toThrow('Invalid phone number format for WhatsApp recipient');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles 429 rate limit response safely', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: { message: 'Too many messages sent per second' },
        }),
      } as Response);

      const provider = new MetaWhatsAppProvider({
        apiToken: 'meta_token',
        phoneNumberId: 'phone_123',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.sendWhatsApp({
          to: '+9779801234567',
          message: 'Hello',
        }),
      ).rejects.toThrow('Meta WhatsApp API rate limit exceeded (429)');
    });

    it('handles 400 validation error safely', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            message: 'Recipient phone number is not registered on WhatsApp',
          },
        }),
      } as Response);

      const provider = new MetaWhatsAppProvider({
        apiToken: 'meta_token',
        phoneNumberId: 'phone_123',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await expect(
        provider.sendWhatsApp({
          to: '+9779801234567',
          message: 'Hello',
        }),
      ).rejects.toThrow('Meta WhatsApp API validation failure (400)');
    });

    it('handles network timeouts with 504 WHATSAPP_TIMEOUT', async () => {
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'TimeoutError';

      const mockFetch = vi.fn().mockRejectedValue(timeoutError);

      const provider = new MetaWhatsAppProvider({
        apiToken: 'meta_token',
        phoneNumberId: 'phone_123',
        timeoutMs: 1000,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      try {
        await provider.sendWhatsApp({
          to: '+9779801234567',
          message: 'Hello',
        });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err instanceof AppError).toBe(true);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(504);
        expect(appErr.code).toBe('WHATSAPP_TIMEOUT');
      }
    });

    it('redacts sensitive Meta tokens from errors', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(
          new Error(
            'Failed request to Graph API with Authorization: Bearer EAAB_meta_secret_key_999',
          ),
        );

      const provider = new MetaWhatsAppProvider({
        apiToken: 'EAAB_meta_secret_key_999',
        phoneNumberId: 'phone_123',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      try {
        await provider.sendWhatsApp({
          to: '+9779801234567',
          message: 'Hello',
        });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err instanceof Error).toBe(true);
        const error = err as Error;
        expect(error.message).not.toContain('EAAB_meta_secret_key_999');
        expect(error.message).toContain('[REDACTED]');
      }
    });
  });

  describe('NotificationWorker Runner & Operational Controls', () => {
    it('processes bounded batches and updates operational metrics', async () => {
      const outboxRepo = new MemoryNotificationOutboxRepository();
      const emailProvider = new MemoryEmailProvider();
      const whatsappProvider = new MemoryWhatsAppProvider();

      const service = new NotificationOutboxService(
        outboxRepo,
        emailProvider,
        whatsappProvider,
        '+9779801234567',
        'Old Liquor <orders@oldliquor.com>',
      );

      // Enqueue 5 jobs
      for (let i = 1; i <= 5; i++) {
        await outboxRepo.enqueue({
          channel: 'WHATSAPP',
          eventType: 'ORDER_CREATED_OWNER_ALERT',
          recipient: '+9779801234567',
          payload: { orderNumber: `ORD-TEST-${i}`, total: '1500.00' },
          idempotencyKey: `test:batch:${i}`,
        });
      }

      const worker = new NotificationWorker({
        notificationService: service,
        batchSize: 3, // Bounded batch limit
      });

      // Batch 1 (limit 3)
      const batch1 = await worker.processOnce();
      expect(batch1.processed).toBe(3);
      expect(batch1.delivered).toBe(3);
      expect(batch1.failed).toBe(0);

      let metrics = worker.getMetrics();
      expect(metrics.totalBatches).toBe(1);
      expect(metrics.totalDelivered).toBe(3);
      expect(metrics.consecutiveEmptyBatches).toBe(0);

      // Batch 2 (remaining 2)
      const batch2 = await worker.processOnce();
      expect(batch2.processed).toBe(2);
      expect(batch2.delivered).toBe(2);

      metrics = worker.getMetrics();
      expect(metrics.totalBatches).toBe(2);
      expect(metrics.totalDelivered).toBe(5);

      // Batch 3 (empty queue)
      const batch3 = await worker.processOnce();
      expect(batch3.processed).toBe(0);

      metrics = worker.getMetrics();
      expect(metrics.consecutiveEmptyBatches).toBe(1);
    });

    it('safely recovers stale PROCESSING jobs (> 5 minutes old)', async () => {
      const outboxRepo = new MemoryNotificationOutboxRepository();

      const record = await outboxRepo.enqueue({
        channel: 'EMAIL',
        eventType: 'ORDER_STATUS_CHANGED',
        recipient: 'stale@example.com',
        payload: { orderNumber: 'ORD-STALE-1', toStatus: 'CONFIRMED' },
        idempotencyKey: 'email:stale:1',
      });

      // Claim it at t=0
      const t0 = new Date();
      const claimed = await outboxRepo.claimBatch(10, t0);
      expect(claimed.length).toBe(1);
      expect(claimed[0].status).toBe('PROCESSING');

      // Attempt to claim at t=2 minutes (NOT stale yet, 5 min timeout not reached)
      const t2m = new Date(t0.getTime() + 2 * 60 * 1000);
      const notReclaimed = await outboxRepo.claimBatch(10, t2m);
      expect(notReclaimed.length).toBe(0);

      // Attempt to claim at t=6 minutes (STALE! 5 min timeout exceeded)
      const t6m = new Date(t0.getTime() + 6 * 60 * 1000);
      const reclaimed = await outboxRepo.claimBatch(10, t6m);
      expect(reclaimed.length).toBe(1);
      expect(reclaimed[0].id).toBe(record!.id);
    });

    it('respects nextRetryAt and does not claim failed jobs before their scheduled retry time', async () => {
      const outboxRepo = new MemoryNotificationOutboxRepository();
      const emailProvider = new MemoryEmailProvider();
      emailProvider.setSimulatedError(
        new Error('Transient connection reset'),
        1,
      );

      const whatsappProvider = new MemoryWhatsAppProvider();

      const service = new NotificationOutboxService(
        outboxRepo,
        emailProvider,
        whatsappProvider,
      );

      await outboxRepo.enqueue({
        channel: 'EMAIL',
        eventType: 'ORDER_STATUS_CHANGED',
        recipient: 'retry@example.com',
        payload: { orderNumber: 'ORD-RETRY-1', toStatus: 'CONFIRMED' },
        idempotencyKey: 'email:retry:1',
      });

      const now = new Date();
      // First attempt fails and schedules nextRetryAt into the future
      const res1 = await service.processPendingNotifications({ now });
      expect(res1.failed).toBe(1);

      // Immediate subsequent claim at the same moment cannot claim it
      const immediateBatch = await outboxRepo.claimBatch(10, now);
      expect(immediateBatch.length).toBe(0);

      // Future claim after nextRetryAt elapses CAN claim it
      const futureTime = new Date(now.getTime() + 60_000);
      const futureBatch = await outboxRepo.claimBatch(10, futureTime);
      expect(futureBatch.length).toBe(1);
    });

    it('shuts down cleanly without starting uncontrolled background loops', async () => {
      const outboxRepo = new MemoryNotificationOutboxRepository();
      const emailProvider = new MemoryEmailProvider();
      const whatsappProvider = new MemoryWhatsAppProvider();

      const service = new NotificationOutboxService(
        outboxRepo,
        emailProvider,
        whatsappProvider,
      );

      const worker = new NotificationWorker({
        notificationService: service,
        batchSize: 10,
        pollIntervalMs: 50,
      });

      // Start worker
      await worker.start();
      expect(worker.getMetrics().isRunning).toBe(true);

      // Stop worker
      await worker.stop();
      expect(worker.getMetrics().isRunning).toBe(false);
    });

    it('prevents concurrent workers from double-processing the same notification', async () => {
      const outboxRepo = new MemoryNotificationOutboxRepository();

      // Enqueue 3 items
      for (let i = 1; i <= 3; i++) {
        await outboxRepo.enqueue({
          channel: 'WHATSAPP',
          eventType: 'ORDER_CREATED_OWNER_ALERT',
          recipient: '+9779801234567',
          payload: { orderNumber: `CONC-${i}` },
          idempotencyKey: `conc:test:${i}`,
        });
      }

      // Worker 1 claims batch of 3
      const worker1Claimed = await outboxRepo.claimBatch(3);
      expect(worker1Claimed.length).toBe(3);

      // Worker 2 attempts concurrent claim immediately
      const worker2Claimed = await outboxRepo.claimBatch(3);
      expect(worker2Claimed.length).toBe(0); // Nothing left to claim
    });
  });
});
