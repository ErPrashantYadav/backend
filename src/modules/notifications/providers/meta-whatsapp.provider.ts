import { AppError } from '../../../errors/app-error';
import { redactSensitiveText } from '../../routing/routing.types';
import type { WhatsAppInput, WhatsAppProvider } from '../notification.types';

export interface MetaWhatsAppOptions {
  apiToken: string;
  phoneNumberId: string;
  apiVersion?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: MetaWhatsAppOptions) {
    if (!options.apiToken?.trim()) {
      throw new AppError(
        500,
        'NOTIFICATION_PROVIDER_UNCONFIGURED',
        'Meta WhatsApp API token is required',
      );
    }
    if (!options.phoneNumberId?.trim()) {
      throw new AppError(
        500,
        'NOTIFICATION_PROVIDER_UNCONFIGURED',
        'Meta WhatsApp phone number ID is required',
      );
    }

    this.baseUrl = (options.baseUrl ?? 'https://graph.facebook.com').replace(
      /\/+$/,
      '',
    );
    this.apiVersion = options.apiVersion ?? 'v21.0';
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Normalizes E.164 or local phone number to Meta's expected digits-only format.
   * e.g. "+977-9801234567" -> "9779801234567"
   */
  private normalizePhoneNumber(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 7 || digits.length > 15) {
      throw new AppError(
        400,
        'INVALID_PHONE_NUMBER',
        `Invalid phone number format for WhatsApp recipient: ${phone}`,
      );
    }
    return digits;
  }

  async sendWhatsApp(input: WhatsAppInput): Promise<{ messageId: string }> {
    const normalizedTo = this.normalizePhoneNumber(input.to);
    const url = `${this.baseUrl}/${this.apiVersion}/${this.options.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedTo,
      type: 'text',
      text: {
        preview_url: false,
        body: input.message,
      },
    };

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'liquor-shop-backend/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network failure';
      const sanitized = redactSensitiveText(message, this.options.apiToken);
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new AppError(
          504,
          'WHATSAPP_TIMEOUT',
          `Meta WhatsApp request timed out after ${this.timeoutMs}ms`,
        );
      }
      throw new AppError(
        502,
        'WHATSAPP_NETWORK_ERROR',
        `Meta WhatsApp network error: ${sanitized}`,
      );
    }

    if (!response.ok) {
      let errorBody = '';
      try {
        const json = (await response.json()) as {
          error?: {
            message?: string;
            type?: string;
            code?: number;
            error_data?: { details?: string };
          };
        };
        errorBody =
          json.error?.message ||
          json.error?.error_data?.details ||
          response.statusText;
      } catch {
        errorBody = response.statusText || `HTTP ${response.status}`;
      }

      const sanitizedError = redactSensitiveText(
        errorBody,
        this.options.apiToken,
      );

      if (response.status === 429) {
        throw new AppError(
          429,
          'WHATSAPP_RATE_LIMIT',
          `Meta WhatsApp API rate limit exceeded (429): ${sanitizedError}`,
        );
      }

      if (response.status === 400) {
        throw new AppError(
          400,
          'WHATSAPP_VALIDATION_ERROR',
          `Meta WhatsApp API validation failure (400): ${sanitizedError}`,
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          502,
          'WHATSAPP_AUTH_ERROR',
          `Meta WhatsApp API authentication error: ${sanitizedError}`,
        );
      }

      throw new AppError(
        502,
        'WHATSAPP_API_ERROR',
        `Meta WhatsApp Cloud API error (${response.status}): ${sanitizedError}`,
      );
    }

    try {
      const data = (await response.json()) as {
        messages?: Array<{ id: string }>;
      };
      const messageId = data?.messages?.[0]?.id;
      if (!messageId) {
        throw new Error('Missing message id in Meta WhatsApp response');
      }
      return { messageId };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid JSON response';
      throw new AppError(
        502,
        'WHATSAPP_INVALID_RESPONSE',
        `Invalid Meta WhatsApp response: ${redactSensitiveText(message)}`,
      );
    }
  }
}
