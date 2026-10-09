-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "roleId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "imageUrl" VARCHAR(2048),
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "logoUrl" VARCHAR(2048),
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "imageUrl" VARCHAR(2048) NOT NULL,
    "publicId" VARCHAR(255),
    "altText" VARCHAR(255),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "sizeLabel" VARCHAR(50) NOT NULL,
    "sizeMilliliters" INTEGER NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "sellingPrice" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "deliveryAddress" VARCHAR(500) NOT NULL,
    "email" VARCHAR(254),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_roleId_isActive_idx" ON "AdminUser"("roleId", "isActive");

-- CreateIndex
CREATE INDEX "AdminUser_isActive_createdAt_idx" ON "AdminUser"("isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_isActive_name_idx" ON "Role"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_isActive_name_idx" ON "Category"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Brand_isActive_name_idx" ON "Brand"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_isActive_idx" ON "Product"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "Product_brandId_isActive_idx" ON "Product"("brandId", "isActive");

-- CreateIndex
CREATE INDEX "Product_isActive_createdAt_idx" ON "Product"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

-- CreateIndex
CREATE INDEX "ProductVariant_stock_idx" ON "ProductVariant"("stock");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_sizeMilliliters_key" ON "ProductVariant"("productId", "sizeMilliliters");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_email_nonblank_check" CHECK (length(btrim("email")) > 0);
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_email_normalized_check" CHECK ("email" = lower(btrim("email")));
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_name_nonblank_check" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Role" ADD CONSTRAINT "Role_name_nonblank_check" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_key_nonblank_check" CHECK (length(btrim("key")) > 0);
ALTER TABLE "Category" ADD CONSTRAINT "Category_name_nonblank_check" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Category" ADD CONSTRAINT "Category_slug_canonical_check" CHECK ("slug" = lower(btrim("slug")) AND "slug" ~ '^[[:alnum:]]+(-[[:alnum:]]+)*$');
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_name_nonblank_check" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_slug_canonical_check" CHECK ("slug" = lower(btrim("slug")) AND "slug" ~ '^[[:alnum:]]+(-[[:alnum:]]+)*$');
ALTER TABLE "Product" ADD CONSTRAINT "Product_name_nonblank_check" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_slug_canonical_check" CHECK ("slug" = lower(btrim("slug")) AND "slug" ~ '^[[:alnum:]]+(-[[:alnum:]]+)*$');
ALTER TABLE "Product" ADD CONSTRAINT "Product_discount_fields_consistent_check" CHECK (("discountType" IS NULL AND "discountValue" IS NULL) OR ("discountType" IS NOT NULL AND "discountValue" IS NOT NULL));
ALTER TABLE "Product" ADD CONSTRAINT "Product_discount_value_nonnegative_check" CHECK ("discountValue" IS NULL OR "discountValue" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_percentage_discount_max_check" CHECK ("discountType" IS DISTINCT FROM 'PERCENTAGE' OR ("discountValue" IS NOT NULL AND "discountValue" <= 100));
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_sortOrder_nonnegative_check" CHECK ("sortOrder" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sku_normalized_check" CHECK (length(btrim("sku")) > 0 AND "sku" = upper(btrim("sku")));
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sizeMilliliters_positive_check" CHECK ("sizeMilliliters" > 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sizeLabel_canonical_check" CHECK ("sizeLabel" = "sizeMilliliters"::text || ' ml');
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_purchasePrice_nonnegative_check" CHECK ("purchasePrice" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sellingPrice_nonnegative_check" CHECK ("sellingPrice" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_nonnegative_check" CHECK ("stock" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_lowStockThreshold_nonnegative_check" CHECK ("lowStockThreshold" >= 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_name_nonblank_check" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_phone_nonblank_check" CHECK (length(btrim("phone")) > 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_deliveryAddress_nonblank_check" CHECK (length(btrim("deliveryAddress")) > 0);
