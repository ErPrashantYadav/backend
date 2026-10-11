import { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error';

export function validateDiscount(
  discountType: 'PERCENTAGE' | 'FIXED' | null,
  discountValue: string | null,
): void {
  if (!discountType && !discountValue) return;
  if (!discountType || !discountValue) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Both discount type and value are required when applying a discount',
    );
  }
  const numeric = Number(discountValue);
  if (Number.isNaN(numeric) || numeric <= 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Discount value must be greater than zero',
    );
  }
  if (discountType === 'PERCENTAGE' && numeric > 100) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Percentage discount cannot exceed 100',
    );
  }
}

export function calculateDiscountedPrice(
  sellingPrice: string,
  discountType: 'PERCENTAGE' | 'FIXED' | null,
  discountValue: string | null,
): string {
  if (!discountType || !discountValue) {
    return sellingPrice;
  }
  const price = new Prisma.Decimal(sellingPrice);
  let effective: Prisma.Decimal;
  if (discountType === 'PERCENTAGE') {
    const percentage = new Prisma.Decimal(discountValue);
    const discountAmount = price.times(percentage).dividedBy(100);
    effective = price.minus(discountAmount);
  } else {
    const fixedAmount = new Prisma.Decimal(discountValue);
    effective = price.minus(fixedAmount);
  }
  if (effective.lessThan(0)) {
    effective = new Prisma.Decimal(0);
  }
  return effective.toFixed(2);
}
