# Liquor Shop Backend — From-Scratch Setup & Developer Onboarding Guide

A complete, battle-tested step-by-step onboarding and setup guide for developers joining the Liquor Shop engineering team. Following this guide guarantees that you can clone the repository, prepare your database, start the application, run background workers, and verify everything with automated tests and Postman without requiring undocumented assistance.

---

## 1. Prerequisites & System Requirements

Before you begin, ensure your development machine has the following tools installed and accessible from your command line:

- **Node.js**: `v20.x` or `v22.x` (`node -v`). LTS versions 20 and 22 are actively supported.
- **npm**: `v10.x` or newer (`npm -v`).
- **PostgreSQL**: Version 14 or newer (`psql --version`). A local running PostgreSQL instance (or local Docker container) listening on `localhost:5432`.
- **Git**: (`git --version`).
- **Postman**: (Optional but highly recommended) Desktop Postman client or Postman CLI (`newman`) for API verification.

> [!TIP]
> On Windows PowerShell, ensure your execution policy permits running scripts:
>
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
> ```

---

## 2. Repository Cloning & Directory Layout

Clone the repository to your local workspace and navigate to the backend folder:

```powershell
git clone <repository-url>
cd liquor-shop-backend
```

Key directories and source layout:

```text
liquor-shop-backend/
├── docs/                      # Canonical API documentation, guides, OpenAPI, & Postman
│   ├── postman/               # Postman collection v2.1 and environment template
│   ├── api-coverage-matrix.md # Full 162-endpoint inventory
│   ├── backend-feature-guide.md # In-depth business rule and architecture guide
│   ├── external-services-setup.md # Cloudinary, Google Maps, WhatsApp, Email setup
│   └── setup-from-scratch.md  # This onboarding guide
├── prisma/                    # Database schema, PostgreSQL migrations, and client config
│   ├── schema.prisma          # Prisma schema definition
│   └── migrations/            # Ordered, immutable migration history
├── scripts/                   # Automation, seeding, provisioning, and doc generators
│   ├── generate-docs.ts       # Single source of truth for OpenAPI & Postman
│   ├── notification-worker.ts # Background outbox dispatcher worker
│   ├── provision-initial-admin.ts # One-time initial admin bootstrap CLI
│   └── seed-sample-catalog.ts # Idempotent sample catalog seed script
├── src/                       # Application source code
│   ├── config/                # Validated environment configuration (env.ts)
│   ├── errors/                # Standardized AppError and exception handlers
│   ├── middleware/            # Rate limiting, admin JWT RBAC verification, validation
│   ├── modules/               # Domain feature modules (cart, checkout, catalog, etc.)
│   ├── utils/                 # Phone normalization, business hours, PDF generator
│   ├── app.ts                 # Express application assembly and route mount points
│   └── server.ts              # HTTP server bootstrapper
└── tests/                     # Automated Vitest test suite
```

---

## 3. Dependency Installation

Install all development and production dependencies:

```powershell
npm install
```

> [!NOTE]
> The `package.json` contains a `postinstall` hook that automatically triggers `prisma generate`. This generates the `@prisma/client` types tailored to your local environment.

---

## 4. Prisma Client Generation

If you ever modify `prisma/schema.prisma` or need to regenerate the Prisma client manually, run:

```powershell
npm run db:generate
```

To validate the syntax and relational consistency of the Prisma schema:

```powershell
npm run db:validate
```

---

## 5. Environment Configuration (`.env`)

The application uses strict Zod validation on startup (`src/config/env.ts`). If any required variable is missing, malformed, or violates security constraints (e.g. JWT secret length or CORS format), the server will fail to start and print actionable validation errors.

1. Create your local `.env` file from the provided template:

```powershell
Copy-Item .env.example .env
```

2. Generate a secure, 32-byte cryptographically random base64url-encoded string for `JWT_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

3. Update your `.env` file with your local credentials and generated secret:

