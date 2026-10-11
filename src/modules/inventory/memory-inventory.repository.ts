import { AppError } from '../../errors/app-error';
import type { PageResult } from '../catalog/catalog.types';
import type {
  AdjustStockInput,
  InventoryMovementRecord,
  InventoryRepository,
  ListLowStockQuery,
  ListMovementsQuery,
  LowStockVariantRecord,
  VariantStockSummary,
} from './inventory.types';

export interface MemoryVariantItem {
  id: string;
  productId: string;
  sku: string;
  sizeLabel: string;
  sizeMilliliters: number;
  purchasePrice: string;
  sellingPrice: string;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  product?: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  };
}

export class MemoryInventoryRepository implements InventoryRepository {
  variants: MemoryVariantItem[] = [];
  movements: InventoryMovementRecord[] = [];
  adminUsers: Array<{ id: string; name: string; email: string }> = [];

  constructor(
    variants: MemoryVariantItem[] = [],
    movements: InventoryMovementRecord[] = [],
  ) {
    this.variants = variants;
    this.movements = movements;
  }

  async adjustStock(input: AdjustStockInput): Promise<{
    variant: VariantStockSummary;
    movement: InventoryMovementRecord;
  }> {
    const variant = this.variants.find((v) => v.id === input.variantId);
    if (!variant) {
      throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
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

    variant.stock = stockAfter;

    const actor = this.adminUsers.find((u) => u.id === input.actorAdminId);
    const movement: InventoryMovementRecord = {
      id: crypto.randomUUID(),
      variantId: input.variantId,
      quantityDelta: input.quantityDelta,
      stockBefore,
      stockAfter,
      type: input.type,
      reason: input.reason,
      actorAdminId: input.actorAdminId,
      createdAt: new Date(),
      variant: {
        id: variant.id,
        sku: variant.sku,
        sizeLabel: variant.sizeLabel,
        product: {
          id: variant.productId,
          name: variant.product?.name ?? 'Test Product',
          slug: variant.product?.slug ?? 'test-product',
        },
      },
      actorAdmin: actor
        ? { id: actor.id, name: actor.name, email: actor.email }
        : null,
    };

    this.movements.push(movement);

    return {
      variant: {
        id: variant.id,
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
        isActive: variant.isActive,
      },
      movement,
    };
  }

  async listMovements(
    query: ListMovementsQuery,
  ): Promise<PageResult<InventoryMovementRecord>> {
    let list = [...this.movements];

    if (query.variantId) {
      list = list.filter((m) => m.variantId === query.variantId);
    }
    if (query.type) {
      list = list.filter((m) => m.type === query.type);
    }
    if (query.startDate) {
      list = list.filter((m) => m.createdAt >= query.startDate!);
    }
    if (query.endDate) {
      list = list.filter((m) => m.createdAt <= query.endDate!);
    }

    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = list.length;
    const start = (query.page - 1) * query.pageSize;
    const items = list.slice(start, start + query.pageSize);

    return {
      items,
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
    let list = this.variants.filter((v) => v.stock <= v.lowStockThreshold);

    if (query.productId) {
      list = list.filter((v) => v.productId === query.productId);
    }
    if (query.isActive !== undefined) {
      list = list.filter((v) => v.isActive === query.isActive);
    }

    list.sort((a, b) => a.stock - b.stock || a.sku.localeCompare(b.sku));

    const total = list.length;
    const start = (query.page - 1) * query.pageSize;
    const items = list.slice(start, start + query.pageSize).map((v) => ({
      id: v.id,
      productId: v.productId,
      sku: v.sku,
      sizeLabel: v.sizeLabel,
      sizeMilliliters: v.sizeMilliliters,
      purchasePrice: v.purchasePrice,
      sellingPrice: v.sellingPrice,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      isActive: v.isActive,
      product: {
        id: v.productId,
        name: v.product?.name ?? 'Test Product',
        slug: v.product?.slug ?? 'test-product',
        isActive: v.product?.isActive ?? true,
      },
    }));

    return {
      items,
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
    const variant = this.variants.find((v) => v.id === variantId);
    if (!variant) return null;
    return {
      id: variant.id,
      stock: variant.stock,
      lowStockThreshold: variant.lowStockThreshold,
      isActive: variant.isActive,
    };
  }
}
