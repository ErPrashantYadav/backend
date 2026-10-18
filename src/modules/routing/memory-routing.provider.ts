import { AppError } from '../../errors/app-error';
import type {
  Coordinates,
  GeocodingProvider,
  RouteResult,
  RoutingProvider,
} from './routing.types';

export interface MemoryRoutingCall {
  origin: Coordinates;
  destination: Coordinates;
  timestamp: Date;
}

export class MemoryRoutingProvider implements RoutingProvider {
  public calls: MemoryRoutingCall[] = [];
  public defaultResult: RouteResult = {
    distanceMeters: 5200, // 5.2 km
    durationSeconds: 900, // 15 mins
  };
  public routeMap: Map<string, RouteResult> = new Map();
  public simulatedError: Error | null = null;
  public simulatedDelayMs = 0;

  constructor(initialDefault?: RouteResult) {
    if (initialDefault) {
      this.defaultResult = initialDefault;
    }
  }

  private makeKey(origin: Coordinates, destination: Coordinates): string {
    return `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}->${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}`;
  }

  setRoute(
    origin: Coordinates,
    destination: Coordinates,
    result: RouteResult,
  ): void {
    this.routeMap.set(this.makeKey(origin, destination), result);
  }

  setSimulatedError(error: Error | null): void {
    this.simulatedError = error;
  }

  async getRoute(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<RouteResult> {
    this.calls.push({
      origin,
      destination,
      timestamp: new Date(),
    });

    if (this.simulatedDelayMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.simulatedDelayMs),
      );
    }

    if (this.simulatedError) {
      throw this.simulatedError;
    }

    const key = this.makeKey(origin, destination);
    if (this.routeMap.has(key)) {
      return this.routeMap.get(key)!;
    }

    return this.defaultResult;
  }

  get callCount(): number {
    return this.calls.length;
  }

  clearCalls(): void {
    this.calls = [];
  }
}

export class MemoryGeocodingProvider implements GeocodingProvider {
  public defaultAddress = 'Baluwatar, Kathmandu 44600, Nepal';
  public addressMap: Map<string, string> = new Map();
  public simulatedError: Error | null = null;
  public isUnconfigured = false;
  public calls: Coordinates[] = [];

  constructor(defaultAddress?: string) {
    if (defaultAddress) {
      this.defaultAddress = defaultAddress;
    }
  }

  private makeKey(coords: Coordinates): string {
    return `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
  }

  setAddress(coords: Coordinates, address: string): void {
    this.addressMap.set(this.makeKey(coords), address);
  }

  setSimulatedError(error: Error | null): void {
    this.simulatedError = error;
  }

  setUnconfigured(unconfigured = true): void {
    this.isUnconfigured = unconfigured;
  }

  async reverseGeocode(coordinates: Coordinates): Promise<string> {
    this.calls.push(coordinates);

    if (this.isUnconfigured) {
      throw new AppError(
        503,
        'GEOCODING_UNAVAILABLE',
        'Google Maps geocoding capability is not configured or unavailable',
      );
    }

    if (this.simulatedError) {
      throw this.simulatedError;
    }

    const key = this.makeKey(coordinates);
    if (this.addressMap.has(key)) {
      return this.addressMap.get(key)!;
    }

    return this.defaultAddress;
  }

  get callCount(): number {
    return this.calls.length;
  }

  clearCalls(): void {
    this.calls = [];
  }
}
