-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('RESTOCK', 'CORRECTION', 'DAMAGE', 'RETURN', 'SALE', 'INTERNAL_TRANSFER', 'MANUAL_ADJUSTMENT', 'OTHER');

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "stockBefore" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "actorAdminId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryMovement_variantId_createdAt_idx" ON "InventoryMovement"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_actorAdminId_idx" ON "InventoryMovement"("actorAdminId");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_reason_nonblank_check" CHECK (length(btrim("reason")) > 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_stockBefore_nonnegative_check" CHECK ("stockBefore" >= 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_stockAfter_nonnegative_check" CHECK ("stockAfter" >= 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_quantityDelta_nonzero_check" CHECK ("quantityDelta" <> 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_delta_consistent_check" CHECK ("stockAfter" = "stockBefore" + "quantityDelta");

