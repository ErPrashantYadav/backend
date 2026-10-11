import {
  PaymentStatus,
  PaymentSubmissionStatus,
  type Prisma,
} from '@prisma/client';
import { AppError } from '../../errors/app-error';
import { prisma } from '../../lib/prisma';
import { sanitizeAuditMetadata } from '../audit/audit.service';
import type {
  CreatePaymentSubmissionParams,
  PaginatedPaymentSubmissions,
  PaymentSubmissionDetail,
  PaymentSubmissionFilter,
  PaymentSubmissionRecord,
  PaymentSubmissionRepository,
  ReviewPaymentSubmissionParams,
} from './payment-submission.types';

function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return '***';
  return `***-***-${trimmed.slice(-4)}`;
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return '***@***';
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (!domain) return '***@***';
  const maskedLocal =
    local.length > 2 ? `${local[0]}***${local.slice(-1)}` : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

function maskAddress(address: string): string {
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length > 1) {
    return `***, ${parts.slice(1).join(', ')}`;
  }
  return `${address.slice(0, 3)}***`;
}

function mapRecord(
  row: Prisma.PaymentSubmissionGetPayload<Record<string, never>>,
): PaymentSubmissionRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    proofImageUrl: row.proofImageUrl,
    transactionReference: row.transactionReference,
    customerNotes: row.customerNotes,
    status: row.status as 'PENDING' | 'APPROVED' | 'REJECTED',
    reviewedByAdminId: row.reviewedByAdminId,
    reviewedAt: row.reviewedAt,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDetail(
  row: Prisma.PaymentSubmissionGetPayload<{
    include: {
      order: true;
      reviewedByAdmin: { select: { id: true; name: true; email: true } };
    };
  }>,
): PaymentSubmissionDetail {
  return {
    ...mapRecord(row),
    order: {
      id: row.order.id,
      orderNumber: row.order.orderNumber,
      status: row.order.status,
      total: row.order.total.toFixed(2),
      paymentMethodCode: row.order.paymentMethodCode,
      paymentMethodName: row.order.paymentMethodName,
      paymentStatus: row.order.paymentStatus,
      customerName: row.order.customerName,
      customerPhoneMasked: maskPhone(row.order.customerPhone),
      customerEmailMasked: maskEmail(row.order.customerEmail),
      deliveryAddressMasked: maskAddress(row.order.deliveryAddress),
      createdAt: row.order.createdAt,
    },
    reviewedByAdmin: row.reviewedByAdmin
      ? {
          id: row.reviewedByAdmin.id,
          name: row.reviewedByAdmin.name,
          email: row.reviewedByAdmin.email,
        }
      : null,
  };
}

