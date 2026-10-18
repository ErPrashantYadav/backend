import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import type { AuditService } from '../audit/audit.service';
import type { NotificationOutboxService } from '../notifications/notification-outbox.service';
import type {
  ContactInquiryRecord,
  ContactInquiryRepository,
  ContactInquiryStatus,
  ListContactInquiriesParams,
} from './contact-inquiry.types';

const VALID_STATUSES: ContactInquiryStatus[] = [
  'NEW',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

const publicSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(180, 'Name cannot exceed 180 characters'),
  phone: z
    .string()
    .trim()
    .min(7, 'Phone number must be at least 7 characters')
    .max(32, 'Phone number cannot exceed 32 characters')
    .regex(/^[0-9+\s\-()]+$/, 'Invalid phone number format'),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(254, 'Email cannot exceed 254 characters')
    .optional()
    .nullable()
    .or(z.literal('')),
  subject: z
    .string()
    .trim()
    .min(2, 'Subject must be at least 2 characters')
    .max(200, 'Subject cannot exceed 200 characters'),
  message: z
    .string()
    .trim()
    .min(5, 'Message must be at least 5 characters')
    .max(5000, 'Message cannot exceed 5000 characters'),
});

const updateStatusSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  adminNote: z
    .string()
    .trim()
    .max(2000, 'Admin note cannot exceed 2000 characters')
    .optional()
    .nullable(),
});

export class ContactInquiryService {
  constructor(
    private readonly repository: ContactInquiryRepository,
    private readonly auditService?: AuditService,
    private readonly notificationOutboxService?: NotificationOutboxService,
  ) {}

