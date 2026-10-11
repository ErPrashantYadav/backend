-- AlterTable
ALTER TABLE "Order" ADD COLUMN "promoCode" VARCHAR(50),
ADD COLUMN "promoDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "promoCodeId" UUID;

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "minimumOrderAmount" DECIMAL(12,2),
    "maxDiscountAmount" DECIMAL(12,2),
    "startDate" TIMESTAMPTZ(3),
    "endDate" TIMESTAMPTZ(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCodeRedemption" (
    "id" UUID NOT NULL,
    "promoCodeId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCodeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_promoCode_idx" ON "Order"("promoCode");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_code_idx" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_isActive_idx" ON "PromoCode"("isActive");

-- CreateIndex
CREATE INDEX "PromoCode_startDate_endDate_idx" ON "PromoCode"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCodeRedemption_promoCodeId_orderId_key" ON "PromoCodeRedemption"("promoCodeId", "orderId");

-- CreateIndex
CREATE INDEX "PromoCodeRedemption_promoCodeId_idx" ON "PromoCodeRedemption"("promoCodeId");

-- CreateIndex
CREATE INDEX "PromoCodeRedemption_orderId_idx" ON "PromoCodeRedemption"("orderId");

-- CreateIndex
CREATE INDEX "PromoCodeRedemption_createdAt_idx" ON "PromoCodeRedemption"("createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoDiscount_check" CHECK ("promoDiscount" >= 0);
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_code_nonblank_check" CHECK (length(btrim("code")) > 0);
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_discountValue_check" CHECK ("discountValue" > 0);
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_percentage_cap_check" CHECK ("discountType" != 'PERCENTAGE' OR "discountValue" <= 100);
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_usedCount_check" CHECK ("usedCount" >= 0);
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_usageLimit_check" CHECK ("usageLimit" IS NULL OR "usageLimit" > 0);
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_minimumOrderAmount_check" CHECK ("minimumOrderAmount" IS NULL OR "minimumOrderAmount" >= 0);
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_maxDiscountAmount_check" CHECK ("maxDiscountAmount" IS NULL OR "maxDiscountAmount" > 0);
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_date_order_check" CHECK ("startDate" IS NULL OR "endDate" IS NULL OR "startDate" <= "endDate");
ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_discountAmount_check" CHECK ("discountAmount" >= 0);

