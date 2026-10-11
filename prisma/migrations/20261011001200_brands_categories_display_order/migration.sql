-- AlterTable
ALTER TABLE "Category" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Category_isActive_displayOrder_idx" ON "Category"("isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "Brand_isActive_displayOrder_idx" ON "Brand"("isActive", "displayOrder");

