import type { ErrorRequestHandler, Request } from 'express';
import { ZodError } from 'zod';
import type { Logger } from 'pino';
import { AppError } from '../errors/app-error';
import { errorResponse } from '../utils/response';

function requestId(request: Request): string | undefined {
  return (request as Request & { id?: string }).id;
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, request, response, _next) => {
    const id = requestId(request);

    if (error instanceof AppError) {
      response
        .status(error.statusCode)
        .json(errorResponse(error.code, error.message, id, error.details));
      return;
    }

    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        code: issue.code,
        message: issue.message,
      }));
      response
        .status(400)
        .json(
          errorResponse(
            'VALIDATION_ERROR',
            'Request validation failed',
            id,
            details,
          ),
        );
      return;
    }

    const parserError = error as { type?: string };
    if (parserError?.type === 'entity.too.large') {
      response
        .status(413)
        .json(
          errorResponse('PAYLOAD_TOO_LARGE', 'Request body is too large', id),
        );
      return;
    }
    if (parserError?.type === 'entity.parse.failed') {
      response
        .status(400)
        .json(
          errorResponse(
            'INVALID_JSON',
            'Request body contains invalid JSON',
            id,
          ),
        );
      return;
    }

    logger.error(
      {
        requestId: id,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      },
      'Request failed',
    );
    response
      .status(500)
      .json(
        errorResponse(
          'INTERNAL_SERVER_ERROR',
          'An unexpected error occurred',
          id,
        ),
      );
  };
}
