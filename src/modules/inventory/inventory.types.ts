import type { PageResult } from '../catalog/catalog.types';

export const INVENTORY_MOVEMENT_TYPES = [
  'RESTOCK',
  'CORRECTION',
  'DAMAGE',
  'RETURN',
  'SALE',
  'INTERNAL_TRANSFER',
  'MANUAL_ADJUSTMENT',
  'OTHER',
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export interface InventoryMovementRecord {
  id: string;
  variantId: string;
  quantityDelta: number;
  stockBefore: number;
  stockAfter: number;
  type: InventoryMovementType;
  reason: string;
  actorAdminId: string | null;
  createdAt: Date;
  variant?: {
    id: string;
    sku: string;
    sizeLabel: string;
    product: {
      id: string;
      name: string;
      slug: string;
    };
  };
  actorAdmin?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface LowStockVariantRecord {
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
  product: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  };
}

export interface AdjustStockInput {
  variantId: string;
  quantityDelta: number;
  type: InventoryMovementType;
  reason: string;
  actorAdminId: string;
}

export interface ListMovementsQuery {
  page: number;
  pageSize: number;
  variantId?: string;
  startDate?: Date;
  endDate?: Date;
  type?: InventoryMovementType;
}

export interface ListLowStockQuery {
  page: number;
  pageSize: number;
  productId?: string;
  isActive?: boolean;
}

export interface VariantStockSummary {
  id: string;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
}

export interface InventoryRepository {
  adjustStock(input: AdjustStockInput): Promise<{
    variant: VariantStockSummary;
    movement: InventoryMovementRecord;
  }>;
  listMovements(
    query: ListMovementsQuery,
  ): Promise<PageResult<InventoryMovementRecord>>;
  listLowStock(
    query: ListLowStockQuery,
  ): Promise<PageResult<LowStockVariantRecord>>;
  getVariantStock(variantId: string): Promise<VariantStockSummary | null>;
}
