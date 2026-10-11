import type {
  ContactInquiryRecord,
  ContactInquiryRepository,
  CreateContactInquiryInput,
  ListContactInquiriesParams,
  UpdateContactInquiryStatusInput,
} from './contact-inquiry.types';

export class MemoryContactInquiryRepository implements ContactInquiryRepository {
  inquiries: ContactInquiryRecord[] = [];

  constructor(initial: ContactInquiryRecord[] = []) {
    this.inquiries = [...initial];
  }

  async create(data: CreateContactInquiryInput): Promise<ContactInquiryRecord> {
    const record: ContactInquiryRecord = {
      id: crypto.randomUUID(),
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      subject: data.subject,
      message: data.message,
      status: 'NEW',
      adminNote: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.inquiries.push(record);
    return record;
  }

  async findById(id: string): Promise<ContactInquiryRecord | null> {
    const found = this.inquiries.find((i) => i.id === id);
    return found ? { ...found } : null;
  }

  async list(params: ListContactInquiriesParams): Promise<{
    items: ContactInquiryRecord[];
    total: number;
  }> {
    let items = [...this.inquiries];

    if (params.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(term) ||
          i.phone.toLowerCase().includes(term) ||
          (i.email && i.email.toLowerCase().includes(term)) ||
          i.subject.toLowerCase().includes(term),
      );
    }

    if (params.status) {
      items = items.filter((i) => i.status === params.status);
    }

    if (params.startDate) {
      const start = new Date(params.startDate).getTime();
      items = items.filter((i) => new Date(i.createdAt).getTime() >= start);
    }

    if (params.endDate) {
      const end = new Date(params.endDate).getTime();
      items = items.filter((i) => new Date(i.createdAt).getTime() <= end);
    }

    const sortOrder = params.sortOrder ?? 'desc';
    const sortBy = params.sortBy ?? 'createdAt';

    items.sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortBy === 'status') {
        return sortOrder === 'asc'
          ? a.status.localeCompare(b.status)
          : b.status.localeCompare(a.status);
      }
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    const total = items.length;
    const startIdx = (params.page - 1) * params.limit;
    const paginated = items.slice(startIdx, startIdx + params.limit);

    return {
      items: paginated.map((i) => ({ ...i })),
      total,
    };
  }

  async updateStatus(
    id: string,
    data: UpdateContactInquiryStatusInput,
  ): Promise<ContactInquiryRecord> {
    const record = this.inquiries.find((i) => i.id === id);
    if (!record) {
      throw new Error('Inquiry not found');
    }

    record.status = data.status;
    if (data.adminNote !== undefined) {
      record.adminNote = data.adminNote;
    }
    if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
      if (!record.resolvedAt) {
        record.resolvedAt = new Date();
      }
    }
    record.updatedAt = new Date();

    return { ...record };
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.inquiries.findIndex((i) => i.id === id);
    if (idx === -1) {
      return false;
    }
    this.inquiries.splice(idx, 1);
    return true;
  }
}