  async submitPublicInquiry(rawInput: unknown): Promise<{
    id: string;
    name: string;
    subject: string;
    createdAt: string;
    status: ContactInquiryStatus;
  }> {
    const parseResult = publicSubmissionSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        issue?.message || 'Invalid inquiry submission data',
      );
    }

    const { name, phone, email, subject, message } = parseResult.data;

    const normalizedEmail =
      email && email.trim() ? email.trim().toLowerCase() : null;

    const record = await this.repository.create({
      name,
      phone,
      email: normalizedEmail,
      subject,
      message,
    });

    if (this.notificationOutboxService) {
      try {
        const inquiryData = {
          id: record.id,
          fullName: record.name,
          email: record.email,
          phone: record.phone,
          subject: record.subject,
          message: record.message,
          createdAt: record.createdAt,
        };
        await this.notificationOutboxService.enqueueContactInquiryAdminEmail(
          inquiryData,
        );
        if (record.email) {
          await this.notificationOutboxService.enqueueContactInquiryCustomerAck(
            inquiryData,
          );
        }
      } catch {
        // Enqueueing failure must not cause contact inquiry submission to fail
      }
    }

    return {
      id: record.id,
      name: record.name,
      subject: record.subject,
      createdAt: record.createdAt.toISOString(),
      status: record.status,
    };
  }

  async listInquiries(query: {
    page?: unknown;
    limit?: unknown;
    search?: unknown;
    status?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    sortBy?: unknown;
    sortOrder?: unknown;
  }): Promise<{
    items: ContactInquiryRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    let page = 1;
    if (query.page !== undefined) {
      const parsedPage = Number(query.page);
      if (isNaN(parsedPage) || parsedPage < 1) {
        throw new AppError(
          400,
          'INVALID_PAGINATION',
          'page must be a positive integer',
        );
      }
      page = Math.floor(parsedPage);
    }

    let limit = 20;
    if (query.limit !== undefined) {
      const parsedLimit = Number(query.limit);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        throw new AppError(
          400,
          'INVALID_PAGINATION',
          'limit must be between 1 and 100',
        );
      }
      limit = Math.min(100, Math.floor(parsedLimit));
    }

    const search =
      typeof query.search === 'string' && query.search.trim()
        ? query.search.trim()
        : undefined;

    let status: ContactInquiryStatus | undefined;
    if (query.status !== undefined) {
      if (
        typeof query.status !== 'string' ||
        !VALID_STATUSES.includes(query.status as ContactInquiryStatus)
      ) {
        throw new AppError(
          400,
          'INVALID_FILTER',
          `status must be one of: ${VALID_STATUSES.join(', ')}`,
        );
      }
      status = query.status as ContactInquiryStatus;
    }

    let startDate: string | undefined;
    if (query.startDate !== undefined) {
      if (
        typeof query.startDate !== 'string' ||
        isNaN(Date.parse(query.startDate))
      ) {
        throw new AppError(
          400,
          'INVALID_DATE',
          'startDate must be a valid ISO date',
        );
      }
      startDate = query.startDate;
    }

    let endDate: string | undefined;
    if (query.endDate !== undefined) {
      if (
        typeof query.endDate !== 'string' ||
        isNaN(Date.parse(query.endDate))
      ) {
        throw new AppError(
          400,
          'INVALID_DATE',
          'endDate must be a valid ISO date',
        );
      }
      endDate = query.endDate;
    }

    if (startDate && endDate) {
      if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
        throw new AppError(
          400,
          'INVALID_DATE_RANGE',
          'startDate must be before or equal to endDate',
        );
      }
    }

    let sortBy: ListContactInquiriesParams['sortBy'] = 'createdAt';
    if (query.sortBy !== undefined) {
      const allowed = ['createdAt', 'name', 'status'];
      if (typeof query.sortBy !== 'string' || !allowed.includes(query.sortBy)) {
        throw new AppError(
          400,
          'INVALID_SORT_FIELD',
          `sortBy must be one of: ${allowed.join(', ')}`,
        );
      }
      sortBy = query.sortBy as ListContactInquiriesParams['sortBy'];
    }

    let sortOrder: 'asc' | 'desc' = 'desc';
    if (query.sortOrder !== undefined) {
      if (query.sortOrder !== 'asc' && query.sortOrder !== 'desc') {
        throw new AppError(
          400,
          'INVALID_SORT_ORDER',
          "sortOrder must be 'asc' or 'desc'",
        );
      }
      sortOrder = query.sortOrder;
    }

    const result = await this.repository.list({
      page,
      limit,
      search,
      status,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    });

    const totalPages = Math.ceil(result.total / limit);

    return {
      items: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
      },
    };
  }

  async getInquiryById(id: string): Promise<ContactInquiryRecord> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new AppError(400, 'INVALID_INQUIRY_ID', 'Inquiry ID is required');
    }

    const inquiry = await this.repository.findById(id.trim());
    if (!inquiry) {
      throw new AppError(404, 'INQUIRY_NOT_FOUND', 'Contact inquiry not found');
    }

    return inquiry;
  }

  async updateInquiryStatus(
    id: string,
    rawInput: unknown,
    actorAdminId?: string,
  ): Promise<ContactInquiryRecord> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new AppError(400, 'INVALID_INQUIRY_ID', 'Inquiry ID is required');
    }

    const existing = await this.repository.findById(id.trim());
    if (!existing) {
      throw new AppError(404, 'INQUIRY_NOT_FOUND', 'Contact inquiry not found');
    }

    const parseResult = updateStatusSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        issue?.message || 'Invalid status update data',
      );
    }

    const { status, adminNote } = parseResult.data;

    const updated = await this.repository.updateStatus(existing.id, {
      status,
      adminNote: adminNote !== undefined ? adminNote : existing.adminNote,
    });

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'contact_inquiry.update_status',
        resourceType: 'contact_inquiry',
        resourceId: existing.id,
        actorAdminId,
        metadata: {
          previousStatus: existing.status,
          newStatus: status,
          adminNote: adminNote ?? null,
        },
      });
    }

    return updated;
  }

  async deleteInquiry(id: string, actorAdminId?: string): Promise<void> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new AppError(400, 'INVALID_INQUIRY_ID', 'Inquiry ID is required');
    }

    const existing = await this.repository.findById(id.trim());
    if (!existing) {
      throw new AppError(404, 'INQUIRY_NOT_FOUND', 'Contact inquiry not found');
    }

    await this.repository.delete(existing.id);

    if (this.auditService && actorAdminId) {
      await this.auditService.recordEvent({
        action: 'contact_inquiry.delete',
        resourceType: 'contact_inquiry',
        resourceId: existing.id,
        actorAdminId,
        metadata: {
          deletedInquirySubject: existing.subject,
          deletedInquiryEmail: existing.email,
        },
      });
    }
  }
}
