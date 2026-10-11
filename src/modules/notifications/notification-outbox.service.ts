import type { Logger } from 'pino';
import { AppError } from '../../errors/app-error';
import { redactSensitiveText } from '../routing/routing.types';
import type {
  EmailProvider,
  NotificationOutboxRepository,
  NotificationRecord,
  WhatsAppProvider,
} from './notification.types';

export const ELIGIBLE_EMAIL_STATUSES = [
  'CONFIRMED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const;

export type EligibleEmailStatus = (typeof ELIGIBLE_EMAIL_STATUSES)[number];

export function isEligibleEmailStatus(status: string): boolean {
  return (ELIGIBLE_EMAIL_STATUSES as readonly string[]).includes(status);
}

export interface OrderNotificationSnapshot {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  deliveryAddress: string;
  total: string;
  paymentMethodName?: string | null;
  paymentMethodCode?: string | null;
  items?: Array<{
    productName: string;
    sizeLabel: string;
    quantity: number;
    unitPrice: string;
  }>;
  createdAt?: Date;
}

export class NotificationOutboxService {
  constructor(
    private readonly outboxRepository: NotificationOutboxRepository,
    private readonly emailProvider: EmailProvider,
    private readonly whatsappProvider: WhatsAppProvider,
    private readonly storeOwnerWhatsAppNumber?: string,
    private readonly emailFrom: string = 'Old Liquor <orders@oldliquor.com>',
    private readonly logger?: Logger,
  ) {}

  /**
   * Enqueues an owner WhatsApp alert upon new order creation within the caller's transaction.
   * If storeOwnerWhatsAppNumber is not configured, logs a warning and gracefully skips.
   */
  async enqueueOrderCreatedWhatsApp(
    order: OrderNotificationSnapshot,
    tx?: unknown,
  ): Promise<NotificationRecord | null> {
    const ownerNumber = this.storeOwnerWhatsAppNumber?.trim();
    if (!ownerNumber) {
      this.logger?.debug(
        { orderNumber: order.orderNumber },
        'Skipping WhatsApp owner alert: STORE_OWNER_WHATSAPP_NUMBER is not configured',
      );
      return null;
    }

    const itemCount =
      order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

    const safePayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
      total: order.total,
      itemCount,
      paymentMethod:
        order.paymentMethodName || order.paymentMethodCode || 'Not specified',
      createdAt: order.createdAt
        ? new Date(order.createdAt).toISOString()
        : new Date().toISOString(),
    };

    const idempotencyKey = `whatsapp:order-created:${order.orderNumber}`;

    return this.outboxRepository.enqueue(
      {
        channel: 'WHATSAPP',
        eventType: 'ORDER_CREATED_OWNER_ALERT',
        recipient: ownerNumber,
        subject: null,
        payload: safePayload,
        idempotencyKey,
        orderId: order.id,
        maxAttempts: 5,
      },
      tx,
    );
  }

  /**
   * Enqueues a customer email notification for eligible order fulfillment status transitions.
   * Explicitly skips order creation or non-eligible transitions.
   * Gracefully skips if the customer has no email address.
   */
  async enqueueOrderStatusEmail(
    order: OrderNotificationSnapshot,
    fromStatus: string,
    toStatus: string,
    tx?: unknown,
  ): Promise<NotificationRecord | null> {
    // 1. Check if the target status is in the allowed customer notification list
    if (!isEligibleEmailStatus(toStatus)) {
      this.logger?.debug(
        { orderNumber: order.orderNumber, toStatus },
        'Skipping email notification: target status is not an eligible customer alert transition',
      );
      return null;
    }

    // 2. Gracefully skip if the customer provided no email address
    const recipient = order.customerEmail?.trim();
    if (!recipient) {
      this.logger?.debug(
        { orderNumber: order.orderNumber, toStatus },
        'Skipping customer email notification: customer has no email address',
      );
      return null;
    }

    const safePayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      fromStatus,
      toStatus,
      total: order.total,
      deliveryAddress: order.deliveryAddress,
      itemsSummary: order.items?.map(
        (i) => `${i.productName} (${i.sizeLabel}) x${i.quantity}`,
      ),
    };

    const subject = `Order ${order.orderNumber} Update: ${toStatus.replace(/_/g, ' ')}`;
    const idempotencyKey = `email:order-status:${order.id}:${toStatus}`;

    return this.outboxRepository.enqueue(
      {
        channel: 'EMAIL',
        eventType: 'ORDER_STATUS_CHANGED',
        recipient,
        subject,
        payload: safePayload,
        idempotencyKey,
        orderId: order.id,
        maxAttempts: 5,
      },
      tx,
    );
  }

  /**
   * Computes bounded exponential backoff with jitter for retries.
   */
  private calculateNextRetryTime(attemptCount: number, now: Date): Date {
    // Base exponential backoff: 2^attempt * 1000 ms (1s, 2s, 4s, 8s, 16s...), capped at 1 hour
    const baseDelayMs = Math.min(Math.pow(2, attemptCount) * 1000, 3600_000);
    // Add 0-25% jitter to prevent thundering herd
    const jitterMs = Math.floor(baseDelayMs * 0.25 * Math.random());
    const totalDelayMs = baseDelayMs + jitterMs;

    return new Date(now.getTime() + totalDelayMs);
  }

  /**
   * Delivery Semantics & At-Least-Once Guarantee:
   * - This outbox processor guarantees at-least-once delivery for pending notifications.
   * - If a notification is successfully sent to an external provider (e.g., SMTP, Resend, Meta)
   *   but this worker crashes or the database connection drops before `markDelivered` commits,
   *   the record remains in PROCESSING status.
   * - After the 5-minute stalled processing timeout expires, another worker will safely reclaim
   *   the record and re-attempt transmission.
   * - At-least-once delivery is the proven, honest distributed systems trade-off when interacting
   *   with non-transactional third-party APIs. Exactly-once delivery across external networks cannot
   *   be guaranteed without distributed 2PC, which neither SMTP nor Resend/Meta APIs support.
   */

  /**
   * Determines whether an error is permanent (non-retryable).
   * Permanent errors immediately transition the outbox record to FAILED rather than retrying.
   */
  private isPermanentFailure(error: unknown): boolean {
    if (error instanceof AppError) {
      if (
        error.code === 'INVALID_RECIPIENT' ||
        error.code === 'INVALID_PHONE_NUMBER' ||
        error.code === 'RESEND_VALIDATION_ERROR' ||
        error.code === 'WHATSAPP_VALIDATION_ERROR' ||
        error.code === 'UNSUPPORTED_NOTIFICATION_CHANNEL'
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Asynchronously processes a claimed batch of pending outbox notifications.
   * Invoked explicitly by scheduled workers or integration commands (no uncontrolled background loops).
   */
  async processPendingNotifications(
    options: {
      batchSize?: number;
      now?: Date;
    } = {},
  ): Promise<{
    processed: number;
    delivered: number;
    failed: number;
  }> {
    const batchSize = options.batchSize ?? 10;
    const now = options.now ?? new Date();

    const claimed = await this.outboxRepository.claimBatch(batchSize, now);
    let deliveredCount = 0;
    let failedCount = 0;

    for (const record of claimed) {
      const nextAttempt = record.attemptCount + 1;

      try {
        if (record.channel === 'EMAIL') {
          await this.processEmailRecord(record);
        } else if (record.channel === 'WHATSAPP') {
          await this.processWhatsAppRecord(record);
        } else {
          throw new AppError(
            400,
            'UNSUPPORTED_NOTIFICATION_CHANNEL',
            `Unsupported channel: ${record.channel}`,
          );
        }

        await this.outboxRepository.markDelivered(record.id, new Date());
        deliveredCount++;
      } catch (error) {
        failedCount++;

        const rawMessage =
          error instanceof Error ? error.message : 'Unknown provider error';
        const sanitizedError = redactSensitiveText(rawMessage);

        const isPermanent = this.isPermanentFailure(error);
        const nextRetryAt = isPermanent
          ? null
          : this.calculateNextRetryTime(nextAttempt, new Date());

        await this.outboxRepository.markFailed(record.id, {
          errorMessage: sanitizedError,
          attemptCount: nextAttempt,
          nextRetryAt,
          isPermanent,
        });

        this.logger?.warn(
          {
            notificationId: record.id,
            channel: record.channel,
            attempt: nextAttempt,
            error: sanitizedError,
          },
          'Notification outbox attempt failed',
        );
      }
    }

    return {
      processed: claimed.length,
      delivered: deliveredCount,
      failed: failedCount,
    };
  }

  private async processEmailRecord(record: NotificationRecord): Promise<void> {
    const payload = record.payload;
    const customerName = String(payload.customerName || 'Customer');
    const orderNumber = String(payload.orderNumber || 'Order');
    const toStatus = String(payload.toStatus || 'UPDATED');
    const total = String(payload.total || '0.00');

    const subject =
      record.subject ||
      `Order ${orderNumber} Update: ${toStatus.replace(/_/g, ' ')}`;

    const text = [
      `Dear ${customerName},`,
      ``,
      `Your order ${orderNumber} has been updated to: ${toStatus.replace(/_/g, ' ')}.`,
      `Order Total: NPR ${total}`,
      `Delivery Address: ${payload.deliveryAddress || 'N/A'}`,
      ``,
      `Thank you for shopping with us!`,
    ].join('\n');

    await this.emailProvider.sendEmail({
      to: record.recipient,
      subject,
      text,
    });
  }

  private async processWhatsAppRecord(
    record: NotificationRecord,
  ): Promise<void> {
    const payload = record.payload;
    const orderNumber = String(payload.orderNumber || 'Unknown');
    const customerName = String(payload.customerName || 'Customer');
    const customerPhone = String(payload.customerPhone || 'N/A');
    const total = String(payload.total || '0.00');
    const itemCount = String(payload.itemCount || '1');
    const paymentMethod = String(payload.paymentMethod || 'COD');

    const message = [
      `*🚨 New Liquor Shop Order Placed*`,
      `*Order Number:* ${orderNumber}`,
      `*Customer:* ${customerName}`,
      `*Phone:* ${customerPhone}`,
      `*Items Count:* ${itemCount}`,
      `*Total Amount:* NPR ${total}`,
      `*Payment:* ${paymentMethod}`,
      `*Address:* ${payload.deliveryAddress || 'N/A'}`,
    ].join('\n');

    await this.whatsappProvider.sendWhatsApp({
      to: record.recipient,
      message,
    });
  }
}
