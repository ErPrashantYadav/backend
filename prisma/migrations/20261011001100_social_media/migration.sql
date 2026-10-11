-- CreateTable
CREATE TABLE "SocialMedia" (
    "id" UUID NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'video',
    "label" VARCHAR(180),
    "thumbnailUrl" VARCHAR(2048),
    "publicId" VARCHAR(255),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SocialMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialMedia_platform_idx" ON "SocialMedia"("platform");

-- CreateIndex
CREATE INDEX "SocialMedia_type_isActive_idx" ON "SocialMedia"("type", "isActive");

-- CreateIndex
CREATE INDEX "SocialMedia_isActive_displayOrder_idx" ON "SocialMedia"("isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "SocialMedia_createdAt_idx" ON "SocialMedia"("createdAt");

