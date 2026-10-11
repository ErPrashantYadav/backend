export type DeliveryFeeMode = 'FIXED' | 'PER_KM' | 'TIERED';

export interface DeliveryFeePolicyConfig {
  mode: DeliveryFeeMode;
  baseAmount: number;
  perKmAmount: number;
  freeDeliveryThreshold?: number | null;
  maxDistanceKm: number;
  fallbackAmount?: number;
}

export interface DeliveryFeeBreakdown {
  mode: DeliveryFeeMode;
  baseAmount: string;
  perKmAmount?: string;
  distanceKm?: string;
  distanceFee?: string;
  subtotal: string;
  freeDeliveryThreshold?: string | null;
  isFreeDelivery: boolean;
  unresolvedPolicyNotes?: string[];
}

export interface DeliveryFeeCalculationResult {
  fee: string; // Exactly 2 decimal places, e.g. "175.00"
  currency: string;
  distanceMeters?: number;
  durationSeconds?: number;
  isFreeDelivery: boolean;
  breakdown: DeliveryFeeBreakdown;
}

export interface DeliveryFeePolicy {
  calculate(input: {
    distanceMeters?: number;
    durationSeconds?: number;
    subtotal: string;
  }): DeliveryFeeCalculationResult;
}
