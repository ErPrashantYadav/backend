import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  ContactInquiryRecord,
  ContactInquiryRepository,
  CreateContactInquiryInput,
  ListContactInquiriesParams,
  UpdateContactInquiryStatusInput,
} from './contact-inquiry.types';

export class PrismaContactInquiryRepository implements ContactInquiryRepository {
  async create(data: CreateContactInquiryInput): Promise<ContactInquiryRecord> {
    const created = await prisma.contactInquiry.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        subject: data.subject,
        message: data.message,
        status: 'NEW',
      },
    });

    return created as ContactInquiryRecord;
  }

  async findById(id: string): Promise<ContactInquiryRecord | null> {
    const record = await prisma.contactInquiry.findUnique({
      where: { id },
    });

    return (record as ContactInquiryRecord) ?? null;
  }

  async list(params: ListContactInquiriesParams): Promise<{
    items: ContactInquiryRecord[];
    total: number;
  }> {
    const where: Prisma.ContactInquiryWhereInput = {};

    if (params.search && params.search.trim()) {
      const term = params.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.createdAt.lte = new Date(params.endDate);
      }
    }

    const total = await prisma.contactInquiry.count({ where });

    const sortOrder = params.sortOrder ?? 'desc';
    const orderBy: Prisma.ContactInquiryOrderByWithRelationInput =
      params.sortBy === 'name'
        ? { name: sortOrder }
        : params.sortBy === 'status'
          ? { status: sortOrder }
          : { createdAt: sortOrder };

    const items = await prisma.contactInquiry.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy,
    });

    return {
      items: items as ContactInquiryRecord[],
      total,
    };
  }

  async updateStatus(
    id: string,
    data: UpdateContactInquiryStatusInput,
  ): Promise<ContactInquiryRecord> {
    const updateData: Prisma.ContactInquiryUpdateInput = {
      status: data.status,
    };

    if (data.adminNote !== undefined) {
      updateData.adminNote = data.adminNote;
    }

    if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
      updateData.resolvedAt = new Date();
    }

    const updated = await prisma.contactInquiry.update({
      where: { id },
      data: updateData,
    });

    return updated as ContactInquiryRecord;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.contactInquiry.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}
