import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../errors/app-error';
import type { PageResult } from '../../types/pagination';
import type { CategoryRecord, CategoryRepository } from './categories.types';

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

function throwCategoryError(error: unknown, resource: string): never {
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

export class PrismaCategoryRepository implements CategoryRepository {
  async listCategories(input: {
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }): Promise<PageResult<CategoryRecord>> {
    const where: Prisma.CategoryWhereInput = {
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
      prisma.category.count({ where }),
      prisma.category.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        select: categorySelect,
      }),
    ]);
    return pageResult(rows, total, input.page, input.pageSize);
  }

  async findCategory(id: string): Promise<CategoryRecord | null> {
    return prisma.category.findUnique({
      where: { id },
      select: categorySelect,
    });
  }

  async createCategory(
    input: Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CategoryRecord> {
    try {
      return await prisma.category.create({
        data: input,
        select: categorySelect,
      });
    } catch (error) {
      throwCategoryError(error, 'Category slug');
    }
  }

  async updateCategory(
    id: string,
    input: Partial<Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<CategoryRecord> {
    try {
      return await prisma.category.update({
        where: { id },
        data: input,
        select: categorySelect,
      });
    } catch (error) {
      throwCategoryError(error, 'Category');
    }
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      await prisma.$transaction(
        async (transaction) => {
          const productCount = await transaction.product.count({
            where: { categoryId: id },
          });
          if (productCount > 0) {
            throw new AppError(
              409,
              'CATEGORY_IN_USE',
              'Category has products; deactivate it instead of deleting',
            );
          }
          await transaction.category.delete({ where: { id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      throwCategoryError(error, 'Category');
    }
  }
}
