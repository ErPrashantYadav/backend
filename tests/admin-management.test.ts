import argon2 from 'argon2';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors/app-error';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type {
  AdminAuthRecord,
  AdminAuthRepository,
} from '../src/modules/auth/auth.types';
import {
  ADMIN_PERMISSION_KEYS,
  ADMIN_SYSTEM_PERMISSION,
} from '../src/modules/admin-management/admin-management.types';
import type {
  AdminManagementRepository,
  ManagedAdmin,
  ManagedPermission,
  ManagedRole,
  ProvisioningRepository,
} from '../src/modules/admin-management/admin-management.types';
import {
  assertExpectedDatabase,
  provisionInitialAdmin,
} from '../src/modules/admin-management/initial-admin-provisioning';
import { testConfig } from './helpers';

const SUPER_ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const STAFF_ID = '00000000-0000-4000-8000-000000000002';
const ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000011';
const STAFF_ROLE_ID = '00000000-0000-4000-8000-000000000012';
const PASSWORD = 'test-only-password-fixture-2026';
const HASH = '$argon2id$test-only-hash';

class MemoryAdminRepository
  implements
    AdminAuthRepository,
    AdminManagementRepository,
    ProvisioningRepository
{
  admins: ManagedAdmin[] = [];
  roles: ManagedRole[] = [];
  permissions: ManagedPermission[] = [];
  hashes = new Map<string, string>();
  provisioningFailure: Error | undefined;

  constructor() {
    this.permissions = ADMIN_PERMISSION_KEYS.map((key, index) => ({
      id: this.id(100 + index),
      key,
      description: null,
    }));
    this.roles = [
      {
        id: ADMIN_ROLE_ID,
        name: 'Super Admin',
        description: null,
        isSystem: true,
        isActive: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        permissions: this.permissions.map(({ key }) => key),
      },
      {
        id: STAFF_ROLE_ID,
        name: 'Staff',
        description: null,
        isSystem: false,
        isActive: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        permissions: ['admin.users.read', 'admin.roles.read'],
      },
    ];
    this.addAdmin({
      id: SUPER_ADMIN_ID,
      email: 'owner@example.test',
      name: 'Owner',
      roleId: ADMIN_ROLE_ID,
      passwordHash: HASH,
    });
    this.addAdmin({
      id: STAFF_ID,
      email: 'staff@example.test',
      name: 'Staff',
      roleId: STAFF_ROLE_ID,
      passwordHash: HASH,
    });
  }

  private id(seed: number): string {
    return `00000000-0000-4000-8000-${seed.toString().padStart(12, '0')}`;
  }

  private role(roleId: string): ManagedRole {
    const role = this.roles.find((candidate) => candidate.id === roleId);
    if (!role) throw new AppError(404, 'NOT_FOUND', 'Role was not found');
    return role;
  }

  private isUsable(admin: ManagedAdmin): boolean {
    return (
      admin.isActive &&
      this.role(admin.role.id).isActive &&
      this.role(admin.role.id).permissions.includes(ADMIN_SYSTEM_PERMISSION)
    );
  }

  private assertNotLastUsable(admin: ManagedAdmin): void {
    if (
      this.isUsable(admin) &&
      this.admins.filter((candidate) => this.isUsable(candidate)).length <= 1
    ) {
      throw new AppError(
        409,
        'LAST_USABLE_ADMIN',
        'Cannot remove the last usable administrator',
      );
    }
  }

  private addAdmin(input: {
    id: string;
    email: string;
    name: string;
    roleId: string;
    passwordHash: string;
    isActive?: boolean;
  }): ManagedAdmin {
    const role = this.role(input.roleId);
    const now = new Date();
    const admin: ManagedAdmin = {
      id: input.id,
      email: input.email,
      name: input.name,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      role: { id: role.id, name: role.name, isActive: role.isActive },
    };
    this.admins.push(admin);
    this.hashes.set(admin.id, input.passwordHash);
    return admin;
  }

  private authRecord(admin: ManagedAdmin): AdminAuthRecord {
    const role = this.role(admin.role.id);
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      passwordHash: this.hashes.get(admin.id) ?? HASH,
      isActive: admin.isActive,
      role: {
        id: role.id,
        name: role.name,
        isActive: role.isActive,
        permissions: [...role.permissions],
      },
    };
  }

  async findByEmail(email: string): Promise<AdminAuthRecord | null> {
    const admin = this.admins.find((candidate) => candidate.email === email);
    return admin ? this.authRecord(admin) : null;
  }

  async findById(id: string): Promise<AdminAuthRecord | null> {
    const admin = this.admins.find((candidate) => candidate.id === id);
    return admin ? this.authRecord(admin) : null;
  }

  async listAdmins(skip: number, take: number): Promise<ManagedAdmin[]> {
    return this.admins
      .slice(skip, skip + take)
      .map((admin) => ({ ...admin, role: { ...admin.role } }));
  }

  async countAdmins(): Promise<number> {
    return this.admins.length;
  }

  async findAdmin(id: string): Promise<ManagedAdmin | null> {
    const admin = this.admins.find((candidate) => candidate.id === id);
    return admin ? { ...admin, role: { ...admin.role } } : null;
  }

  async createAdmin(input: {
    email: string;
    name: string;
    passwordHash: string;
    roleId: string;
  }): Promise<ManagedAdmin> {
    if (this.admins.some((admin) => admin.email === input.email)) {
      throw new AppError(
        409,
        'DUPLICATE_RESOURCE',
        'Admin email already exists',
      );
    }
    const role = this.role(input.roleId);
    if (!role.isActive)
      throw new AppError(400, 'INVALID_ROLE', 'An active role is required');
    return this.addAdmin({ ...input, id: this.id(200 + this.admins.length) });
  }

  async updateAdmin(
    id: string,
    input: { email?: string; name?: string; roleId?: string },
  ): Promise<ManagedAdmin> {
    const admin = this.admins.find((candidate) => candidate.id === id);
    if (!admin) throw new AppError(404, 'NOT_FOUND', 'Admin was not found');
    if (
      input.email &&
      this.admins.some(
        (candidate) => candidate.id !== id && candidate.email === input.email,
      )
    ) {
      throw new AppError(
        409,
        'DUPLICATE_RESOURCE',
        'Admin email already exists',
      );
    }
    if (input.roleId) {
      const role = this.role(input.roleId);
      if (!role.isActive)
        throw new AppError(400, 'INVALID_ROLE', 'An active role is required');
      if (
        this.isUsable(admin) &&
        !role.permissions.includes(ADMIN_SYSTEM_PERMISSION)
      ) {
        this.assertNotLastUsable(admin);
      }
      admin.role = { id: role.id, name: role.name, isActive: role.isActive };
    }
    if (input.email !== undefined) admin.email = input.email;
    if (input.name !== undefined) admin.name = input.name;
    admin.updatedAt = new Date();
    return { ...admin, role: { ...admin.role } };
  }

  async setAdminActive(id: string, isActive: boolean): Promise<ManagedAdmin> {
    const admin = this.admins.find((candidate) => candidate.id === id);
    if (!admin) throw new AppError(404, 'NOT_FOUND', 'Admin was not found');
    if (isActive && !this.role(admin.role.id).isActive) {
      throw new AppError(
        400,
        'INVALID_ROLE',
        'Cannot activate an admin with an inactive role',
      );
    }
    if (!isActive) this.assertNotLastUsable(admin);
    admin.isActive = isActive;
    admin.updatedAt = new Date();
    return { ...admin, role: { ...admin.role } };
  }

  async setAdminPassword(id: string, passwordHash: string): Promise<void> {
    if (!this.admins.some((admin) => admin.id === id)) {
      throw new AppError(404, 'NOT_FOUND', 'Admin was not found');
    }
    this.hashes.set(id, passwordHash);
  }

  async listRoles(): Promise<ManagedRole[]> {
    return this.roles.map((role) => ({
      ...role,
      permissions: [...role.permissions],
    }));
  }

  async findRole(id: string): Promise<ManagedRole | null> {
    const role = this.roles.find((candidate) => candidate.id === id);
    return role ? { ...role, permissions: [...role.permissions] } : null;
  }

  async createRole(input: {
    name: string;
    description?: string;
    isActive: boolean;
  }): Promise<ManagedRole> {
    if (this.roles.some((role) => role.name === input.name)) {
      throw new AppError(409, 'DUPLICATE_RESOURCE', 'Role name already exists');
    }
    const now = new Date();
    const role: ManagedRole = {
      id: this.id(300 + this.roles.length),
      name: input.name,
      description: input.description ?? null,
      isSystem: false,
      isActive: input.isActive,
      createdAt: now,
      updatedAt: now,
      permissions: [],
    };
    this.roles.push(role);
    return { ...role, permissions: [] };
  }

  async updateRole(
    id: string,
    input: { name?: string; description?: string | null; isActive?: boolean },
  ): Promise<ManagedRole> {
    const role = this.role(id);
    if (
      input.name &&
      this.roles.some(
        (candidate) => candidate.id !== id && candidate.name === input.name,
      )
    ) {
      throw new AppError(409, 'DUPLICATE_RESOURCE', 'Role name already exists');
    }
    if (
      input.isActive === false &&
      role.isActive &&
      role.permissions.includes(ADMIN_SYSTEM_PERMISSION)
    ) {
      const affected = this.admins.filter(
        (admin) => admin.role.id === id && admin.isActive,
      ).length;
      if (
        this.admins.filter((admin) => this.isUsable(admin)).length <= affected
      ) {
        throw new AppError(
          409,
          'LAST_USABLE_ADMIN',
          'Cannot deactivate last usable admin role',
        );
      }
    }
    if (input.name !== undefined) role.name = input.name;
    if (input.description !== undefined) role.description = input.description;
    if (input.isActive !== undefined) role.isActive = input.isActive;
    role.updatedAt = new Date();
    for (const admin of this.admins.filter(
      (candidate) => candidate.role.id === id,
    )) {
      admin.role = { id, name: role.name, isActive: role.isActive };
    }
    return { ...role, permissions: [...role.permissions] };
  }

  async listPermissions(): Promise<ManagedPermission[]> {
    return this.permissions.map((permission) => ({ ...permission }));
  }

  async replaceRolePermissions(
    roleId: string,
    keys: string[],
  ): Promise<ManagedRole> {
    const role = this.role(roleId);
    if (
      keys.some(
        (key) => !this.permissions.some((permission) => permission.key === key),
      )
    ) {
      throw new AppError(
        400,
        'UNKNOWN_PERMISSION',
        'One or more permission keys are unknown',
      );
    }
    if (
      role.isActive &&
      role.permissions.includes(ADMIN_SYSTEM_PERMISSION) &&
      !keys.includes(ADMIN_SYSTEM_PERMISSION)
    ) {
      const affected = this.admins.filter(
        (admin) => admin.role.id === roleId && admin.isActive,
      ).length;
      if (
        this.admins.filter((admin) => this.isUsable(admin)).length <= affected
      ) {
        throw new AppError(
          409,
          'LAST_USABLE_ADMIN',
          'Cannot remove final system administrator permission',
        );
      }
    }
    role.permissions = [...keys];
    return { ...role, permissions: [...role.permissions] };
  }

  async removeRolePermission(
    roleId: string,
    key: string,
  ): Promise<ManagedRole> {
    const role = this.role(roleId);
    if (!role.permissions.includes(key))
      throw new AppError(404, 'NOT_FOUND', 'Role permission was not found');
    return this.replaceRolePermissions(
      roleId,
      role.permissions.filter((permission) => permission !== key),
    );
  }

  async provisionInitialAdmin(input: {
    email: string;
    name: string;
    passwordHash: string;
    roleName: string;
    permissionKeys: readonly string[];
  }): Promise<void> {
    if (
      this.admins.length > 0 ||
      this.roles.some((role) => role.name === input.roleName) ||
      this.permissions.some((permission) =>
        input.permissionKeys.includes(permission.key),
      )
    ) {
      throw new AppError(
        409,
        'PROVISIONING_STATE_NOT_EMPTY',
        'Initial provisioning state is not empty',
      );
    }
    if (this.provisioningFailure) throw this.provisioningFailure;

    const role = await this.createRole({
      name: input.roleName,
      isActive: true,
    });
    for (const key of input.permissionKeys) {
      this.permissions.push({
        id: this.id(500 + this.permissions.length),
        key,
        description: null,
      });
    }
    this.role(role.id).permissions = [...input.permissionKeys];
    await this.createAdmin({
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      roleId: role.id,
    });
  }
}

