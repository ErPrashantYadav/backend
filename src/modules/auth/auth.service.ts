import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { AppError } from '../../errors/app-error';
import type { AppConfig } from '../../config/env';
import { createAdminAccessToken, verifyAdminAccessToken } from './access-token';
import type {
  AdminAuthRecord,
  AdminAuthRepository,
  AdminProfile,
} from './auth.types';

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

let dummyPasswordHash: Promise<string> | undefined;

function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= argon2.hash(randomBytes(32), ARGON_OPTIONS);
  return dummyPasswordHash;
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toAdminProfile(record: AdminAuthRecord): AdminProfile {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: { id: record.role.id, name: record.role.name },
    permissions: [...record.role.permissions].sort(),
  };
}

async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (!passwordHash.startsWith('$argon2id$')) return false;
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

function invalidCredentials(): AppError {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
}

export class AdminAuthService {
  private readonly dummyPasswordHash: Promise<string>;

  constructor(
    private readonly config: AppConfig,
    private readonly repository: AdminAuthRepository,
  ) {
    this.dummyPasswordHash = getDummyPasswordHash();
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
    admin: AdminProfile;
  }> {
    const dummyHash = await this.dummyPasswordHash;
    const record = await this.repository.findByEmail(
      normalizeAdminEmail(email),
    );
    const hash = record?.passwordHash ?? dummyHash;
    const passwordMatches = await verifyPassword(password, hash);

    if (
      !record ||
      !passwordMatches ||
      !record.isActive ||
      !record.role.isActive
    ) {
      throw invalidCredentials();
    }

    return {
      accessToken: createAdminAccessToken(this.config, record.id),
      tokenType: 'Bearer',
      expiresIn: this.config.JWT_ACCESS_TOKEN_TTL_SECONDS,
      admin: toAdminProfile(record),
    };
  }

  async authenticate(token: string): Promise<AdminProfile> {
    let claims;
    try {
      claims = verifyAdminAccessToken(this.config, token);
    } catch {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required');
    }

    const record = await this.repository.findById(claims.sub);
    if (!record || !record.isActive || !record.role.isActive) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required');
    }

    return toAdminProfile(record);
  }
}

export { ARGON_OPTIONS };
