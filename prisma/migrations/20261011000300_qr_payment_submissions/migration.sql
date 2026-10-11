-- CreateEnum
CREATE TYPE "PaymentSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PaymentSubmission" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "proofImageUrl" VARCHAR(2048) NOT NULL,
    "transactionReference" VARCHAR(255),
    "customerNotes" TEXT,
    "status" "PaymentSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByAdminId" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentSubmission_orderId_idx" ON "PaymentSubmission"("orderId");

-- CreateIndex
CREATE INDEX "PaymentSubmission_status_idx" ON "PaymentSubmission"("status");

-- CreateIndex
CREATE INDEX "PaymentSubmission_createdAt_idx" ON "PaymentSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentSubmission_reviewedByAdminId_idx" ON "PaymentSubmission"("reviewedByAdminId");

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_proofImageUrl_url_check" CHECK ("proofImageUrl" ~* '^(https:\/\/|assets\/)');
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_rejectionReason_check" CHECK ("status" != 'REJECTED' OR ("rejectionReason" IS NOT NULL AND length(btrim("rejectionReason")) > 0));

