import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  CreateGalleryItemInput,
  GalleryItemRecord,
  GalleryRepository,
  ListGalleryParams,
  UpdateGalleryItemInput,
} from './gallery.types';

export class PrismaGalleryRepository implements GalleryRepository {
  async create(data: CreateGalleryItemInput): Promise<GalleryItemRecord> {
    return prisma.galleryItem.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        imageUrl: data.imageUrl,
        publicId: data.publicId ?? null,
        category: data.category ?? null,
        displayOrder: data.displayOrder ?? 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findById(id: string): Promise<GalleryItemRecord | null> {
    return prisma.galleryItem.findUnique({
      where: { id },
    });
  }

  async list(params: ListGalleryParams = {}): Promise<{
    items: GalleryItemRecord[];
    total: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.GalleryItemWhereInput = {};

    if (params.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params.category && params.category.trim().length > 0) {
      where.category = {
        equals: params.category.trim(),
        mode: 'insensitive',
      };
    }

    if (params.search && params.search.trim().length > 0) {
      const term = params.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { category: { contains: term, mode: 'insensitive' } },
      ];
    }

    const sortBy = params.sortBy ?? 'displayOrder';
    const sortOrder = params.sortOrder ?? 'asc';

    const orderBy: Prisma.GalleryItemOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
      { createdAt: 'desc' },
    ];

    const [items, total] = await Promise.all([
      prisma.galleryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      prisma.galleryItem.count({ where }),
    ]);

    return { items, total };
  }

  async listActive(category?: string): Promise<GalleryItemRecord[]> {
    const where: Prisma.GalleryItemWhereInput = {
      isActive: true,
    };

    if (category && category.trim().length > 0) {
      where.category = {
        equals: category.trim(),
        mode: 'insensitive',
      };
    }

    return prisma.galleryItem.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async update(
    id: string,
    data: UpdateGalleryItemInput,
  ): Promise<GalleryItemRecord> {
    const updateData: Prisma.GalleryItemUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.publicId !== undefined) updateData.publicId = data.publicId;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.displayOrder !== undefined)
      updateData.displayOrder = data.displayOrder;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.galleryItem.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.galleryItem.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}
