-- AlterTable
ALTER TABLE "StoreSettings"
  ADD COLUMN "storeOriginLatitude" DECIMAL(10,7),
  ADD COLUMN "storeOriginLongitude" DECIMAL(10,7),
  ADD COLUMN "deliveryFeeMode" VARCHAR(20) NOT NULL DEFAULT 'PER_KM',
  ADD COLUMN "deliveryFeeBaseAmount" DECIMAL(12,2) NOT NULL DEFAULT 100.00,
  ADD COLUMN "deliveryFeePerKmAmount" DECIMAL(12,2) NOT NULL DEFAULT 25.00,
  ADD COLUMN "deliveryFeeFreeThreshold" DECIMAL(12,2),
  ADD COLUMN "hasExplicitDeliveryFeeFreeThreshold" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryMaxDistanceKm" DECIMAL(8,2) NOT NULL DEFAULT 25.00,
  ADD COLUMN "deliveryFallbackAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "isOrderingEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "orderingMessage" VARCHAR(500);

-- Constraints
ALTER TABLE "StoreSettings"
  ADD CONSTRAINT "StoreSettings_storeOriginLatitude_check" CHECK ("storeOriginLatitude" IS NULL OR ("storeOriginLatitude" >= -90 AND "storeOriginLatitude" <= 90)),
  ADD CONSTRAINT "StoreSettings_storeOriginLongitude_check" CHECK ("storeOriginLongitude" IS NULL OR ("storeOriginLongitude" >= -180 AND "storeOriginLongitude" <= 180)),
  ADD CONSTRAINT "StoreSettings_deliveryFeeBaseAmount_check" CHECK ("deliveryFeeBaseAmount" >= 0),
  ADD CONSTRAINT "StoreSettings_deliveryFeePerKmAmount_check" CHECK ("deliveryFeePerKmAmount" >= 0),
  ADD CONSTRAINT "StoreSettings_deliveryFeeFreeThreshold_check" CHECK ("deliveryFeeFreeThreshold" IS NULL OR "deliveryFeeFreeThreshold" >= 0),
  ADD CONSTRAINT "StoreSettings_deliveryMaxDistanceKm_check" CHECK ("deliveryMaxDistanceKm" > 0),
  ADD CONSTRAINT "StoreSettings_deliveryFallbackAmount_check" CHECK ("deliveryFallbackAmount" >= 0),
  ADD CONSTRAINT "StoreSettings_deliveryFeeMode_check" CHECK ("deliveryFeeMode" IN ('FIXED', 'PER_KM', 'TIERED'));

