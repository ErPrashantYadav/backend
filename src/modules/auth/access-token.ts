import { randomUUID } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { AppConfig } from '../../config/env';

export interface AdminAccessClaims extends JwtPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  tokenUse: 'admin_access';
}

function keyFromConfig(config: AppConfig): Buffer {
  return Buffer.from(config.JWT_SECRET, 'base64url');
}

export function createAdminAccessToken(
  config: AppConfig,
  adminId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  return jwt.sign(
    { tokenUse: 'admin_access', iat: nowSeconds },
    keyFromConfig(config),
    {
      algorithm: 'HS256',
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
      subject: adminId,
      jwtid: randomUUID(),
      expiresIn: config.JWT_ACCESS_TOKEN_TTL_SECONDS,
    },
  );
}

export function verifyAdminAccessToken(
  config: AppConfig,
  token: string,
  nowSeconds?: number,
): AdminAccessClaims {
  const payload = jwt.verify(token, keyFromConfig(config), {
    algorithms: ['HS256'],
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
    clockTimestamp: nowSeconds,
    clockTolerance: 0,
  });

  if (typeof payload === 'string') {
    throw new Error('JWT payload must be an object');
  }

  const isUuid = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );

  const issuedAt = payload.iat;
  const expiresAt = payload.exp;
  if (
    !isUuid(payload.sub) ||
    !isUuid(payload.jti) ||
    payload.tokenUse !== 'admin_access' ||
    typeof issuedAt !== 'number' ||
    !Number.isSafeInteger(issuedAt) ||
    typeof expiresAt !== 'number' ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt - issuedAt !== config.JWT_ACCESS_TOKEN_TTL_SECONDS
  ) {
    throw new Error('JWT required claims are invalid');
  }

  return payload as AdminAccessClaims;
}
