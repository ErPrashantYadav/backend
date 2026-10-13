# Liquor Shop Backend

Independent Node.js, TypeScript, Express and PostgreSQL e-commerce backend powering the Liquor Shop storefront and administration portal.

## API Documentation & Postman

- **Comprehensive API & Developer Guide**: [docs/api-documentation.md](file:///d:/KreativeMandu/oldLiquor/backend/docs/api-documentation.md)
- **Database & Admin Operations Guide**: [docs/database-and-admin-operations.md](file:///d:/KreativeMandu/oldLiquor/backend/docs/database-and-admin-operations.md)
- **Cloudinary Upload Testing Guide**: [docs/cloudinary-upload-testing.md](file:///d:/KreativeMandu/oldLiquor/backend/docs/cloudinary-upload-testing.md)
- **Notification Provider Testing Guide**: [docs/notification-provider-testing.md](file:///d:/KreativeMandu/oldLiquor/backend/docs/notification-provider-testing.md)
- **OpenAPI 3.1 Specification (JSON)**: [docs/openapi.json](file:///d:/KreativeMandu/oldLiquor/backend/docs/openapi.json)
- **OpenAPI 3.1 Specification (YAML)**: [docs/openapi.yaml](file:///d:/KreativeMandu/oldLiquor/backend/docs/openapi.yaml)
- **Postman API Testing Guide**: [docs/postman-api-testing-guide.md](file:///d:/KreativeMandu/oldLiquor/backend/docs/postman-api-testing-guide.md)
- **Postman Collection (v2.1)**: [docs/postman/liquor-shop-backend.postman_collection.json](file:///d:/KreativeMandu/oldLiquor/backend/docs/postman/liquor-shop-backend.postman_collection.json)
- **Postman Environment Template**: [docs/postman/liquor-shop-backend.postman_environment.json](file:///d:/KreativeMandu/oldLiquor/backend/docs/postman/liquor-shop-backend.postman_environment.json)

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 14 or newer

## Install

```powershell
npm install
Copy-Item .env.example .env
```

Set `DATABASE_URL` to the PostgreSQL connection string for your local database and set `CORS_ORIGINS` to the exact frontend origins, comma-separated if needed. The example contains placeholders only. Do not commit `.env` or put production credentials in source control.

## Development

```powershell
npm run dev
```

The API listens on `http://localhost:3000` by default. Liveness is available at `/api/health/live`; readiness is at `/api/health/ready` and runs a database query.

## Admin Authentication

Admin and staff access is provided by `POST /api/admin/auth/login` and `GET /api/admin/auth/me`. Customer authentication, registration, refresh tokens, sessions, and logout are not provided. Set `JWT_SECRET` to an unpadded base64url encoding of at least 32 cryptographically random bytes, and provide explicit `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_ACCESS_TOKEN_TTL_SECONDS=900`. The example secret is deliberately invalid; generate and configure a separate secret per environment through the deployment secret manager. Access tokens use HS256, an admin-only token-use claim, and a fixed 15-minute expiration. Passwords are verified with Argon2id. Protected requests reload account status, role status, and permissions from PostgreSQL. Login attempts are subject to a stricter process-local rate limit in addition to the global API limit.

## Admin and Role Management

Protected management endpoints are mounted at `/api/admin`: `GET/POST /users`, `GET/PATCH /users/:id`, `PATCH /users/:id/status`, `PATCH /users/:id/password`, `GET /roles`, `GET /permissions`, `GET/POST /roles`, `PATCH /roles/:id`, `PUT /roles/:id/permissions`, and `DELETE /roles/:id/permissions/:permissionKey`. They require the corresponding `admin.users.*` or `admin.roles.*` permission. The `admin.system.manage` permission grants the full management permission set. Hard deletion of admins and roles is not exposed. Changes that would deactivate or deprivilege the last active system administrator are rejected; self-deactivation is rejected.

## Catalog Management

Protected catalog routes use `/api/admin/categories`, `/api/admin/brands`, `/api/admin/products`, `/api/admin/products/:id/images`, and `/api/admin/products/:id/variants`. Admin brand reorder route `PUT /api/admin/brands/reorder` (requires `catalog.brands.update`) persists custom display order via `$transaction` (Category reordering is not supported). Each resource supports permission-scoped list/detail/create/update/delete operations where applicable; admin lists support pagination, and lists support search/filtering. Category and brand deletes return a conflict while products reference them; delete operations for products and variants deactivate them to preserve future order/inventory references. Product image records store HTTPS image URLs and metadata; image upload integration is not part of these CRUD routes. Variant size input accepts `ml` or `L` and is normalized to a positive integer millilitre key and canonical `<n> ml` label. SKUs are trimmed and uppercased; slugs use NFKC, lowercase, and hyphen-separated Unicode letters/numbers. Discounts exist only on products.

## Admin Dashboard and Sales Analytics

Protected analytics endpoints are mounted at `/api/admin/dashboard` and require the `dashboard.read` permission (or `admin.system.manage`):

- `GET /api/admin/dashboard/summary` (alias `/overview`): High-level operational metrics including total orders, today's orders, pending orders, delivered orders, gross sales, average order value, payment summary (paid vs pending vs failed), low-stock count, and active promo code count.
- `GET /api/admin/dashboard/sales` (alias `/sales-chart`): Aggregated sales time series grouped by `day`, `week`, or `month` with optional `startDate` and `endDate` ISO-8601 filters. Excludes cancelled orders from revenue and volume calculations.
- `GET /api/admin/dashboard/order-status-breakdown` (alias `/orders/status-breakdown`): Distribution of orders across all fulfillment statuses (`PENDING`, `CONFIRMED`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`).
- `GET /api/admin/dashboard/top-products` (alias `/best-sellers`): Top selling products and variants ranked by total quantity sold and revenue generated, bounded with an optional `limit` query param (1–100, default 10). Excludes cancelled orders.
- `GET /api/admin/dashboard/low-stock` (alias `/inventory`): Lists active catalog variants whose current inventory is at or below their configured `lowStockThreshold`, ordered ascending by stock.

## Admin Customer Management and Guest Order History

Protected customer management endpoints are mounted at `/api/admin/customers` and require the `customers.read` permission (or `admin.system.manage`):

- `GET /api/admin/customers`: Paginated listing of customer accounts created via guest checkouts. Supports search across `name`, `phone`, and `email` (case-insensitive substring match). Supports pagination query parameters (`page`, `limit`) and sorting (`sortBy` in `createdAt`, `name`, `orderCount`, `totalSpent`, `latestOrderAt`, `sortOrder` in `asc`, `desc`). Computes aggregated metrics (`orderCount`, `totalSpent` excluding cancelled orders, `latestOrderAt`) per customer. Preserves distinct customer identities without automatically merging separate records sharing the same phone number.
- `GET /api/admin/customers/:id`: Retrieves full customer profile, complete summary metrics (`orderCount`, `totalSpent`, `latestOrderAt`, `firstOrderAt`, `completedOrderCount`, `pendingOrderCount`, `cancelledOrderCount`), and the 5 most recent orders. Returns 404 `CUSTOMER_NOT_FOUND` if not found.
- `GET /api/admin/customers/:id/orders`: Retrieves full paginated order history for the specified customer. Supports query filters by `status` (e.g. `DELIVERED`, `CANCELLED`), `paymentStatus` (e.g. `PAID`, `UNDER_REVIEW`), date range (`startDate`, `endDate` in ISO-8601), and sorting (`sortBy` in `createdAt`, `total`).
- **Security & Privacy**: All responses strictly exclude sensitive fields, including `orderLookupToken`, `lookupTokenHash`, `idempotencyKey`, and `requestFingerprint`. Customers continue to checkout as guests without requiring passwords or sessions.

## Contact & Customer Inquiries

Public and admin endpoints for managing customer contact messages and inquiries:

- `POST /api/contact` (alias `/api/contact-inquiries`): Public submission endpoint allowing guests to submit an inquiry with `name`, `phone`, optional `email`, `subject`, and `message`. Protected by an IP rate limiter (10 requests per 15 minutes), strict Zod length boundaries, input sanitization, and normalization. Client-supplied internal fields (`status`, `adminNote`, `id`, `resolvedAt`) are strictly ignored.
- `GET /api/admin/contact-inquiries` (alias `/api/admin/contact`): Paginated listing protected by `contact-inquiries.read`. Supports query parameters for `page`, `limit` (max 100), `search` across name, phone, email, and subject, `status` filter (`NEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`), date range filter (`startDate`, `endDate`), and sorting.
- `GET /api/admin/contact-inquiries/:id`: Retrieves inquiry details including internal `adminNote`, `status`, and `resolvedAt`. Protected by `contact-inquiries.read`.
- `PATCH /api/admin/contact-inquiries/:id/status` (alias `PUT`): Updates the inquiry status (`NEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`) and optional internal `adminNote`. Automatically timestamps `resolvedAt` upon resolution/closure and generates a persistent audit log record. Protected by `contact-inquiries.update`.
- `DELETE /api/admin/contact-inquiries/:id`: Deletes an inquiry record and logs an audit log event. Protected by `contact-inquiries.update`.

### One-Time Initial Administrator Provisioning

Provisioning is an explicit CLI operation; application startup never runs it. Confirm `DATABASE_URL` points to the intended database before invoking it. Provide `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, and `INITIAL_ADMIN_PASSWORD` through a secure secret manager or process environment injection. The password must be at least 16 characters; it is never printed. Avoid putting the password literal in a saved script or shell command history. Once the variables are injected into the process environment, run:

```powershell
npm run admin:provision:initial
```

The command normalizes email, hashes with the authentication module's Argon2id parameters, and atomically creates the initial `Initial Super Administrator` role, all admin-management and catalog permission keys, their assignments, and the first active admin. Before writing, it verifies that `current_database()` exactly matches `INITIAL_ADMIN_EXPECTED_DATABASE`. It refuses to proceed if any admin exists, the initial role exists, any required permission already exists, or any role-permission assignment exists. It never overwrites records. If any check or insert fails, the transaction rolls back. If the state was partially populated by an earlier/manual process, stop and inspect it read-only, then reconcile it deliberately in a separately reviewed procedure before retrying. Do not delete partial records blindly or rerun with different credentials expecting an update. The provisioning command has been added but must not be run until the target database is explicitly approved.

### Sample Catalog Seeding

For testing and local development, an idempotent sample catalog seed script is provided:

```powershell
# Safe non-destructive dry run (validates schema constraints without DB writes)
npm run db:seed:sample -- --dry-run

# Live seed execution (upserts sample categories, brands, products, and variants)
npm run db:seed:sample
```

The dataset includes 5 categories, 5 brands, 7 products, and 14 variants with clearly identifiable `SAMPLE-*` SKUs. The script is protected against running in production environments unless `ALLOW_PRODUCTION_SAMPLE_SEED=true` is set. It never modifies admin users, roles, permissions, orders, payments, customers, or inventory movements.

## Database Schema and Migrations

The initial schema includes admin users, roles and permissions; categories, brands, products, product images, product variants and guest customer identity records. Customers have no password or authentication relationship. Customer name, phone and delivery address are required; email is optional. A future order must keep its own address snapshot rather than relying on the customer's current address. Variant SKU, canonical size, purchase/selling prices, stock and low-stock threshold are stored on `ProductVariant`; product-level discounts are stored on `Product`. Money uses PostgreSQL `Decimal(12,2)` (ten integer digits and two fractional digits). Activation state and low-stock threshold require explicit values; stock defaults to zero. Category/brand/product/variant relations use restrictive deletion where records may later be referenced by order or inventory history; product image rows may be removed with their product.

Customer phone and email indexes are intentionally non-unique. Identity matching/merging policy has not been decided. Normalize admin email with trim + lowercase, SKU with trim + uppercase, and slug with Unicode NFKC + lowercase, replacing runs of non-letter/non-digit characters with one hyphen and trimming boundary hyphens. The migration checks canonical email/SKU case and slug case/shape before the corresponding unique indexes. This avoids Prisma-unmodeled `citext` or functional indexes; the tradeoff is that writes which bypass application normalization must already provide canonical values. The database slug check does not implement full Unicode NFKC normalization, so the future validator remains responsible for that step. Email lowercasing also assumes admin email addresses are treated case-insensitively.

Size input normalization is specified as follows: accept positive volume labels in `mL` or `L`, case-insensitively; convert exactly to a positive integer millilitre count; reject unsupported units and values that cannot be represented as whole millilitres; store `sizeMilliliters` and display `sizeLabel` as `<integer> ml` (for example, `1 L` becomes `1000 ml`). The composite unique key uses the integer volume, and a database check requires the display label to match it. This schema therefore treats variants as volume sizes, not package counts.

Product discounts apply to a selected variant's selling price: percentage discounts use the stored rate; fixed discounts subtract the stored amount; the effective unit price must be clamped at zero and quantized to the store currency's two decimal places. PostgreSQL can validate discount field pairing, non-negative amount and the 0-100 percentage range, but cannot enforce the resulting price across the Product/ProductVariant relation with a normal `CHECK`; future checkout/pricing code must enforce the clamp. Whether coupons stack with product discounts, and their application order/base, remain unapproved and are not encoded here. The rounding mode for percentage calculations also remains to be selected. The SQL migration contains manually maintained `CHECK` clauses because Prisma schema validation cannot express them.

Validate or generate the Prisma client with `npm run db:validate` and `npm run db:generate`. The prepared initial migration is `prisma/migrations/20261009000000_initial_liquor_shop/migration.sql`. It was generated from an empty schema and then manually updated for the canonical-size field, customer address and database checks. Prisma does not model the manual checks, so preserve and review them in future migrations. The Render development database was previously inspected read-only and contained no non-system tables; it was not contacted for this task. Do not run `migrate dev` against Render; use it only with a disposable/local development database. Rerunning the following diff command overwrites the SQL file and removes the manual checks until they are reapplied:

```powershell
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output prisma/migrations/20261009000000_initial_liquor_shop/migration.sql
```

Review the SQL and test it against a local development database first. The command that would apply committed migrations to Render is `npm run db:migrate`. Do not run it until the migration SQL is reviewed and explicitly approved. Never reset or drop the Render database.

## Checks

```powershell
npm test
npm run lint
npm run typecheck
npm run format
npm run db:validate
```

## Production Build

```powershell
npm run build
npm start
```

The application validates its environment before listening. A failed PostgreSQL probe makes readiness return HTTP 503; liveness remains available. Rate limiting currently uses the process-local memory store, so configure Dokploy for a single API instance until a shared store is justified.

## Catalog Architecture & Modularization

The catalog is decoupled into three dedicated feature modules adhering to clean domain boundaries:

- **Categories** (`src/modules/categories/`):
  - Storefront: `GET /api/catalog/categories`
  - Admin: `GET /api/admin/categories`, `GET /api/admin/categories/:id`, `POST /api/admin/categories`, `PUT|PATCH /api/admin/categories/:id`, `DELETE /api/admin/categories/:id`
- **Brands** (`src/modules/brands/`):
  - Storefront: `GET /api/catalog/brands`
  - Admin: `GET /api/admin/brands`, `GET /api/admin/brands/:id`, `POST /api/admin/brands`, `PUT|PATCH /api/admin/brands/:id`, `DELETE /api/admin/brands/:id`, `PUT /api/admin/brands/reorder`
- **Products** (`src/modules/products/`):
  - Storefront: `GET /api/catalog/products`, `GET /api/catalog/products/:idOrSlug`
  - Admin: `GET /api/admin/products`, `GET /api/admin/products/:id`, `POST /api/admin/products`, `PUT|PATCH /api/admin/products/:id`, `DELETE /api/admin/products/:id`, variant management (`POST /:id/variants`, `PATCH /:id/variants/:variantId`, `DELETE /:id/variants/:variantId`), and image management (`POST /:id/images`, `DELETE /:id/images/:imageId`)
- **Shared Utilities**:
  - `src/types/pagination.ts`: Standard `PageResult<T>` pagination contract.
  - `src/utils/slug.ts`: Unicode NFKC slug normalization (`normalizeCatalogSlug`).
  - `src/utils/money.ts`: Two-decimal currency rounding and quantization (`normalizeMoney`).
  - `src/utils/discount.ts`: Product percentage and fixed discount calculation clamped at zero (`calculateDiscountedPrice`, `validateDiscount`).

## Banners and Promotions Management

- **Storefront Endpoint**:
  - `GET /api/banners`: Public endpoint returning active promotional banners within scheduled dates (`now >= startDate` and `now <= endDate`), ordered by `displayOrder ASC` and `createdAt DESC`.
- **Admin Endpoints**:
  - `GET /api/admin/banners`: Paginated banner listing with `isActive`, `search`, and sorting filters (requires `banners.read`).
  - `GET /api/admin/banners/:id`: Single banner detail (requires `banners.read`).
  - `POST /api/admin/banners`: Create promotional banner with scheduling dates and Cloudinary image URL (requires `banners.create`).
  - `PUT /api/admin/banners/reorder`: Persist drag-and-drop display order across banners (requires `banners.update`).
  - `PUT /api/admin/banners/:id` / `PATCH /api/admin/banners/:id`: Update banner content, links, display order, or dates (requires `banners.update`).
  - `PATCH /api/admin/banners/:id/status`: Activate or deactivate banner (requires `banners.update`).
  - `DELETE /api/admin/banners/:id`: Delete banner safely (requires `banners.delete`).
- **Media Integration**:
  - Secure Cloudinary upload via `POST /api/admin/media/upload` using `purpose: BANNER_IMAGE` (target folder: `CLOUDINARY_BANNER_FOLDER`, default `liquor_shop/banners`).
  - Reference protection: prevents deleting Cloudinary assets currently referenced by any banner record.
- **Audit Integration**:
  - Automatically records audit events for `banner.create`, `banner.update`, `banner.update_status`, `banner.reorder`, and `banner.delete` with actor admin details.

## Gallery Management

- **Storefront Endpoint**:
  - `GET /api/gallery`: Public endpoint returning active gallery items ordered by `displayOrder ASC` and `createdAt DESC`, with optional `category` filter.
- **Admin Endpoints**:
  - `GET /api/admin/gallery`: Paginated gallery list with `category`, `isActive`, `search`, and sorting filters (requires `gallery.read`).
  - `GET /api/admin/gallery/:id`: Single gallery item detail (requires `gallery.read`).
  - `POST /api/admin/gallery`: Create gallery item with Cloudinary image URL, category, title, description, and display order (requires `gallery.create`).
  - `PUT /api/admin/gallery/:id` / `PATCH /api/admin/gallery/:id`: Update gallery item fields (requires `gallery.update`).
  - `PATCH /api/admin/gallery/:id/status`: Activate or deactivate gallery item (requires `gallery.update`).
  - `DELETE /api/admin/gallery/:id`: Delete gallery item safely (requires `gallery.delete`).
- **Media Integration**:
  - Secure Cloudinary upload via `POST /api/admin/media/upload` using `purpose: GALLERY_IMAGE` (target folder: `CLOUDINARY_GALLERY_FOLDER`, default `liquor_shop/gallery`).
  - Asset reference protection: prevents deleting Cloudinary assets currently referenced by any gallery item record.
- **Audit Integration**:
  - Automatically records audit events for `gallery.create`, `gallery.update`, `gallery.update_status`, and `gallery.delete` with actor admin details.

## Store Settings and Business Hours

- **Storefront Endpoint**:
  - `GET /api/settings`: Public endpoint returning safe, public-facing store configuration (store name, tagline, primary & secondary phone, support email, address, city, location map URL, social links, 7-day business hours, and active scheduled announcement). All internal fields, database IDs, and secrets are strictly excluded.
- **Admin Endpoints**:
  - `GET /api/admin/settings`: Retrieve complete store configuration including timestamps and internal settings (requires `settings.read`).
  - `PUT /api/admin/settings` / `PATCH /api/admin/settings`: Update store details, contact numbers, social links, weekly business hours (including open/closed status and overnight hours), announcement text, and scheduling (requires `settings.update`).
- **Validation & Scheduling Rules**:
  - Validates 24-hour business hour format (`HH:mm`), closed days, and overnight trading hours.
  - Validates phone format, support email, social URLs, and IANA timezone identifier (`Asia/Kathmandu`).
  - Enforces `announcementStartDate <= announcementEndDate`.
- **Audit Integration**:
  - Automatically records audit events for `settings.update` with actor admin details and modified field names.

## Social Media Management

- **Storefront Endpoints**:
  - `GET /api/social-media`: Public endpoint returning active social media entries (video reels, posts, profile links) ordered by `displayOrder ASC` and `createdAt DESC`. Supports filtering by `type` (`video` | `profile`) and `platform` (`FACEBOOK`, `INSTAGRAM`, `YOUTUBE`, `TIKTOK`, `OTHER`).
  - `GET /api/social-media/active`: Alias endpoint returning all active social entries.
  - `GET /api/social-media-link` (and `GET /api/social-media/profiles`): Public endpoint returning active profile handles grouped by lowercase platform key (e.g. `{ facebook: [...], instagram: [...] }`).
  - `GET /api/social-media-link/active`: Public endpoint returning active profile links.
  - _Storefront Consumer Note_: The storefront can consume these links in the site footer (for social icons/handles) and in the homepage Community / Video Showcase section (for Instagram Reels, YouTube Shorts, and TikTok embeds). Note that this repository contains only the backend API; UI components remain to be wired on the storefront frontend.
- **Admin Endpoints**:
  - `GET /api/admin/social-media`: Listing with platform filtering, status toggle filter (`isActive`), type filter (`video` | `profile`), text search across labels and URLs, pagination, and `platformCounts` summary object (`ALL`, `FACEBOOK`, `INSTAGRAM`, `YOUTUBE`, `TIKTOK`, `OTHER`) to directly populate the tab pill badges in the Admin UI (requires `social-media.read`).
  - `GET /api/admin/social-media/:id`: Retrieve single social media item details (requires `social-media.read`).
  - `POST /api/admin/social-media`: Create single social entry with platform, URL, type, label, optional thumbnail URL, and display order (requires `social-media.create`).
  - `POST /api/admin/social-media/batch`: Batch creation of multiple social links (requires `social-media.create`).
  - `PUT /api/admin/social-media/:id` / `PATCH /api/admin/social-media/:id`: Update social media link fields (requires `social-media.update`).
  - `PATCH /api/admin/social-media/:id/status`: Toggle active status (requires `social-media.update`).
  - `DELETE /api/admin/social-media/:id`: Delete social media entry (requires `social-media.delete`).
- **Media Reference Protection**:
  - Cloudinary assets used as thumbnails in social media entries cannot be deleted while referenced.
- **Audit Integration**:
  - Automatically records audit events for `social_media.create`, `social_media.update`, `social_media.update_status`, and `social_media.delete` with actor admin details.

## Admin Drag-and-Drop Display Ordering

Admin drag-and-drop reordering is strictly restricted to presentation modules where explicit manual ordering is required:

1. **Brands**: `PUT /api/admin/brands/reorder` (requires `catalog.brands.update`)
2. **Banners**: `PUT /api/admin/banners/reorder` (requires `banners.update`)

> [!NOTE]
> Categories, Products, Gallery, and Social Media do NOT expose reorder endpoints. Their `displayOrder` fields, migrations, and database indexes remain intact for historical database compatibility and default storefront ordering (`displayOrder ASC`), but no reorder API endpoints are exposed.

### Standard Reorder Request Payload

Active reorder endpoints accept a JSON payload with an array of objects:

```json
{
  "items": [
    { "id": "10000000-0000-4000-8000-000000000001", "displayOrder": 0 },
    { "id": "10000000-0000-4000-8000-000000000002", "displayOrder": 1 }
  ]
}
```

### Safety and Validation Guarantees

- **Duplicate Prevention**: Reorder payloads containing duplicate IDs are rejected with HTTP 400 (`VALIDATION_ERROR`).
- **Existence Verification**: Every referenced ID must exist; any non-existent ID fails atomically with HTTP 404 (`NOT_FOUND` / `BANNER_NOT_FOUND`).
- **Range Boundaries**: Negative `displayOrder` values are rejected with HTTP 400 (`VALIDATION_ERROR`).
- **Atomic Persistence**: Database updates run inside Prisma interactive transactions (`$transaction`), guaranteeing all-or-nothing execution.
- **Storefront Parity**: Public storefront listings strictly return items sorted by `displayOrder ASC` before secondary criteria.
- **Audit Trails**: Every reorder action generates an audit log record linking the actor admin ID, timestamp, and target resource.
