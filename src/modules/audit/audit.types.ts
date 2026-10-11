export interface AuditLogRecord {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorAdminId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  actorAdmin?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface CreateAuditLogInput {
  action: string;
  resourceType: string;
  resourceId: string;
  actorAdminId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogFilter {
  action?: string;
  resourceType?: string;
  resourceId?: string;
  actorAdminId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedAuditLogs {
  items: AuditLogRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditLogRepository {
  createLog(input: CreateAuditLogInput): Promise<AuditLogRecord>;
  listLogs(filter: AuditLogFilter): Promise<PaginatedAuditLogs>;
  listLogsForResource(
    resourceType: string,
    resourceId: string,
  ): Promise<AuditLogRecord[]>;
}
