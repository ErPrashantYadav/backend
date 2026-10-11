import argon2 from 'argon2';
import { AppError } from '../../errors/app-error';
import { ARGON_OPTIONS, normalizeAdminEmail } from '../auth/auth.service';
import type { AdminProfile } from '../auth/auth.types';
import type { AdminManagementRepository } from './admin-management.types';

export class AdminManagementService {
  constructor(private readonly repository: AdminManagementRepository) {}

  async listAdmins(page: number, pageSize: number) {
    const [total, admins] = await Promise.all([
      this.repository.countAdmins(),
      this.repository.listAdmins((page - 1) * pageSize, pageSize),
    ]);
    return {
      admins,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getAdmin(id: string) {
    const admin = await this.repository.findAdmin(id);
    if (!admin) throw new AppError(404, 'NOT_FOUND', 'Admin was not found');
    return admin;
  }

  async createAdmin(input: {
    email: string;
    name: string;
    password: string;
    roleId: string;
  }) {
    const passwordHash = await argon2.hash(input.password, ARGON_OPTIONS);
    return this.repository.createAdmin({
      email: normalizeAdminEmail(input.email),
      name: input.name.trim(),
      passwordHash,
      roleId: input.roleId,
    });
  }

  async updateAdmin(
    id: string,
    input: { email?: string; name?: string; roleId?: string },
  ) {
    return this.repository.updateAdmin(id, {
      ...(input.email !== undefined
        ? { email: normalizeAdminEmail(input.email) }
        : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
    });
  }

  async setAdminActive(id: string, isActive: boolean, actor: AdminProfile) {
    if (!isActive && id === actor.id) {
      throw new AppError(
        409,
        'SELF_DEACTIVATION_FORBIDDEN',
        'You cannot deactivate your own account',
      );
    }
    return this.repository.setAdminActive(id, isActive);
  }

  async setAdminPassword(id: string, password: string): Promise<void> {
    const passwordHash = await argon2.hash(password, ARGON_OPTIONS);
    await this.repository.setAdminPassword(id, passwordHash);
  }

  listRoles() {
    return this.repository.listRoles();
  }

  async getRole(id: string) {
    const role = await this.repository.findRole(id);
    if (!role) throw new AppError(404, 'NOT_FOUND', 'Role was not found');
    return role;
  }

  createRole(input: { name: string; description?: string; isActive: boolean }) {
    return this.repository.createRole({
      ...input,
      name: input.name.trim(),
      ...(input.description !== undefined
        ? { description: input.description.trim() }
        : {}),
    });
  }

  updateRole(
    id: string,
    input: { name?: string; description?: string | null; isActive?: boolean },
  ) {
    return this.repository.updateRole(id, {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
    });
  }

  listPermissions() {
    return this.repository.listPermissions();
  }

  replaceRolePermissions(roleId: string, keys: string[]) {
    return this.repository.replaceRolePermissions(roleId, [...new Set(keys)]);
  }

  removeRolePermission(roleId: string, key: string) {
    return this.repository.removeRolePermission(roleId, key);
  }
}
