-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" VARCHAR(50) NOT NULL DEFAULT 'default',
    "storeName" VARCHAR(180) NOT NULL DEFAULT 'Old Liquor',
    "storeTagline" VARCHAR(255),
    "primaryPhone" VARCHAR(50) NOT NULL DEFAULT '+977-9801234567',
    "secondaryPhone" VARCHAR(50),
    "supportEmail" VARCHAR(255) NOT NULL DEFAULT 'support@oldliquor.com',
    "address" VARCHAR(255) NOT NULL DEFAULT 'Kathmandu, Nepal',
    "city" VARCHAR(100) NOT NULL DEFAULT 'Kathmandu',
    "locationUrl" VARCHAR(2048),
    "socialLinks" JSONB,
    "businessHours" JSONB NOT NULL,
    "announcementText" TEXT,
    "announcementActive" BOOLEAN NOT NULL DEFAULT false,
    "announcementStartDate" TIMESTAMPTZ(3),
    "announcementEndDate" TIMESTAMPTZ(3),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kathmandu',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

