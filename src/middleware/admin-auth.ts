import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error';
import type { AdminAuthService } from '../modules/auth/auth.service';
import { ADMIN_SYSTEM_PERMISSION } from '../modules/admin-management/admin-management.types';

const permissionKeySchema = z.string().trim().min(1).max(120);

export function createAdminAuthenticationMiddleware(
  authService: AdminAuthService,
): RequestHandler {
  return (request, _response, next) => {
    const authorization = request.header('authorization');
    const match = authorization?.match(/^Bearer ([A-Za-z0-9._~-]+)$/i);
    if (!match) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required'));
      return;
    }
    const token = match[1];
    if (!token) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required'));
      return;
    }

    void authService
      .authenticate(token)
      .then((profile) => {
        request.adminProfile = profile;
        next();
      })
      .catch(next);
  };
}

export function requireAdminPermission(permissionKey: string): RequestHandler {
  const parsed = permissionKeySchema.safeParse(permissionKey);
  if (!parsed.success) {
    throw new Error(
      'Permission key must be a nonblank value of at most 120 characters',
    );
  }

  const requiredPermission = parsed.data;
  return (request, _response, next) => {
    if (!request.adminProfile) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required'));
      return;
    }
    if (
      !request.adminProfile.permissions.includes(requiredPermission) &&
      !request.adminProfile.permissions.includes(ADMIN_SYSTEM_PERMISSION)
    ) {
      next(new AppError(403, 'FORBIDDEN', 'Permission denied'));
      return;
    }
    next();
  };
}
