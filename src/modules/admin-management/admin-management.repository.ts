import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../errors/app-error';
import { normalizeAdminEmail } from '../auth/auth.service';
import type {
  AdminManagementRepository,
  ManagedAdmin,
  ManagedPermission,
  ManagedRole,
  ProvisioningRepository,
} from './admin-management.types';
import { ADMIN_SYSTEM_PERMISSION } from './admin-management.types';
import { prisma } from '../../lib/prisma';

const managedAdminSelect = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true, isActive: true } },
} satisfies Prisma.AdminUserSelect;

const managedRoleSelect = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  rolePermissions: {
    select: { permission: { select: { key: true } } },
    orderBy: { permission: { key: 'asc' } },
  },
} satisfies Prisma.RoleSelect;

type AdminRow = Prisma.AdminUserGetPayload<{
  select: typeof managedAdminSelect;
}>;
type RoleRow = Prisma.RoleGetPayload<{ select: typeof managedRoleSelect }>;

function mapAdmin(row: AdminRow): ManagedAdmin {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    role: row.role,
  };
}

function mapRole(row: RoleRow): ManagedRole {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    permissions: row.rolePermissions.map(({ permission }) => permission.key),
  };
}

function throwDatabaseConflict(error: unknown, description: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new AppError(
        409,
        'DUPLICATE_RESOURCE',
        `${description} already exists`,
      );
    }
    if (error.code === 'P2025') {
      throw new AppError(404, 'NOT_FOUND', `${description} was not found`);
    }
  }
  throw error;
}

async function countUsableAdmins(
  transaction: Prisma.TransactionClient,
): Promise<number> {
  return transaction.adminUser.count({
    where: {
      isActive: true,
      role: {
        isActive: true,
        rolePermissions: {
          some: { permission: { key: ADMIN_SYSTEM_PERMISSION } },
        },
      },
    },
  });
}

async function replaceRolePermissionSet(
  transaction: Prisma.TransactionClient,
  roleId: string,
  keys: string[],
): Promise<ManagedRole> {
  const role = await transaction.role.findUnique({
    where: { id: roleId },
    include: {
      rolePermissions: {
        include: { permission: { select: { key: true } } },
      },
    },
  });
  if (!role) throw new AppError(404, 'NOT_FOUND', 'Role was not found');
  const permissions = await transaction.permission.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true },
  });
  if (permissions.length !== keys.length) {
    throw new AppError(
      400,
      'UNKNOWN_PERMISSION',
      'One or more permission keys are unknown',
    );
  }

  const currentlyGrantsSystem = role.rolePermissions.some(
    ({ permission }) => permission.key === ADMIN_SYSTEM_PERMISSION,
  );
  const willGrantSystem = keys.includes(ADMIN_SYSTEM_PERMISSION);
  if (role.isActive && currentlyGrantsSystem && !willGrantSystem) {
    const [usable, affected] = await Promise.all([
      countUsableAdmins(transaction),
      transaction.adminUser.count({
        where: { roleId, isActive: true },
      }),
    ]);
    if (usable <= affected) {
      throw new AppError(
        409,
        'LAST_USABLE_ADMIN',
        'Cannot remove the system permission from the last usable administrator',
      );
    }
  }

  await transaction.rolePermission.deleteMany({ where: { roleId } });
  if (permissions.length > 0) {
    await transaction.rolePermission.createMany({
      data: permissions.map(({ id }) => ({ roleId, permissionId: id })),
    });
  }
  const updated = await transaction.role.findUniqueOrThrow({
    where: { id: roleId },
    select: managedRoleSelect,
  });
  return mapRole(updated);
}