function createManagementApp(
  repository: MemoryAdminRepository,
  actorId = SUPER_ADMIN_ID,
) {
  const config = testConfig();
  const app = createApp(config, async () => {}, {
    adminAuthRepository: repository,
    adminManagementRepository: repository,
  });
  const token = createAdminAccessToken(config, actorId);
  return { app, token };
}

describe('admin management APIs', () => {
  it('lists paginated admins without password hashes', async () => {
    const repository = new MemoryAdminRepository();
    const { app, token } = createManagementApp(repository);
    const response = await request(app)
      .get('/api/admin/users?page=1&pageSize=1')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.admins).toHaveLength(1);
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    const detail = await request(app)
      .get(`/api/admin/users/${SUPER_ADMIN_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.id).toBe(SUPER_ADMIN_ID);
    expect(JSON.stringify(detail.body)).not.toContain('passwordHash');
  });

  it('creates admins with Argon2id hashes and returns only safe fields', async () => {
    const repository = new MemoryAdminRepository();
    const { app, token } = createManagementApp(repository);
    const response = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: '  NEW@EXAMPLE.TEST ',
        name: 'New Admin',
        password: PASSWORD,
        roleId: STAFF_ROLE_ID,
      });
    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe('new@example.test');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    const created = repository.admins.find(
      (admin) => admin.email === 'new@example.test',
    )!;
    const hash = repository.hashes.get(created.id)!;
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await argon2.verify(hash, PASSWORD)).toBe(true);
  });

  it('validates admin input and rejects normalized duplicate emails', async () => {
    const repository = new MemoryAdminRepository();
    const { app, token } = createManagementApp(repository);
    const invalid = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'bad', name: '', password: 'short', roleId: 'bad-id' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const duplicate = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'OWNER@EXAMPLE.TEST',
        name: 'Duplicate',
        password: PASSWORD,
        roleId: ADMIN_ROLE_ID,
      });
    expect(duplicate.status).toBe(409);
  });

  it('updates safe profile fields and changes passwords without exposing hashes', async () => {
    const repository = new MemoryAdminRepository();
    const { app, token } = createManagementApp(repository);
    const updated = await request(app)
      .patch(`/api/admin/users/${STAFF_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Staff' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Updated Staff');
    expect(JSON.stringify(updated.body)).not.toContain('passwordHash');

    const changedPassword = await request(app)
      .patch(`/api/admin/users/${STAFF_ID}/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'Another-test-password-123!' });
    expect(changedPassword.status).toBe(200);
    const changedHash = repository.hashes.get(STAFF_ID)!;
    expect(await argon2.verify(changedHash, 'Another-test-password-123!')).toBe(
      true,
    );
    expect(JSON.stringify(changedPassword.body)).not.toContain(changedHash);
  });

  it('rejects missing auth and insufficient permissions', async () => {
    const repository = new MemoryAdminRepository();
    const { app } = createManagementApp(repository);
    expect((await request(app).get('/api/admin/users')).status).toBe(401);

    const { app: staffApp, token: staffToken } = createManagementApp(
      repository,
      STAFF_ID,
    );
    const response = await request(staffApp)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        email: 'extra@example.test',
        name: 'Extra',
        password: PASSWORD,
        roleId: STAFF_ROLE_ID,
      });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('prevents self-deactivation and deactivation of the last usable admin', async () => {
    const repository = new MemoryAdminRepository();
    const { app, token } = createManagementApp(repository);
    const self = await request(app)
      .patch(`/api/admin/users/${SUPER_ADMIN_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe('SELF_DEACTIVATION_FORBIDDEN');

    const otherSuper = await repository.createAdmin({
      email: 'other-super@example.test',
      name: 'Other Super',
      passwordHash: HASH,
      roleId: ADMIN_ROLE_ID,
    });
    await repository.setAdminActive(otherSuper.id, false);
    await expect(
      repository.setAdminActive(SUPER_ADMIN_ID, false),
    ).rejects.toMatchObject({
      code: 'LAST_USABLE_ADMIN',
    });
  });

  it('lists, creates, updates roles and manages known permission assignments', async () => {
    const repository = new MemoryAdminRepository();
    const { app, token } = createManagementApp(repository);
    expect(
      (
        await request(app)
          .get('/api/admin/roles')
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(200);
    const listedPermissions = await request(app)
      .get('/api/admin/permissions')
      .set('Authorization', `Bearer ${token}`);
    expect(listedPermissions.status).toBe(200);
    expect(
      listedPermissions.body.data.some(
        (permission: { key: string }) => permission.key === 'admin.users.read',
      ),
    ).toBe(true);

    const created = await request(app)
      .post('/api/admin/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inventory Staff', isActive: true });
    expect(created.status).toBe(201);
    const roleId = created.body.data.id as string;
    const updated = await request(app)
      .patch(`/api/admin/roles/${roleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Inventory access' });
    expect(updated.status).toBe(200);

    const assigned = await request(app)
      .put(`/api/admin/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ permissionKeys: ['admin.users.read'] });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.permissions).toEqual(['admin.users.read']);

    const unknown = await request(app)
      .put(`/api/admin/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ permissionKeys: ['not.a.real.permission'] });
    expect(unknown.status).toBe(400);

    const removed = await request(app)
      .delete(`/api/admin/roles/${roleId}/permissions/admin.users.read`)
      .set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.permissions).toEqual([]);

    const duplicate = await request(app)
      .post('/api/admin/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inventory Staff', isActive: true });
    expect(duplicate.status).toBe(409);
  });

  it('prevents removing the system permission from the last usable admin role', async () => {
    const repository = new MemoryAdminRepository();
    const { app, token } = createManagementApp(repository);
    const response = await request(app)
      .delete(
        `/api/admin/roles/${ADMIN_ROLE_ID}/permissions/${ADMIN_SYSTEM_PERMISSION}`,
      )
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LAST_USABLE_ADMIN');
  });

  it('prevents deactivating the role used by the last usable admin', async () => {
    const repository = new MemoryAdminRepository();
    const { app, token } = createManagementApp(repository);
    const response = await request(app)
      .patch(`/api/admin/roles/${ADMIN_ROLE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LAST_USABLE_ADMIN');
  });

  it('uses current database permissions after role permission grants and removals', async () => {
    const repository = new MemoryAdminRepository();
    const { app: ownerApp, token: ownerToken } =
      createManagementApp(repository);
    const granted = await request(ownerApp)
      .put(`/api/admin/roles/${STAFF_ROLE_ID}/permissions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ permissionKeys: ['admin.users.read', 'admin.users.create'] });
    expect(granted.status).toBe(200);

    const { app: staffApp, token: staffToken } = createManagementApp(
      repository,
      STAFF_ID,
    );
    const allowed = await request(staffApp)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        email: 'created-by-staff@example.test',
        name: 'Created by Staff',
        password: PASSWORD,
        roleId: STAFF_ROLE_ID,
      });
    expect(allowed.status).toBe(201);

    const removed = await request(ownerApp)
      .delete(
        `/api/admin/roles/${STAFF_ROLE_ID}/permissions/admin.users.create`,
      )
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(removed.status).toBe(200);
    const denied = await request(staffApp)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        email: 'denied-by-staff@example.test',
        name: 'Denied by Staff',
        password: PASSWORD,
        roleId: STAFF_ROLE_ID,
      });
    expect(denied.status).toBe(403);
  });

  it('does not reactivate an admin assigned to an inactive role', async () => {
    const repository = new MemoryAdminRepository();
    const { app, token } = createManagementApp(repository);
    const staffRole = repository.roles.find(
      (role) => role.id === STAFF_ROLE_ID,
    )!;
    staffRole.isActive = false;
    repository.admins.find((admin) => admin.id === STAFF_ID)!.role.isActive =
      false;
    const response = await request(app)
      .patch(`/api/admin/users/${STAFF_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_ROLE');
  });
});

describe('initial administrator provisioning', () => {
  it('requires the connected database name to match the explicit expectation', () => {
    expect(() =>
      assertExpectedDatabase('liquor_shop', 'liquor_shop'),
    ).not.toThrow();
    expect(() => assertExpectedDatabase('production', 'liquor_shop')).toThrow(
      expect.objectContaining({ code: 'PROVISIONING_DATABASE_MISMATCH' }),
    );
  });

  it('normalizes email, hashes the password, and creates role permissions without exposing the secret', async () => {
    const repository = new MemoryAdminRepository();
    repository.admins = [];
    repository.roles = [];
    repository.permissions = [];
    repository.hashes.clear();
    let capturedPassword = '';
    await provisionInitialAdmin(
      {
        email: ' BOOTSTRAP@EXAMPLE.TEST ',
        name: 'Bootstrap',
        password: PASSWORD,
      },
      repository,
      async (password) => {
        capturedPassword = password;
        return `hashed:${password}`;
      },
    );
    expect(capturedPassword).toBe(PASSWORD);
    expect(repository.admins).toHaveLength(1);
    expect(repository.admins[0].email).toBe('bootstrap@example.test');
    expect(repository.hashes.get(repository.admins[0].id)).toBe(
      `hashed:${PASSWORD}`,
    );
    expect(repository.roles[0].permissions).toContain(ADMIN_SYSTEM_PERMISSION);
  });

  it('refuses reruns and partial existing bootstrap state without overwriting', async () => {
    const repository = new MemoryAdminRepository();
    const beforeAdmins = structuredClone(repository.admins);
    const beforeRoles = structuredClone(repository.roles);
    await expect(
      provisionInitialAdmin(
        { email: 'owner@example.test', name: 'Replace?', password: PASSWORD },
        repository,
        async () => HASH,
      ),
    ).rejects.toMatchObject({ code: 'PROVISIONING_STATE_NOT_EMPTY' });
    expect(repository.admins).toEqual(beforeAdmins);
    expect(repository.roles).toEqual(beforeRoles);

    const partial = new MemoryAdminRepository();
    partial.admins = [];
    partial.roles = [];
    partial.hashes.clear();
    partial.permissions = [
      { id: 'permission-existing', key: 'admin.users.read', description: null },
    ];
    await expect(
      provisionInitialAdmin(
        {
          email: 'bootstrap@example.test',
          name: 'Bootstrap',
          password: PASSWORD,
        },
        partial,
        async () => HASH,
      ),
    ).rejects.toMatchObject({ code: 'PROVISIONING_STATE_NOT_EMPTY' });
    expect(partial.admins).toHaveLength(0);
    expect(partial.roles).toHaveLength(0);
  });

  it('rejects weak input and leaves provisioning repository untouched on hash failure', async () => {
    const repository = new MemoryAdminRepository();
    repository.admins = [];
    repository.roles = [];
    repository.permissions = [];
    repository.hashes.clear();
    await expect(
      provisionInitialAdmin(
        { email: 'bad-email', name: 'Bootstrap', password: 'short' },
        repository,
        async () => HASH,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_PROVISIONING_INPUT' });

    await expect(
      provisionInitialAdmin(
        {
          email: 'bootstrap@example.test',
          name: 'Bootstrap',
          password: PASSWORD,
        },
        repository,
        async () => {
          throw new Error('simulated hashing failure');
        },
      ),
    ).rejects.toThrow('simulated hashing failure');
    expect(repository.admins).toHaveLength(0);
    expect(repository.roles).toHaveLength(0);
  });

  it('propagates repository transaction failures without partial fixture state', async () => {
    const repository = new MemoryAdminRepository();
    repository.admins = [];
    repository.roles = [];
    repository.permissions = [];
    repository.hashes.clear();
    repository.provisioningFailure = new Error('simulated transaction failure');

    await expect(
      provisionInitialAdmin(
        {
          email: 'bootstrap@example.test',
          name: 'Bootstrap',
          password: PASSWORD,
        },
        repository,
        async () => HASH,
      ),
    ).rejects.toThrow('simulated transaction failure');
    expect(repository.admins).toHaveLength(0);
    expect(repository.roles).toHaveLength(0);
    expect(repository.permissions).toHaveLength(0);
  });
});
