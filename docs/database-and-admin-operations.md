# Database, Seed Data & Admin Operations Guide

Comprehensive operational handbook for database migrations, initial admin provisioning, seed data management, and environment safety for the Liquor Shop Backend.

---

## 1. Command Safety Classification

Before executing any CLI commands, review the operation type:

| Command                           | Classification          | Modifies DB? | Safe on Production? | Purpose                                                               |
| :-------------------------------- | :---------------------- | :----------- | :------------------ | :-------------------------------------------------------------------- |
| `npm run db:validate`             | **Read-Only (Local)**   | No           | Yes                 | Validates `prisma/schema.prisma` syntax without database access       |
| `npx prisma migrate status`       | **Read-Only (Remote)**  | No           | Yes                 | Inspects `_prisma_migrations` table and lists pending migrations      |
| `npm run dev` / `npm start`       | **Read-Only (Probes)**  | No           | Yes                 | Boots server; `/api/health/ready` executes non-destructive `SELECT 1` |
| `npm test`                        | **In-Memory / Mocks**   | No           | Yes                 | Runs Vitest suites against in-memory repositories; no live DB writes  |
| `npm run db:migrate`              | **Database Write**      | **Yes**      | **Yes (Reviewed)**  | Runs `prisma migrate deploy` to safely apply committed migrations     |
| `npm run admin:provision:initial` | **Database Write**      | **Yes**      | **Yes (Once)**      | Atomically bootstraps root super admin; fails if records exist        |
| `npm run db:migrate:dev`          | **Destructive / Write** | **Yes**      | **NEVER**           | For local development only; may reset/recreate database tables        |
| `npx prisma migrate reset`        | **Destructive**         | **Yes**      | **NEVER**           | Drops and recreates the entire database                               |

---

## 2. Checking Database Connectivity & Migration Status

### 2.1 Non-Destructive Migration Inspection

To inspect which migrations are applied and which remain pending without modifying any schema or records:

```powershell
npx prisma migrate status --schema prisma/schema.prisma
```

**Expected Safe Output**:

```text
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "liquor_shop", schema "public" at "..."

14 migrations found in prisma/migrations
Following migrations have not yet been applied:
20261011000000_inventory_movements
20261011000100_guest_cart_and_checkout
...
To apply migrations in production run prisma migrate deploy.
```

### 2.2 Verifying Database Connectivity Without Schema Checks

Run the server readiness probe against a running instance:

```powershell
# Using curl or browser
curl http://localhost:3000/api/health/ready
```

- **HTTP 200 OK**: PostgreSQL connection is healthy and responding to queries.
- **HTTP 503 Service Unavailable**: Database is unreachable or rejecting connections.

---

## 3. Seed Data Audit & Status

### 3.1 Current Status

- **Sample Seed Script**: Available via `npm run db:seed:sample` (`scripts/seed-sample-catalog.ts`).
- **Sample Catalog Data**: Provides realistic, clearly identifiable test catalog data (`SAMPLE-*` SKU prefixes and test notices):
  - **Categories** (5): Whisky, Vodka, Rum, Beer, Wine.
  - **Brands** (5): Old Durbar, Khukri, Ruslan, Gorkha, Divine Wines.
  - **Products** (7): Old Durbar Black Chimney, Old Durbar 12Y Reserve, Khukri XXX Coronation Rum, Khukri Spice Rum, Ruslan Ultra Premium Vodka, Gorkha Craft Beer, Divine Red Wine Classic Reserve.
  - **Product Variants** (15): Canonical volume variants (750 ml, 375 ml, 180 ml, 650 ml, 330 ml) with calibrated pricing and stock levels.
- **Excluded Domains**: Sample seeding strictly preserves admin users, roles, permissions, orders, payments, customers, and inventory movements without modifications.

### 3.2 Distinguishing Seed Data vs Admin Provisioning

| Dimension          | Initial Admin Provisioning                                  | Sample Seed Data                                                        |
| :----------------- | :---------------------------------------------------------- | :---------------------------------------------------------------------- |
| **Target Scope**   | Security, RBAC roles, permissions, root admin               | Catalog: categories, brands, products, variants                         |
| **Execution Mode** | One-time bootstrap (`npm run admin:provision:initial`)      | Optional local/staging environment populator (`npm run db:seed:sample`) |
| **Idempotency**    | **Non-idempotent**: Fails with 409 if any admin/role exists | **Fully idempotent**: `upsert` by unique slug & SKU                     |
| **Production Use** | **Required** to access admin panel                          | **Blocked** in production unless explicit override                      |

