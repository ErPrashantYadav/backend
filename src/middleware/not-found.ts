import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new AppError(
      404,
      'NOT_FOUND',
      `Route ${request.method} ${request.path} was not found`,
    ),
  );
};
