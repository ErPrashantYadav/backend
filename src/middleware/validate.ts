import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error';

export function validateBody<TSchema extends z.ZodType>(
  schema: TSchema,
): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        code: issue.code,
        message: issue.message,
      }));
      next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          'Request validation failed',
          details,
        ),
      );
      return;
    }

    request.body = result.data;
    next();
  };
}
