-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('COD', 'STATIC_QR');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'PAID', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "providerLabel" VARCHAR(120),
    "accountName" VARCHAR(180),
    "accountNumber" VARCHAR(100),
    "qrImageUrl" VARCHAR(2048),
    "instructions" TEXT,
    "minAmount" DECIMAL(12,2),
    "maxAmount" DECIMAL(12,2),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paymentMethodCode" VARCHAR(50),
ADD COLUMN "paymentMethodName" VARCHAR(120),
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "paymentReference" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_code_key" ON "PaymentMethod"("code");

-- CreateIndex
CREATE INDEX "PaymentMethod_isActive_displayOrder_idx" ON "PaymentMethod"("isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- AddCheckConstraint
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_code_canonical_check" CHECK ("code" = upper(btrim("code")));
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_name_nonblank_check" CHECK (length(btrim("name")) > 0);
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_minAmount_nonnegative_check" CHECK ("minAmount" IS NULL OR "minAmount" >= 0);
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_maxAmount_nonnegative_check" CHECK ("maxAmount" IS NULL OR "maxAmount" >= 0);
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_amounts_order_check" CHECK ("minAmount" IS NULL OR "maxAmount" IS NULL OR "maxAmount" >= "minAmount");

