import { AppError } from '../../errors/app-error';
import type { PageResult } from '../catalog/catalog.types';
import {
  INVENTORY_MOVEMENT_TYPES,
  type AdjustStockInput,
  type InventoryMovementRecord,
  type InventoryRepository,
  type ListLowStockQuery,
  type ListMovementsQuery,
  type LowStockVariantRecord,
  type VariantStockSummary,
} from './inventory.types';

export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  async adjustStock(input: AdjustStockInput): Promise<{
    variant: VariantStockSummary;
    movement: InventoryMovementRecord;
  }> {
    const trimmedReason = input.reason.trim();
    if (!trimmedReason || trimmedReason.length > 500) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Adjustment reason is required and must be at most 500 characters',
      );
    }

    if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Quantity delta must be a non-zero integer',
      );
    }

    if (!INVENTORY_MOVEMENT_TYPES.includes(input.type)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Invalid adjustment type. Allowed types: ${INVENTORY_MOVEMENT_TYPES.join(', ')}`,
      );
    }

    if (!input.actorAdminId || !input.actorAdminId.trim()) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Actor admin ID is required for stock adjustments',
      );
    }

    return this.repository.adjustStock({
      ...input,
      reason: trimmedReason,
    });
  }

  async listMovements(
    query: ListMovementsQuery,
  ): Promise<PageResult<InventoryMovementRecord>> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));

    if (query.type && !INVENTORY_MOVEMENT_TYPES.includes(query.type)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Invalid movement type filter: ${query.type}`,
      );
    }

    return this.repository.listMovements({
      ...query,
      page,
      pageSize,
    });
  }

  async listLowStock(
    query: ListLowStockQuery,
  ): Promise<PageResult<LowStockVariantRecord>> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));

    return this.repository.listLowStock({
      ...query,
      page,
      pageSize,
    });
  }

  async getVariantStock(variantId: string): Promise<VariantStockSummary> {
    const variant = await this.repository.getVariantStock(variantId);
    if (!variant) {
      throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
    }
    return variant;
  }
}
