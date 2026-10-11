# Liquor Shop Backend

Independent Node.js, TypeScript, Express and PostgreSQL backend. The initial Prisma schema defines admin authorization, catalog and customer identity foundations; commerce routes and order/inventory models are not included yet.

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

Protected catalog routes use `/api/admin/categories`, `/api/admin/brands`, `/api/admin/products`, `/api/admin/products/:id/images`, and `/api/admin/products/:id/variants`. Each resource supports permission-scoped list/detail/create/update/delete operations where applicable; admin lists support pagination, and lists support search/filtering. Category and brand deletes return a conflict while products reference them; delete operations for products and variants deactivate them to preserve future order/inventory references. Product image records store HTTPS image URLs and metadata; image upload integration is not part of these CRUD routes. Variant size input accepts `ml` or `L` and is normalized to a positive integer millilitre key and canonical `<n> ml` label. SKUs are trimmed and uppercased; slugs use NFKC, lowercase, and hyphen-separated Unicode letters/numbers. Discounts exist only on products.

## Admin Dashboard and Sales Analytics

Protected analytics endpoints are mounted at `/api/admin/dashboard` and require the `dashboard.read` permission (or `admin.system.manage`):

- `GET /api/admin/dashboard/summary` (alias `/overview`): High-level operational metrics including total orders, today's orders, pending orders, delivered orders, gross sales, average order value, payment summary (paid vs pending vs failed), low-stock count, and active promo code count.
- `GET /api/admin/dashboard/sales` (alias `/sales-chart`): Aggregated sales time series grouped by `day`, `week`, or `month` with optional `startDate` and `endDate` ISO-8601 filters. Excludes cancelled orders from revenue and volume calculations.
- `GET /api/admin/dashboard/order-status-breakdown` (alias `/orders/status-breakdown`): Distribution of orders across all fulfillment statuses (`PENDING`, `CONFIRMED`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`).
- `GET /api/admin/dashboard/top-products` (alias `/best-sellers`): Top selling products and variants ranked by total quantity sold and revenue generated, bounded with an optional `limit` query param (1–100, default 10). Excludes cancelled orders.
- `GET /api/admin/dashboard/low-stock` (alias `/inventory`): Lists active catalog variants whose current inventory is at or below their configured `lowStockThreshold`, ordered ascending by stock.

### One-Time Initial Administrator Provisioning

Provisioning is an explicit CLI operation; application startup never runs it. Confirm `DATABASE_URL` points to the intended database before invoking it. Provide `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, and `INITIAL_ADMIN_PASSWORD` through a secure secret manager or process environment injection. The password must be at least 16 characters; it is never printed. Avoid putting the password literal in a saved script or shell command history. Once the variables are injected into the process environment, run:

```powershell
npm run admin:provision:initial
```

The command normalizes email, hashes with the authentication module's Argon2id parameters, and atomically creates the initial `Initial Super Administrator` role, all admin-management and catalog permission keys, their assignments, and the first active admin. Before writing, it verifies that `current_database()` exactly matches `INITIAL_ADMIN_EXPECTED_DATABASE`. It refuses to proceed if any admin exists, the initial role exists, any required permission already exists, or any role-permission assignment exists. It never overwrites records. If any check or insert fails, the transaction rolls back. If the state was partially populated by an earlier/manual process, stop and inspect it read-only, then reconcile it deliberately in a separately reviewed procedure before retrying. Do not delete partial records blindly or rerun with different credentials expecting an update. The provisioning command has been added but must not be run until the target database is explicitly approved.

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
