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
