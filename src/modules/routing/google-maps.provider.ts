import { AppError } from '../../errors/app-error';
import {
  type Coordinates,
  type RouteResult,
  type RoutingProvider,
  redactSensitiveText,
} from './routing.types';

interface DistanceMatrixElement {
  status: string;
  distance?: { value: number; text: string };
  duration?: { value: number; text: string };
}

interface DistanceMatrixResponse {
  status: string;
  error_message?: string;
  rows?: Array<{
    elements: DistanceMatrixElement[];
  }>;
}

export class GoogleMapsRoutingProvider implements RoutingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number = 5000,
    private readonly baseUrl: string = 'https://maps.googleapis.com/maps/api/distancematrix/json',
  ) {
    if (!apiKey || !apiKey.trim()) {
      throw new AppError(
        500,
        'ROUTING_CONFIG_ERROR',
        'Google Maps API key is required to initialize GoogleMapsRoutingProvider',
      );
    }
  }

  async getRoute(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<RouteResult> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('origins', `${origin.latitude},${origin.longitude}`);
    url.searchParams.set(
      'destinations',
      `${destination.latitude},${destination.longitude}`,
    );
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('key', this.apiKey.trim());

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          `Google Maps provider returned HTTP status ${response.status}`,
        );
      }

      const data = (await response.json()) as DistanceMatrixResponse;

      if (data.status === 'OVER_QUERY_LIMIT') {
        throw new AppError(
          429,
          'ROUTING_RATE_LIMITED',
          'Google Maps rate limit exceeded',
        );
      }

      if (data.status === 'REQUEST_DENIED') {
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          'Google Maps request was denied by provider',
        );
      }

      if (data.status !== 'OK') {
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          `Google Maps routing query failed with status: ${data.status}`,
        );
      }

      const element = data.rows?.[0]?.elements?.[0];
      if (!element) {
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          'Malformed response from Google Maps Distance Matrix API',
        );
      }

      if (element.status === 'ZERO_RESULTS' || element.status === 'NOT_FOUND') {
        throw new AppError(
          404,
          'ROUTE_NOT_FOUND',
          'No road driving route found between origin and destination coordinates',
        );
      }

      if (element.status !== 'OK' || !element.distance || !element.duration) {
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          `Google Maps element status failed: ${element.status}`,
        );
      }

      return {
        distanceMeters: Math.round(element.distance.value),
        durationSeconds: Math.round(element.duration.value),
      };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'))
      ) {
        throw new AppError(
          504,
          'ROUTING_TIMEOUT',
          `Google Maps routing request timed out after ${this.timeoutMs}ms`,
        );
      }

      if (error instanceof AppError) {
        // Ensure sensitive credentials are redacted even if they somehow got into AppError message
        error.message = redactSensitiveText(error.message, this.apiKey);
        throw error;
      }

      const rawMessage =
        error instanceof Error ? error.message : 'Unknown routing error';
      const sanitized = redactSensitiveText(rawMessage, this.apiKey);

      throw new AppError(
        502,
        'ROUTING_PROVIDER_ERROR',
        `Google Maps routing provider failed: ${sanitized}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
