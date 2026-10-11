import { AppError } from '../../errors/app-error';
import type { AuditService } from '../audit/audit.service';
import type {
  CreatePromoCodeInput,
  ManagedPromoCode,
  PromoCodeFilter,
  PromoCodeRepository,
  PromoCodeValidationResult,
  PublicPromoCode,
  UpdatePromoCodeInput,
} from './promo-code.types';

const CODE_REGEX = /^[A-Z0-9_-]{2,50}$/;

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export class PromoCodeService {
  constructor(
    private readonly repository: PromoCodeRepository,
    private readonly auditService?: AuditService,
  ) {}

  toPublic(promo: ManagedPromoCode): PublicPromoCode {
    return {
      code: promo.code,
      description: promo.description,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      minimumOrderAmount: promo.minimumOrderAmount,
      maxDiscountAmount: promo.maxDiscountAmount,
      startDate: promo.startDate,
      endDate: promo.endDate,
      expiresAt: promo.endDate,
    };
  }

  async listAdmin(filter?: PromoCodeFilter): Promise<ManagedPromoCode[]> {
    return this.repository.list(filter);
  }

  async getAdmin(id: string): Promise<ManagedPromoCode> {
    const promo = await this.repository.findById(id);
    if (!promo) {
      throw new AppError(404, 'NOT_FOUND', 'Promo code not found');
    }
    return promo;
  }

  async create(
    input: CreatePromoCodeInput,
    actorAdminId?: string,
  ): Promise<ManagedPromoCode> {
    const code = input.code.trim().toUpperCase();
    if (!CODE_REGEX.test(code)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'code must be 2-50 characters consisting of uppercase letters, numbers, underscores, or hyphens',
      );
    }

    if (input.discountType !== 'PERCENTAGE' && input.discountType !== 'FIXED') {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        "discountType must be either 'PERCENTAGE' or 'FIXED'",
      );
    }

    const discountValue = Number(input.discountValue);
    if (isNaN(discountValue) || discountValue <= 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'discountValue must be a positive number',
      );
    }

    if (input.discountType === 'PERCENTAGE' && discountValue > 100) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'discountValue for PERCENTAGE cannot exceed 100',
      );
    }

    if (
      input.minimumOrderAmount !== undefined &&
      input.minimumOrderAmount !== null
    ) {
      const minAmount = Number(input.minimumOrderAmount);
      if (isNaN(minAmount) || minAmount < 0) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'minimumOrderAmount must be a non-negative number',
        );
      }
    }

    if (
      input.maxDiscountAmount !== undefined &&
      input.maxDiscountAmount !== null
    ) {
      const maxDiscount = Number(input.maxDiscountAmount);
      if (isNaN(maxDiscount) || maxDiscount <= 0) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'maxDiscountAmount must be a positive number',
        );
      }
    }

    const startDate = input.startDate ? new Date(input.startDate) : null;
    const endDateRaw = input.endDate ?? input.expiresAt;
    const endDate = endDateRaw ? new Date(endDateRaw) : null;

    if (startDate && isNaN(startDate.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid startDate format');
    }

    if (endDate && isNaN(endDate.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid endDate format');
    }

    if (startDate && endDate && startDate > endDate) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'endDate must be greater than or equal to startDate',
      );
    }

    if (input.usageLimit !== undefined && input.usageLimit !== null) {
      const limit = Number(input.usageLimit);
      if (!Number.isInteger(limit) || limit <= 0) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'usageLimit must be a positive integer',
        );
      }
    }

    const existing = await this.repository.findByCode(code);
    if (existing) {
      throw new AppError(
        409,
        'DUPLICATE_PROMO_CODE',
        `Promo code '${code}' already exists`,
      );
    }

    const created = await this.repository.create({
      ...input,
      code,
      startDate,
      endDate,
    });

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'promo_code.create',
        resourceType: 'promo_code',
        resourceId: created.id,
        actorAdminId,
        metadata: {
          code: created.code,
          discountType: created.discountType,
          discountValue: created.discountValue,
        },
      });
    }

    return created;
  }

  async update(
    id: string,
    input: UpdatePromoCodeInput,
    actorAdminId?: string,
  ): Promise<ManagedPromoCode> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Promo code not found');
    }

    let code = existing.code;
    if (input.code !== undefined) {
      code = input.code.trim().toUpperCase();
      if (!CODE_REGEX.test(code)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'code must be 2-50 characters consisting of uppercase letters, numbers, underscores, or hyphens',
        );
      }
      if (code !== existing.code) {
        const duplicate = await this.repository.findByCode(code);
        if (duplicate && duplicate.id !== id) {
          throw new AppError(
            409,
            'DUPLICATE_PROMO_CODE',
            `Promo code '${code}' already exists`,
          );
        }
      }
    }

    const discountType = input.discountType ?? existing.discountType;
    if (discountType !== 'PERCENTAGE' && discountType !== 'FIXED') {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        "discountType must be either 'PERCENTAGE' or 'FIXED'",
      );
    }

    const discountValue =
      input.discountValue !== undefined
        ? Number(input.discountValue)
        : Number(existing.discountValue);
    if (isNaN(discountValue) || discountValue <= 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'discountValue must be a positive number',
      );
    }

    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'discountValue for PERCENTAGE cannot exceed 100',
      );
    }

    if (
      input.minimumOrderAmount !== undefined &&
      input.minimumOrderAmount !== null
    ) {
      const minAmount = Number(input.minimumOrderAmount);
      if (isNaN(minAmount) || minAmount < 0) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'minimumOrderAmount must be a non-negative number',
        );
      }
    }

    if (
      input.maxDiscountAmount !== undefined &&
      input.maxDiscountAmount !== null
    ) {
      const maxDiscount = Number(input.maxDiscountAmount);
      if (isNaN(maxDiscount) || maxDiscount <= 0) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'maxDiscountAmount must be a positive number',
        );
      }
    }

    const startDate =
      input.startDate !== undefined
        ? input.startDate
          ? new Date(input.startDate)
          : null
        : existing.startDate;

    const endDateRaw =
      input.endDate !== undefined
        ? input.endDate
        : input.expiresAt !== undefined
          ? input.expiresAt
          : existing.endDate;

    const endDate = endDateRaw ? new Date(endDateRaw) : null;

    if (startDate && isNaN(startDate.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid startDate format');
    }

    if (endDate && isNaN(endDate.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid endDate format');
    }

    if (startDate && endDate && startDate > endDate) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'endDate must be greater than or equal to startDate',
      );
    }

    if (input.usageLimit !== undefined && input.usageLimit !== null) {
      const limit = Number(input.usageLimit);
      if (!Number.isInteger(limit) || limit <= 0) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'usageLimit must be a positive integer',
        );
      }
    }

    const updated = await this.repository.update(id, {
      ...input,
      code,
      startDate,
      endDate,
    });

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'promo_code.update',
        resourceType: 'promo_code',
        resourceId: id,
        actorAdminId,
        metadata: {
          code: updated.code,
          discountType: updated.discountType,
          discountValue: updated.discountValue,
        },
      });
    }

    return updated;
  }

  async setStatus(
    id: string,
    isActive: boolean,
    actorAdminId?: string,
  ): Promise<ManagedPromoCode> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Promo code not found');
    }

    const updated = await this.repository.setStatus(id, isActive);

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'promo_code.status_change',
        resourceType: 'promo_code',
        resourceId: id,
        actorAdminId,
        metadata: {
          code: updated.code,
          isActive,
        },
      });
    }

    return updated;
  }

  async delete(
    id: string,
    actorAdminId?: string,
  ): Promise<{ deleted: boolean; softDeleted?: boolean }> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Promo code not found');
    }

    const result = await this.repository.delete(id);

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'promo_code.delete',
        resourceType: 'promo_code',
        resourceId: id,
        actorAdminId,
        metadata: {
          code: existing.code,
          softDeleted: Boolean(result.softDeleted),
        },
      });
    }

    return result;
  }

  async listPublicActive(now = new Date()): Promise<PublicPromoCode[]> {
    const all = await this.repository.list({ isActive: true });
    const active = all.filter((p) => {
      if (!p.isActive) return false;
      if (p.startDate && p.startDate > now) return false;
      if (p.endDate && p.endDate < now) return false;
      if (p.usageLimit !== null && p.usedCount >= p.usageLimit) return false;
      return true;
    });

    return active.map((p) => this.toPublic(p));
  }

  async validatePromoCode(
    code: string,
    subtotal: string | number,
    now = new Date(),
  ): Promise<PromoCodeValidationResult> {
    const normalized = code.trim().toUpperCase();
    const promo = await this.repository.findByCode(normalized);

    if (!promo) {
      throw new AppError(
        404,
        'PROMO_NOT_FOUND',
        `Promo code '${normalized}' was not found`,
      );
    }

    if (!promo.isActive) {
      throw new AppError(
        400,
        'PROMO_INACTIVE',
        `Promo code '${promo.code}' is no longer active`,
      );
    }

    if (promo.startDate && promo.startDate > now) {
      throw new AppError(
        400,
        'PROMO_NOT_YET_ACTIVE',
        `Promo code '${promo.code}' is not valid until ${promo.startDate.toISOString()}`,
      );
    }

    if (promo.endDate && promo.endDate < now) {
      throw new AppError(
        400,
        'PROMO_EXPIRED',
        `Promo code '${promo.code}' has expired`,
      );
    }

    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      throw new AppError(
        400,
        'PROMO_USAGE_LIMIT_EXCEEDED',
        `Promo code '${promo.code}' usage limit has been reached`,
      );
    }

    const subtotalNum = Number(subtotal);
    if (isNaN(subtotalNum) || subtotalNum < 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'subtotal must be a non-negative number',
      );
    }

    if (
      promo.minimumOrderAmount !== null &&
      subtotalNum < Number(promo.minimumOrderAmount)
    ) {
      throw new AppError(
        400,
        'PROMO_MINIMUM_ORDER_NOT_MET',
        `Minimum order amount of NPR ${promo.minimumOrderAmount} required for promo code '${promo.code}'`,
      );
    }

    let discountAmount = 0;
    if (promo.discountType === 'FIXED') {
      discountAmount = Math.min(Number(promo.discountValue), subtotalNum);
    } else {
      const percentageDiscount =
        subtotalNum * (Number(promo.discountValue) / 100);
      const capped =
        promo.maxDiscountAmount !== null
          ? Math.min(percentageDiscount, Number(promo.maxDiscountAmount))
          : percentageDiscount;
      discountAmount = Math.min(capped, subtotalNum);
    }

    discountAmount = roundToTwo(discountAmount);
    const newTotal = roundToTwo(Math.max(0, subtotalNum - discountAmount));

    return {
      valid: true,
      promoCode: promo,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount: discountAmount.toFixed(2),
      eligibleSubtotal: subtotalNum.toFixed(2),
      newTotal: newTotal.toFixed(2),
    };
  }
}
