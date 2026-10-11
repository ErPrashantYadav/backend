import { AppError } from '../../../errors/app-error';
import { redactSensitiveText } from '../../routing/routing.types';
import type { EmailInput, EmailProvider } from '../notification.types';

export interface ResendProviderOptions {
  apiKey: string;
  from: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class ResendEmailProvider implements EmailProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: ResendProviderOptions) {
    if (!options.apiKey?.trim()) {
      throw new AppError(
        500,
        'NOTIFICATION_PROVIDER_UNCONFIGURED',
        'Resend API key is required',
      );
    }
    if (!options.from?.trim()) {
      throw new AppError(
        500,
        'NOTIFICATION_PROVIDER_UNCONFIGURED',
        'Email sender (from) address is required',
      );
    }
    this.baseUrl = (options.baseUrl ?? 'https://api.resend.com').replace(
      /\/+$/,
      '',
    );
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async sendEmail(input: EmailInput): Promise<{ messageId: string }> {
    const url = `${this.baseUrl}/emails`;

    const payload = {
      from: this.options.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    };

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'liquor-shop-backend/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network failure';
      const sanitized = redactSensitiveText(message, this.options.apiKey);
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new AppError(
          504,
          'RESEND_TIMEOUT',
          `Resend request timed out after ${this.timeoutMs}ms`,
        );
      }
      throw new AppError(
        502,
        'RESEND_NETWORK_ERROR',
        `Resend network error: ${sanitized}`,
      );
    }

    if (!response.ok) {
      let errorBody = '';
      try {
        const json = (await response.json()) as {
          message?: string;
          name?: string;
        };
        errorBody = json.message || json.name || response.statusText;
      } catch {
        errorBody = response.statusText || `HTTP ${response.status}`;
      }

      const sanitizedError = redactSensitiveText(
        errorBody,
        this.options.apiKey,
      );

      if (response.status === 429) {
        throw new AppError(
          429,
          'RESEND_RATE_LIMIT',
          `Resend rate limit exceeded (429): ${sanitizedError}`,
        );
      }

      if (response.status === 400 || response.status === 422) {
        throw new AppError(
          400,
          'RESEND_VALIDATION_ERROR',
          `Resend rejection (${response.status}): ${sanitizedError}`,
        );
      }

      throw new AppError(
        502,
        'RESEND_API_ERROR',
        `Resend API error (${response.status}): ${sanitizedError}`,
      );
    }

    try {
      const data = (await response.json()) as { id?: string };
      if (!data?.id) {
        throw new Error('Missing message id in Resend response');
      }
      return { messageId: data.id };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid JSON response';
      throw new AppError(
        502,
        'RESEND_INVALID_RESPONSE',
        `Invalid Resend response: ${redactSensitiveText(message)}`,
      );
    }
  }
}
