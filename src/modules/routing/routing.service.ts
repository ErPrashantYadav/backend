import { AppError } from '../../errors/app-error';
import {
  type Coordinates,
  type GeographicBounds,
  type RouteResult,
  type RoutingProvider,
  redactSensitiveText,
} from './routing.types';

export class RoutingService {
  constructor(
    private readonly provider: RoutingProvider,
    public readonly storeOrigin: Coordinates = {
      latitude: 27.7172,
      longitude: 85.324,
    },
    public readonly maxDistanceKm: number = 25,
    public readonly serviceBounds?: GeographicBounds,
  ) {
    this.validateCoordinates(this.storeOrigin, 'Store origin');
  }

  public validateCoordinates(coords: Coordinates, label = 'Coordinates'): void {
    if (
      typeof coords !== 'object' ||
      coords === null ||
      typeof coords.latitude !== 'number' ||
      typeof coords.longitude !== 'number' ||
      !Number.isFinite(coords.latitude) ||
      !Number.isFinite(coords.longitude)
    ) {
      throw new AppError(
        400,
        'INVALID_COORDINATES',
        `${label} must have valid finite latitude and longitude numbers`,
      );
    }

    if (coords.latitude < -90 || coords.latitude > 90) {
      throw new AppError(
        400,
        'INVALID_COORDINATES',
        `${label} latitude must be between -90 and 90 degrees`,
      );
    }

    if (coords.longitude < -180 || coords.longitude > 180) {
      throw new AppError(
        400,
        'INVALID_COORDINATES',
        `${label} longitude must be between -180 and 180 degrees`,
      );
    }
  }

  public checkServiceBounds(destination: Coordinates): void {
    if (!this.serviceBounds) return;

    const { minLatitude, maxLatitude, minLongitude, maxLongitude } =
      this.serviceBounds;

    if (
      destination.latitude < minLatitude ||
      destination.latitude > maxLatitude ||
      destination.longitude < minLongitude ||
      destination.longitude > maxLongitude
    ) {
      throw new AppError(
        400,
        'OUT_OF_SERVICE_AREA',
        'Delivery location is outside the serviceable geographic area',
      );
    }
  }

  async calculateRoute(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<RouteResult> {
    this.validateCoordinates(origin, 'Origin');
    this.validateCoordinates(destination, 'Destination');
    this.checkServiceBounds(destination);

    let raw: RouteResult;
    try {
      raw = await this.provider.getRoute(origin, destination);
    } catch (error) {
      if (error instanceof AppError) {
        error.message = redactSensitiveText(error.message);
        throw error;
      }
      const rawMessage =
        error instanceof Error
          ? error.message
          : 'Unknown routing provider error';
      throw new AppError(
        502,
        'ROUTING_PROVIDER_ERROR',
        redactSensitiveText(rawMessage),
      );
    }

    const distanceMeters = Math.max(0, Math.round(raw.distanceMeters));
    const durationSeconds = Math.max(0, Math.round(raw.durationSeconds));

    if (this.maxDistanceKm > 0 && distanceMeters > this.maxDistanceKm * 1000) {
      const distanceKm = (distanceMeters / 1000).toFixed(1);
      throw new AppError(
        400,
        'MAX_DISTANCE_EXCEEDED',
        `Delivery distance (${distanceKm} km) exceeds maximum serviceable limit of ${this.maxDistanceKm} km`,
      );
    }

    return {
      distanceMeters,
      durationSeconds,
    };
  }

  async getRouteToDestination(destination: Coordinates): Promise<RouteResult> {
    return this.calculateRoute(this.storeOrigin, destination);
  }
}