---

## 4. Initial Administrator Provisioning Procedure

The initial admin provisioning command is an explicit, atomic, single-use bootstrap mechanism. It is never executed automatically during startup or migration.

### 4.1 Prerequisites

1. All database migrations must be applied (`npm run db:migrate`).
2. Target database must be completely empty of admin users, roles, and permissions.
3. Process environment must provide the following 4 variables:
   - `INITIAL_ADMIN_EMAIL`: Valid, trimmed email address (e.g. `admin@oldliquor.com`).
   - `INITIAL_ADMIN_NAME`: Full display name (e.g. `System Administrator`).
   - `INITIAL_ADMIN_PASSWORD`: Strong password (minimum 16 characters).
   - `INITIAL_ADMIN_EXPECTED_DATABASE`: Target database name (e.g. `liquor_shop`).

### 4.2 Safe Execution Steps

```powershell
# 1. Inject required environment variables into process scope (do NOT save in scripts)
$env:INITIAL_ADMIN_EMAIL = "admin@oldliquor.com"
$env:INITIAL_ADMIN_NAME = "System Administrator"
$env:INITIAL_ADMIN_PASSWORD = "StrongSecurePassword#2026!"
$env:INITIAL_ADMIN_EXPECTED_DATABASE = "liquor_shop"

# 2. Execute provisioning command
npm run admin:provision:initial

# 3. Clear environment variables from session immediately
Remove-Item Env:\INITIAL_ADMIN_EMAIL
Remove-Item Env:\INITIAL_ADMIN_NAME
Remove-Item Env:\INITIAL_ADMIN_PASSWORD
Remove-Item Env:\INITIAL_ADMIN_EXPECTED_DATABASE
```

### 4.3 Safety Guarantees Built into Provisioning

- **Database Identity Guard**: Compares `current_database()` to `INITIAL_ADMIN_EXPECTED_DATABASE`. If connected to the wrong database, it aborts immediately.
- **Empty State Guard**: Verifies `adminUser.count() === 0`, `role.findUnique() === null`, and `rolePermission.count() === 0`. If any exist, it throws `409 PROVISIONING_STATE_NOT_EMPTY` without writing.
- **Serializable Transaction**: Runs all inserts inside a `Serializable` transaction isolation level. If any step fails, everything is rolled back.
- **Argon2id Hashing**: Passes credentials through Argon2id with recommended parameters (`memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`).

---

## 5. Sample Catalog Seed Script (`npm run db:seed:sample`)

The sample catalog seed script populates a realistic, idempotent catalog dataset for local testing and development.

### 5.1 Idempotency & Relational Safety

The script is strictly idempotent:

- Categories and Brands are keyed by unique, canonical `slug`.
- Products are keyed by unique `slug` and linked to verified category and brand IDs.
- Product Variants are keyed by unique `sku` (e.g. `SAMPLE-OD-BC-750ML`) and respect `(productId, sizeMilliliters)` uniqueness.
- Runs inside an atomic database transaction (`prisma.$transaction`).
- Pre-existing unrelated data is fully preserved; no `truncate` or `deleteMany` operations are performed.

### 5.2 Environment Protection Guards

The script includes built-in guards against accidental execution:

1. **Production Guard**: If `NODE_ENV === 'production'` or `DATABASE_URL` contains `production`, seeding is rejected unless `ALLOW_PRODUCTION_SAMPLE_SEED=true` is explicitly provided.
2. **Database Verification Guard**: If `SAMPLE_SEED_EXPECTED_DATABASE` is provided in the environment, the script queries `current_database()` and halts if connected to a different database.

### 5.3 Execution Instructions

```powershell
# 1. Non-destructive dry run (validates schema constraints and computes counts without DB writes):
npm run db:seed:sample -- --dry-run

# 2. Live execution on local / staging database:
npm run db:seed:sample

# 3. Optional targeted execution with database name verification:
$env:SAMPLE_SEED_EXPECTED_DATABASE = "liquor_shop"
npm run db:seed:sample
Remove-Item Env:\SAMPLE_SEED_EXPECTED_DATABASE
```

---

## 6. How to Apply Pending Migrations Safely

When authorized to apply migrations to Render or staging:

```powershell
# 1. Verify connection and inspect pending migrations (read-only)
npx prisma migrate status

# 2. Apply committed migrations without dropping or resetting tables
npm run db:migrate
# (equivalent to: prisma migrate deploy --schema prisma/schema.prisma)

# 3. Confirm all migrations are applied (read-only)
npx prisma migrate status
```
