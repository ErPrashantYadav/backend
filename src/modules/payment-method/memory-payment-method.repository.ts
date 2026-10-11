import { AppError } from '../../errors/app-error';
import type {
  CreatePaymentMethodInput,
  ManagedPaymentMethod,
  PaymentMethodRepository,
  UpdatePaymentMethodInput,
} from './payment-method.types';

export class MemoryPaymentMethodRepository implements PaymentMethodRepository {
  items: ManagedPaymentMethod[] = [];

  constructor(initialItems: ManagedPaymentMethod[] = []) {
    this.items = [...initialItems];
  }

  async list(filter?: { isActive?: boolean }): Promise<ManagedPaymentMethod[]> {
    let result = [...this.items];
    if (filter?.isActive !== undefined) {
      result = result.filter((item) => item.isActive === filter.isActive);
    }
    result.sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return result;
  }

  async findById(id: string): Promise<ManagedPaymentMethod | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async findByCode(code: string): Promise<ManagedPaymentMethod | null> {
    return (
      this.items.find(
        (item) => item.code.toUpperCase() === code.trim().toUpperCase(),
      ) ?? null
    );
  }

  async create(input: CreatePaymentMethodInput): Promise<ManagedPaymentMethod> {
    const code = input.code.trim().toUpperCase();
    if (this.items.some((item) => item.code === code)) {
      throw new AppError(
        409,
        'DUPLICATE_CODE',
        `Payment method with code '${code}' already exists`,
      );
    }

    const now = new Date();
    const created: ManagedPaymentMethod = {
      id: crypto.randomUUID(),
      code,
      type: input.type,
      name: input.name.trim(),
      description: input.description ?? null,
      providerLabel: input.providerLabel ?? null,
      accountName: input.accountName ?? null,
      accountNumber: input.accountNumber ?? null,
      qrImageUrl: input.qrImageUrl ?? null,
      instructions: input.instructions ?? null,
      minAmount: input.minAmount ?? null,
      maxAmount: input.maxAmount ?? null,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.items.push(created);
    return created;
  }

  async update(
    id: string,
    input: UpdatePaymentMethodInput,
  ): Promise<ManagedPaymentMethod> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Payment method not found');
    }

    if (input.name !== undefined) existing.name = input.name.trim();
    if (input.description !== undefined)
      existing.description = input.description;
    if (input.providerLabel !== undefined)
      existing.providerLabel = input.providerLabel;
    if (input.accountName !== undefined)
      existing.accountName = input.accountName;
    if (input.accountNumber !== undefined)
      existing.accountNumber = input.accountNumber;
    if (input.qrImageUrl !== undefined) existing.qrImageUrl = input.qrImageUrl;
    if (input.instructions !== undefined)
      existing.instructions = input.instructions;
    if (input.minAmount !== undefined) existing.minAmount = input.minAmount;
    if (input.maxAmount !== undefined) existing.maxAmount = input.maxAmount;
    if (input.displayOrder !== undefined)
      existing.displayOrder = input.displayOrder;
    if (input.isActive !== undefined) existing.isActive = input.isActive;
    existing.updatedAt = new Date();

    return existing;
  }

  async setStatus(
    id: string,
    isActive: boolean,
  ): Promise<ManagedPaymentMethod> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Payment method not found');
    }
    existing.isActive = isActive;
    existing.updatedAt = new Date();
    return existing;
  }
}
