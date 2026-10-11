-- CreateTable
CREATE TABLE "Banner" (
    "id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "imageUrl" VARCHAR(2048) NOT NULL,
    "publicId" VARCHAR(255),
    "linkUrl" VARCHAR(2048),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMPTZ(3),
    "endDate" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Banner_isActive_displayOrder_idx" ON "Banner"("isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "Banner_startDate_endDate_idx" ON "Banner"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Banner_createdAt_idx" ON "Banner"("createdAt");

