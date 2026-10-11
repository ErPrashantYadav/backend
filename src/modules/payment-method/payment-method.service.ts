import { AppError } from '../../errors/app-error';
import type {
  CreatePaymentMethodInput,
  ManagedPaymentMethod,
  PaymentMethodRepository,
  PublicPaymentMethod,
  UpdatePaymentMethodInput,
} from './payment-method.types';

function validateAmounts(
  minAmount?: string | null,
  maxAmount?: string | null,
): void {
  let min: number | undefined;
  let max: number | undefined;

  if (minAmount !== undefined && minAmount !== null) {
    min = Number(minAmount);
    if (isNaN(min) || min < 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'minAmount must be a non-negative number',
      );
    }
  }

  if (maxAmount !== undefined && maxAmount !== null) {
    max = Number(maxAmount);
    if (isNaN(max) || max < 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'maxAmount must be a non-negative number',
      );
    }
  }

  if (min !== undefined && max !== undefined && max < min) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'maxAmount cannot be less than minAmount',
    );
  }
}

function validateQrImageUrl(url?: string | null): void {
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error();
      }
    } catch {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'qrImageUrl must be a valid HTTP or HTTPS URL',
      );
    }
  }
}

export class PaymentMethodService {
  constructor(private readonly repository: PaymentMethodRepository) {}

  toPublic(item: ManagedPaymentMethod): PublicPaymentMethod {
    return {
      id: item.id,
      code: item.code,
      type: item.type,
      name: item.name,
      description: item.description,
      providerLabel: item.providerLabel,
      accountName: item.accountName,
      qrImageUrl: item.qrImageUrl,
      instructions: item.instructions,
      minAmount: item.minAmount,
      maxAmount: item.maxAmount,
      displayOrder: item.displayOrder,
    };
  }

  async listAdmin(filter?: {
    isActive?: boolean;
  }): Promise<ManagedPaymentMethod[]> {
    return this.repository.list(filter);
  }

  async getAdmin(id: string): Promise<ManagedPaymentMethod> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new AppError(404, 'NOT_FOUND', 'Payment method not found');
    }
    return item;
  }

  async create(input: CreatePaymentMethodInput): Promise<ManagedPaymentMethod> {
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9_]{2,50}$/.test(code)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'code must be 2-50 uppercase alphanumeric characters or underscores',
      );
    }

    if (!input.name || !input.name.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'name is required');
    }

    if (input.type !== 'COD' && input.type !== 'STATIC_QR') {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        "type must be either 'COD' or 'STATIC_QR'",
      );
    }

    validateAmounts(input.minAmount, input.maxAmount);
    validateQrImageUrl(input.qrImageUrl);

    const existing = await this.repository.findByCode(code);
    if (existing) {
      throw new AppError(
        409,
        'DUPLICATE_CODE',
        `Payment method with code '${code}' already exists`,
      );
    }

    return this.repository.create({
      ...input,
      code,
      name: input.name.trim(),
    });
  }

  async update(
    id: string,
    input: UpdatePaymentMethodInput,
  ): Promise<ManagedPaymentMethod> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Payment method not found');
    }

    if (input.name !== undefined && !input.name.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'name cannot be empty');
    }

    const minAmount =
      input.minAmount !== undefined ? input.minAmount : existing.minAmount;
    const maxAmount =
      input.maxAmount !== undefined ? input.maxAmount : existing.maxAmount;
    validateAmounts(minAmount, maxAmount);

    if (input.qrImageUrl !== undefined) {
      validateQrImageUrl(input.qrImageUrl);
    }

    return this.repository.update(id, input);
  }

  async setStatus(
    id: string,
    isActive: boolean,
  ): Promise<ManagedPaymentMethod> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Payment method not found');
    }
    return this.repository.setStatus(id, isActive);
  }

  async listPublic(): Promise<PublicPaymentMethod[]> {
    const active = await this.repository.list({ isActive: true });
    return active.map((item) => this.toPublic(item));
  }

  async validateForCheckout(
    code: string,
    orderTotal: string,
  ): Promise<ManagedPaymentMethod> {
    const method = await this.repository.findByCode(code);
    if (!method || !method.isActive) {
      throw new AppError(
        400,
        'INVALID_PAYMENT_METHOD',
        `Payment method '${code}' is not available or active`,
      );
    }

    const total = Number(orderTotal);
    if (method.minAmount !== null && total < Number(method.minAmount)) {
      throw new AppError(
        400,
        'PAYMENT_AMOUNT_LIMIT',
        `Order total is below minimum amount (${method.minAmount}) for payment method '${method.name}'`,
      );
    }

    if (method.maxAmount !== null && total > Number(method.maxAmount)) {
      throw new AppError(
        400,
        'PAYMENT_AMOUNT_LIMIT',
        `Order total exceeds maximum amount (${method.maxAmount}) for payment method '${method.name}'`,
      );
    }

    return method;
  }
}
