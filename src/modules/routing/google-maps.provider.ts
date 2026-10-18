import { AppError } from '../../errors/app-error';
import {
  type Coordinates,
  type GeocodingProvider,
  type RouteResult,
  type RoutingProvider,
  redactSensitiveText,
} from './routing.types';

interface RouteMatrixElement {
  originIndex?: number;
  destinationIndex?: number;
  status?: {
    code?: number;
    message?: string;
    details?: unknown[];
  };
  condition?:
    | 'ROUTE_EXISTS'
    | 'ROUTE_NOT_FOUND'
    | 'ROUTE_MATRIX_ELEMENT_CONDITION_UNSPECIFIED'
    | string;
  distanceMeters?: number;
  duration?: string;
}

export class GoogleMapsRoutingProvider implements RoutingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number = 5000,
    private readonly baseUrl: string = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
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
    const payload = {
      origins: [
        {
          waypoint: {
            location: {
              latLng: {
                latitude: origin.latitude,
                longitude: origin.longitude,
              },
            },
          },
        },
      ],
      destinations: [
        {
          waypoint: {
            location: {
              latLng: {
                latitude: destination.latitude,
                longitude: destination.longitude,
              },
            },
          },
        },
      ],
      travelMode: 'DRIVE',
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Goog-Api-Key': this.apiKey.trim(),
          'X-Goog-FieldMask':
            'originIndex,destinationIndex,status,condition,distanceMeters,duration',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new AppError(
            429,
            'ROUTING_RATE_LIMITED',
            'Google Maps rate limit exceeded',
          );
        }
        if (response.status === 403) {
          throw new AppError(
            502,
            'ROUTING_PROVIDER_ERROR',
            'Google Maps request was denied by provider',
          );
        }
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          `Google Maps provider returned HTTP status ${response.status}`,
        );
      }

      const rawData = (await response.json()) as unknown;

      let elements: RouteMatrixElement[];
      if (Array.isArray(rawData)) {
        elements = rawData as RouteMatrixElement[];
      } else if (
        rawData &&
        typeof rawData === 'object' &&
        'originIndex' in rawData
      ) {
        elements = [rawData as RouteMatrixElement];
      } else {
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          'Malformed response from Google Routes API',
        );
      }

      const element =
        elements.find(
          (el) =>
            (el.originIndex === undefined || el.originIndex === 0) &&
            (el.destinationIndex === undefined || el.destinationIndex === 0),
        ) ?? elements[0];

      if (!element) {
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          'Malformed response from Google Routes API',
        );
      }

      // Check gRPC / RPC status object inside the element if present
      if (
        element.status &&
        element.status.code !== undefined &&
        element.status.code !== 0
      ) {
        const statusCode = element.status.code;
        const statusMessage = element.status.message ?? '';

        if (statusCode === 5 || statusMessage.includes('NOT_FOUND')) {
          throw new AppError(
            404,
            'ROUTE_NOT_FOUND',
            'No road driving route found between origin and destination coordinates',
          );
        }

        if (statusCode === 8 || statusMessage.includes('RESOURCE_EXHAUSTED')) {
          throw new AppError(
            429,
            'ROUTING_RATE_LIMITED',
            'Google Maps rate limit exceeded',
          );
        }

        if (statusCode === 7 || statusMessage.includes('PERMISSION_DENIED')) {
          throw new AppError(
            502,
            'ROUTING_PROVIDER_ERROR',
            'Google Maps request was denied by provider',
          );
        }

        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          `Google Maps routing query failed with status: ${statusMessage || statusCode}`,
        );
      }

      if (element.condition === 'ROUTE_NOT_FOUND') {
        throw new AppError(
          404,
          'ROUTE_NOT_FOUND',
          'No road driving route found between origin and destination coordinates',
        );
      }

      if (
        element.distanceMeters === undefined ||
        element.distanceMeters === null ||
        typeof element.duration !== 'string' ||
        !element.duration.endsWith('s')
      ) {
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          'Malformed response from Google Routes API: missing distance or duration',
        );
      }

      const durationSecondsMatch = /^([\d.]+)s$/.exec(element.duration.trim());
      const rawSeconds = durationSecondsMatch?.[1];
      if (!durationSecondsMatch || !rawSeconds) {
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          'Malformed duration format from Google Routes API',
        );
      }

      const durationSeconds = Number.parseFloat(rawSeconds);
      if (
        !Number.isFinite(durationSeconds) ||
        !Number.isFinite(element.distanceMeters)
      ) {
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          'Malformed numeric distance or duration from Google Routes API',
        );
      }

      return {
        distanceMeters: Math.round(element.distanceMeters),
        durationSeconds: Math.round(durationSeconds),
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

interface GeocodingResult {
  formatted_address: string;
}

interface GeocodingResponse {
  status: string;
  error_message?: string;
  results?: GeocodingResult[];
}

export class GoogleMapsGeocodingProvider implements GeocodingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number = 5000,
    private readonly baseUrl: string = 'https://maps.googleapis.com/maps/api/geocode/json',
  ) {
    if (!apiKey || !apiKey.trim()) {
      throw new AppError(
        500,
        'ROUTING_CONFIG_ERROR',
        'Google Maps API key is required to initialize GoogleMapsGeocodingProvider',
      );
    }
  }

  async reverseGeocode(coordinates: Coordinates): Promise<string> {
    const url = new URL(this.baseUrl);
    url.searchParams.set(
      'latlng',
      `${coordinates.latitude},${coordinates.longitude}`,
    );
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
          `Google Maps geocoding provider returned HTTP status ${response.status}`,
        );
      }

      const data = (await response.json()) as GeocodingResponse;

      if (data.status === 'OVER_QUERY_LIMIT') {
        throw new AppError(
          429,
          'ROUTING_RATE_LIMITED',
          'Google Maps rate limit exceeded during geocoding',
        );
      }

      if (data.status === 'REQUEST_DENIED') {
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          'Google Maps geocoding request was denied by provider',
        );
      }

      if (data.status === 'ZERO_RESULTS') {
        throw new AppError(
          404,
          'GEOCODING_FAILED',
          'No formatted address found for the provided coordinates',
        );
      }

      if (data.status !== 'OK') {
        throw new AppError(
          502,
          'ROUTING_PROVIDER_ERROR',
          `Google Maps geocoding failed with status: ${data.status}`,
        );
      }

      const formatted = data.results?.[0]?.formatted_address;
      if (!formatted || !formatted.trim()) {
        throw new AppError(
          404,
          'GEOCODING_FAILED',
          'No formatted address found for the provided coordinates',
        );
      }

      return formatted.trim();
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'))
      ) {
        throw new AppError(
          504,
          'GEOCODING_TIMEOUT',
          `Google Maps geocoding request timed out after ${this.timeoutMs}ms`,
        );
      }

      if (error instanceof AppError) {
        error.message = redactSensitiveText(error.message, this.apiKey);
        throw error;
      }

      const rawMessage =
        error instanceof Error ? error.message : 'Unknown geocoding error';
      const sanitized = redactSensitiveText(rawMessage, this.apiKey);

      throw new AppError(
        502,
        'ROUTING_PROVIDER_ERROR',
        `Google Maps geocoding provider failed: ${sanitized}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
