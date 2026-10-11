export type PaymentSubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PaymentSubmissionRecord {
  id: string;
  orderId: string;
  proofImageUrl: string;
  transactionReference: string | null;
  customerNotes: string | null;
  status: PaymentSubmissionStatus;
  reviewedByAdminId: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentSubmissionDetail extends PaymentSubmissionRecord {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    total: string;
    paymentMethodCode: string | null;
    paymentMethodName: string | null;
    paymentStatus: string;
    customerName: string;
    customerPhoneMasked: string;
    customerEmailMasked: string | null;
    deliveryAddressMasked: string;
    createdAt: Date;
  };
  reviewedByAdmin?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface SubmitPaymentProofInput {
  orderNumber: string;
  orderLookupToken: string;
  proofImageUrl: string;
  transactionReference?: string | null;
  customerNotes?: string | null;
}

export interface PublicPaymentProofResponse {
  submissionId: string;
  orderNumber: string;
  status: PaymentSubmissionStatus;
  paymentStatus: string;
  submittedAt: Date;
  proofImageUrl: string;
  transactionReference: string | null;
}

export interface PaymentSubmissionFilter {
  status?: PaymentSubmissionStatus;
  orderNumber?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedPaymentSubmissions {
  items: PaymentSubmissionDetail[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreatePaymentSubmissionParams {
  orderId: string;
  proofImageUrl: string;
  transactionReference?: string | null;
  customerNotes?: string | null;
}

export interface ReviewPaymentSubmissionParams {
  submissionId: string;
  adminId: string;
  action: 'APPROVE' | 'REJECT';
  reason?: string;
}

export interface PaymentSubmissionRepository {
  createSubmission(
    params: CreatePaymentSubmissionParams,
  ): Promise<PaymentSubmissionRecord>;
  findSubmissionById(id: string): Promise<PaymentSubmissionDetail | null>;
  findPendingSubmissionByOrderId(
    orderId: string,
  ): Promise<PaymentSubmissionRecord | null>;
  listSubmissions(
    filter: PaymentSubmissionFilter,
  ): Promise<PaginatedPaymentSubmissions>;
  reviewSubmission(params: ReviewPaymentSubmissionParams): Promise<{
    submission: PaymentSubmissionRecord;
    previousStatus: PaymentSubmissionStatus;
  }>;
}
