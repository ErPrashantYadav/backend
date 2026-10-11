import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  CreatePaymentMethodInput,
  ManagedPaymentMethod,
  PaymentMethodRepository,
  UpdatePaymentMethodInput,
} from './payment-method.types';

function mapPaymentMethod(
  row: Prisma.PaymentMethodGetPayload<Record<string, never>>,
): ManagedPaymentMethod {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    name: row.name,
    description: row.description,
    providerLabel: row.providerLabel,
    accountName: row.accountName,
    accountNumber: row.accountNumber,
    qrImageUrl: row.qrImageUrl,
    instructions: row.instructions,
    minAmount: row.minAmount ? row.minAmount.toFixed(2) : null,
    maxAmount: row.maxAmount ? row.maxAmount.toFixed(2) : null,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaPaymentMethodRepository implements PaymentMethodRepository {
  async list(filter?: { isActive?: boolean }): Promise<ManagedPaymentMethod[]> {
    const where: Prisma.PaymentMethodWhereInput = {};
    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    const rows = await prisma.paymentMethod.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map(mapPaymentMethod);
  }

  async findById(id: string): Promise<ManagedPaymentMethod | null> {
    const row = await prisma.paymentMethod.findUnique({
      where: { id },
    });
    return row ? mapPaymentMethod(row) : null;
  }

  async findByCode(code: string): Promise<ManagedPaymentMethod | null> {
    const row = await prisma.paymentMethod.findUnique({
      where: { code },
    });
    return row ? mapPaymentMethod(row) : null;
  }

  async create(input: CreatePaymentMethodInput): Promise<ManagedPaymentMethod> {
    const row = await prisma.paymentMethod.create({
      data: {
        code: input.code,
        type: input.type,
        name: input.name,
        description: input.description ?? null,
        providerLabel: input.providerLabel ?? null,
        accountName: input.accountName ?? null,
        accountNumber: input.accountNumber ?? null,
        qrImageUrl: input.qrImageUrl ?? null,
        instructions: input.instructions ?? null,
        minAmount: input.minAmount ? new Prisma.Decimal(input.minAmount) : null,
        maxAmount: input.maxAmount ? new Prisma.Decimal(input.maxAmount) : null,
        displayOrder: input.displayOrder ?? 0,
        isActive: input.isActive ?? true,
      },
    });

    return mapPaymentMethod(row);
  }

  async update(
    id: string,
    input: UpdatePaymentMethodInput,
  ): Promise<ManagedPaymentMethod> {
    const data: Prisma.PaymentMethodUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.providerLabel !== undefined)
      data.providerLabel = input.providerLabel;
    if (input.accountName !== undefined) data.accountName = input.accountName;
    if (input.accountNumber !== undefined)
      data.accountNumber = input.accountNumber;
    if (input.qrImageUrl !== undefined) data.qrImageUrl = input.qrImageUrl;
    if (input.instructions !== undefined)
      data.instructions = input.instructions;
    if (input.minAmount !== undefined)
      data.minAmount = input.minAmount
        ? new Prisma.Decimal(input.minAmount)
        : null;
    if (input.maxAmount !== undefined)
      data.maxAmount = input.maxAmount
        ? new Prisma.Decimal(input.maxAmount)
        : null;
    if (input.displayOrder !== undefined)
      data.displayOrder = input.displayOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const row = await prisma.paymentMethod.update({
      where: { id },
      data,
    });

    return mapPaymentMethod(row);
  }

  async setStatus(
    id: string,
    isActive: boolean,
  ): Promise<ManagedPaymentMethod> {
    const row = await prisma.paymentMethod.update({
      where: { id },
      data: { isActive },
    });
    return mapPaymentMethod(row);
  }
}