export class PrismaPaymentSubmissionRepository implements PaymentSubmissionRepository {
  async createSubmission(
    params: CreatePaymentSubmissionParams,
  ): Promise<PaymentSubmissionRecord> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.orderId },
      });
      if (!order) {
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
      }

      const existingPending = await tx.paymentSubmission.findFirst({
        where: {
          orderId: params.orderId,
          status: PaymentSubmissionStatus.PENDING,
        },
      });
      if (existingPending) {
        throw new AppError(
          409,
          'SUBMISSION_ALREADY_PENDING',
          'A payment proof submission is already pending review for this order',
        );
      }

      const created = await tx.paymentSubmission.create({
        data: {
          orderId: params.orderId,
          proofImageUrl: params.proofImageUrl,
          transactionReference: params.transactionReference,
          customerNotes: params.customerNotes,
          status: PaymentSubmissionStatus.PENDING,
        },
      });

      await tx.order.update({
        where: { id: params.orderId },
        data: {
          paymentStatus: PaymentStatus.UNDER_REVIEW,
        },
      });

      const auditMeta = sanitizeAuditMetadata({
        submissionId: created.id,
        proofImageUrl: created.proofImageUrl,
        transactionReference: created.transactionReference,
      });

      await tx.auditLog.create({
        data: {
          action: 'PAYMENT_PROOF_SUBMITTED',
          resourceType: 'ORDER',
          resourceId: params.orderId,
          actorAdminId: null,
          metadata: (auditMeta as Prisma.InputJsonValue) ?? undefined,
        },
      });

      return mapRecord(created);
    });
  }

  async findSubmissionById(
    id: string,
  ): Promise<PaymentSubmissionDetail | null> {
    const row = await prisma.paymentSubmission.findUnique({
      where: { id },
      include: {
        order: true,
        reviewedByAdmin: { select: { id: true, name: true, email: true } },
      },
    });
    return row ? mapDetail(row) : null;
  }

  async findPendingSubmissionByOrderId(
    orderId: string,
  ): Promise<PaymentSubmissionRecord | null> {
    const row = await prisma.paymentSubmission.findFirst({
      where: {
        orderId,
        status: PaymentSubmissionStatus.PENDING,
      },
    });
    return row ? mapRecord(row) : null;
  }

  async listSubmissions(
    filter: PaymentSubmissionFilter,
  ): Promise<PaginatedPaymentSubmissions> {
    const where: Prisma.PaymentSubmissionWhereInput = {};
    if (filter.status) {
      where.status = filter.status as PaymentSubmissionStatus;
    }
    if (filter.orderNumber) {
      where.order = {
        orderNumber: { contains: filter.orderNumber, mode: 'insensitive' },
      };
    }

    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));

    const [total, rows] = await Promise.all([
      prisma.paymentSubmission.count({ where }),
      prisma.paymentSubmission.findMany({
        where,
        include: {
          order: true,
          reviewedByAdmin: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(mapDetail),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async reviewSubmission(params: ReviewPaymentSubmissionParams): Promise<{
    submission: PaymentSubmissionRecord;
    previousStatus: PaymentSubmissionStatus;
  }> {
    return prisma.$transaction(async (tx) => {
      const submission = await tx.paymentSubmission.findUnique({
        where: { id: params.submissionId },
      });
      if (!submission) {
        throw new AppError(
          404,
          'SUBMISSION_NOT_FOUND',
          'Payment submission not found',
        );
      }

      if (submission.status === PaymentSubmissionStatus.APPROVED) {
        throw new AppError(
          409,
          'ALREADY_APPROVED',
          'Payment submission has already been approved',
        );
      }
      if (submission.status === PaymentSubmissionStatus.REJECTED) {
        throw new AppError(
          409,
          'ALREADY_REJECTED',
          'Payment submission has already been rejected',
        );
      }

      const newStatus =
        params.action === 'APPROVE'
          ? PaymentSubmissionStatus.APPROVED
          : PaymentSubmissionStatus.REJECTED;

      const updateResult = await tx.paymentSubmission.updateMany({
        where: {
          id: params.submissionId,
          status: PaymentSubmissionStatus.PENDING,
        },
        data: {
          status: newStatus,
          reviewedByAdminId: params.adminId,
          reviewedAt: new Date(),
          rejectionReason: params.action === 'REJECT' ? params.reason : null,
        },
      });

      if (updateResult.count === 0) {
        throw new AppError(
          409,
          'CONCURRENT_REVIEW_CONFLICT',
          'Submission was already reviewed by another administrator',
        );
      }

      if (params.action === 'APPROVE') {
        await tx.order.update({
          where: { id: submission.orderId },
          data: {
            paymentStatus: PaymentStatus.PAID,
            ...(submission.transactionReference
              ? { paymentReference: submission.transactionReference }
              : {}),
          },
        });
      } else {
        await tx.order.update({
          where: { id: submission.orderId },
          data: {
            paymentStatus: PaymentStatus.FAILED,
          },
        });
      }

      const auditMeta = sanitizeAuditMetadata({
        submissionId: params.submissionId,
        newStatus: newStatus,
        reason: params.action === 'REJECT' ? params.reason : null,
      });

      await tx.auditLog.create({
        data: {
          action:
            params.action === 'APPROVE'
              ? 'PAYMENT_SUBMISSION_APPROVED'
              : 'PAYMENT_SUBMISSION_REJECTED',
          resourceType: 'ORDER',
          resourceId: submission.orderId,
          actorAdminId: params.adminId,
          metadata: (auditMeta as Prisma.InputJsonValue) ?? undefined,
        },
      });

      const updated = await tx.paymentSubmission.findUniqueOrThrow({
        where: { id: params.submissionId },
      });

      return {
        submission: mapRecord(updated),
        previousStatus: submission.status as
          'PENDING' | 'APPROVED' | 'REJECTED',
      };
    });
  }
}
