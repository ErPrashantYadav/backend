import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  CreatePromoCodeInput,
  ManagedPromoCode,
  PromoCodeFilter,
  PromoCodeRepository,
  UpdatePromoCodeInput,
} from './promo-code.types';

function mapPromoCode(
  row: Prisma.PromoCodeGetPayload<Record<string, never>>,
): ManagedPromoCode {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discountType as 'PERCENTAGE' | 'FIXED',
    discountValue: row.discountValue.toFixed(2),
    minimumOrderAmount: row.minimumOrderAmount
      ? row.minimumOrderAmount.toFixed(2)
      : null,
    maxDiscountAmount: row.maxDiscountAmount
      ? row.maxDiscountAmount.toFixed(2)
      : null,
    startDate: row.startDate,
    endDate: row.endDate,
    expiresAt: row.endDate,
    usageLimit: row.usageLimit,
    usedCount: row.usedCount,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaPromoCodeRepository implements PromoCodeRepository {
  async list(filter?: PromoCodeFilter): Promise<ManagedPromoCode[]> {
    const where: Prisma.PromoCodeWhereInput = {};

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.discountType !== undefined) {
      where.discountType = filter.discountType;
    }

    if (filter?.search) {
      where.code = {
        contains: filter.search.trim(),
        mode: 'insensitive',
      };
    }

    const rows = await prisma.promoCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(mapPromoCode);
  }

  async findById(id: string): Promise<ManagedPromoCode | null> {
    const row = await prisma.promoCode.findUnique({
      where: { id },
    });
    return row ? mapPromoCode(row) : null;
  }

  async findByCode(code: string): Promise<ManagedPromoCode | null> {
    const normalized = code.trim().toUpperCase();
    const row = await prisma.promoCode.findFirst({
      where: {
        code: {
          equals: normalized,
          mode: 'insensitive',
        },
      },
    });
    return row ? mapPromoCode(row) : null;
  }

  async create(input: CreatePromoCodeInput): Promise<ManagedPromoCode> {
    const endDate = input.endDate ?? input.expiresAt ?? null;
    const row = await prisma.promoCode.create({
      data: {
        code: input.code.trim().toUpperCase(),
        description: input.description ?? null,
        discountType: input.discountType,
        discountValue: new Prisma.Decimal(input.discountValue),
        minimumOrderAmount:
          input.minimumOrderAmount !== undefined &&
          input.minimumOrderAmount !== null
            ? new Prisma.Decimal(input.minimumOrderAmount)
            : null,
        maxDiscountAmount:
          input.maxDiscountAmount !== undefined &&
          input.maxDiscountAmount !== null
            ? new Prisma.Decimal(input.maxDiscountAmount)
            : null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        usageLimit:
          input.usageLimit !== undefined && input.usageLimit !== null
            ? Number(input.usageLimit)
            : null,
        isActive: input.isActive ?? true,
      },
    });

    return mapPromoCode(row);
  }

  async update(
    id: string,
    input: UpdatePromoCodeInput,
  ): Promise<ManagedPromoCode> {
    const data: Prisma.PromoCodeUpdateInput = {};

    if (input.code !== undefined) {
      data.code = input.code.trim().toUpperCase();
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }
    if (input.discountType !== undefined) {
      data.discountType = input.discountType;
    }
    if (input.discountValue !== undefined) {
      data.discountValue = new Prisma.Decimal(input.discountValue);
    }
    if (input.minimumOrderAmount !== undefined) {
      data.minimumOrderAmount =
        input.minimumOrderAmount !== null
          ? new Prisma.Decimal(input.minimumOrderAmount)
          : null;
    }
    if (input.maxDiscountAmount !== undefined) {
      data.maxDiscountAmount =
        input.maxDiscountAmount !== null
          ? new Prisma.Decimal(input.maxDiscountAmount)
          : null;
    }
    if (input.startDate !== undefined) {
      data.startDate = input.startDate ? new Date(input.startDate) : null;
    }
    const resolvedEndDate =
      input.endDate !== undefined ? input.endDate : input.expiresAt;
    if (resolvedEndDate !== undefined) {
      data.endDate = resolvedEndDate ? new Date(resolvedEndDate) : null;
    }
    if (input.usageLimit !== undefined) {
      data.usageLimit =
        input.usageLimit !== null ? Number(input.usageLimit) : null;
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    const row = await prisma.promoCode.update({
      where: { id },
      data,
    });

    return mapPromoCode(row);
  }

  async setStatus(id: string, isActive: boolean): Promise<ManagedPromoCode> {
    const row = await prisma.promoCode.update({
      where: { id },
      data: { isActive },
    });
    return mapPromoCode(row);
  }

  async delete(
    id: string,
  ): Promise<{ deleted: boolean; softDeleted?: boolean }> {
    const redemptionsCount = await prisma.promoCodeRedemption.count({
      where: { promoCodeId: id },
    });

    if (redemptionsCount > 0) {
      // Historical redemptions exist, soft-delete to preserve history
      await prisma.promoCode.update({
        where: { id },
        data: { isActive: false },
      });
      return { deleted: true, softDeleted: true };
    }

    await prisma.promoCode.delete({
      where: { id },
    });
    return { deleted: true, softDeleted: false };
  }

  async incrementUsedCount(id: string): Promise<ManagedPromoCode | null> {
    // Atomic increment only if usage limit has not been exceeded
    const result = await prisma.$executeRaw`
      UPDATE "PromoCode"
      SET "usedCount" = "usedCount" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}::uuid
        AND "isActive" = true
        AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
    `;

    if (result === 0) {
      return null;
    }

    const row = await prisma.promoCode.findUnique({
      where: { id },
    });
    return row ? mapPromoCode(row) : null;
  }

  async recordRedemption(input: {
    promoCodeId: string;
    orderId: string;
    discountAmount: string;
  }): Promise<void> {
    await prisma.promoCodeRedemption.create({
      data: {
        promoCodeId: input.promoCodeId,
        orderId: input.orderId,
        discountAmount: new Prisma.Decimal(input.discountAmount),
      },
    });
  }
}
