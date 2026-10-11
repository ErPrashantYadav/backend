import type { Logger } from 'pino';
import type {
  AuditLogFilter,
  AuditLogRecord,
  AuditLogRepository,
  CreateAuditLogInput,
  PaginatedAuditLogs,
} from './audit.types';

function isSensitiveKey(key: string): boolean {
  const norm = key.toLowerCase().replace(/[-_\s]/g, '');
  return (
    norm.includes('password') ||
    norm.includes('secret') ||
    norm.includes('token') ||
    norm.includes('credential') ||
    norm.includes('cookie') ||
    norm.includes('accountnumber') ||
    norm.includes('cardnumber') ||
    norm.includes('cvv') ||
    norm.includes('apikey') ||
    norm.includes('jwt') ||
    norm.includes('bearer') ||
    norm === 'authorization' ||
    norm === 'auth'
  );
}

function isSensitiveStringValue(val: string): boolean {
  const trimmed = val.trim();
  if (/^bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(trimmed)) {
    return true;
  }
  if (/^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(trimmed)) {
    return true;
  }
  return false;
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (typeof value === 'object') {
    return sanitizeAuditMetadata(value as Record<string, unknown>);
  }
  if (typeof value === 'string' && isSensitiveStringValue(value)) {
    return '[REDACTED]';
  }
  return value;
}

export function sanitizeAuditMetadata(
  meta?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (isSensitiveKey(key)) {
      continue;
    }
    sanitized[key] = sanitizeValue(value);
  }
  return sanitized;
}

export class AuditService {
  constructor(
    private readonly auditRepository: AuditLogRepository,
    private readonly logger?: Logger,
  ) {}

  async recordEvent(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    const sanitizedMeta = sanitizeAuditMetadata(input.metadata);

    const record = await this.auditRepository.createLog({
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      actorAdminId: input.actorAdminId,
      metadata: sanitizedMeta,
    });

    this.logger?.info(
      {
        auditEvent: record.action,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        actorAdminId: record.actorAdminId,
      },
      'Security-relevant audit event recorded',
    );

    return record;
  }

  async listLogs(filter: AuditLogFilter): Promise<PaginatedAuditLogs> {
    return this.auditRepository.listLogs(filter);
  }

  async listLogsForResource(
    resourceType: string,
    resourceId: string,
  ): Promise<AuditLogRecord[]> {
    return this.auditRepository.listLogsForResource(resourceType, resourceId);
  }
}
