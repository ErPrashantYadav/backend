import { randomUUID } from 'node:crypto';
import type {
  NewsletterRepository,
  NewsletterSubscriberRecord,
  NewsletterQueryOptions,
} from './newsletter.types';

export class MemoryNewsletterRepository implements NewsletterRepository {
  private readonly subscribers = new Map<string, NewsletterSubscriberRecord>();

  constructor(initialData: NewsletterSubscriberRecord[] = []) {
    for (const item of initialData) {
      this.subscribers.set(item.id, { ...item });
    }
  }

  async findByEmail(email: string): Promise<NewsletterSubscriberRecord | null> {
    const normalized = email.trim().toLowerCase();
    for (const sub of this.subscribers.values()) {
      if (sub.email === normalized) {
        return { ...sub };
      }
    }
    return null;
  }

  async findById(id: string): Promise<NewsletterSubscriberRecord | null> {
    const sub = this.subscribers.get(id);
    return sub ? { ...sub } : null;
  }

  async create(email: string): Promise<NewsletterSubscriberRecord> {
    const normalized = email.trim().toLowerCase();
    for (const sub of this.subscribers.values()) {
      if (sub.email === normalized) {
        const error = new Error(
          'Unique constraint failed on the fields: (`email`)',
        );
        (error as unknown as { code: string }).code = 'P2002';
        throw error;
      }
    }

    const now = new Date();
    const record: NewsletterSubscriberRecord = {
      id: randomUUID(),
      email: normalized,
      isActive: true,
      subscribedAt: now,
      unsubscribedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.subscribers.set(record.id, record);
    return { ...record };
  }

  async reactivate(email: string): Promise<NewsletterSubscriberRecord> {
    const normalized = email.trim().toLowerCase();
    for (const sub of this.subscribers.values()) {
      if (sub.email === normalized) {
        const updated: NewsletterSubscriberRecord = {
          ...sub,
          isActive: true,
          unsubscribedAt: null,
          updatedAt: new Date(),
        };
        this.subscribers.set(sub.id, updated);
        return { ...updated };
      }
    }
    throw new Error('Subscriber not found');
  }

  async unsubscribe(email: string): Promise<NewsletterSubscriberRecord> {
    const normalized = email.trim().toLowerCase();
    for (const sub of this.subscribers.values()) {
      if (sub.email === normalized) {
        const updated: NewsletterSubscriberRecord = {
          ...sub,
          isActive: false,
          unsubscribedAt: new Date(),
          updatedAt: new Date(),
        };
        this.subscribers.set(sub.id, updated);
        return { ...updated };
      }
    }
    throw new Error('Subscriber not found');
  }

  async list(
    options?: NewsletterQueryOptions,
  ): Promise<NewsletterSubscriberRecord[]> {
    let items = Array.from(this.subscribers.values());

    if (options?.isActive !== undefined) {
      items = items.filter((s) => s.isActive === options.isActive);
    }

    if (options?.search) {
      const term = options.search.trim().toLowerCase();
      items = items.filter((s) => s.email.toLowerCase().includes(term));
    }

    return items
      .sort((a, b) => b.subscribedAt.getTime() - a.subscribedAt.getTime())
      .map((item) => ({ ...item }));
  }

  async delete(id: string): Promise<boolean> {
    return this.subscribers.delete(id);
  }
}
