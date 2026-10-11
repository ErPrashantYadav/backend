import type { NotificationOutbox, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  EnqueueNotificationInput,
  NotificationOutboxRepository,
  NotificationRecord,
} from './notification.types';

function mapRow(row: NotificationOutbox): NotificationRecord {
  return {
    id: row.id,
    channel: row.channel,
    eventType: row.eventType,
    recipient: row.recipient,
    subject: row.subject,
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: row.status,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    nextRetryAt: row.nextRetryAt,
    lastAttemptAt: row.lastAttemptAt,
    processedAt: row.processedAt,
    errorMessage: row.errorMessage,
    idempotencyKey: row.idempotencyKey,
    orderId: row.orderId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaNotificationOutboxRepository implements NotificationOutboxRepository {
  async enqueue(
    input: EnqueueNotificationInput,
    tx?: unknown,
  ): Promise<NotificationRecord | null> {
    const client = (tx as Prisma.TransactionClient) ?? prisma;

    // Check existing by idempotency key to prevent duplicate enqueueing
    const existing = await client.notificationOutbox.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    if (existing) {
      return mapRow(existing);
    }

    const created = await client.notificationOutbox.create({
      data: {
        channel: input.channel,
        eventType: input.eventType,
        recipient: input.recipient,
        subject: input.subject ?? null,
        payload: input.payload as Prisma.InputJsonValue,
        status: 'PENDING',
        attemptCount: 0,
        maxAttempts: input.maxAttempts ?? 5,
        nextRetryAt: new Date(),
        idempotencyKey: input.idempotencyKey,
        orderId: input.orderId ?? null,
      },
    });

    return mapRow(created);
  }

  async claimBatch(
    batchSize: number,
    now: Date = new Date(),
  ): Promise<NotificationRecord[]> {
    // Stalled processing timeout: 5 minutes
    const stalledCutoff = new Date(now.getTime() - 5 * 60 * 1000);

    return prisma.$transaction(async (tx) => {
      const candidates = await tx.notificationOutbox.findMany({
        where: {
          OR: [
            {
              status: 'PENDING',
              nextRetryAt: { lte: now },
            },
            {
              status: 'PROCESSING',
              lastAttemptAt: { lte: stalledCutoff },
            },
          ],
        },
        orderBy: [{ nextRetryAt: 'asc' }, { createdAt: 'asc' }],
        take: batchSize,
      });

      if (candidates.length === 0) {
        return [];
      }

      const candidateIds = candidates.map((c) => c.id);

      await tx.notificationOutbox.updateMany({
        where: {
          id: { in: candidateIds },
          OR: [
            {
              status: 'PENDING',
              nextRetryAt: { lte: now },
            },
            {
              status: 'PROCESSING',
              lastAttemptAt: { lte: stalledCutoff },
            },
          ],
        },
        data: {
          status: 'PROCESSING',
          lastAttemptAt: now,
        },
      });

      const claimed = await tx.notificationOutbox.findMany({
        where: {
          id: { in: candidateIds },
          status: 'PROCESSING',
          lastAttemptAt: now,
        },
        orderBy: { createdAt: 'asc' },
      });

      return claimed.map(mapRow);
    });
  }

  async markDelivered(
    id: string,
    processedAt: Date = new Date(),
  ): Promise<NotificationRecord> {
    const updated = await prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        processedAt,
        errorMessage: null,
      },
    });

    return mapRow(updated);
  }

  async markFailed(
    id: string,
    options: {
      errorMessage: string;
      attemptCount: number;
      nextRetryAt?: Date | null;
      isPermanent: boolean;
    },
  ): Promise<NotificationRecord> {
    const existing = await prisma.notificationOutbox.findUniqueOrThrow({
      where: { id },
    });

    const isExhausted =
      options.isPermanent || options.attemptCount >= existing.maxAttempts;

    const updated = await prisma.notificationOutbox.update({
      where: { id },
      data: {
        status: isExhausted ? 'FAILED' : 'PENDING',
        attemptCount: options.attemptCount,
        nextRetryAt: isExhausted
          ? existing.nextRetryAt
          : (options.nextRetryAt ?? new Date()),
        errorMessage: options.errorMessage,
        lastAttemptAt: new Date(),
      },
    });

    return mapRow(updated);
  }

  async findById(id: string): Promise<NotificationRecord | null> {
    const row = await prisma.notificationOutbox.findUnique({
      where: { id },
    });
    return row ? mapRow(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<NotificationRecord | null> {
    const row = await prisma.notificationOutbox.findUnique({
      where: { idempotencyKey: key },
    });
    return row ? mapRow(row) : null;
  }

  async listByOrderId(orderId: string): Promise<NotificationRecord[]> {
    const rows = await prisma.notificationOutbox.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapRow);
  }
}
