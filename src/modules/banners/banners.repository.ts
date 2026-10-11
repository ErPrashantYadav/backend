import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  BannerRecord,
  BannerRepository,
  CreateBannerInput,
  ListBannersParams,
  UpdateBannerInput,
} from './banners.types';

export class PrismaBannerRepository implements BannerRepository {
  async create(data: CreateBannerInput): Promise<BannerRecord> {
    return prisma.banner.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        imageUrl: data.imageUrl,
        publicId: data.publicId ?? null,
        linkUrl: data.linkUrl ?? null,
        displayOrder: data.displayOrder ?? 0,
        isActive: data.isActive ?? true,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
      },
    });
  }

  async findById(id: string): Promise<BannerRecord | null> {
    return prisma.banner.findUnique({
      where: { id },
    });
  }

  async list(params: ListBannersParams = {}): Promise<{
    items: BannerRecord[];
    total: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.BannerWhereInput = {};

    if (params.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params.search && params.search.trim().length > 0) {
      const term = params.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const sortBy = params.sortBy ?? 'displayOrder';
    const sortOrder = params.sortOrder ?? 'asc';

    const orderBy: Prisma.BannerOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
      { createdAt: 'desc' },
    ];

    const [items, total] = await Promise.all([
      prisma.banner.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      prisma.banner.count({ where }),
    ]);

    return { items, total };
  }

  async listActive(now: Date = new Date()): Promise<BannerRecord[]> {
    return prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [{ startDate: null }, { startDate: { lte: now } }],
          },
          {
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async update(id: string, data: UpdateBannerInput): Promise<BannerRecord> {
    const updateData: Prisma.BannerUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.publicId !== undefined) updateData.publicId = data.publicId;
    if (data.linkUrl !== undefined) updateData.linkUrl = data.linkUrl;
    if (data.displayOrder !== undefined)
      updateData.displayOrder = data.displayOrder;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;

    return prisma.banner.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.banner.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  async reorder(
    items: Array<{ id: string; displayOrder: number }>,
  ): Promise<void> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.banner.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );
  }
}
