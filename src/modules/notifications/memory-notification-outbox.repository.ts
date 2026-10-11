import crypto from 'node:crypto';
import type {
  EnqueueNotificationInput,
  NotificationOutboxRepository,
  NotificationRecord,
} from './notification.types';

export class MemoryNotificationOutboxRepository implements NotificationOutboxRepository {
  public records: NotificationRecord[] = [];

  constructor(initialRecords: NotificationRecord[] = []) {
    this.records = [...initialRecords];
  }

  async enqueue(
    input: EnqueueNotificationInput,
    _tx?: unknown,
  ): Promise<NotificationRecord | null> {
    const existing = this.records.find(
      (r) => r.idempotencyKey === input.idempotencyKey,
    );
    if (existing) {
      return { ...existing };
    }

    const record: NotificationRecord = {
      id: crypto.randomUUID(),
      channel: input.channel,
      eventType: input.eventType,
      recipient: input.recipient,
      subject: input.subject ?? null,
      payload: input.payload,
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: input.maxAttempts ?? 5,
      nextRetryAt: new Date(),
      lastAttemptAt: null,
      processedAt: null,
      errorMessage: null,
      idempotencyKey: input.idempotencyKey,
      orderId: input.orderId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.records.push(record);
    return { ...record };
  }

  async claimBatch(
    batchSize: number,
    now: Date = new Date(),
  ): Promise<NotificationRecord[]> {
    const stalledCutoff = new Date(now.getTime() - 5 * 60 * 1000);

    const eligible = this.records.filter((r) => {
      if (r.status === 'PENDING' && r.nextRetryAt.getTime() <= now.getTime()) {
        return true;
      }
      if (
        r.status === 'PROCESSING' &&
        r.lastAttemptAt &&
        r.lastAttemptAt.getTime() <= stalledCutoff.getTime()
      ) {
        return true;
      }
      return false;
    });

    // Sort by nextRetryAt asc, then createdAt asc
    eligible.sort(
      (a, b) =>
        a.nextRetryAt.getTime() - b.nextRetryAt.getTime() ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );

    const claimed = eligible.slice(0, batchSize);

    for (const record of claimed) {
      record.status = 'PROCESSING';
      record.lastAttemptAt = now;
      record.updatedAt = now;
    }

    return claimed.map((r) => ({ ...r }));
  }

  async markDelivered(
    id: string,
    processedAt: Date = new Date(),
  ): Promise<NotificationRecord> {
    const record = this.records.find((r) => r.id === id);
    if (!record) {
      throw new Error(`Notification record ${id} not found`);
    }

    record.status = 'DELIVERED';
    record.processedAt = processedAt;
    record.errorMessage = null;
    record.updatedAt = new Date();

    return { ...record };
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
    const record = this.records.find((r) => r.id === id);
    if (!record) {
      throw new Error(`Notification record ${id} not found`);
    }

    const isExhausted =
      options.isPermanent || options.attemptCount >= record.maxAttempts;

    record.status = isExhausted ? 'FAILED' : 'PENDING';
    record.attemptCount = options.attemptCount;
    if (!isExhausted && options.nextRetryAt) {
      record.nextRetryAt = options.nextRetryAt;
    }
    record.errorMessage = options.errorMessage;
    record.lastAttemptAt = new Date();
    record.updatedAt = new Date();

    return { ...record };
  }

  async findById(id: string): Promise<NotificationRecord | null> {
    const found = this.records.find((r) => r.id === id);
    return found ? { ...found } : null;
  }

  async findByIdempotencyKey(key: string): Promise<NotificationRecord | null> {
    const found = this.records.find((r) => r.idempotencyKey === key);
    return found ? { ...found } : null;
  }

  async listByOrderId(orderId: string): Promise<NotificationRecord[]> {
    return this.records
      .filter((r) => r.orderId === orderId)
      .map((r) => ({ ...r }));
  }

  clear(): void {
    this.records = [];
  }
}