```ini
# Application Environment
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/liquor_shop?schema=public
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
LOG_LEVEL=info
TRUST_PROXY_HOPS=1
REQUEST_BODY_LIMIT=1mb

# Security & Admin Authentication
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=120
AUTH_LOGIN_RATE_LIMIT_WINDOW_MS=900000
AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS=5
JWT_SECRET=<paste-your-generated-base64url-secret-here>
JWT_ISSUER=liquor-shop-local
JWT_AUDIENCE=liquor-shop-admin-api
JWT_ACCESS_TOKEN_TTL_SECONDS=900

# Delivery Routing & GPS (Kathmandu Defaults)
STORE_ORIGIN_LATITUDE=27.7172
STORE_ORIGIN_LONGITUDE=85.3240
DELIVERY_FEE_MODE=PER_KM
DELIVERY_FEE_BASE_AMOUNT=100
DELIVERY_FEE_PER_KM_AMOUNT=25
DELIVERY_FEE_FREE_THRESHOLD=5000
DELIVERY_MAX_DISTANCE_KM=25
DELIVERY_FALLBACK_AMOUNT=0

# Notifications (Console Provider for safe local testing)
EMAIL_PROVIDER=CONSOLE
EMAIL_FROM=Old Liquor <orders@oldliquor.com>
STORE_ORDER_NOTIFICATION_EMAIL=orders@oldliquor.test
STORE_CONTACT_NOTIFICATION_EMAIL=contact@oldliquor.test
```

> [!CAUTION]
> Never commit `.env` to Git. Keep `EMAIL_PROVIDER=CONSOLE` during local development to avoid attempting live email deliveries.

---

## 6. Local Database Creation & Target Verification

1. Start your local PostgreSQL server.
2. Create the development database named `liquor_shop`:

```powershell
# Using psql:
psql -U postgres -c "CREATE DATABASE liquor_shop;"
```

3. Verify your connection string and current database target:

```powershell
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/liquor_shop' });
client.connect().then(() => client.query('SELECT current_database();')).then(r => {
  console.log('Connected to database:', r.rows[0].current_database);
  return client.end();
}).catch(e => { console.error('Connection failed:', e.message); process.exit(1); });
"
```

---

## 7. Migration Deployment

Deploy all pending migrations to your local database using Prisma:

```powershell
npm run db:migrate
```

This applies all 16 migrations sequentially in an immutable transaction:

1. `20261011000000_baseline_schema`
2. `20261012010000_add_admin_order_notification_email`
3. `20261012020000_customer_order_history_optimizations`
4. `20261012030000_admin_customer_profiles_and_metrics`
5. `20261012040000_contact_inquiries`
6. `20261012050000_fix_contact_inquiries_phone_name`
7. `20261012060000_add_contact_inquiry_resolved_at`
8. `20261012070000_contact_inquiry_permissions`
9. `20261012080000_promotional_banners`
10. `20261012090000_showcase_gallery`
11. `20261012100000_social_media_links`
12. `20261012110000_banner_gallery_social_permissions`
13. `20261012120000_add_store_contact_notification_email`
14. `20261012130000_add_payment_methods_read_permission`
15. `20261013000000_store_delivery_hours_settings`
16. `20261014000000_newsletter_subscribers`

To check the migration status at any time:

```powershell
npx prisma migrate status
```

---

## 8. Initial Administrator Provisioning

The database initially has zero administrator accounts. To create the first active superadmin, use the idempotent CLI tool:

```powershell
# Set environment variables for the bootstrap script
$env:INITIAL_ADMIN_EMAIL="superadmin@liquor.test"
$env:INITIAL_ADMIN_NAME="System Superadmin"
$env:INITIAL_ADMIN_PASSWORD="SuperAdminSecret123!"
$env:INITIAL_ADMIN_EXPECTED_DATABASE="liquor_shop"

npm run admin:provision:initial
```

This script:

- Verifies that the connected database name matches `INITIAL_ADMIN_EXPECTED_DATABASE`.
- Validates that password length is at least 16 characters.
- Hashes the password using Argon2id (`m=65536, t=3, p=4`).
- Inserts the `Initial Super Administrator` role.
- Inserts all core RBAC permissions (including `admin.system.manage`, `orders.*`, `catalog.*`, `newsletter.*`, etc.).
- Maps all permissions to the superadmin role.
- Inserts the first active admin user.

---

## 9. Sample Catalog Seeding (Optional)

To populate your catalog with realistic test data (categories, brands, products, variants, payment methods):

```powershell
# Dry run to preview inserts without modifying database:
npm run db:seed:sample -- --dry-run

# Live seed execution:
npm run db:seed:sample
```

