export type ContactInquiryStatus =
  'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface ContactInquiryRecord {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  subject: string;
  message: string;
  status: ContactInquiryStatus;
  adminNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContactInquiryInput {
  name: string;
  phone: string;
  email?: string | null;
  subject: string;
  message: string;
}

export interface ListContactInquiriesParams {
  page: number;
  limit: number;
  search?: string;
  status?: ContactInquiryStatus;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'name' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateContactInquiryStatusInput {
  status: ContactInquiryStatus;
  adminNote?: string | null;
}

export interface ContactInquiryRepository {
  create(data: CreateContactInquiryInput): Promise<ContactInquiryRecord>;
  findById(id: string): Promise<ContactInquiryRecord | null>;
  list(params: ListContactInquiriesParams): Promise<{
    items: ContactInquiryRecord[];
    total: number;
  }>;
  updateStatus(
    id: string,
    data: UpdateContactInquiryStatusInput,
  ): Promise<ContactInquiryRecord>;
  delete(id: string): Promise<boolean>;
}
