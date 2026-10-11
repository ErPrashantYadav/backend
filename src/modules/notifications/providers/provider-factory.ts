import type { AppConfig } from '../../../config/env';
import type { EmailProvider, WhatsAppProvider } from '../notification.types';
import {
  ConsoleEmailProvider,
  UnconfiguredEmailProvider,
} from './email.provider';
import { MemoryEmailProvider } from './memory-email.provider';
import { MemoryWhatsAppProvider } from './memory-whatsapp.provider';
import { MetaWhatsAppProvider } from './meta-whatsapp.provider';
import { ResendEmailProvider } from './resend-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';
import {
  ConsoleWhatsAppProvider,
  UnconfiguredWhatsAppProvider,
} from './whatsapp.provider';

export function createEmailProvider(
  config: AppConfig,
  isMemoryMode = false,
): EmailProvider {
  if (isMemoryMode || config.EMAIL_PROVIDER === 'TEST') {
    return new MemoryEmailProvider();
  }

  if (config.EMAIL_PROVIDER === 'CONSOLE') {
    return new ConsoleEmailProvider();
  }

  if (config.EMAIL_PROVIDER === 'RESEND') {
    if (!config.RESEND_API_KEY?.trim()) {
      return new UnconfiguredEmailProvider(
        'RESEND_API_KEY is required when EMAIL_PROVIDER=RESEND',
      );
    }
    return new ResendEmailProvider({
      apiKey: config.RESEND_API_KEY,
      from: config.EMAIL_FROM,
    });
  }

  if (config.EMAIL_PROVIDER === 'SMTP') {
    if (!config.SMTP_HOST?.trim() || !config.SMTP_PORT) {
      return new UnconfiguredEmailProvider(
        'SMTP_HOST and SMTP_PORT are required when EMAIL_PROVIDER=SMTP',
      );
    }
    return new SmtpEmailProvider({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      user: config.SMTP_USER,
      pass: config.SMTP_PASSWORD,
      from: config.EMAIL_FROM,
    });
  }

  return new UnconfiguredEmailProvider('Email provider is not configured');
}

export function createWhatsAppProvider(
  config: AppConfig,
  isMemoryMode = false,
): WhatsAppProvider {
  if (isMemoryMode) {
    return new MemoryWhatsAppProvider();
  }

  if (
    config.WHATSAPP_API_TOKEN?.trim() &&
    config.WHATSAPP_PHONE_NUMBER_ID?.trim()
  ) {
    return new MetaWhatsAppProvider({
      apiToken: config.WHATSAPP_API_TOKEN,
      phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID,
    });
  }

  if (config.NODE_ENV === 'development') {
    return new ConsoleWhatsAppProvider();
  }

  return new UnconfiguredWhatsAppProvider(
    'WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required for WhatsApp Business notifications',
  );
}