---

## 10. Starting the Backend Server

Start the application in development mode with live TypeScript hot-reloading:

```powershell
npm run dev
```

The server will log:

```text
{"level":30,"time":...,"msg":"Liquor Shop backend server started successfully","port":3000,"environment":"development"}
```

Test the health probes:

- Liveness: `curl http://localhost:3000/api/health/live`
- Readiness: `curl http://localhost:3000/api/health/ready`

---

## 11. Running the Notification Worker (Separate Process)

The backend uses a resilient, asynchronous PostgreSQL outbox pattern for transactional email and WhatsApp notifications. Orders and contact inquiries place notification records in the outbox inside the database transaction.

To process and dispatch notifications continuously in the background, open a second terminal and run:

```powershell
npm run notifications:worker
```

With `EMAIL_PROVIDER=CONSOLE`, dispatched emails will print cleanly to the terminal logs with their recipients, subject, and HTML body preview without attempting external network calls.

---

## 12. Importing and Running Postman Tests

1. Open Postman.
2. Click **Import** (top left).
3. Import both files:
   - [`docs/postman/liquor-shop-backend.postman_collection.json`](file:///d:/KreativeMandu/oldLiquor/backend/docs/postman/liquor-shop-backend.postman_collection.json)
   - [`docs/postman/liquor-shop-backend.postman_environment.json`](file:///d:/KreativeMandu/oldLiquor/backend/docs/postman/liquor-shop-backend.postman_environment.json)
4. Select the environment: **Liquor Shop Backend (Local Environment)**.
5. Execute requests in the recommended sequence:
   - Run `2. Admin Authentication` ➔ `Admin Login`. This automatically captures `adminToken` and stores it in your Postman environment.
   - Run `4. Categories` ➔ `Admin Create Category`. Stores `categoryId`.
   - Run `5. Brands` ➔ `Admin Create Brand`. Stores `brandId`.
   - Run `6. Products` ➔ `Admin Create Product` & `Admin Create Variant`. Stores `productId` and `variantId`.
   - Run `8. Guest Cart & Checkout Flow` ➔ `1. Init Cart` ➔ `2. Add Item` ➔ `3. Execute Checkout`. Stores `orderNumber` and `orderLookupToken`.
   - Run `9. Payment Methods` ➔ `Submit Payment Proof`. Stores `paymentSubmissionId`.
   - Run `10. Order Management` ➔ `Download Order Tax Invoice` (downloads binary PDF).
   - Run `18. Negative Cases` to confirm 404 behavior for forbidden reorders.

---

## 13. Running Automated Tests & Quality Checks

Run the complete automated verification suite before submitting any pull request:

```powershell
# 1. Vitest Unit & Integration Test Suite
npm test

# 2. TypeScript Static Typecheck
npm run typecheck

# 3. ESLint Code Analysis
npm run lint

# 4. Prettier Formatting Verification
npm run format

# 5. Prisma Schema Validation
npm run db:validate

# 6. Production Compilation Build
npm run build
```

---

## 14. Common Pitfalls & Troubleshooting

### Error: `Invalid environment configuration: JWT_SECRET must encode at least 32 random bytes`

- **Cause**: The `JWT_SECRET` in `.env` is either the default template string or is shorter than 32 bytes.
- **Fix**: Run `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` and paste the result into `.env`.

### Error: `DATABASE_UNAVAILABLE` on `/api/health/ready`

- **Cause**: PostgreSQL is not running or credentials in `DATABASE_URL` are incorrect.
- **Fix**: Check `psql -U postgres` and ensure your PostgreSQL service is active.

### Error: `ORDER_SUBTOTAL_BELOW_MINIMUM` during checkout

- **Cause**: Checkout enforces an NPR 800 minimum eligible subtotal after catalog discounts.
- **Fix**: Ensure the cart items' combined price multiplied by quantity is at least NPR 800 (the sample Macallan variant is NPR 15,500, which satisfies this rule).

### Error: `STORE_CLOSED` during checkout

- **Cause**: Store business hours in settings are configured to closed for the current day of the week, or `isOrderingEnabled: false`.
- **Fix**: Check `GET /api/settings` to inspect `businessHours` and `isOrderingEnabled`. In `StoreSettings`, set `isOrderingEnabled: true`.
