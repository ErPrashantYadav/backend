export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
}

export interface RoutingProvider {
  getRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult>;
}

export interface GeocodingProvider {
  reverseGeocode(coordinates: Coordinates): Promise<string>;
}

export interface GeographicBounds {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

/**
 * Redacts API keys and sensitive tokens from URLs or query strings
 * to prevent leaking secrets in logs, exceptions, or error payloads.
 */
export function redactSensitiveUrl(rawUrl: string): string {
  let sanitized = rawUrl;
  try {
    const parsed = new URL(rawUrl);
    for (const param of [
      'key',
      'apiKey',
      'token',
      'apiToken',
      'pass',
      'password',
      'secret',
    ]) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    }
    sanitized = parsed.toString();
  } catch {
    // Not a valid URL, fallback to regex
  }
  return sanitized
    .replace(/(^|[?&]|\b)(key=)[^\s&,;"]+/gi, '$1$2[REDACTED]')
    .replace(/(^|[?&]|\b)(apiKey=)[^\s&,;"]+/gi, '$1$2[REDACTED]')
    .replace(/(^|[?&]|\b)(token=)[^\s&,;"]+/gi, '$1$2[REDACTED]')
    .replace(/(^|[?&]|\b)(apiToken=)[^\s&,;"]+/gi, '$1$2[REDACTED]')
    .replace(/(^|[?&]|\b)(pass=)[^\s&,;"]+/gi, '$1$2[REDACTED]')
    .replace(/(^|[?&]|\b)(password=)[^\s&,;"]+/gi, '$1$2[REDACTED]')
    .replace(/(^|[?&]|\b)(secret=)[^\s&,;"]+/gi, '$1$2[REDACTED]')
    .replace(/(\bBearer\s+)[^\s&,;"]+/gi, '$1[REDACTED]');
}

/**
 * Redacts any occurrence of a secret string from text or error messages.
 */
export function redactSensitiveText(
  text: string,
  sensitiveSecret?: string,
): string {
  let sanitized = redactSensitiveUrl(text);
  if (sensitiveSecret && sensitiveSecret.trim().length > 3) {
    sanitized = sanitized.replaceAll(sensitiveSecret.trim(), '[REDACTED]');
  }
  return sanitized;
}
