import type { Logger } from 'pino';
import { AppError } from '../../errors/app-error';
import { invoiceGeneratorService } from '../invoices/invoice-generator.service';
import type { InvoiceOrderData } from '../invoices/invoice.types';
import { redactSensitiveText } from '../routing/routing.types';
import type { StoreSettingsRepository } from '../store-settings/store-settings.types';
import type {
  EmailProvider,
  NotificationOutboxRepository,
  NotificationRecord,
  WhatsAppProvider,
} from './notification.types';
import {
  extractStoreInfo,
  renderAdminContactInquiryEmail,
  renderAdminNewOrderEmail,
  renderCustomerContactAckEmail,
  renderCustomerOrderConfirmedEmail,
  renderCustomerOrderStatusEmail,
} from './templates';

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
  subtotal?: string;
  discountTotal?: string;
  deliveryFee?: string;
  promoCode?: string | null;
  promoDiscount?: string;
  paymentMethodName?: string | null;
  paymentMethodCode?: string | null;
  paymentStatus?: string | null;
  items?: Array<{
    productName: string;
    sku?: string;
    sizeLabel: string;
    quantity: number;
    unitPrice: string;
    unitDiscount?: string;
    effectiveUnitPrice?: string;
    subtotal?: string;
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
    private readonly storeOrderNotificationEmail?: string,
    private readonly storeContactNotificationEmail?: string,
    private readonly storeSettingsRepository?: StoreSettingsRepository,
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

    const isConfirmed = toStatus === 'CONFIRMED';
    const eventType = isConfirmed
      ? 'ORDER_CONFIRMED_CUSTOMER_INVOICE'
      : 'ORDER_STATUS_CHANGED';

    const safePayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: recipient,
      fromStatus,
      toStatus,
      subtotal: order.subtotal || order.total,
      discountTotal: order.discountTotal || '0.00',
      deliveryFee: order.deliveryFee || '0.00',
      total: order.total,
      promoCode: order.promoCode || null,
      promoDiscount: order.promoDiscount || '0.00',
      paymentMethod:
        order.paymentMethodName || order.paymentMethodCode || 'Not specified',
      paymentStatus: order.paymentStatus || 'PENDING',
      itemCount:
        order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
      deliveryAddress: order.deliveryAddress,
      items: order.items || [],
      itemsSummary: order.items?.map(
        (i) => `${i.productName} (${i.sizeLabel}) x${i.quantity}`,
      ),
      createdAt: order.createdAt
        ? new Date(order.createdAt).toISOString()
        : new Date().toISOString(),
    };

    const subject = isConfirmed
      ? `Order Confirmation - ${order.orderNumber}`
      : `Order ${order.orderNumber} Update: ${toStatus.replace(/_/g, ' ')}`;
    const idempotencyKey = `email:order-status:${order.id}:${toStatus}`;

    return this.outboxRepository.enqueue(
      {
        channel: 'EMAIL',
        eventType,
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

  /**
   * Enqueues an admin email alert upon new guest order creation within the caller's transaction.
   * If storeOrderNotificationEmail is not configured, logs a debug message and gracefully skips.
   */
  async enqueueOrderCreatedAdminEmail(
    order: OrderNotificationSnapshot,
    tx?: unknown,
  ): Promise<NotificationRecord | null> {
    const adminEmail = this.storeOrderNotificationEmail?.trim();
    if (!adminEmail) {
      this.logger?.debug(
        { orderNumber: order.orderNumber },
        'Skipping admin order email alert: STORE_ORDER_NOTIFICATION_EMAIL is not configured',
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
      customerEmail: order.customerEmail || null,
      deliveryAddress: order.deliveryAddress,
      subtotal: order.subtotal || order.total,
      discountTotal: order.discountTotal || '0.00',
      deliveryFee: order.deliveryFee || '0.00',
      total: order.total,
      promoCode: order.promoCode || null,
      promoDiscount: order.promoDiscount || '0.00',
      paymentMethod:
        order.paymentMethodName || order.paymentMethodCode || 'Not specified',
      paymentStatus: order.paymentStatus || 'PENDING',
      itemCount,
      items: order.items || [],
      createdAt: order.createdAt
        ? new Date(order.createdAt).toISOString()
        : new Date().toISOString(),
    };

    const idempotencyKey = `email:order-created-admin:${order.orderNumber}`;
    const subject = `New Order Received - ${order.orderNumber}`;

    return this.outboxRepository.enqueue(
      {
        channel: 'EMAIL',
        eventType: 'ORDER_CREATED_ADMIN_ALERT',
        recipient: adminEmail,
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
   * Enqueues a customer confirmation email with PDF invoice attachment upon new order creation.
   * If customer provided no email address, gracefully skips.
   */
  async enqueueOrderCreatedCustomerEmail(
    order: OrderNotificationSnapshot,
    tx?: unknown,
  ): Promise<NotificationRecord | null> {
    const recipient = order.customerEmail?.trim();
    if (!recipient) {
      this.logger?.debug(
        { orderNumber: order.orderNumber },
        'Skipping customer confirmation email: customer has no email address',
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
      customerEmail: recipient,
      deliveryAddress: order.deliveryAddress,
      subtotal: order.subtotal || order.total,
      discountTotal: order.discountTotal || '0.00',
      deliveryFee: order.deliveryFee || '0.00',
      total: order.total,
      promoCode: order.promoCode || null,
      promoDiscount: order.promoDiscount || '0.00',
      paymentMethod:
        order.paymentMethodName || order.paymentMethodCode || 'Not specified',
      paymentStatus: order.paymentStatus || 'PENDING',
      itemCount,
      items: order.items || [],
      createdAt: order.createdAt
        ? new Date(order.createdAt).toISOString()
        : new Date().toISOString(),
    };

    const idempotencyKey = `email:order-confirmed-customer:${order.orderNumber}`;
    const subject = `Order Confirmation - ${order.orderNumber}`;

    return this.outboxRepository.enqueue(
      {
        channel: 'EMAIL',
        eventType: 'ORDER_CONFIRMED_CUSTOMER_INVOICE',
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
   * Enqueues an admin email alert when a contact inquiry is submitted.
   * If storeContactNotificationEmail is not configured, gracefully skips.
   */
  async enqueueContactInquiryAdminEmail(
    inquiry: {
      id: string;
      fullName: string;
      email?: string | null;
      phone?: string | null;
      subject: string;
      message: string;
      createdAt?: Date | string;
    },
    tx?: unknown,
  ): Promise<NotificationRecord | null> {
    const adminEmail = this.storeContactNotificationEmail?.trim();
    if (!adminEmail) {
      this.logger?.debug(
        { inquiryId: inquiry.id },
        'Skipping admin contact inquiry email: STORE_CONTACT_NOTIFICATION_EMAIL is not configured',
      );
      return null;
    }

    const safePayload = {
      inquiryId: inquiry.id,
      fullName: inquiry.fullName,
      email: inquiry.email || null,
      phone: inquiry.phone || null,
      subject: inquiry.subject,
      message: inquiry.message,
      createdAt: inquiry.createdAt
        ? new Date(inquiry.createdAt).toISOString()
        : new Date().toISOString(),
    };

    const idempotencyKey = `email:contact-inquiry-admin:${inquiry.id}`;
    const subject = `New Contact Inquiry: ${inquiry.subject}`;

    return this.outboxRepository.enqueue(
      {
        channel: 'EMAIL',
        eventType: 'CONTACT_INQUIRY_ADMIN_ALERT',
        recipient: adminEmail,
        subject,
        payload: safePayload,
        idempotencyKey,
        maxAttempts: 5,
      },
      tx,
    );
  }

  /**
   * Enqueues a customer acknowledgement email when a contact inquiry is submitted.
   * If customer has no email address, gracefully skips.
   */
  async enqueueContactInquiryCustomerAck(
    inquiry: {
      id: string;
      fullName: string;
      email?: string | null;
      phone?: string | null;
      subject: string;
      message: string;
      createdAt?: Date | string;
    },
    tx?: unknown,
  ): Promise<NotificationRecord | null> {
    const recipient = inquiry.email?.trim();
    if (!recipient) {
      return null;
    }

    const safePayload = {
      inquiryId: inquiry.id,
      fullName: inquiry.fullName,
      email: recipient,
      phone: inquiry.phone || null,
      subject: inquiry.subject,
      message: inquiry.message,
      createdAt: inquiry.createdAt
        ? new Date(inquiry.createdAt).toISOString()
        : new Date().toISOString(),
    };

    const idempotencyKey = `email:contact-inquiry-customer:${inquiry.id}`;
    const subject = `Thank you for contacting Old Liquor - Inquiry Received`;

    return this.outboxRepository.enqueue(
      {
        channel: 'EMAIL',
        eventType: 'CONTACT_INQUIRY_CUSTOMER_ACK',
        recipient,
        subject,
        payload: safePayload,
        idempotencyKey,
        maxAttempts: 5,
      },
      tx,
    );
  }

  private async processEmailRecord(record: NotificationRecord): Promise<void> {
    const payload = record.payload as Record<string, unknown>;
    const eventType = record.eventType;

    const storeSettings = this.storeSettingsRepository
      ? await this.storeSettingsRepository.get()
      : null;
    const storeInfo = extractStoreInfo(storeSettings);

    if (eventType === 'ORDER_CREATED_ADMIN_ALERT') {
      const orderNumber = String(payload.orderNumber || 'Order');
      const customerName = String(payload.customerName || 'Customer');
      const customerPhone = String(payload.customerPhone || 'N/A');
      const customerEmail = payload.customerEmail
        ? String(payload.customerEmail)
        : null;
      const deliveryAddress = String(payload.deliveryAddress || 'N/A');
      const total = String(payload.total || '0.00');
      const subtotal = String(payload.subtotal || total);
      const deliveryFee = String(payload.deliveryFee || '0.00');
      const discountTotal = String(payload.discountTotal || '0.00');
      const promoCode = payload.promoCode ? String(payload.promoCode) : null;
      const promoDiscount = payload.promoDiscount
        ? String(payload.promoDiscount)
        : null;
      const paymentMethod = String(payload.paymentMethod || 'Not specified');
      const paymentStatus = String(payload.paymentStatus || 'PENDING');
      const items = Array.isArray(payload.items)
        ? (payload.items as Array<Record<string, unknown>>)
        : [];
      const itemCount = Number(payload.itemCount || items.length || 0);

      const rendered = renderAdminNewOrderEmail(
        {
          orderNumber,
          customerName,
          customerPhone,
          customerEmail,
          deliveryAddress,
          subtotal,
          deliveryFee,
          discountTotal,
          promoCode,
          promoDiscount,
          total,
          paymentMethod,
          paymentStatus,
          itemCount,
          items: items.map((i) => ({
            productName: String(i.productName || 'Item'),
            sku: i.sku ? String(i.sku) : undefined,
            sizeLabel: String(i.sizeLabel || 'Standard'),
            quantity: Number(i.quantity || 1),
            unitPrice: String(i.unitPrice || '0.00'),
            unitDiscount: i.unitDiscount ? String(i.unitDiscount) : undefined,
            effectiveUnitPrice: i.effectiveUnitPrice
              ? String(i.effectiveUnitPrice)
              : undefined,
            subtotal: i.subtotal ? String(i.subtotal) : undefined,
          })),
        },
        storeInfo,
      );

      await this.emailProvider.sendEmail({
        to: record.recipient,
        from: this.emailFrom,
        subject: record.subject || rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      return;
    }

    if (eventType === 'ORDER_CONFIRMED_CUSTOMER_INVOICE') {
      const orderNumber = String(payload.orderNumber || 'Order');
      const customerName = String(payload.customerName || 'Valued Customer');
      const deliveryAddress = String(payload.deliveryAddress || 'N/A');
      const total = String(payload.total || '0.00');
      const subtotal = String(payload.subtotal || total);
      const deliveryFee = String(payload.deliveryFee || '0.00');
      const discountTotal = String(payload.discountTotal || '0.00');
      const promoCode = payload.promoCode ? String(payload.promoCode) : null;
      const promoDiscount = payload.promoDiscount
        ? String(payload.promoDiscount)
        : null;
      const paymentMethod = String(payload.paymentMethod || 'Cash on Delivery');
      const items = Array.isArray(payload.items)
        ? (payload.items as Array<Record<string, unknown>>)
        : [];

      const rendered = renderCustomerOrderConfirmedEmail(
        {
          orderNumber,
          customerName,
          deliveryAddress,
          paymentMethod,
          subtotal,
          deliveryFee,
          discountTotal,
          promoCode,
          promoDiscount,
          total,
          items: items.map((i) => ({
            productName: String(i.productName || 'Item'),
            sku: i.sku ? String(i.sku) : undefined,
            sizeLabel: String(i.sizeLabel || 'Standard'),
            quantity: Number(i.quantity || 1),
            unitPrice: String(i.unitPrice || '0.00'),
            subtotal: i.subtotal ? String(i.subtotal) : undefined,
          })),
        },
        storeInfo,
      );

      // Build InvoiceOrderData snapshot for deterministic PDF generation
      const invoiceData: InvoiceOrderData = {
        orderNumber,
        createdAt: payload.createdAt
          ? new Date(payload.createdAt as string)
          : new Date(),
        customer: {
          name: customerName,
          phone: String(payload.customerPhone || 'N/A'),
          email: record.recipient,
          deliveryAddress,
        },
        items: items.map((i) => ({
          productName: String(i.productName || 'Item'),
          sku: String(i.sku || 'N/A'),
          sizeLabel: String(i.sizeLabel || 'Standard'),
          quantity: Number(i.quantity || 1),
          unitPrice: String(i.unitPrice || '0.00'),
          unitDiscount: i.unitDiscount ? String(i.unitDiscount) : undefined,
          effectiveUnitPrice: i.effectiveUnitPrice
            ? String(i.effectiveUnitPrice)
            : String(i.unitPrice || '0.00'),
          subtotal: String(
            i.subtotal ?? (Number(i.unitPrice) * Number(i.quantity)).toFixed(2),
          ),
        })),
        pricing: {
          subtotal,
          discountTotal,
          deliveryFee,
          promoDiscount: promoDiscount || undefined,
          total,
        },
        promoCode,
        payment: {
          methodName: paymentMethod,
          status: String(payload.paymentStatus || 'PENDING'),
        },
        status: 'CONFIRMED',
      };

      const pdfBuffer = await invoiceGeneratorService.generateInvoicePdf(
        invoiceData,
        storeSettings
          ? {
              storeName: storeSettings.storeName,
              storeTagline: storeSettings.storeTagline,
              primaryPhone: storeSettings.primaryPhone,
              supportEmail: storeSettings.supportEmail,
              address: storeSettings.address,
              city: storeSettings.city,
            }
          : undefined,
      );

      await this.emailProvider.sendEmail({
        to: record.recipient,
        from: this.emailFrom,
        subject: record.subject || rendered.subject,
        text: rendered.text,
        html: rendered.html,
        attachments: [
          {
            filename: `invoice-${orderNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
      return;
    }

    if (eventType === 'CONTACT_INQUIRY_ADMIN_ALERT') {
      const fullName = String(payload.fullName || 'Sender');
      const email = payload.email ? String(payload.email) : null;
      const phone = payload.phone ? String(payload.phone) : null;
      const inquirySubject = String(payload.subject || 'No Subject');
      const message = String(payload.message || '');
      const inquiryId = String(payload.inquiryId || record.id);

      const rendered = renderAdminContactInquiryEmail(
        {
          inquiryId,
          fullName,
          email,
          phone,
          subject: inquirySubject,
          message,
        },
        storeInfo,
      );

      await this.emailProvider.sendEmail({
        to: record.recipient,
        from: this.emailFrom,
        subject: record.subject || rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      return;
    }

    if (eventType === 'CONTACT_INQUIRY_CUSTOMER_ACK') {
      const fullName = String(payload.fullName || 'Valued Customer');
      const inquirySubject = String(payload.subject || 'Inquiry');
      const message = String(payload.message || '');
      const inquiryId = payload.inquiryId
        ? String(payload.inquiryId)
        : record.id;

      const rendered = renderCustomerContactAckEmail(
        {
          inquiryId,
          fullName,
          subject: inquirySubject,
          message,
        },
        storeInfo,
      );

      await this.emailProvider.sendEmail({
        to: record.recipient,
        from: this.emailFrom,
        subject: record.subject || rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      return;
    }

    // Default / ORDER_STATUS_CHANGED handling
    const customerName = String(payload.customerName || 'Customer');
    const orderNumber = String(payload.orderNumber || 'Order');
    const fromStatus = payload.fromStatus
      ? String(payload.fromStatus)
      : undefined;
    const toStatus = String(payload.toStatus || 'UPDATED');
    const total = String(payload.total || '0.00');
    const deliveryAddress = String(payload.deliveryAddress || 'N/A');

    const rendered = renderCustomerOrderStatusEmail(
      {
        orderNumber,
        customerName,
        fromStatus,
        toStatus,
        total,
        deliveryAddress,
      },
      storeInfo,
    );

    await this.emailProvider.sendEmail({
      to: record.recipient,
      from: this.emailFrom,
      subject: record.subject || rendered.subject,
      text: rendered.text,
      html: rendered.html,
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
