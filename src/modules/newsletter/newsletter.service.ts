import type { Logger } from 'pino';
import { AppError } from '../../errors/app-error';
import type { AuditService } from '../audit/audit.service';
import type {
  NewsletterRepository,
  NewsletterSubscriberRecord,
  NewsletterQueryOptions,
} from './newsletter.types';

export function normalizeNewsletterEmail(email: string): string {
  return email.trim().toLowerCase();
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const maskedLocal =
    local.length > 2
      ? `${local[0]}***${local[local.length - 1]}`
      : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

export class NewsletterService {
  constructor(
    private readonly newsletterRepository: NewsletterRepository,
    private readonly auditService?: AuditService,
    private readonly logger?: Logger,
  ) {}

  async subscribe(rawEmail: string): Promise<NewsletterSubscriberRecord> {
    const email = normalizeNewsletterEmail(rawEmail);

    const existing = await this.newsletterRepository.findByEmail(email);
    if (existing) {
      if (!existing.isActive) {
        const reactivated = await this.newsletterRepository.reactivate(email);
        this.logger?.info(
          { subscriberId: reactivated.id, email: maskEmail(email) },
          'Newsletter subscriber reactivated',
        );
        return reactivated;
      }
      throw new AppError(400, 'ALREADY_EXISTS', 'Email is already subscribed');
    }

    try {
      const created = await this.newsletterRepository.create(email);
      this.logger?.info(
        { subscriberId: created.id, email: maskEmail(email) },
        'Newsletter subscriber registered',
      );
      return created;
    } catch (error) {
      const isUniqueConstraint =
        (error as { code?: string })?.code === 'P2002' ||
        (error instanceof Error && error.message.includes('Unique constraint'));

      if (isUniqueConstraint) {
        const concurrentRecord =
          await this.newsletterRepository.findByEmail(email);
        if (concurrentRecord) {
          if (!concurrentRecord.isActive) {
            return this.newsletterRepository.reactivate(email);
          }
          throw new AppError(
            400,
            'ALREADY_EXISTS',
            'Email is already subscribed',
          );
        }
      }
      throw error;
    }
  }

  async unsubscribe(rawEmail: string): Promise<NewsletterSubscriberRecord> {
    const email = normalizeNewsletterEmail(rawEmail);

    const subscriber = await this.newsletterRepository.findByEmail(email);
    if (!subscriber) {
      throw new AppError(400, 'NOT_FOUND', 'Email not found');
    }

    if (!subscriber.isActive) {
      throw new AppError(400, 'BAD_REQUEST', 'Email is already unsubscribed');
    }

    const unsubscribed = await this.newsletterRepository.unsubscribe(email);
    this.logger?.info(
      { subscriberId: unsubscribed.id, email: maskEmail(email) },
      'Newsletter subscriber unsubscribed',
    );
    return unsubscribed;
  }

  async getAll(
    options?: NewsletterQueryOptions,
  ): Promise<NewsletterSubscriberRecord[]> {
    return this.newsletterRepository.list(options);
  }

  async getActive(
    options?: Omit<NewsletterQueryOptions, 'isActive'>,
  ): Promise<NewsletterSubscriberRecord[]> {
    return this.newsletterRepository.list({ ...options, isActive: true });
  }

  async remove(id: string, actorAdminId?: string): Promise<{ id: string }> {
    const subscriber = await this.newsletterRepository.findById(id);
    if (!subscriber) {
      throw new AppError(404, 'NOT_FOUND', 'Subscriber not found');
    }

    const deleted = await this.newsletterRepository.delete(id);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'Subscriber not found');
    }

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'NEWSLETTER_SUBSCRIBER_DELETED',
        resourceType: 'NewsletterSubscriber',
        resourceId: id,
        actorAdminId,
        metadata: {
          subscriberId: id,
        },
      });
    }

    this.logger?.info(
      { subscriberId: id, actorAdminId },
      'Newsletter subscriber deleted by administrator',
    );

    return { id };
  }
}
