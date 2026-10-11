import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  CreateSocialMediaInput,
  ListSocialMediaParams,
  PlatformCounts,
  SocialMediaRecord,
  SocialMediaRepository,
  UpdateSocialMediaInput,
} from './social-media.types';

export class PrismaSocialMediaRepository implements SocialMediaRepository {
  async create(data: CreateSocialMediaInput): Promise<SocialMediaRecord> {
    return prisma.socialMedia.create({
      data: {
        platform: data.platform.toUpperCase(),
        url: data.url,
        type: data.type ?? 'video',
        label: data.label ?? null,
        thumbnailUrl: data.thumbnailUrl ?? null,
        publicId: data.publicId ?? null,
        displayOrder: data.displayOrder ?? 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  async createMany(
    data: CreateSocialMediaInput[],
  ): Promise<SocialMediaRecord[]> {
    const created: SocialMediaRecord[] = [];
    for (const item of data) {
      const record = await this.create(item);
      created.push(record);
    }
    return created;
  }

  async findById(id: string): Promise<SocialMediaRecord | null> {
    return prisma.socialMedia.findUnique({
      where: { id },
    });
  }

  async list(params: ListSocialMediaParams = {}): Promise<{
    items: SocialMediaRecord[];
    total: number;
    platformCounts: PlatformCounts;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SocialMediaWhereInput = {};

    if (params.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params.type && params.type.trim().length > 0) {
      where.type = params.type.trim();
    }

    if (
      params.platform &&
      params.platform.trim().length > 0 &&
      params.platform.trim().toUpperCase() !== 'ALL'
    ) {
      where.platform = {
        equals: params.platform.trim().toUpperCase(),
        mode: 'insensitive',
      };
    }

    if (params.search && params.search.trim().length > 0) {
      const term = params.search.trim();
      where.OR = [
        { label: { contains: term, mode: 'insensitive' } },
        { url: { contains: term, mode: 'insensitive' } },
        { platform: { contains: term, mode: 'insensitive' } },
      ];
    }

    let orderBy: Prisma.SocialMediaOrderByWithRelationInput[] = [
      { displayOrder: 'asc' },
      { createdAt: 'desc' },
    ];

    if (params.sortBy) {
      const sortOrder = params.sortOrder === 'desc' ? 'desc' : 'asc';
      orderBy = [{ [params.sortBy]: sortOrder }, { createdAt: 'desc' }];
    }

    const [items, total, platformGroups] = await Promise.all([
      prisma.socialMedia.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      prisma.socialMedia.count({ where }),
      prisma.socialMedia.groupBy({
        by: ['platform'],
        _count: { _all: true },
        where: params.type ? { type: params.type } : undefined,
      }),
    ]);

    const counts: PlatformCounts = {
      ALL: 0,
      FACEBOOK: 0,
      INSTAGRAM: 0,
      YOUTUBE: 0,
      TIKTOK: 0,
      OTHER: 0,
    };

    let allCount = 0;
    for (const group of platformGroups) {
      const key = group.platform.toUpperCase();
      counts[key] = group._count._all;
      allCount += group._count._all;
    }
    counts.ALL = allCount;

    return {
      items,
      total,
      platformCounts: counts,
    };
  }

  async listActive(
    type?: string,
    platform?: string,
  ): Promise<SocialMediaRecord[]> {
    const where: Prisma.SocialMediaWhereInput = {
      isActive: true,
    };

    if (type && type.trim().length > 0) {
      where.type = type.trim();
    }

    if (
      platform &&
      platform.trim().length > 0 &&
      platform.trim().toUpperCase() !== 'ALL'
    ) {
      where.platform = {
        equals: platform.trim().toUpperCase(),
        mode: 'insensitive',
      };
    }

    return prisma.socialMedia.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async update(
    id: string,
    data: UpdateSocialMediaInput,
  ): Promise<SocialMediaRecord> {
    const updateData: Prisma.SocialMediaUpdateInput = {};

    if (data.platform !== undefined) {
      updateData.platform = data.platform.toUpperCase();
    }
    if (data.url !== undefined) {
      updateData.url = data.url;
    }
    if (data.type !== undefined) {
      updateData.type = data.type;
    }
    if (data.label !== undefined) {
      updateData.label = data.label;
    }
    if (data.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = data.thumbnailUrl;
    }
    if (data.publicId !== undefined) {
      updateData.publicId = data.publicId;
    }
    if (data.displayOrder !== undefined) {
      updateData.displayOrder = data.displayOrder;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    return prisma.socialMedia.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.socialMedia.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}
