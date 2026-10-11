import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  AuditLogFilter,
  AuditLogRecord,
  AuditLogRepository,
  CreateAuditLogInput,
  PaginatedAuditLogs,
} from './audit.types';

function mapRecord(
  row: Prisma.AuditLogGetPayload<{
    include: {
      actorAdmin: { select: { id: true; name: true; email: true } };
    };
  }>,
): AuditLogRecord {
  return {
    id: row.id,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    actorAdminId: row.actorAdminId,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.createdAt,
    actorAdmin: row.actorAdmin
      ? {
          id: row.actorAdmin.id,
          name: row.actorAdmin.name,
          email: row.actorAdmin.email,
        }
      : null,
  };
}

export class PrismaAuditLogRepository implements AuditLogRepository {
  async createLog(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    const row = await prisma.auditLog.create({
      data: {
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        actorAdminId: input.actorAdminId ?? null,
        metadata: (input.metadata ?? Prisma.DbNull) as Prisma.InputJsonValue,
      },
      include: {
        actorAdmin: { select: { id: true, name: true, email: true } },
      },
    });
    return mapRecord(row);
  }

  async listLogs(filter: AuditLogFilter): Promise<PaginatedAuditLogs> {
    const where: Prisma.AuditLogWhereInput = {};

    if (filter.action) {
      where.action = filter.action;
    }
    if (filter.resourceType) {
      where.resourceType = filter.resourceType;
    }
    if (filter.resourceId) {
      where.resourceId = filter.resourceId;
    }
    if (filter.actorAdminId) {
      where.actorAdminId = filter.actorAdminId;
    }
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) {
        where.createdAt.gte = new Date(filter.dateFrom);
      }
      if (filter.dateTo) {
        where.createdAt.lte = new Date(filter.dateTo);
      }
    }

    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          actorAdmin: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(mapRecord),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async listLogsForResource(
    resourceType: string,
    resourceId: string,
  ): Promise<AuditLogRecord[]> {
    const rows = await prisma.auditLog.findMany({
      where: {
        resourceType,
        resourceId,
      },
      include: {
        actorAdmin: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapRecord);
  }
}
