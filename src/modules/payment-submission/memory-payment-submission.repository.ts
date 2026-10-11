import { AppError } from '../../errors/app-error';
import type { AuditLogRepository } from '../audit/audit.types';
import { sanitizeAuditMetadata } from '../audit/audit.service';
import type {
  CheckoutRepository,
  OrderSnapshot,
} from '../checkout/checkout.types';
import type {
  CreatePaymentSubmissionParams,
  PaginatedPaymentSubmissions,
  PaymentSubmissionDetail,
  PaymentSubmissionFilter,
  PaymentSubmissionRecord,
  PaymentSubmissionRepository,
  PaymentSubmissionStatus,
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

export class MemoryPaymentSubmissionRepository implements PaymentSubmissionRepository {
  submissions: PaymentSubmissionRecord[] = [];

  constructor(
    private readonly checkoutRepository?: CheckoutRepository,
    public readonly admins: Array<{
      id: string;
      name: string;
      email: string;
    }> = [],
    public auditRepository?: AuditLogRepository,
  ) {}

  setAuditRepository(repo: AuditLogRepository): void {
    this.auditRepository = repo;
  }

  private async getOrder(orderId: string): Promise<OrderSnapshot | null> {
    if (!this.checkoutRepository) return null;
    if ('orders' in this.checkoutRepository) {
      const orders = (this.checkoutRepository as { orders: OrderSnapshot[] })
        .orders;
      return orders.find((o) => o.id === orderId) ?? null;
    }
    return null;
  }

  private mapDetail(
    sub: PaymentSubmissionRecord,
    order: OrderSnapshot | null,
  ): PaymentSubmissionDetail {
    const admin = sub.reviewedByAdminId
      ? this.admins.find((a) => a.id === sub.reviewedByAdminId)
      : null;

    return {
      ...sub,
      order: {
        id: order?.id ?? sub.orderId,
        orderNumber: order?.orderNumber ?? 'UNKNOWN',
        status: order?.status ?? 'PENDING',
        total: order?.total ?? '0.00',
        paymentMethodCode: order?.paymentMethodCode ?? null,
        paymentMethodName: order?.paymentMethodName ?? null,
        paymentStatus: order?.paymentStatus ?? 'PENDING',
        customerName: order?.customerName ?? 'Guest',
        customerPhoneMasked: maskPhone(order?.customerPhone ?? ''),
        customerEmailMasked: maskEmail(order?.customerEmail ?? null),
        deliveryAddressMasked: maskAddress(order?.deliveryAddress ?? ''),
        createdAt: order?.createdAt ?? sub.createdAt,
      },
      reviewedByAdmin: admin
        ? {
            id: admin.id,
            name: admin.name,
            email: admin.email,
          }
        : null,
    };
  }

  async createSubmission(
    params: CreatePaymentSubmissionParams,
  ): Promise<PaymentSubmissionRecord> {
    const existingPending = this.submissions.find(
      (s) => s.orderId === params.orderId && s.status === 'PENDING',
    );
    if (existingPending) {
      throw new AppError(
        409,
        'SUBMISSION_ALREADY_PENDING',
        'A payment proof submission is already pending review for this order',
      );
    }

    const submission: PaymentSubmissionRecord = {
      id: crypto.randomUUID(),
      orderId: params.orderId,
      proofImageUrl: params.proofImageUrl,
      transactionReference: params.transactionReference ?? null,
      customerNotes: params.customerNotes ?? null,
      status: 'PENDING',
      reviewedByAdminId: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.auditRepository) {
      await this.auditRepository.createLog({
        action: 'PAYMENT_PROOF_SUBMITTED',
        resourceType: 'ORDER',
        resourceId: params.orderId,
        actorAdminId: null,
        metadata: sanitizeAuditMetadata({
          submissionId: submission.id,
          proofImageUrl: submission.proofImageUrl,
          transactionReference: submission.transactionReference,
        }),
      });
    }

    this.submissions.push(submission);

    if (this.checkoutRepository) {
      await this.checkoutRepository.updateOrderPayment(
        params.orderId,
        'UNDER_REVIEW',
      );
    }

    return submission;
  }

  async findSubmissionById(
    id: string,
  ): Promise<PaymentSubmissionDetail | null> {
    const sub = this.submissions.find((s) => s.id === id);
    if (!sub) return null;
    const order = await this.getOrder(sub.orderId);
    return this.mapDetail(sub, order);
  }

  async findPendingSubmissionByOrderId(
    orderId: string,
  ): Promise<PaymentSubmissionRecord | null> {
    const sub = this.submissions.find(
      (s) => s.orderId === orderId && s.status === 'PENDING',
    );
    return sub ?? null;
  }

  async listSubmissions(
    filter: PaymentSubmissionFilter,
  ): Promise<PaginatedPaymentSubmissions> {
    let items = [...this.submissions];

    if (filter.status) {
      items = items.filter((s) => s.status === filter.status);
    }

    const detailItems: PaymentSubmissionDetail[] = [];
    for (const sub of items) {
      const order = await this.getOrder(sub.orderId);
      if (
        filter.orderNumber &&
        order &&
        !order.orderNumber
          .toLowerCase()
          .includes(filter.orderNumber.toLowerCase())
      ) {
        continue;
      }
      detailItems.push(this.mapDetail(sub, order));
    }

    // Sort newest first
    detailItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
    const total = detailItems.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const paginated = detailItems.slice((page - 1) * pageSize, page * pageSize);

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

  async reviewSubmission(params: ReviewPaymentSubmissionParams): Promise<{
    submission: PaymentSubmissionRecord;
    previousStatus: PaymentSubmissionStatus;
  }> {
    const sub = this.submissions.find((s) => s.id === params.submissionId);
    if (!sub) {
      throw new AppError(
        404,
        'SUBMISSION_NOT_FOUND',
        'Payment submission not found',
      );
    }

    if (sub.status === 'APPROVED') {
      throw new AppError(
        409,
        'ALREADY_APPROVED',
        'Payment submission has already been approved',
      );
    }
    if (sub.status === 'REJECTED') {
      throw new AppError(
        409,
        'ALREADY_REJECTED',
        'Payment submission has already been rejected',
      );
    }

    const previousStatus = sub.status;
    const newStatus = params.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    if (this.auditRepository) {
      await this.auditRepository.createLog({
        action:
          params.action === 'APPROVE'
            ? 'PAYMENT_SUBMISSION_APPROVED'
            : 'PAYMENT_SUBMISSION_REJECTED',
        resourceType: 'ORDER',
        resourceId: sub.orderId,
        actorAdminId: params.adminId,
        metadata: sanitizeAuditMetadata({
          submissionId: params.submissionId,
          newStatus,
          reason: params.action === 'REJECT' ? params.reason : null,
        }),
      });
    }

    sub.status = newStatus;
    sub.reviewedByAdminId = params.adminId;
    sub.reviewedAt = new Date();
    sub.rejectionReason =
      params.action === 'REJECT' ? (params.reason ?? null) : null;
    sub.updatedAt = new Date();

    if (this.checkoutRepository) {
      if (params.action === 'APPROVE') {
        await this.checkoutRepository.updateOrderPayment(
          sub.orderId,
          'PAID',
          sub.transactionReference ?? undefined,
        );
      } else {
        await this.checkoutRepository.updateOrderPayment(sub.orderId, 'FAILED');
      }
    }

    return {
      submission: { ...sub },
      previousStatus,
    };
  }
}
