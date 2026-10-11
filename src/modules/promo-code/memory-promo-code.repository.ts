import crypto from 'node:crypto';
import type {
  CreatePromoCodeInput,
  ManagedPromoCode,
  PromoCodeFilter,
  PromoCodeRepository,
  UpdatePromoCodeInput,
} from './promo-code.types';

export class MemoryPromoCodeRepository implements PromoCodeRepository {
  promoCodes: ManagedPromoCode[] = [];
  redemptions: Array<{
    id: string;
    promoCodeId: string;
    orderId: string;
    discountAmount: string;
    createdAt: Date;
  }> = [];

  constructor(initialPromoCodes: ManagedPromoCode[] = []) {
    this.promoCodes = [...initialPromoCodes];
  }

  async list(filter?: PromoCodeFilter): Promise<ManagedPromoCode[]> {
    let result = [...this.promoCodes];

    if (filter?.isActive !== undefined) {
      result = result.filter((p) => p.isActive === filter.isActive);
    }

    if (filter?.discountType !== undefined) {
      result = result.filter((p) => p.discountType === filter.discountType);
    }

    if (filter?.search) {
      const q = filter.search.trim().toUpperCase();
      result = result.filter((p) => p.code.includes(q));
    }

    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findById(id: string): Promise<ManagedPromoCode | null> {
    const promo = this.promoCodes.find((p) => p.id === id);
    return promo ? { ...promo } : null;
  }

  async findByCode(code: string): Promise<ManagedPromoCode | null> {
    const normalized = code.trim().toUpperCase();
    const promo = this.promoCodes.find(
      (p) => p.code.toUpperCase() === normalized,
    );
    return promo ? { ...promo } : null;
  }

  async create(input: CreatePromoCodeInput): Promise<ManagedPromoCode> {
    const now = new Date();
    const endDate = input.endDate ?? input.expiresAt ?? null;
    const promo: ManagedPromoCode = {
      id: crypto.randomUUID(),
      code: input.code.trim().toUpperCase(),
      description: input.description ?? null,
      discountType: input.discountType,
      discountValue: Number(input.discountValue).toFixed(2),
      minimumOrderAmount:
        input.minimumOrderAmount !== undefined &&
        input.minimumOrderAmount !== null
          ? Number(input.minimumOrderAmount).toFixed(2)
          : null,
      maxDiscountAmount:
        input.maxDiscountAmount !== undefined &&
        input.maxDiscountAmount !== null
          ? Number(input.maxDiscountAmount).toFixed(2)
          : null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      expiresAt: endDate ? new Date(endDate) : null,
      usageLimit:
        input.usageLimit !== undefined && input.usageLimit !== null
          ? Number(input.usageLimit)
          : null,
      usedCount: 0,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.promoCodes.push(promo);
    return { ...promo };
  }

  async update(
    id: string,
    input: UpdatePromoCodeInput,
  ): Promise<ManagedPromoCode> {
    const promo = this.promoCodes.find((p) => p.id === id);
    if (!promo) {
      throw new Error('Promo code not found');
    }

    if (input.code !== undefined) {
      promo.code = input.code.trim().toUpperCase();
    }
    if (input.description !== undefined) {
      promo.description = input.description;
    }
    if (input.discountType !== undefined) {
      promo.discountType = input.discountType;
    }
    if (input.discountValue !== undefined) {
      promo.discountValue = Number(input.discountValue).toFixed(2);
    }
    if (input.minimumOrderAmount !== undefined) {
      promo.minimumOrderAmount =
        input.minimumOrderAmount !== null
          ? Number(input.minimumOrderAmount).toFixed(2)
          : null;
    }
    if (input.maxDiscountAmount !== undefined) {
      promo.maxDiscountAmount =
        input.maxDiscountAmount !== null
          ? Number(input.maxDiscountAmount).toFixed(2)
          : null;
    }
    if (input.startDate !== undefined) {
      promo.startDate = input.startDate ? new Date(input.startDate) : null;
    }
    const resolvedEndDate =
      input.endDate !== undefined ? input.endDate : input.expiresAt;
    if (resolvedEndDate !== undefined) {
      promo.endDate = resolvedEndDate ? new Date(resolvedEndDate) : null;
      promo.expiresAt = promo.endDate;
    }
    if (input.usageLimit !== undefined) {
      promo.usageLimit =
        input.usageLimit !== null ? Number(input.usageLimit) : null;
    }
    if (input.isActive !== undefined) {
      promo.isActive = input.isActive;
    }

    promo.updatedAt = new Date();
    return { ...promo };
  }

  async setStatus(id: string, isActive: boolean): Promise<ManagedPromoCode> {
    const promo = this.promoCodes.find((p) => p.id === id);
    if (!promo) {
      throw new Error('Promo code not found');
    }
    promo.isActive = isActive;
    promo.updatedAt = new Date();
    return { ...promo };
  }

  async delete(
    id: string,
  ): Promise<{ deleted: boolean; softDeleted?: boolean }> {
    const index = this.promoCodes.findIndex((p) => p.id === id);
    if (index === -1) {
      return { deleted: false };
    }

    const hasRedemptions = this.redemptions.some((r) => r.promoCodeId === id);
    if (hasRedemptions) {
      this.promoCodes[index]!.isActive = false;
      this.promoCodes[index]!.updatedAt = new Date();
      return { deleted: true, softDeleted: true };
    }

    this.promoCodes.splice(index, 1);
    return { deleted: true, softDeleted: false };
  }

  async incrementUsedCount(id: string): Promise<ManagedPromoCode | null> {
    const promo = this.promoCodes.find((p) => p.id === id);
    if (!promo || !promo.isActive) {
      return null;
    }

    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      return null;
    }

    promo.usedCount += 1;
    promo.updatedAt = new Date();
    return { ...promo };
  }

  async recordRedemption(input: {
    promoCodeId: string;
    orderId: string;
    discountAmount: string;
  }): Promise<void> {
    this.redemptions.push({
      id: crypto.randomUUID(),
      promoCodeId: input.promoCodeId,
      orderId: input.orderId,
      discountAmount: Number(input.discountAmount).toFixed(2),
      createdAt: new Date(),
    });
  }
}
