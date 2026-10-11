import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AdminAuthService } from '../auth/auth.service';
import {
  createAdminAuthenticationMiddleware,
  requireAdminPermission,
} from '../../middleware/admin-auth';
import { validateBody } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import { PrismaAdminManagementRepository } from './admin-management.repository';
import { AdminManagementService } from './admin-management.service';
import type { AdminManagementRepository } from './admin-management.types';

const createAdminSchema = z
  .object({
    email: z.string().trim().email().max(254),
    name: z.string().trim().min(1).max(120),
    password: z.string().min(16).max(1024),
    roleId: z.string().uuid(),
  })
  .strict();

const updateAdminSchema = z
  .object({
    email: z.string().trim().email().max(254).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    roleId: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    'At least one field is required',
  );

const adminStatusSchema = z.object({ isActive: z.boolean() }).strict();
const adminPasswordSchema = z
  .object({ password: z.string().min(16).max(1024) })
  .strict();

const createRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).optional(),
    isActive: z.boolean(),
  })
  .strict();

const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (body) => Object.keys(body).length > 0,
    'At least one field is required',
  );

const rolePermissionsSchema = z
  .object({
    permissionKeys: z
      .array(z.string().trim().min(1).max(120))
      .max(200)
      .refine(
        (keys) => new Set(keys).size === keys.length,
        'Permission keys must be unique',
      ),
  })
  .strict();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function asyncHandler(
  handler: (
    request: Parameters<RequestHandler>[0],
    response: Parameters<RequestHandler>[1],
  ) => Promise<void>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response).catch(next);
  };
}

export function createAdminManagementRouter(
  authService: AdminAuthService,
  repository: AdminManagementRepository = new PrismaAdminManagementRepository(),
): Router {
  const router = Router();
  const service = new AdminManagementService(repository);

  router.use(createAdminAuthenticationMiddleware(authService));

  router.get(
    '/users',
    requireAdminPermission('admin.users.read'),
    asyncHandler(async (request, response) => {
      const query = paginationSchema.parse(request.query);
      const result = await service.listAdmins(query.page, query.pageSize);
      response.status(200).json(successResponse('Admins fetched', result));
    }),
  );
  router.post(
    '/users',
    requireAdminPermission('admin.users.create'),
    validateBody(createAdminSchema),
    asyncHandler(async (request, response) => {
      const admin = await service.createAdmin(request.body);
      response.status(201).json(successResponse('Admin created', admin));
    }),
  );
  router.get(
    '/users/:id',
    requireAdminPermission('admin.users.read'),
    asyncHandler(async (request, response) => {
      const admin = await service.getAdmin(
        z.string().uuid().parse(request.params.id),
      );
      response.status(200).json(successResponse('Admin fetched', admin));
    }),
  );
  router.patch(
    '/users/:id',
    requireAdminPermission('admin.users.update'),
    validateBody(updateAdminSchema),
    asyncHandler(async (request, response) => {
      const admin = await service.updateAdmin(
        z.string().uuid().parse(request.params.id),
        request.body,
      );
      response.status(200).json(successResponse('Admin updated', admin));
    }),
  );
  router.patch(
    '/users/:id/status',
    requireAdminPermission('admin.users.status'),
    validateBody(adminStatusSchema),
    asyncHandler(async (request, response) => {
      const admin = await service.setAdminActive(
        z.string().uuid().parse(request.params.id),
        request.body.isActive,
        request.adminProfile!,
      );
      response.status(200).json(successResponse('Admin status updated', admin));
    }),
  );
  router.patch(
    '/users/:id/password',
    requireAdminPermission('admin.users.password'),
    validateBody(adminPasswordSchema),
    asyncHandler(async (request, response) => {
      await service.setAdminPassword(
        z.string().uuid().parse(request.params.id),
        request.body.password,
      );
      response
        .status(200)
        .json(
          successResponse('Admin password updated', { id: request.params.id }),
        );
    }),
  );

  router.get(
    '/roles',
    requireAdminPermission('admin.roles.read'),
    asyncHandler(async (_request, response) => {
      response
        .status(200)
        .json(successResponse('Roles fetched', await service.listRoles()));
    }),
  );
  router.get(
    '/permissions',
    requireAdminPermission('admin.roles.read'),
    asyncHandler(async (_request, response) => {
      response
        .status(200)
        .json(
          successResponse(
            'Permissions fetched',
            await service.listPermissions(),
          ),
        );
    }),
  );
  router.get(
    '/roles/:id',
    requireAdminPermission('admin.roles.read'),
    asyncHandler(async (request, response) => {
      const role = await service.getRole(
        z.string().uuid().parse(request.params.id),
      );
      response.status(200).json(successResponse('Role fetched', role));
    }),
  );
  router.post(
    '/roles',
    requireAdminPermission('admin.roles.create'),
    validateBody(createRoleSchema),
    asyncHandler(async (request, response) => {
      const role = await service.createRole(request.body);
      response.status(201).json(successResponse('Role created', role));
    }),
  );
  router.patch(
    '/roles/:id',
    requireAdminPermission('admin.roles.update'),
    validateBody(updateRoleSchema),
    asyncHandler(async (request, response) => {
      const role = await service.updateRole(
        z.string().uuid().parse(request.params.id),
        request.body,
      );
      response.status(200).json(successResponse('Role updated', role));
    }),
  );
  router.put(
    '/roles/:id/permissions',
    requireAdminPermission('admin.roles.permissions'),
    validateBody(rolePermissionsSchema),
    asyncHandler(async (request, response) => {
      const role = await service.replaceRolePermissions(
        z.string().uuid().parse(request.params.id),
        request.body.permissionKeys,
      );
      response
        .status(200)
        .json(successResponse('Role permissions updated', role));
    }),
  );
  router.delete(
    '/roles/:id/permissions/:permissionKey',
    requireAdminPermission('admin.roles.permissions'),
    asyncHandler(async (request, response) => {
      const permissionKey = z
        .string()
        .min(1)
        .max(120)
        .parse(request.params.permissionKey);
      const role = await service.removeRolePermission(
        z.string().uuid().parse(request.params.id),
        permissionKey,
      );
      response
        .status(200)
        .json(successResponse('Role permission removed', role));
    }),
  );

  return router;
}
