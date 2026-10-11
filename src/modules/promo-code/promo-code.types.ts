export type PromoDiscountType = 'PERCENTAGE' | 'FIXED';

export interface ManagedPromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: PromoDiscountType;
  discountValue: string;
  minimumOrderAmount: string | null;
  maxDiscountAmount: string | null;
  startDate: Date | null;
  endDate: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicPromoCode {
  code: string;
  description: string | null;
  discountType: PromoDiscountType;
  discountValue: string;
  minimumOrderAmount: string | null;
  maxDiscountAmount: string | null;
  startDate: Date | null;
  endDate: Date | null;
  expiresAt: Date | null;
}

export interface CreatePromoCodeInput {
  code: string;
  description?: string | null;
  discountType: PromoDiscountType;
  discountValue: string | number;
  minimumOrderAmount?: string | number | null;
  maxDiscountAmount?: string | number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  expiresAt?: Date | string | null;
  usageLimit?: number | null;
  isActive?: boolean;
}

export interface UpdatePromoCodeInput {
  code?: string;
  description?: string | null;
  discountType?: PromoDiscountType;
  discountValue?: string | number;
  minimumOrderAmount?: string | number | null;
  maxDiscountAmount?: string | number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  expiresAt?: Date | string | null;
  usageLimit?: number | null;
  isActive?: boolean;
}

export interface PromoCodeFilter {
  isActive?: boolean;
  discountType?: PromoDiscountType;
  search?: string;
}

export interface PromoCodeValidationResult {
  valid: boolean;
  promoCode?: ManagedPromoCode;
  code: string;
  discountType: PromoDiscountType;
  discountValue: string;
  discountAmount: string;
  eligibleSubtotal: string;
  newTotal: string;
  reason?: string;
}

export interface PromoCodeRepository {
  list(filter?: PromoCodeFilter): Promise<ManagedPromoCode[]>;
  findById(id: string): Promise<ManagedPromoCode | null>;
  findByCode(code: string): Promise<ManagedPromoCode | null>;
  create(input: CreatePromoCodeInput): Promise<ManagedPromoCode>;
  update(id: string, input: UpdatePromoCodeInput): Promise<ManagedPromoCode>;
  setStatus(id: string, isActive: boolean): Promise<ManagedPromoCode>;
  delete(id: string): Promise<{ deleted: boolean; softDeleted?: boolean }>;
  incrementUsedCount(id: string): Promise<ManagedPromoCode | null>;
  recordRedemption(input: {
    promoCodeId: string;
    orderId: string;
    discountAmount: string;
  }): Promise<void>;
}
