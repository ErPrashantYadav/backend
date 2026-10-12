import { AppError } from '../../../errors/app-error';
import type { EmailInput, EmailProvider } from '../notification.types';

export class UnconfiguredEmailProvider implements EmailProvider {
  constructor(private readonly reason = 'Email provider is not configured') {}

  async sendEmail(_input: EmailInput): Promise<{ messageId: string }> {
    throw new AppError(500, 'NOTIFICATION_PROVIDER_UNCONFIGURED', this.reason);
  }
}

export class ConsoleEmailProvider implements EmailProvider {
  async sendEmail(_input: EmailInput): Promise<{ messageId: string }> {
    const messageId = `console-email-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    // Output safe notification log without leaking full PII or sensitive keys
    return { messageId };
  }
}

export { ResendEmailProvider } from './resend-email.provider';
export { SmtpEmailProvider } from './smtp-email.provider';
