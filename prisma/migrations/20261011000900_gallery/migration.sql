-- CreateTable
CREATE TABLE "GalleryItem" (
    "id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "imageUrl" VARCHAR(2048) NOT NULL,
    "publicId" VARCHAR(255),
    "category" VARCHAR(100),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalleryItem_isActive_displayOrder_idx" ON "GalleryItem"("isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "GalleryItem_category_idx" ON "GalleryItem"("category");

-- CreateIndex
CREATE INDEX "GalleryItem_createdAt_idx" ON "GalleryItem"("createdAt");

