import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  NewsletterRepository,
  NewsletterSubscriberRecord,
  NewsletterQueryOptions,
} from './newsletter.types';

export class PrismaNewsletterRepository implements NewsletterRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findByEmail(email: string): Promise<NewsletterSubscriberRecord | null> {
    return this.client.newsletterSubscriber.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<NewsletterSubscriberRecord | null> {
    return this.client.newsletterSubscriber.findUnique({
      where: { id },
    });
  }

  async create(email: string): Promise<NewsletterSubscriberRecord> {
    return this.client.newsletterSubscriber.create({
      data: { email },
    });
  }

  async reactivate(email: string): Promise<NewsletterSubscriberRecord> {
    return this.client.newsletterSubscriber.update({
      where: { email },
      data: {
        isActive: true,
        unsubscribedAt: null,
      },
    });
  }

  async unsubscribe(email: string): Promise<NewsletterSubscriberRecord> {
    return this.client.newsletterSubscriber.update({
      where: { email },
      data: {
        isActive: false,
        unsubscribedAt: new Date(),
      },
    });
  }

  async list(
    options?: NewsletterQueryOptions,
  ): Promise<NewsletterSubscriberRecord[]> {
    const where: Prisma.NewsletterSubscriberWhereInput = {};

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    if (options?.search) {
      where.email = { contains: options.search, mode: 'insensitive' };
    }

    return this.client.newsletterSubscriber.findMany({
      where,
      orderBy: { subscribedAt: 'desc' },
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.client.newsletterSubscriber.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return false;
      }
      throw error;
    }
  }
}
