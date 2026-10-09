export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  requestId?: string;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export function successResponse<T>(
  message: string,
  data: T,
  requestId?: string,
): ApiSuccess<T> {
  return { success: true, message, data, ...(requestId ? { requestId } : {}) };
}

export function errorResponse(
  code: string,
  message: string,
  requestId?: string,
  details?: unknown,
): ApiFailure {
  return {
    success: false,
    error: { code, message, ...(details === undefined ? {} : { details }) },
    ...(requestId ? { requestId } : {}),
  };
}
