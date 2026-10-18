import crypto from 'node:crypto';
import type { Logger } from 'pino';
import type { AppConfig } from '../../config/env';
import { AppError } from '../../errors/app-error';
import type { AuditService } from '../audit/audit.service';
import type {
  CheckoutRepository,
  OrderSnapshot,
} from '../checkout/checkout.types';
import type { PaymentMethodRepository } from '../payment-method/payment-method.types';
import type {
  PaginatedPaymentSubmissions,
  PaymentSubmissionDetail,
  PaymentSubmissionFilter,
  PaymentSubmissionRecord,
  PaymentSubmissionRepository,
  PublicPaymentProofResponse,
  SubmitPaymentProofInput,
} from './payment-submission.types';

export function isValidPaymentProofUrl(
  url: string,
  cloudName?: string,
  paymentProofFolder?: string,
  environment?: string,
): boolean {
  const trimmed = url.trim();
  if (/^(assets\/|qr-proofs\/)[a-zA-Z0-9_\-\./]+$/i.test(trimmed)) {
    return true;
  }

  const isTestEnv = (environment ?? process.env.NODE_ENV) === 'test';

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return false;
    }

    // Allow configured test domains strictly in isolated test environments
    if (
      isTestEnv &&
      (parsed.hostname === 'images.liquorshop.test' ||
        parsed.hostname === 'storage.test')
    ) {
      return true;
    }

    // Cloudinary domain check
    if (parsed.hostname === 'res.cloudinary.com') {
      const configuredCloud = cloudName?.trim();
      // Fail closed: Cloudinary URL cannot be validated without an explicit configured cloud
      if (!configuredCloud) {
        return false;
      }

      // First path segment in Cloudinary is the cloud account name:
      // https://res.cloudinary.com/<cloud_name>/image/upload/...
      const segments = parsed.pathname.split('/').filter(Boolean);
      const urlCloud = segments[0];

      if (!urlCloud) {
        return false;
      }

      // In production or when cloud names differ, mock-cloud is forbidden.
      // mock-cloud is strictly permitted only in isolated automated test environments.
      const isAllowedCloud =
        urlCloud === configuredCloud ||
        (isTestEnv && urlCloud === 'mock-cloud');

      if (!isAllowedCloud) {
        return false;
      }

      const folder = (
        paymentProofFolder || 'liquor_shop/payment_proofs'
      ).trim();
      const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
      if (!cleanFolder) {
        return false;
      }

      // Dedicated payment-proof folder validation
      if (!parsed.pathname.includes(`/${cleanFolder}/`)) {
        return false;
      }

      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export class PaymentSubmissionService {
  constructor(
    private readonly paymentSubmissionRepository: PaymentSubmissionRepository,
    private readonly checkoutRepository: CheckoutRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly logger?: Logger,
    private readonly auditService?: AuditService,
    private readonly config?: AppConfig,
  ) {}

  async verifyOrderForProofSubmission(
    orderNumber: string,
    orderLookupToken?: string,
  ): Promise<OrderSnapshot> {
    if (!orderLookupToken || !orderLookupToken.trim()) {
      throw new AppError(
        404,
        'ORDER_NOT_FOUND',
        'Order not found or invalid lookup token',
      );
    }

    const order = await this.checkoutRepository.findOrderByNumber(orderNumber);
    if (!order) {
      throw new AppError(
        404,
        'ORDER_NOT_FOUND',
        'Order not found or invalid lookup token',
      );
    }

    // Verify lookup token with timing-safe SHA-256 hash comparison
    const providedHash = crypto
      .createHash('sha256')
      .update(orderLookupToken.trim())
      .digest('hex');

    const a = Buffer.from(providedHash, 'utf8');
    const b = Buffer.from(order.lookupTokenHash, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new AppError(
        404,
        'ORDER_NOT_FOUND',
        'Order not found or invalid lookup token',
      );
    }

    // Verify order payment method is active Static QR
    if (!order.paymentMethodCode) {
      throw new AppError(
        400,
        'INVALID_PAYMENT_METHOD',
        'Order was not placed with a QR payment method',
      );
    }

    const method = await this.paymentMethodRepository.findByCode(
      order.paymentMethodCode,
    );
    if (!method || method.type !== 'STATIC_QR') {
      throw new AppError(
        400,
        'INVALID_PAYMENT_METHOD',
        'Payment proof can only be submitted for Static QR payment orders',
      );
    }

    if (!method.isActive) {
      throw new AppError(
        400,
        'INACTIVE_PAYMENT_METHOD',
        'Payment method is currently inactive',
      );
    }

    // Validate order eligibility
    if (order.status === 'CANCELLED') {
      throw new AppError(
        400,
        'INVALID_ORDER_STATE',
        'Cannot submit payment proof for a cancelled order',
      );
    }
    if (order.status === 'RETURNED') {
      throw new AppError(
        400,
        'INVALID_ORDER_STATE',
        'Cannot submit payment proof for a returned order',
      );
    }

    // Validate payment status
    if (order.paymentStatus === 'PAID') {
      throw new AppError(
        400,
        'ORDER_ALREADY_PAID',
        'Order is already marked as paid',
      );
    }
    if (order.paymentStatus === 'REFUNDED') {
      throw new AppError(
        400,
        'INVALID_PAYMENT_STATE',
        'Order payment has been refunded',
      );
    }

    // Check if there is already a pending submission
    const existingPending =
      await this.paymentSubmissionRepository.findPendingSubmissionByOrderId(
        order.id,
      );
    if (existingPending) {
      throw new AppError(
        409,
        'SUBMISSION_ALREADY_PENDING',
        'A payment proof submission is already pending review for this order',
      );
    }

    return order;
  }

  async submitPaymentProof(
    input: SubmitPaymentProofInput,
  ): Promise<PublicPaymentProofResponse> {
    const order = await this.verifyOrderForProofSubmission(
      input.orderNumber,
      input.orderLookupToken,
    );

    // Validate image URL belongs to Cloudinary payment proofs folder or trusted storage
    const url = input.proofImageUrl.trim();
    if (
      !isValidPaymentProofUrl(
        url,
        this.config?.CLOUDINARY_CLOUD_NAME,
        this.config?.CLOUDINARY_PAYMENT_PROOF_FOLDER,
        this.config?.NODE_ENV,
      )
    ) {
      throw new AppError(
        400,
        'INVALID_IMAGE_URL',
        'Proof image must belong to the configured store payment proofs storage or valid asset reference',
      );
    }

    // Sanitize optional transaction reference
    let sanitizedRef: string | null = null;
    if (input.transactionReference && input.transactionReference.trim()) {
      sanitizedRef = input.transactionReference.trim().slice(0, 120);
      if (/[\r\n\t<>"]/.test(sanitizedRef)) {
        throw new AppError(
          400,
          'INVALID_REFERENCE',
          'Transaction reference contains invalid characters',
        );
      }
    }

    const submission = await this.paymentSubmissionRepository.createSubmission({
      orderId: order.id,
      proofImageUrl: url,
      transactionReference: sanitizedRef,
      customerNotes: input.customerNotes?.trim() || null,
    });

    this.logger?.info(
      {
        event: 'PAYMENT_PROOF_SUBMITTED',
        submissionId: submission.id,
        orderNumber: order.orderNumber,
      },
      'Guest submitted QR payment proof',
    );

    return {
      submissionId: submission.id,
      orderNumber: order.orderNumber,
      status: submission.status,
      paymentStatus: 'UNDER_REVIEW',
      submittedAt: submission.createdAt,
      proofImageUrl: submission.proofImageUrl,
      transactionReference: submission.transactionReference,
    };
  }

  async listSubmissions(
    filter: PaymentSubmissionFilter,
  ): Promise<PaginatedPaymentSubmissions> {
    return this.paymentSubmissionRepository.listSubmissions(filter);
  }

  async getSubmissionById(id: string): Promise<PaymentSubmissionDetail> {
    const submission =
      await this.paymentSubmissionRepository.findSubmissionById(id);
    if (!submission) {
      throw new AppError(
        404,
        'SUBMISSION_NOT_FOUND',
        'Payment submission not found',
      );
    }
    return submission;
  }

  async approveSubmission(
    submissionId: string,
    adminId: string,
  ): Promise<PaymentSubmissionRecord> {
    const { submission } =
      await this.paymentSubmissionRepository.reviewSubmission({
        submissionId,
        adminId,
        action: 'APPROVE',
      });

    this.logger?.info(
      {
        event: 'PAYMENT_SUBMISSION_APPROVED',
        submissionId,
        adminId,
        orderId: submission.orderId,
      },
      'Payment submission approved by administrator',
    );

    return submission;
  }

  async rejectSubmission(
    submissionId: string,
    adminId: string,
    reason: string,
  ): Promise<PaymentSubmissionRecord> {
    const trimmedReason = reason?.trim();
    if (
      !trimmedReason ||
      trimmedReason.length < 3 ||
      trimmedReason.length > 500
    ) {
      throw new AppError(
        400,
        'INVALID_REJECTION_REASON',
        'Rejection reason must be between 3 and 500 characters',
      );
    }

    const { submission } =
      await this.paymentSubmissionRepository.reviewSubmission({
        submissionId,
        adminId,
        action: 'REJECT',
        reason: trimmedReason,
      });

    this.logger?.info(
      {
        event: 'PAYMENT_SUBMISSION_REJECTED',
        submissionId,
        adminId,
        orderId: submission.orderId,
        reason: trimmedReason,
      },
      'Payment submission rejected by administrator',
    );

    return submission;
  }
}
