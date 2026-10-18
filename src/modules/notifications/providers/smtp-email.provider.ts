import nodemailer, {
  type TransportOptions,
  type Transporter,
} from 'nodemailer';
import { AppError } from '../../../errors/app-error';
import { redactSensitiveText } from '../../routing/routing.types';
import type { EmailInput, EmailProvider } from '../notification.types';

export interface SmtpProviderOptions {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
  secure?: boolean;
  timeoutMs?: number;
  transporter?: Transporter;
}

export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly password?: string;

  constructor(options: SmtpProviderOptions) {
    if (!options.host?.trim()) {
      throw new AppError(
        500,
        'NOTIFICATION_PROVIDER_UNCONFIGURED',
        'SMTP_HOST is required for SMTP email provider',
      );
    }
    if (!options.port || options.port < 1 || options.port > 65535) {
      throw new AppError(
        500,
        'NOTIFICATION_PROVIDER_UNCONFIGURED',
        'Valid SMTP_PORT is required for SMTP email provider',
      );
    }
    if (!options.from?.trim()) {
      throw new AppError(
        500,
        'NOTIFICATION_PROVIDER_UNCONFIGURED',
        'Email sender (from) address is required',
      );
    }

    this.from = options.from;
    this.password = options.pass;
    const timeoutMs = options.timeoutMs ?? 10_000;

    if (options.transporter) {
      this.transporter = options.transporter;
    } else {
      const isDirectTls = options.secure ?? options.port === 465;

      const transportConfig: TransportOptions = {
        host: options.host,
        port: options.port,
        secure: isDirectTls,
        requireTLS: !isDirectTls, // Strictly enforces STARTTLS on non-465 ports
        tls: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true,
        },
        connectionTimeout: timeoutMs,
        greetingTimeout: timeoutMs,
        socketTimeout: timeoutMs,
        ...(options.user && options.pass
          ? {
              auth: {
                user: options.user,
                pass: options.pass,
              },
            }
          : {}),
      } as TransportOptions;

      this.transporter = nodemailer.createTransport(transportConfig);
    }
  }

  async sendEmail(input: EmailInput): Promise<{ messageId: string }> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
        ...(input.attachments && input.attachments.length > 0
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                contentType: a.contentType,
              })),
            }
          : {}),
      });

      const messageId =
        info.messageId ||
        `smtp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      return { messageId };
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error ? err.message : 'Unknown SMTP transmission error';
      const sanitized = redactSensitiveText(rawMessage, this.password);

      throw new AppError(
        502,
        'SMTP_SEND_FAILED',
        `SMTP email delivery failed: ${sanitized}`,
      );
    }
  }
}
