import { AppError } from '../../errors/app-error';
import type { DeliveryFeeEstimator } from '../checkout/checkout.types';
import type { RoutingService } from '../routing/routing.service';
import {
  resolveEffectiveDeliveryFreeThreshold,
  type StoreSettingsRepository,
} from '../store-settings/store-settings.types';
import { ConfigurableDeliveryFeePolicy } from './delivery-fee.policy';
import type { DeliveryFeePolicy } from './delivery-fee.types';

export class RoutingDeliveryFeeEstimator implements DeliveryFeeEstimator {
  constructor(
    private readonly routingService: RoutingService,
    private readonly policy: DeliveryFeePolicy,
    private readonly currency: string = 'NPR',
    public readonly requireCoordinates: boolean = false,
    private readonly storeSettingsRepository?: StoreSettingsRepository,
  ) {}

  async estimateFee(input: {
    address: string;
    coordinates?: { latitude: number; longitude: number };
    subtotal: string;
  }): Promise<{
    fee: string;
    currency: string;
    distanceMeters?: number;
    durationSeconds?: number;
    breakdown?: Record<string, unknown>;
  }> {
    if (this.requireCoordinates && !input.coordinates) {
      throw new AppError(
        400,
        'COORDINATES_REQUIRED',
        'Delivery coordinates (latitude and longitude) are required for fee calculation',
      );
    }

    let effectivePolicy = this.policy;
    let overrideOrigin = this.routingService.storeOrigin;
    let overrideMaxDistanceKm = this.routingService.maxDistanceKm;

    if (this.storeSettingsRepository) {
      const settings = await this.storeSettingsRepository.get();

      if (
        settings.storeOriginLatitude !== null &&
        settings.storeOriginLatitude !== undefined &&
        settings.storeOriginLongitude !== null &&
        settings.storeOriginLongitude !== undefined
      ) {
        overrideOrigin = {
          latitude: Number(settings.storeOriginLatitude),
          longitude: Number(settings.storeOriginLongitude),
        };
      }

      const baseConfig =
        this.policy instanceof ConfigurableDeliveryFeePolicy
          ? this.policy.config
          : undefined;

      const effectiveMode =
        settings.deliveryFeeMode ?? baseConfig?.mode ?? 'PER_KM';
      const effectiveBaseAmount =
        settings.deliveryFeeBaseAmount !== null &&
        settings.deliveryFeeBaseAmount !== undefined
          ? Number(settings.deliveryFeeBaseAmount)
          : (baseConfig?.baseAmount ?? 100);
      const effectivePerKmAmount =
        settings.deliveryFeePerKmAmount !== null &&
        settings.deliveryFeePerKmAmount !== undefined
          ? Number(settings.deliveryFeePerKmAmount)
          : (baseConfig?.perKmAmount ?? 25);
      const effectiveFreeThreshold = resolveEffectiveDeliveryFreeThreshold(
        settings,
        baseConfig?.freeDeliveryThreshold,
      );
      overrideMaxDistanceKm =
        settings.deliveryMaxDistanceKm !== null &&
        settings.deliveryMaxDistanceKm !== undefined
          ? Number(settings.deliveryMaxDistanceKm)
          : (baseConfig?.maxDistanceKm ?? this.routingService.maxDistanceKm);
      const effectiveFallback =
        settings.deliveryFallbackAmount !== null &&
        settings.deliveryFallbackAmount !== undefined
          ? Number(settings.deliveryFallbackAmount)
          : (baseConfig?.fallbackAmount ?? 0);

      effectivePolicy = new ConfigurableDeliveryFeePolicy(
        {
          mode: effectiveMode,
          baseAmount: effectiveBaseAmount,
          perKmAmount: effectivePerKmAmount,
          freeDeliveryThreshold: effectiveFreeThreshold,
          maxDistanceKm: overrideMaxDistanceKm,
          fallbackAmount: effectiveFallback,
        },
        this.currency,
      );
    }

    let distanceMeters: number | undefined;
    let durationSeconds: number | undefined;

    if (input.coordinates) {
      const route = await this.routingService.getRouteToDestination(
        input.coordinates,
        overrideOrigin,
        overrideMaxDistanceKm,
      );
      distanceMeters = route.distanceMeters;
      durationSeconds = route.durationSeconds;
    }

    const calculated = effectivePolicy.calculate({
      distanceMeters,
      durationSeconds,
      subtotal: input.subtotal,
    });

    return {
      fee: calculated.fee,
      currency: this.currency,
      distanceMeters,
      durationSeconds,
      breakdown: calculated.breakdown as unknown as Record<string, unknown>,
    };
  }
}
