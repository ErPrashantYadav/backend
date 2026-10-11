import { AppError } from '../../errors/app-error';
import type { DeliveryFeeEstimator } from '../checkout/checkout.types';
import type { RoutingService } from '../routing/routing.service';
import type { DeliveryFeePolicy } from './delivery-fee.types';

export class RoutingDeliveryFeeEstimator implements DeliveryFeeEstimator {
  constructor(
    private readonly routingService: RoutingService,
    private readonly policy: DeliveryFeePolicy,
    private readonly currency: string = 'NPR',
    public readonly requireCoordinates: boolean = false,
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

    let distanceMeters: number | undefined;
    let durationSeconds: number | undefined;

    if (input.coordinates) {
      const route = await this.routingService.getRouteToDestination(
        input.coordinates,
      );
      distanceMeters = route.distanceMeters;
      durationSeconds = route.durationSeconds;
    }

    const calculated = this.policy.calculate({
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
