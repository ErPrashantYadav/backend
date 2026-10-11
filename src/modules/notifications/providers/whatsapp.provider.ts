import { AppError } from '../../../errors/app-error';
import type { WhatsAppInput, WhatsAppProvider } from '../notification.types';

export class UnconfiguredWhatsAppProvider implements WhatsAppProvider {
  constructor(
    private readonly reason = 'WhatsApp Business API provider is not configured',
  ) {}

  async sendWhatsApp(_input: WhatsAppInput): Promise<{ messageId: string }> {
    throw new AppError(500, 'NOTIFICATION_PROVIDER_UNCONFIGURED', this.reason);
  }
}

export class ConsoleWhatsAppProvider implements WhatsAppProvider {
  async sendWhatsApp(_input: WhatsAppInput): Promise<{ messageId: string }> {
    const messageId = `console-wa-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    return { messageId };
  }
}

export { MetaWhatsAppProvider } from './meta-whatsapp.provider';
export { createWhatsAppProvider } from './provider-factory';
