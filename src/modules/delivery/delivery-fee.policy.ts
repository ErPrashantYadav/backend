import { Prisma } from '@prisma/client';
import type {
  DeliveryFeeCalculationResult,
  DeliveryFeePolicy,
  DeliveryFeePolicyConfig,
} from './delivery-fee.types';

export const UNRESOLVED_DELIVERY_POLICY_DECISIONS = [
  'Free delivery threshold policy: Whether orders above NPR 5,000 receive complimentary delivery, subject to local alcohol distribution regulations.',
  'Traffic & duration surge pricing: Whether high road duration or peak evening hours (e.g. 18:00 - 22:00) incur a supplemental delivery fee.',
  'Kathmandu Ring Road boundary enforcement: Whether delivery beyond the Ring Road incurs zonal surcharges beyond linear road distance.',
  'Missing coordinates fallback: Whether manual text addresses without GPS coordinates fall back to flat base fee or require customer pin confirmation prior to dispatch.',
] as const;

export class ConfigurableDeliveryFeePolicy implements DeliveryFeePolicy {
  constructor(
    public readonly config: DeliveryFeePolicyConfig,
    public readonly currency: string = 'NPR',
  ) {}

  calculate(input: {
    distanceMeters?: number;
    durationSeconds?: number;
    subtotal: string;
  }): DeliveryFeeCalculationResult {
    const subtotalDecimal = new Prisma.Decimal(input.subtotal || '0.00');

    // 1. Check for Free Delivery Threshold if configured
    if (
      this.config.freeDeliveryThreshold !== undefined &&
      this.config.freeDeliveryThreshold !== null &&
      Number(this.config.freeDeliveryThreshold) > 0 &&
      subtotalDecimal.greaterThanOrEqualTo(this.config.freeDeliveryThreshold)
    ) {
      return {
        fee: '0.00',
        currency: this.currency,
        distanceMeters: input.distanceMeters,
        durationSeconds: input.durationSeconds,
        isFreeDelivery: true,
        breakdown: {
          mode: this.config.mode,
          baseAmount: Number(this.config.baseAmount ?? 0).toFixed(2),
          subtotal: subtotalDecimal.toFixed(2),
          freeDeliveryThreshold: Number(
            this.config.freeDeliveryThreshold,
          ).toFixed(2),
          isFreeDelivery: true,
          unresolvedPolicyNotes: [...UNRESOLVED_DELIVERY_POLICY_DECISIONS],
        },
      };
    }

    // 2. If no distance is provided (coordinates omitted), use fallback amount
    if (input.distanceMeters === undefined) {
      const fallback = Number(this.config.fallbackAmount ?? 0).toFixed(2);
      return {
        fee: fallback,
        currency: this.currency,
        distanceMeters: undefined,
        durationSeconds: undefined,
        isFreeDelivery: false,
        breakdown: {
          mode: this.config.mode,
          baseAmount: fallback,
          subtotal: subtotalDecimal.toFixed(2),
          freeDeliveryThreshold:
            this.config.freeDeliveryThreshold !== undefined &&
            this.config.freeDeliveryThreshold !== null
              ? Number(this.config.freeDeliveryThreshold).toFixed(2)
              : null,
          isFreeDelivery: false,
          unresolvedPolicyNotes: [...UNRESOLVED_DELIVERY_POLICY_DECISIONS],
        },
      };
    }

    // 3. Compute fee based on configured policy mode
    const baseDec = new Prisma.Decimal(this.config.baseAmount ?? 0);
    const distanceKm = input.distanceMeters / 1000;
    const distanceKmDec = new Prisma.Decimal(distanceKm);

    let feeDec: Prisma.Decimal;
    let distanceFeeDec: Prisma.Decimal | undefined;

    switch (this.config.mode) {
      case 'FIXED':
      case 'FLAT' as unknown as 'FIXED': {
        feeDec = baseDec;
        break;
      }

      case 'TIERED': {
        // Tiered pricing:
        // 0 to 5 km: base amount
        // 5 to 15 km: base amount + 100 NPR
        // > 15 km: base amount + 250 NPR
        if (distanceKm <= 5) {
          feeDec = baseDec;
        } else if (distanceKm <= 15) {
          distanceFeeDec = new Prisma.Decimal(100);
          feeDec = baseDec.plus(distanceFeeDec);
        } else {
          distanceFeeDec = new Prisma.Decimal(250);
          feeDec = baseDec.plus(distanceFeeDec);
        }
        break;
      }

      case 'PER_KM':
      default: {
        // Base amount + distanceKm * perKmAmount, rounded to 2 decimals
        const perKmDec = new Prisma.Decimal(this.config.perKmAmount ?? 0);
        distanceFeeDec = distanceKmDec.times(perKmDec);
        feeDec = baseDec.plus(distanceFeeDec);
        break;
      }
    }

    const finalFee = feeDec.toFixed(2);

    return {
      fee: finalFee,
      currency: this.currency,
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
      isFreeDelivery: false,
      breakdown: {
        mode: this.config.mode,
        baseAmount: baseDec.toFixed(2),
        perKmAmount:
          this.config.mode === 'PER_KM' && this.config.perKmAmount !== undefined
            ? Number(this.config.perKmAmount).toFixed(2)
            : undefined,
        distanceKm: distanceKm.toFixed(2),
        distanceFee: distanceFeeDec ? distanceFeeDec.toFixed(2) : undefined,
        subtotal: subtotalDecimal.toFixed(2),
        freeDeliveryThreshold:
          this.config.freeDeliveryThreshold !== undefined &&
          this.config.freeDeliveryThreshold !== null
            ? Number(this.config.freeDeliveryThreshold).toFixed(2)
            : null,
        isFreeDelivery: false,
        unresolvedPolicyNotes: [...UNRESOLVED_DELIVERY_POLICY_DECISIONS],
      },
    };
  }
}