export class PrismaAdminManagementRepository
  implements AdminManagementRepository, ProvisioningRepository
{
  constructor(private readonly client: PrismaClient = prisma) {}

  async listAdmins(skip: number, take: number): Promise<ManagedAdmin[]> {
    const rows = await this.client.adminUser.findMany({
      skip,
      take,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: managedAdminSelect,
    });
    return rows.map(mapAdmin);
  }

  countAdmins(): Promise<number> {
    return this.client.adminUser.count();
  }

  async findAdmin(id: string): Promise<ManagedAdmin | null> {
    const row = await this.client.adminUser.findUnique({
      where: { id },
      select: managedAdminSelect,
    });
    return row ? mapAdmin(row) : null;
  }

  async createAdmin(input: {
    email: string;
    name: string;
    passwordHash: string;
    roleId: string;
  }): Promise<ManagedAdmin> {
    try {
      const row = await this.client.$transaction(
        async (transaction) => {
          const role = await transaction.role.findUnique({
            where: { id: input.roleId },
            select: { id: true, isActive: true },
          });
          if (!role || !role.isActive) {
            throw new AppError(
              400,
              'INVALID_ROLE',
              'An active role is required',
            );
          }
          return transaction.adminUser.create({
            data: {
              email: normalizeAdminEmail(input.email),
              name: input.name.trim(),
              passwordHash: input.passwordHash,
              roleId: input.roleId,
              isActive: true,
            },
            select: managedAdminSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return mapAdmin(row);
    } catch (error) {
      throwDatabaseConflict(error, 'Admin email');
    }
  }

  async updateAdmin(
    id: string,
    input: { email?: string; name?: string; roleId?: string },
  ): Promise<ManagedAdmin> {
    try {
      const row = await this.client.$transaction(
        async (transaction) => {
          const current = await transaction.adminUser.findUnique({
            where: { id },
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: { permission: { select: { key: true } } },
                  },
                },
              },
            },
          });
          if (!current)
            throw new AppError(404, 'NOT_FOUND', 'Admin was not found');

          if (input.roleId) {
            const nextRole = await transaction.role.findUnique({
              where: { id: input.roleId },
              select: {
                id: true,
                isActive: true,
                rolePermissions: {
                  select: { permission: { select: { key: true } } },
                },
              },
            });
            if (!nextRole?.isActive) {
              throw new AppError(
                400,
                'INVALID_ROLE',
                'An active role is required',
              );
            }

            const currentlyUsable =
              current.isActive &&
              current.role.isActive &&
              current.role.rolePermissions.some(
                ({ permission }) => permission.key === ADMIN_SYSTEM_PERMISSION,
              );
            const remainsUsable = nextRole.rolePermissions.some(
              ({ permission }) => permission.key === ADMIN_SYSTEM_PERMISSION,
            );
            if (
              currentlyUsable &&
              !remainsUsable &&
              (await countUsableAdmins(transaction)) <= 1
            ) {
              throw new AppError(
                409,
                'LAST_USABLE_ADMIN',
                'Cannot remove the last usable administrator',
              );
            }
          }

          return transaction.adminUser.update({
            where: { id },
            data: {
              ...(input.email !== undefined
                ? { email: normalizeAdminEmail(input.email) }
                : {}),
              ...(input.name !== undefined ? { name: input.name.trim() } : {}),
              ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
            },
            select: managedAdminSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return mapAdmin(row);
    } catch (error) {
      throwDatabaseConflict(error, 'Admin');
    }
  }

  async setAdminActive(id: string, isActive: boolean): Promise<ManagedAdmin> {
    try {
      const row = await this.client.$transaction(
        async (transaction) => {
          const current = await transaction.adminUser.findUnique({
            where: { id },
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: { permission: { select: { key: true } } },
                  },
                },
              },
            },
          });
          if (!current)
            throw new AppError(404, 'NOT_FOUND', 'Admin was not found');
          if (isActive && !current.role.isActive) {
            throw new AppError(
              400,
              'INVALID_ROLE',
              'Cannot activate an admin while the assigned role is inactive',
            );
          }
          const isUsable =
            current.isActive &&
            current.role.isActive &&
            current.role.rolePermissions.some(
              ({ permission }) => permission.key === ADMIN_SYSTEM_PERMISSION,
            );
          if (
            !isActive &&
            isUsable &&
            (await countUsableAdmins(transaction)) <= 1
          ) {
            throw new AppError(
              409,
              'LAST_USABLE_ADMIN',
              'Cannot deactivate the last usable administrator',
            );
          }
          return transaction.adminUser.update({
            where: { id },
            data: { isActive },
            select: managedAdminSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return mapAdmin(row);
    } catch (error) {
      throwDatabaseConflict(error, 'Admin');
    }
  }

  async setAdminPassword(id: string, passwordHash: string): Promise<void> {
    try {
      await this.client.adminUser.update({
        where: { id },
        data: { passwordHash },
        select: { id: true },
      });
    } catch (error) {
      throwDatabaseConflict(error, 'Admin');
    }
  }

  async listRoles(): Promise<ManagedRole[]> {
    const rows = await this.client.role.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: managedRoleSelect,
    });
    return rows.map(mapRole);
  }

  async findRole(id: string): Promise<ManagedRole | null> {
    const row = await this.client.role.findUnique({
      where: { id },
      select: managedRoleSelect,
    });
    return row ? mapRole(row) : null;
  }

  async createRole(input: {
    name: string;
    description?: string;
    isActive: boolean;
  }): Promise<ManagedRole> {
    try {
      const row = await this.client.role.create({
        data: {
          name: input.name.trim(),
          description: input.description?.trim(),
          isActive: input.isActive,
        },
        select: managedRoleSelect,
      });
      return mapRole(row);
    } catch (error) {
      throwDatabaseConflict(error, 'Role name');
    }
  }

  async updateRole(
    id: string,
    input: { name?: string; description?: string | null; isActive?: boolean },
  ): Promise<ManagedRole> {
    try {
      const row = await this.client.$transaction(
        async (transaction) => {
          const current = await transaction.role.findUnique({
            where: { id },
            include: {
              rolePermissions: {
                include: { permission: { select: { key: true } } },
              },
            },
          });
          if (!current)
            throw new AppError(404, 'NOT_FOUND', 'Role was not found');
          if (input.isActive === false && current.isActive) {
            const grantsSystem = current.rolePermissions.some(
              ({ permission }) => permission.key === ADMIN_SYSTEM_PERMISSION,
            );
            if (grantsSystem) {
              const [usable, affected] = await Promise.all([
                countUsableAdmins(transaction),
                transaction.adminUser.count({
                  where: { roleId: id, isActive: true },
                }),
              ]);
              if (usable <= affected) {
                throw new AppError(
                  409,
                  'LAST_USABLE_ADMIN',
                  'Cannot deactivate the role used by the last usable administrator',
                );
              }
            }
          }
          return transaction.role.update({
            where: { id },
            data: {
              ...(input.name !== undefined ? { name: input.name.trim() } : {}),
              ...(input.description !== undefined
                ? { description: input.description?.trim() || null }
                : {}),
              ...(input.isActive !== undefined
                ? { isActive: input.isActive }
                : {}),
            },
            select: managedRoleSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return mapRole(row);
    } catch (error) {
      throwDatabaseConflict(error, 'Role name');
    }
  }

  async listPermissions(): Promise<ManagedPermission[]> {
    return this.client.permission.findMany({
      orderBy: { key: 'asc' },
      select: { id: true, key: true, description: true },
    });
  }

  async replaceRolePermissions(
    roleId: string,
    keys: string[],
  ): Promise<ManagedRole> {
    return this.client.$transaction(
      (transaction) => replaceRolePermissionSet(transaction, roleId, keys),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async removeRolePermission(
    roleId: string,
    key: string,
  ): Promise<ManagedRole> {
    return this.client.$transaction(
      async (transaction) => {
        const role = await transaction.role.findUnique({
          where: { id: roleId },
          include: {
            rolePermissions: {
              include: { permission: { select: { key: true } } },
            },
          },
        });
        if (!role) throw new AppError(404, 'NOT_FOUND', 'Role was not found');
        const nextKeys = role.rolePermissions
          .map(({ permission }) => permission.key)
          .filter((permissionKey) => permissionKey !== key);
        if (nextKeys.length === role.rolePermissions.length) {
          throw new AppError(404, 'NOT_FOUND', 'Role permission was not found');
        }
        return replaceRolePermissionSet(transaction, roleId, nextKeys);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async provisionInitialAdmin(input: {
    email: string;
    name: string;
    passwordHash: string;
    roleName: string;
    permissionKeys: readonly string[];
  }): Promise<void> {
    try {
      await this.client.$transaction(
        async (transaction) => {
          const [adminCount, role, existingPermissions, assignmentCount] =
            await Promise.all([
              transaction.adminUser.count(),
              transaction.role.findUnique({
                where: { name: input.roleName },
                select: { id: true },
              }),
              transaction.permission.findMany({
                where: { key: { in: [...input.permissionKeys] } },
                select: { id: true },
              }),
              transaction.rolePermission.count(),
            ]);
          if (
            adminCount > 0 ||
            role ||
            existingPermissions.length > 0 ||
            assignmentCount > 0
          ) {
            throw new AppError(
              409,
              'PROVISIONING_STATE_NOT_EMPTY',
              'Initial provisioning state is not empty; inspect and reconcile existing records manually',
            );
          }

          const createdRole = await transaction.role.create({
            data: {
              name: input.roleName,
              description: 'Initial system administrator role',
              isSystem: true,
              isActive: true,
            },
            select: { id: true },
          });
          await transaction.permission.createMany({
            data: input.permissionKeys.map((key) => ({ key })),
          });
          const permissions = await transaction.permission.findMany({
            where: { key: { in: [...input.permissionKeys] } },
            select: { id: true },
          });
          await transaction.rolePermission.createMany({
            data: permissions.map(({ id }) => ({
              roleId: createdRole.id,
              permissionId: id,
            })),
          });
          await transaction.adminUser.create({
            data: {
              email: normalizeAdminEmail(input.email),
              name: input.name.trim(),
              passwordHash: input.passwordHash,
              roleId: createdRole.id,
              isActive: true,
            },
            select: { id: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throwDatabaseConflict(error, 'Initial admin provisioning record');
    }
  }
}
