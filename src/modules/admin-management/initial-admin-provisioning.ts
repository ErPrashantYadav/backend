import argon2 from 'argon2';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import { ARGON_OPTIONS, normalizeAdminEmail } from '../auth/auth.service';
import {
  ADMIN_PERMISSION_KEYS,
  type ProvisioningRepository,
} from './admin-management.types';

export const INITIAL_ADMIN_ROLE_NAME = 'Initial Super Administrator';

export function assertExpectedDatabase(
  actualDatabaseName: string,
  expectedDatabaseName: string,
): void {
  if (
    !expectedDatabaseName.trim() ||
    actualDatabaseName !== expectedDatabaseName.trim()
  ) {
    throw new AppError(
      400,
      'PROVISIONING_DATABASE_MISMATCH',
      'Connected database does not match INITIAL_ADMIN_EXPECTED_DATABASE; no provisioning was performed',
    );
  }
}

const provisioningSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(16).max(1024),
});

export async function provisionInitialAdmin(
  input: { email: string; name: string; password: string },
  repository: ProvisioningRepository,
  hashPassword: (password: string) => Promise<string> = (password) =>
    argon2.hash(password, ARGON_OPTIONS),
): Promise<void> {
  const parsed = provisioningSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      400,
      'INVALID_PROVISIONING_INPUT',
      'Initial admin email, name, or password does not meet requirements',
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await repository.provisionInitialAdmin({
    email: normalizeAdminEmail(parsed.data.email),
    name: parsed.data.name,
    passwordHash,
    roleName: INITIAL_ADMIN_ROLE_NAME,
    permissionKeys: ADMIN_PERMISSION_KEYS,
  });
}
