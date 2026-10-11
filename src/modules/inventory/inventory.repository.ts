import { Prisma } from '@prisma/client';
import { AppError } from '../../errors/app-error';
import { prisma } from '../../lib/prisma';
import type { PageResult } from '../../types/pagination';
import type {
  AdjustStockInput,
  InventoryMovementRecord,
  InventoryRepository,
  ListLowStockQuery,
  ListMovementsQuery,
  LowStockVariantRecord,
  VariantStockSummary,
} from './inventory.types';

function throwInventoryError(error: unknown, resource = 'Resource'): never {
  if (error instanceof AppError) {
    throw error;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      throw new AppError(404, 'NOT_FOUND', `${resource} was not found`);
    }
    if (error.code === 'P2003') {
      throw new AppError(
        400,
        'FOREIGN_KEY_VIOLATION',
        'Referenced entity does not exist',
      );
    }
  }
  throw error;
}

export class PrismaInventoryRepository implements InventoryRepository {
  async adjustStock(input: AdjustStockInput): Promise<{
    variant: VariantStockSummary;
    movement: InventoryMovementRecord;
  }> {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const variant = await tx.productVariant.findUnique({
            where: { id: input.variantId },
            select: {
              id: true,
              stock: true,
              lowStockThreshold: true,
              isActive: true,
            },
          });

          if (!variant) {
            throw new AppError(
              404,
              'NOT_FOUND',
              'Product variant was not found',
            );
          }

          const stockBefore = variant.stock;
          const stockAfter = stockBefore + input.quantityDelta;

          if (stockAfter < 0) {
            throw new AppError(
              400,
              'INSUFFICIENT_STOCK',
              `Stock cannot be negative. Current stock: ${stockBefore}, requested delta: ${input.quantityDelta}`,
            );
          }

          const updatedVariant = await tx.productVariant.update({
            where: { id: input.variantId },
            data: { stock: stockAfter },
            select: {
              id: true,
              stock: true,
              lowStockThreshold: true,
              isActive: true,
            },
          });

          const movement = await tx.inventoryMovement.create({
            data: {
              variantId: input.variantId,
              quantityDelta: input.quantityDelta,
              stockBefore,
              stockAfter,
              type: input.type,
              reason: input.reason.trim(),
              actorAdminId: input.actorAdminId,
            },
            include: {
              variant: {
                select: {
                  id: true,
                  sku: true,
                  sizeLabel: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
              actorAdmin: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          });

          return {
            variant: updatedVariant,
            movement: {
              id: movement.id,
              variantId: movement.variantId,
              quantityDelta: movement.quantityDelta,
              stockBefore: movement.stockBefore,
              stockAfter: movement.stockAfter,
              type: movement.type,
              reason: movement.reason,
              actorAdminId: movement.actorAdminId,
              createdAt: movement.createdAt,
              variant: movement.variant,
              actorAdmin: movement.actorAdmin,
            },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      throwInventoryError(error, 'Product variant');
    }
  }

  async listMovements(
    query: ListMovementsQuery,
  ): Promise<PageResult<InventoryMovementRecord>> {
    const where: Prisma.InventoryMovementWhereInput = {
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: query.startDate } : {}),
              ...(query.endDate ? { lte: query.endDate } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.inventoryMovement.count({ where }),
      prisma.inventoryMovement.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              sizeLabel: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          actorAdmin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      items: rows.map((m) => ({
        id: m.id,
        variantId: m.variantId,
        quantityDelta: m.quantityDelta,
        stockBefore: m.stockBefore,
        stockAfter: m.stockAfter,
        type: m.type,
        reason: m.reason,
        actorAdminId: m.actorAdminId,
        createdAt: m.createdAt,
        variant: m.variant,
        actorAdmin: m.actorAdmin,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize) || 0,
      },
    };
  }

  async listLowStock(
    query: ListLowStockQuery,
  ): Promise<PageResult<LowStockVariantRecord>> {
    const offset = (query.page - 1) * query.pageSize;
    const productId = query.productId ?? null;
    const isActive = query.isActive ?? null;

    const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "ProductVariant" pv
      WHERE pv.stock <= pv."lowStockThreshold"
        AND (${productId}::uuid IS NULL OR pv."productId" = ${productId}::uuid)
        AND (${isActive}::boolean IS NULL OR pv."isActive" = ${isActive}::boolean)
    `;

    const total = Number(countRows[0]?.count ?? 0n);

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        productId: string;
        sku: string;
        sizeLabel: string;
        sizeMilliliters: number;
        purchasePrice: Prisma.Decimal;
        sellingPrice: Prisma.Decimal;
        stock: number;
        lowStockThreshold: number;
        isActive: boolean;
        productName: string;
        productSlug: string;
        productIsActive: boolean;
      }>
    >`
      SELECT pv.id, pv."productId", pv.sku, pv."sizeLabel", pv."sizeMilliliters",
             pv."purchasePrice", pv."sellingPrice", pv.stock, pv."lowStockThreshold", pv."isActive",
             p.name AS "productName", p.slug AS "productSlug", p."isActive" AS "productIsActive"
      FROM "ProductVariant" pv
      INNER JOIN "Product" p ON p.id = pv."productId"
      WHERE pv.stock <= pv."lowStockThreshold"
        AND (${productId}::uuid IS NULL OR pv."productId" = ${productId}::uuid)
        AND (${isActive}::boolean IS NULL OR pv."isActive" = ${isActive}::boolean)
      ORDER BY pv.stock ASC, pv.sku ASC
      LIMIT ${query.pageSize} OFFSET ${offset}
    `;

    return {
      items: rows.map((r) => ({
        id: r.id,
        productId: r.productId,
        sku: r.sku,
        sizeLabel: r.sizeLabel,
        sizeMilliliters: r.sizeMilliliters,
        purchasePrice: r.purchasePrice.toFixed(2),
        sellingPrice: r.sellingPrice.toFixed(2),
        stock: r.stock,
        lowStockThreshold: r.lowStockThreshold,
        isActive: r.isActive,
        product: {
          id: r.productId,
          name: r.productName,
          slug: r.productSlug,
          isActive: r.productIsActive,
        },
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize) || 0,
      },
    };
  }

  async getVariantStock(
    variantId: string,
  ): Promise<VariantStockSummary | null> {
    return prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        stock: true,
        lowStockThreshold: true,
        isActive: true,
      },
    });
  }
}
