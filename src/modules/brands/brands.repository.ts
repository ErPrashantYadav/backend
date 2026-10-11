import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/app-error';
import type { PageResult } from '../../types/pagination';
import type { BrandRecord, BrandRepository } from './brands.types';

const brandSelect = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BrandSelect;

function throwBrandError(error: unknown, resource: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new AppError(409, 'DUPLICATE_RESOURCE', `${resource} already exists`);
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throw new AppError(404, 'NOT_FOUND', `${resource} was not found`);
  }
  throw error;
}

function pageResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PageResult<T> {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export class PrismaBrandRepository implements BrandRepository {
  async listBrands(input: {
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }): Promise<PageResult<BrandRecord>> {
    const where: Prisma.BrandWhereInput = {
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { slug: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.brand.count({ where }),
      prisma.brand.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        select: brandSelect,
      }),
    ]);
    return pageResult(rows, total, input.page, input.pageSize);
  }

  async findBrand(id: string): Promise<BrandRecord | null> {
    return prisma.brand.findUnique({
      where: { id },
      select: brandSelect,
    });
  }

  async createBrand(
    input: Omit<BrandRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BrandRecord> {
    try {
      return await prisma.brand.create({
        data: input,
        select: brandSelect,
      });
    } catch (error) {
      throwBrandError(error, 'Brand slug');
    }
  }

  async updateBrand(
    id: string,
    input: Partial<Omit<BrandRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BrandRecord> {
    try {
      return await prisma.brand.update({
        where: { id },
        data: input,
        select: brandSelect,
      });
    } catch (error) {
      throwBrandError(error, 'Brand');
    }
  }

  async deleteBrand(id: string): Promise<void> {
    try {
      await prisma.$transaction(
        async (transaction) => {
          const productCount = await transaction.product.count({
            where: { brandId: id },
          });
          if (productCount > 0) {
            throw new AppError(
              409,
              'BRAND_IN_USE',
              'Brand has products; deactivate it instead of deleting',
            );
          }
          await transaction.brand.delete({ where: { id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      throwBrandError(error, 'Brand');
    }
  }

  async reorderBrands(
    items: Array<{ id: string; displayOrder: number }>,
  ): Promise<void> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.brand.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );
  }
}
