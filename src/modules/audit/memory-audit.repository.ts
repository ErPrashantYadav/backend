import type {
  AuditLogFilter,
  AuditLogRecord,
  AuditLogRepository,
  CreateAuditLogInput,
  PaginatedAuditLogs,
} from './audit.types';

export class MemoryAuditLogRepository implements AuditLogRepository {
  logs: AuditLogRecord[] = [];

  constructor(
    public readonly admins: Array<{
      id: string;
      name: string;
      email: string;
    }> = [],
  ) {}

  async createLog(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    const admin = input.actorAdminId
      ? this.admins.find((a) => a.id === input.actorAdminId)
      : null;

    const record: AuditLogRecord = {
      id: crypto.randomUUID(),
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      actorAdminId: input.actorAdminId ?? null,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
      actorAdmin: admin
        ? {
            id: admin.id,
            name: admin.name,
            email: admin.email,
          }
        : null,
    };

    this.logs.push(record);
    return record;
  }

  async listLogs(filter: AuditLogFilter): Promise<PaginatedAuditLogs> {
    let items = [...this.logs];

    if (filter.action) {
      items = items.filter((l) => l.action === filter.action);
    }
    if (filter.resourceType) {
      items = items.filter((l) => l.resourceType === filter.resourceType);
    }
    if (filter.resourceId) {
      items = items.filter((l) => l.resourceId === filter.resourceId);
    }
    if (filter.actorAdminId) {
      items = items.filter((l) => l.actorAdminId === filter.actorAdminId);
    }
    if (filter.dateFrom) {
      const from = new Date(filter.dateFrom).getTime();
      items = items.filter((l) => l.createdAt.getTime() >= from);
    }
    if (filter.dateTo) {
      const to = new Date(filter.dateTo).getTime();
      items = items.filter((l) => l.createdAt.getTime() <= to);
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const paginated = items.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: paginated,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async listLogsForResource(
    resourceType: string,
    resourceId: string,
  ): Promise<AuditLogRecord[]> {
    return this.logs
      .filter(
        (l) => l.resourceType === resourceType && l.resourceId === resourceId,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
