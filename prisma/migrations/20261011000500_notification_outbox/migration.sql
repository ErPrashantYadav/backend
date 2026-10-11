-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "recipient" VARCHAR(254) NOT NULL,
    "subject" VARCHAR(255),
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMPTZ(3),
    "processedAt" TIMESTAMPTZ(3),
    "errorMessage" TEXT,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "orderId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_idempotencyKey_key" ON "NotificationOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_nextRetryAt_idx" ON "NotificationOutbox"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_orderId_idx" ON "NotificationOutbox"("orderId");

-- CreateIndex
CREATE INDEX "NotificationOutbox_channel_status_idx" ON "NotificationOutbox"("channel", "status");

-- CreateIndex
CREATE INDEX "NotificationOutbox_createdAt_idx" ON "NotificationOutbox"("createdAt");

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_attemptCount_check" CHECK ("attemptCount" >= 0);
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_maxAttempts_check" CHECK ("maxAttempts" > 0);
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_recipient_nonblank_check" CHECK (length(btrim("recipient")) > 0);
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_eventType_nonblank_check" CHECK (length(btrim("eventType")) > 0);
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_idempotencyKey_nonblank_check" CHECK (length(btrim("idempotencyKey")) > 0);

