export type NotificationChannel = 'EMAIL' | 'WHATSAPP';

export type NotificationStatus =
  'PENDING' | 'PROCESSING' | 'DELIVERED' | 'FAILED';

export interface NotificationRecord {
  id: string;
  channel: NotificationChannel;
  eventType: string;
  recipient: string;
  subject: string | null;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: Date;
  lastAttemptAt: Date | null;
  processedAt: Date | null;
  errorMessage: string | null;
  idempotencyKey: string;
  orderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnqueueNotificationInput {
  channel: NotificationChannel;
  eventType: string;
  recipient: string;
  subject?: string | null;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  orderId?: string | null;
  maxAttempts?: number;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailInput {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  sendEmail(input: EmailInput): Promise<{ messageId: string }>;
}

export interface WhatsAppInput {
  to: string;
  message: string;
  templateName?: string;
  templateParameters?: Record<string, string>;
}

export interface WhatsAppProvider {
  sendWhatsApp(input: WhatsAppInput): Promise<{ messageId: string }>;
}

export interface NotificationOutboxRepository {
  enqueue(
    input: EnqueueNotificationInput,
    tx?: unknown,
  ): Promise<NotificationRecord | null>;
  claimBatch(batchSize: number, now?: Date): Promise<NotificationRecord[]>;
  markDelivered(id: string, processedAt?: Date): Promise<NotificationRecord>;
  markFailed(
    id: string,
    options: {
      errorMessage: string;
      attemptCount: number;
      nextRetryAt?: Date | null;
      isPermanent: boolean;
    },
  ): Promise<NotificationRecord>;
  findById(id: string): Promise<NotificationRecord | null>;
  findByIdempotencyKey(key: string): Promise<NotificationRecord | null>;
  listByOrderId(orderId: string): Promise<NotificationRecord[]>;
}
