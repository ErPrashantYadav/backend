import { prisma } from '../../lib/prisma';
import type { AdminAuthRecord, AdminAuthRepository } from './auth.types';

const adminAuthSelect = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  isActive: true,
  role: {
    select: {
      id: true,
      name: true,
      isActive: true,
      rolePermissions: {
        select: { permission: { select: { key: true } } },
      },
    },
  },
} as const;

function toAdminAuthRecord(record: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isActive: boolean;
  role: {
    id: string;
    name: string;
    isActive: boolean;
    rolePermissions: { permission: { key: string } }[];
  };
}): AdminAuthRecord {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    passwordHash: record.passwordHash,
    isActive: record.isActive,
    role: {
      id: record.role.id,
      name: record.role.name,
      isActive: record.role.isActive,
      permissions: record.role.rolePermissions.map(
        ({ permission }) => permission.key,
      ),
    },
  };
}

export class PrismaAdminAuthRepository implements AdminAuthRepository {
  async findByEmail(email: string): Promise<AdminAuthRecord | null> {
    const record = await prisma.adminUser.findUnique({
      where: { email },
      select: adminAuthSelect,
    });
    return record ? toAdminAuthRecord(record) : null;
  }

  async findById(id: string): Promise<AdminAuthRecord | null> {
    const record = await prisma.adminUser.findUnique({
      where: { id },
      select: adminAuthSelect,
    });
    return record ? toAdminAuthRecord(record) : null;
  }
}
