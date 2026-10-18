# Liquor Shop Backend — API & Developer Documentation

Comprehensive architectural reference, developer setup guide, OpenAPI 3.1 specification, Postman collection guide, and endpoint catalog for the Liquor Shop Backend.

---

## 1. Architecture & Technology Stack

The Liquor Shop Backend is an independent, headless e-commerce backend built with:

- **Runtime**: Node.js (>= 20) with TypeScript (>= 5.9)
- **Framework**: Express.js (v5.2) with Helmet security headers, CORS, and JSON body parsing
- **Database & ORM**: PostgreSQL (>= 14) with Prisma ORM (v6.12)
- **Authentication**: Stateless JWT with Argon2id password hashing, 15-minute token TTL, and RBAC permission checks
- **Validation**: Strict schema validation using Zod (v4)
- **Media Management**: Cloudinary integration with media reference tracking
- **Mapping & Logistics**: Google Maps Geocoding & Distance Matrix API integration with distance-based delivery fee computation
- **Notifications**: Transactional Outbox pattern with background worker (`scripts/notification-worker.ts`), supporting WhatsApp Business Cloud API and multi-provider Email (Console, SMTP, Resend)
- **Logging**: High-performance structured logging with Pino

---

## 2. Setup & Installation

### 2.1 Prerequisites

- **Node.js**: `v20.0.0` or higher
- **npm**: `v10.0.0` or higher
- **PostgreSQL**: `v14.0` or higher running locally or in a managed container

### 2.2 Installation Steps

```powershell
# 1. Clone repository and navigate to backend directory
cd d:\KreativeMandu\oldLiquor\backend

# 2. Install dependencies (triggers prisma generate automatically)
npm install

# 3. Create environment configuration
Copy-Item .env.example .env
```

### 2.3 Environment Configuration (`.env`)

Configure the following variables in `.env` (refer to `.env.example`):

| Variable                             | Description                                                     | Example / Default                                                 |
| :----------------------------------- | :-------------------------------------------------------------- | :---------------------------------------------------------------- |
| `NODE_ENV`                           | Application environment mode                                    | `development` \| `production` \| `test`                           |
| `PORT`                               | HTTP port the Express server listens on                         | `3000`                                                            |
| `DATABASE_URL`                       | PostgreSQL connection string                                    | `postgresql://user:pass@localhost:5432/liquor_shop?schema=public` |
| `CORS_ORIGINS`                       | Allowed frontend origins (comma-separated)                      | `http://localhost:5173`                                           |
| `LOG_LEVEL`                          | Pino log verbosity (`trace`, `debug`, `info`, `warn`, `error`)  | `info`                                                            |
| `TRUST_PROXY_HOPS`                   | Reverse proxy hops for IP detection                             | `1`                                                               |
| `REQUEST_BODY_LIMIT`                 | Maximum JSON request payload size                               | `1mb`                                                             |
| `RATE_LIMIT_WINDOW_MS`               | Global rate limit window in milliseconds                        | `60000` (1 minute)                                                |
| `RATE_LIMIT_MAX_REQUESTS`            | Global max requests per IP window                               | `120`                                                             |
| `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`    | Auth login rate limit window                                    | `900000` (15 minutes)                                             |
| `AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS` | Auth login max attempts per IP window                           | `5`                                                               |
| `JWT_SECRET`                         | Base64URL-encoded cryptographically secure secret (>= 32 bytes) | _Secure random string_                                            |
| `JWT_ISSUER`                         | JWT token issuer claim (`iss`)                                  | `https://api.liquorshop.com`                                      |
| `JWT_AUDIENCE`                       | JWT token audience claim (`aud`)                                | `liquor-shop-admin-api`                                           |
| `JWT_ACCESS_TOKEN_TTL_SECONDS`       | Access token time-to-live in seconds                            | `900` (15 minutes)                                                |
| `CLOUDINARY_CLOUD_NAME`              | Cloudinary cloud account name                                   | `your_cloud_name`                                                 |
| `CLOUDINARY_API_KEY`                 | Cloudinary API access key                                       | `your_api_key`                                                    |
| `CLOUDINARY_API_SECRET`              | Cloudinary API secret                                           | `your_api_secret`                                                 |
| `CLOUDINARY_PRODUCT_FOLDER`          | Target folder for product images                                | `liquor_shop/products`                                            |
| `CLOUDINARY_PAYMENT_QR_FOLDER`       | Target folder for payment QR assets                             | `liquor_shop/payment_qr`                                          |
| `CLOUDINARY_BANNER_FOLDER`           | Target folder for banner graphics                               | `liquor_shop/banners`                                             |
| `CLOUDINARY_GALLERY_FOLDER`          | Target folder for gallery graphics                              | `liquor_shop/gallery`                                             |
| `GOOGLE_MAPS_API_KEY`                | Google Maps API key (Geocoding / Distance Matrix)               | _Optional in development_                                         |
| `STORE_ORIGIN_LATITUDE`              | Latitude of physical store (Kathmandu)                          | `27.7172`                                                         |
| `STORE_ORIGIN_LONGITUDE`             | Longitude of physical store (Kathmandu)                         | `85.3240`                                                         |
| `DELIVERY_FEE_MODE`                  | Fee calculation mode (`FIXED`, `PER_KM`, `TIERED`)              | `PER_KM`                                                          |
| `DELIVERY_FEE_BASE_AMOUNT`           | Base delivery fee in NPR                                        | `100`                                                             |
| `DELIVERY_FEE_PER_KM_AMOUNT`         | Incremental fee per road kilometer in NPR                       | `25`                                                              |
| `DELIVERY_FEE_FREE_THRESHOLD`        | Subtotal threshold for free delivery in NPR                     | `5000`                                                            |
| `DELIVERY_MAX_DISTANCE_KM`           | Maximum delivery radius in kilometers                           | `25`                                                              |
| `DELIVERY_FALLBACK_AMOUNT`           | Flat fee fallback if geocoding fails                            | `0`                                                               |
| `STORE_OWNER_WHATSAPP_NUMBER`        | Store owner WhatsApp number (international format)              | `+9779801234567`                                                  |
| `WHATSAPP_API_TOKEN`                 | Meta WhatsApp Cloud API bearer token                            | `your_token`                                                      |
| `WHATSAPP_PHONE_NUMBER_ID`           | Meta WhatsApp Cloud Phone Number ID                             | `your_phone_id`                                                   |
| `EMAIL_PROVIDER`                     | Transactional email provider (`CONSOLE`, `SMTP`, `RESEND`)      | `CONSOLE`                                                         |
| `EMAIL_FROM`                         | Outgoing email sender address                                   | `Old Liquor <orders@oldliquor.com>`                               |
| `STORE_ORDER_NOTIFICATION_EMAIL`     | Store admin destination for new order email alerts              | `admin-orders@oldliquor.com`                                      |
| `STORE_CONTACT_NOTIFICATION_EMAIL`   | Store destination for customer contact inquiry alerts           | `admin-contact@oldliquor.com`                                     |
| `SMTP_HOST` / `SMTP_PORT`            | SMTP server connection host and port                            | `smtp.mailgun.org` / `587`                                        |
| `SMTP_USER` / `SMTP_PASSWORD`        | SMTP authentication credentials                                 | _Credentials_                                                     |
| `RESEND_API_KEY`                     | Resend API key for Resend email provider                        | `re_...`                                                          |
| `NOTIFICATION_WORKER_BATCH_SIZE`     | Outbox batch size per polling tick                              | `10`                                                              |
| `NOTIFICATION_MAX_ATTEMPTS`          | Maximum retry attempts for failed notifications                 | `5`                                                               |

---

## 3. Database Management & Seeding

### 3.1 Migration Workflow

```powershell
# Validate Prisma schema syntax and relations
npm run db:validate

# Generate Prisma Client TypeScript bindings
npm run db:generate

# In Development: create and apply migration (LOCAL DB ONLY)
npm run db:migrate:dev

# In Production / CI: apply committed migrations safely without reset
npm run db:migrate
```

> [!CAUTION]
> Never run `npm run db:migrate:dev` against staging or production databases. Always use `npm run db:migrate` (`prisma migrate deploy`).

### 3.2 Initial Administrator Provisioning

Initial admin creation is an explicit, safe, atomic CLI task that verifies the target database:

```powershell
# Set provisioning environment variables (temporary or process-injected)
$env:INITIAL_ADMIN_EMAIL="admin@oldliquor.com"
$env:INITIAL_ADMIN_NAME="System Administrator"
$env:INITIAL_ADMIN_PASSWORD="SecureAdminPassword#2026!"
$env:INITIAL_ADMIN_EXPECTED_DATABASE="liquor_shop"

# Execute provisioning script
npm run admin:provision:initial
```

This script:

1. Verifies that `current_database()` matches `INITIAL_ADMIN_EXPECTED_DATABASE`.
2. Verifies that no administrators or default roles exist yet.
3. Hashes the password using Argon2id.
4. Atomically creates the `Initial Super Administrator` role with all required permissions and links the new administrator.

### 3.3 Notification Outbox Worker

Transactional notifications (WhatsApp and customer emails) are written to a persistent database outbox table within the checkout transaction. Run the worker as a background process or recurring job:

```powershell
npm run notifications:worker
```

### 3.4 Sample Catalog Seeding

For local development and testing, an idempotent sample catalog seed script is provided:

```powershell
# Safe non-destructive dry run (validates schema constraints without DB writes)
npm run db:seed:sample -- --dry-run

# Execute sample catalog seeding (upserts categories, brands, products, and variants)
npm run db:seed:sample
```

The script populates 5 categories, 5 brands, 7 products, and 14 variants with `SAMPLE-*` SKUs. It is blocked in production by default unless `ALLOW_PRODUCTION_SAMPLE_SEED=true` is set.

> [!NOTE]
> For a detailed operational runbook covering database safety, read-only vs mutating commands, migration deploy instructions, and sample seed data guidelines, consult [`docs/database-and-admin-operations.md`](file:///d:/KreativeMandu/oldLiquor/backend/docs/database-and-admin-operations.md).
> For email and WhatsApp provider setup, testing dry-run modes, and Meta WhatsApp Cloud API configuration, consult [`docs/notification-provider-testing.md`](file:///d:/KreativeMandu/oldLiquor/backend/docs/notification-provider-testing.md).

---

## 4. OpenAPI 3.1 Specification

The API is fully documented in OpenAPI 3.1 format:

- **JSON Specification**: [`docs/openapi.json`](file:///d:/KreativeMandu/oldLiquor/backend/docs/openapi.json)
- **YAML Specification**: [`docs/openapi.yaml`](file:///d:/KreativeMandu/oldLiquor/backend/docs/openapi.yaml)

### 4.1 Viewing the OpenAPI Specification

1. **Swagger Editor**:
   - Open [editor.swagger.io](https://editor.swagger.io/) and paste the contents of `docs/openapi.yaml`.
2. **Redocly CLI (Offline Preview)**:
   ```powershell
   npx @redocly/cli preview-docs docs/openapi.yaml
   ```
3. **VS Code / Cursor Extensions**:
   - Install the _OpenAPI (Swagger) Editor_ or _Swagger Viewer_ extension to preview `docs/openapi.yaml` directly in your IDE (`Shift+Alt+P` or right-click -> Preview Swagger).
4. **Generating Client SDKs**:
   ```powershell
   npx @openapitools/openapi-generator-cli generate -i docs/openapi.json -g typescript-axios -o ./client-sdk
   ```

---

## 5. Postman Collection & Automated Testing

The complete test suite and API request catalog is available in `docs/postman/`:

- **Collection**: [`docs/postman/liquor-shop-backend.postman_collection.json`](file:///d:/KreativeMandu/oldLiquor/backend/docs/postman/liquor-shop-backend.postman_collection.json)
- **Environment**: [`docs/postman/liquor-shop-backend.postman_environment.json`](file:///d:/KreativeMandu/oldLiquor/backend/docs/postman/liquor-shop-backend.postman_environment.json)
- **Execution & Safety Runbook**: [`docs/postman-api-testing-guide.md`](file:///d:/KreativeMandu/oldLiquor/backend/docs/postman-api-testing-guide.md)

### 5.1 Importing into Postman

1. Open Postman.
2. Click **Import** (top left).
3. Drag and drop both `liquor-shop-backend.postman_collection.json` and `liquor-shop-backend.postman_environment.json`.
4. In the top right environment dropdown, select **Liquor Shop Backend (Local Environment)**.

### 5.2 Automated Token & ID Chaining

- When you execute **Admin Authentication -> Admin Login**, Postman's test script automatically extracts `response.data.accessToken` and stores it into the `{{admin_token}}` environment variable.
- Subsequent admin requests use `Bearer {{admin_token}}` in their `Authorization` header automatically.
- Entity creation requests (e.g., **Admin Categories -> Create Category**) dynamically capture generated IDs (e.g., `{{category_id}}`, `{{brand_id}}`, `{{product_id}}`, `{{banner_id}}`) for downstream update, reorder, and deletion requests.

### 5.3 Automated Assertion Coverage

The Postman collection includes both positive and negative assertions:

- **Positive Tests**: Assert HTTP 200/201, `success === true`, presence of expected object keys, and array types.
- **Security Tests**: Assert HTTP 401 (`UNAUTHORIZED`) when sending requests without a bearer token.
- **Validation Tests**: Assert HTTP 400 (`VALIDATION_ERROR`) when sending malformed data (e.g. invalid email format).
- **Forbidden Reorder Tests (Task 32/33/34/35)**:
  - Categories Reorder -> Asserts HTTP 404 (`NOT_FOUND`).
  - Products Reorder -> Asserts HTTP 404 (`NOT_FOUND`).
  - Gallery Reorder -> Asserts HTTP 404 (`NOT_FOUND`).
  - Social Media Reorder -> Asserts HTTP 404 (`NOT_FOUND`).
  - Brands Reorder -> Permitted HTTP 200 (Requires `catalog.brands.update`).
  - Banners Reorder -> Permitted HTTP 200 (Requires `banners.update`).

---

## 6. API Response Contracts & Error Codes

### 6.1 Success Envelope Format

#### Single Resource

```json
{
  "success": true,
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "name": "Single Malt Scotch",
    "slug": "single-malt-scotch"
  }
}
```

#### Paginated List

```json
{
  "success": true,
  "data": [
    {
      "id": "10000000-0000-4000-8000-000000000001",
      "name": "Single Malt Scotch"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### 6.2 Error Envelope Format

All application errors conform to the standard error envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address format"
      }
    ]
  }
}
```

### 6.3 Standard Error Codes

| HTTP Status | Error Code                               | Description                                                        |
| :---------- | :--------------------------------------- | :----------------------------------------------------------------- |
| `400`       | `VALIDATION_ERROR`                       | Request body or query parameters failed Zod schema validation      |
| `401`       | `UNAUTHORIZED`                           | Missing, expired, or malformed JWT bearer token                    |
| `401`       | `INVALID_CREDENTIALS`                    | Incorrect admin email or password                                  |
| `403`       | `FORBIDDEN` / `INSUFFICIENT_PERMISSIONS` | Admin lacks the required permission key for this action            |
| `404`       | `NOT_FOUND` / `RESOURCE_NOT_FOUND`       | Target entity does not exist or endpoint route is not exposed      |
| `409`       | `CONFLICT` / `SLUG_ALREADY_EXISTS`       | Unique constraint violated or entity has blocking child references |
| `429`       | `TOO_MANY_REQUESTS`                      | IP address has exceeded the rate limit threshold                   |
| `500`       | `INTERNAL_SERVER_ERROR`                  | Unhandled server error                                             |
| `503`       | `SERVICE_UNAVAILABLE`                    | Database health probe failed or external dependency is unreachable |

---

## 7. Endpoint Catalog by Domain

The backend exposes 148 verified endpoints across 22 domains:

### 7.1 Health & System Probes

| Method | Endpoint            | Auth / Permission | Description                                         |
| :----- | :------------------ | :---------------- | :-------------------------------------------------- |
| `GET`  | `/api/health/live`  | Public            | Liveness probe (HTTP 200 OK)                        |
| `GET`  | `/api/health/ready` | Public            | Readiness probe (executes `SELECT 1` on PostgreSQL) |

### 7.2 Admin Authentication

| Method | Endpoint                | Auth / Permission     | Description                                      |
| :----- | :---------------------- | :-------------------- | :----------------------------------------------- |
| `POST` | `/api/admin/auth/login` | Public (Rate-limited) | Admin login; returns 15m access token            |
| `GET`  | `/api/admin/auth/me`    | Bearer Token          | Current admin profile, role, and permission keys |

### 7.3 Admin Users Management

| Method  | Endpoint                        | Auth / Permission    | Description                               |
| :------ | :------------------------------ | :------------------- | :---------------------------------------- |
| `GET`   | `/api/admin/users`              | `admin.users.read`   | Paginated admin users listing with search |
| `POST`  | `/api/admin/users`              | `admin.users.create` | Create a new admin user                   |
| `GET`   | `/api/admin/users/:id`          | `admin.users.read`   | Retrieve admin user details               |
| `PATCH` | `/api/admin/users/:id`          | `admin.users.update` | Update admin user profile (name, role)    |
| `PATCH` | `/api/admin/users/:id/status`   | `admin.users.update` | Activate or deactivate admin account      |
| `PATCH` | `/api/admin/users/:id/password` | `admin.users.update` | Reset admin user password                 |

### 7.4 Admin Roles & Permissions

| Method   | Endpoint                                | Auth / Permission    | Description                                  |
| :------- | :-------------------------------------- | :------------------- | :------------------------------------------- |
| `GET`    | `/api/admin/permissions`                | `admin.roles.read`   | List all available permission keys in system |
| `GET`    | `/api/admin/roles`                      | `admin.roles.read`   | List all roles with assigned permissions     |
| `POST`   | `/api/admin/roles`                      | `admin.roles.create` | Create a new administrative role             |
| `PATCH`  | `/api/admin/roles/:id`                  | `admin.roles.update` | Update role name or description              |
| `PUT`    | `/api/admin/roles/:id/permissions`      | `admin.roles.update` | Replace permission assignments for a role    |
| `DELETE` | `/api/admin/roles/:id/permissions/:key` | `admin.roles.update` | Remove a single permission from a role       |

### 7.5 Admin Audit Logs

| Method | Endpoint                    | Auth / Permission | Description                                    |
| :----- | :-------------------------- | :---------------- | :--------------------------------------------- |
| `GET`  | `/api/admin/audit-logs`     | `audit-logs.read` | Paginated audit trail with date/action filters |
| `GET`  | `/api/admin/audit-logs/:id` | `audit-logs.read` | Single audit event record with actor details   |

### 7.6 Storefront Categories

| Method | Endpoint                  | Auth / Permission | Description                                      |
| :----- | :------------------------ | :---------------- | :----------------------------------------------- |
| `GET`  | `/api/catalog/categories` | Public            | List active categories ordered by `displayOrder` |

### 7.7 Admin Categories

| Method           | Endpoint                          | Auth / Permission           | Description                                  |
| :--------------- | :-------------------------------- | :-------------------------- | :------------------------------------------- |
| `GET`            | `/api/admin/categories`           | `catalog.categories.read`   | Paginated categories with product counts     |
| `POST`           | `/api/admin/categories`           | `catalog.categories.create` | Create a new catalog category                |
| `GET`            | `/api/admin/categories/:id`       | `catalog.categories.read`   | Category detail record                       |
| `PUT` \| `PATCH` | `/api/admin/categories/:id`       | `catalog.categories.update` | Update category name, slug, description      |
| `DELETE`         | `/api/admin/categories/:id`       | `catalog.categories.delete` | Delete category (blocked if products linked) |
| _`PUT`_          | _`/api/admin/categories/reorder`_ | _N/A_                       | **Forbidden (404 Not Found)**                |

### 7.8 Storefront Brands

| Method | Endpoint              | Auth / Permission | Description                                  |
| :----- | :-------------------- | :---------------- | :------------------------------------------- |
| `GET`  | `/api/catalog/brands` | Public            | List active brands ordered by `displayOrder` |

### 7.9 Admin Brands

| Method           | Endpoint                    | Auth / Permission       | Description                               |
| :--------------- | :-------------------------- | :---------------------- | :---------------------------------------- |
| `GET`            | `/api/admin/brands`         | `catalog.brands.read`   | Paginated brands with product counts      |
| `POST`           | `/api/admin/brands`         | `catalog.brands.create` | Create a new catalog brand                |
| `GET`            | `/api/admin/brands/:id`     | `catalog.brands.read`   | Brand detail record                       |
| `PUT` \| `PATCH` | `/api/admin/brands/:id`     | `catalog.brands.update` | Update brand details                      |
| `DELETE`         | `/api/admin/brands/:id`     | `catalog.brands.delete` | Delete brand (blocked if products linked) |
| `PUT`            | `/api/admin/brands/reorder` | `catalog.brands.update` | **Reorder brands display order**          |

### 7.10 Storefront Products

| Method | Endpoint                          | Auth / Permission | Description                                  |
| :----- | :-------------------------------- | :---------------- | :------------------------------------------- |
| `GET`  | `/api/catalog/products`           | Public            | Paginated product catalog with filters       |
| `GET`  | `/api/catalog/products/:idOrSlug` | Public            | Single product detail by UUID or unique slug |

### 7.11 Admin Products, Variants & Images

| Method           | Endpoint                                      | Auth / Permission         | Description                                   |
| :--------------- | :-------------------------------------------- | :------------------------ | :-------------------------------------------- |
| `GET`            | `/api/admin/products`                         | `catalog.products.read`   | Paginated admin products with stock/variants  |
| `POST`           | `/api/admin/products`                         | `catalog.products.create` | Create product with optional initial variants |
| `GET`            | `/api/admin/products/:id`                     | `catalog.products.read`   | Complete product detail with variants/images  |
| `PUT` \| `PATCH` | `/api/admin/products/:id`                     | `catalog.products.update` | Update product details                        |
| `DELETE`         | `/api/admin/products/:id`                     | `catalog.products.delete` | Deactivate product                            |
| `POST`           | `/api/admin/products/:id/variants`            | `catalog.products.update` | Add size variant (`sizeMilliliters`, SKU)     |
| `PATCH`          | `/api/admin/products/:id/variants/:variantId` | `catalog.products.update` | Update variant prices, SKU, threshold         |
| `DELETE`         | `/api/admin/products/:id/variants/:variantId` | `catalog.products.delete` | Deactivate variant                            |
| `POST`           | `/api/admin/products/:id/images`              | `catalog.products.update` | Attach Cloudinary image URL to product        |
| `DELETE`         | `/api/admin/products/:id/images/:imageId`     | `catalog.products.delete` | Detach image record from product              |
| _`PUT`_          | _`/api/admin/products/reorder`_               | _N/A_                     | **Forbidden (404 Not Found)**                 |

### 7.12 Admin Inventory

| Method | Endpoint                                 | Auth / Permission  | Description                                 |
| :----- | :--------------------------------------- | :----------------- | :------------------------------------------ |
| `GET`  | `/api/admin/inventory`                   | `inventory.read`   | Paginated stock listing across all variants |
| `GET`  | `/api/admin/inventory/low-stock`         | `inventory.read`   | Variants at or below low stock threshold    |
| `GET`  | `/api/admin/inventory/:variantId`        | `inventory.read`   | Single variant inventory record             |
| `POST` | `/api/admin/inventory/:variantId/adjust` | `inventory.update` | Adjust stock level with reason & audit note |

### 7.13 Storefront Cart

| Method | Endpoint             | Auth / Permission | Description                                         |
| :----- | :------------------- | :---------------- | :-------------------------------------------------- |
| `POST` | `/api/cart/validate` | Public            | Validate cart items, prices, and stock availability |

### 7.14 Storefront Checkout

| Method | Endpoint              | Auth / Permission | Description                                       |
| :----- | :-------------------- | :---------------- | :------------------------------------------------ |
| `POST` | `/api/checkout/quote` | Public            | Calculate subtotal, delivery fee, and total       |
| `POST` | `/api/checkout`       | Public            | Create guest order, reserve stock, generate token |

### 7.15 Storefront Orders & Lookup

| Method | Endpoint                   | Auth / Permission       | Description                                  |
| :----- | :------------------------- | :---------------------- | :------------------------------------------- |
| `GET`  | `/api/orders/:orderNumber` | Public (Token required) | Lookup order status using guest lookup token |

### 7.16 Admin Orders

| Method  | Endpoint                        | Auth / Permission | Description                                   |
| :------ | :------------------------------ | :---------------- | :-------------------------------------------- |
| `GET`   | `/api/admin/orders`             | `orders.read`     | Paginated orders with status & date filters   |
| `GET`   | `/api/admin/orders/:id`         | `orders.read`     | Order details with items, customer, delivery  |
| `GET`   | `/api/admin/orders/:id/invoice` | `orders.read`     | Download deterministic PDF tax invoice        |
| `GET`   | `/api/admin/orders/:id/history` | `orders.read`     | Order status transition history & audit logs  |
| `PATCH` | `/api/admin/orders/:id/status`  | `orders.status`   | Update fulfillment status (`CONFIRMED`, etc.) |
| `POST`  | `/api/admin/orders/:id/cancel`  | `orders.status`   | Cancel order and release reserved stock       |

### 7.17 Storefront & Admin Payment Methods & Submissions

| Method  | Endpoint                                     | Auth / Permission            | Description                                             |
| :------ | :------------------------------------------- | :--------------------------- | :------------------------------------------------------ |
| `GET`   | `/api/payment-methods`                       | Public                       | Active payment methods (COD, Static QR)                 |
| `GET`   | `/api/admin/payment-methods`                 | `payment-methods.read`       | Paginated admin payment methods list                    |
| `POST`  | `/api/admin/payment-methods`                 | `payment-methods.create`     | Create payment method with optional QR image URL        |
| `GET`   | `/api/admin/payment-methods/:id`             | `payment-methods.read`       | Single payment method details                           |
| `PATCH` | `/api/admin/payment-methods/:id`             | `payment-methods.update`     | Update payment method details                           |
| `POST`  | `/api/orders/:orderNumber/payment-proof`     | Public (Order Token)         | Submit payment slip (multipart file or Cloudinary JSON) |
| `GET`   | `/api/admin/payment-submissions`             | `payment-submissions.read`   | Paginated payment submissions pending review            |
| `GET`   | `/api/admin/payment-submissions/:id`         | `payment-submissions.read`   | Single payment proof detail with receipt image          |
| `POST`  | `/api/admin/payment-submissions/:id/approve` | `payment-submissions.verify` | Approve customer payment submission                     |
| `POST`  | `/api/admin/payment-submissions/:id/reject`  | `payment-submissions.verify` | Reject payment submission with mandatory reason         |
| `POST`  | `/api/admin/payment-submissions/:id/review`  | `payment-submissions.verify` | Combined approve/reject action review                   |

### 7.18 Admin Customers

| Method | Endpoint                          | Auth / Permission | Description                                  |
| :----- | :-------------------------------- | :---------------- | :------------------------------------------- |
| `GET`  | `/api/admin/customers`            | `customers.read`  | Paginated guest customer profiles with stats |
| `GET`  | `/api/admin/customers/:id`        | `customers.read`  | Customer profile, total spent, recent orders |
| `GET`  | `/api/admin/customers/:id/orders` | `customers.read`  | Full order history for specified customer    |

### 7.19 Contact & Customer Inquiries

| Method   | Endpoint                                  | Auth / Permission          | Description                                    |
| :------- | :---------------------------------------- | :------------------------- | :--------------------------------------------- |
| `POST`   | `/api/contact`                            | Public (Rate-limited)      | Public customer inquiry submission             |
| `GET`    | `/api/admin/contact-inquiries`            | `contact-inquiries.read`   | Paginated inquiries with status & date filters |
| `GET`    | `/api/admin/contact-inquiries/:id`        | `contact-inquiries.read`   | Inquiry details with internal admin note       |
| `PATCH`  | `/api/admin/contact-inquiries/:id/status` | `contact-inquiries.update` | Update inquiry status and admin notes          |
| `DELETE` | `/api/admin/contact-inquiries/:id`        | `contact-inquiries.update` | Delete customer inquiry record                 |

### 7.20 Banners & Promotions

| Method           | Endpoint                        | Auth / Permission | Description                                |
| :--------------- | :------------------------------ | :---------------- | :----------------------------------------- |
| `GET`            | `/api/banners`                  | Public            | List active scheduled banners              |
| `GET`            | `/api/admin/banners`            | `banners.read`    | Paginated banners with active/date filters |
| `POST`           | `/api/admin/banners`            | `banners.create`  | Create banner with image, link, schedule   |
| `GET`            | `/api/admin/banners/:id`        | `banners.read`    | Single banner details                      |
| `PUT` \| `PATCH` | `/api/admin/banners/:id`        | `banners.update`  | Update banner details                      |
| `PATCH`          | `/api/admin/banners/:id/status` | `banners.update`  | Activate or deactivate banner              |
| `DELETE`         | `/api/admin/banners/:id`        | `banners.delete`  | Delete banner record                       |
| `PUT`            | `/api/admin/banners/reorder`    | `banners.update`  | **Reorder banners display order**          |

### 7.21 Gallery Management

| Method           | Endpoint                        | Auth / Permission | Description                                         |
| :--------------- | :------------------------------ | :---------------- | :-------------------------------------------------- |
| `GET`            | `/api/gallery`                  | Public            | List active gallery items ordered by `displayOrder` |
| `GET`            | `/api/admin/gallery`            | `gallery.read`    | Paginated gallery items with category filter        |
| `POST`           | `/api/admin/gallery`            | `gallery.create`  | Create gallery item with Cloudinary image URL       |
| `GET`            | `/api/admin/gallery/:id`        | `gallery.read`    | Single gallery item detail                          |
| `PUT` \| `PATCH` | `/api/admin/gallery/:id`        | `gallery.update`  | Update gallery item details                         |
| `PATCH`          | `/api/admin/gallery/:id/status` | `gallery.update`  | Activate or deactivate gallery item                 |
| `DELETE`         | `/api/admin/gallery/:id`        | `gallery.delete`  | Delete gallery item                                 |
| _`PUT`_          | _`/api/admin/gallery/reorder`_  | _N/A_             | **Forbidden (404 Not Found)**                       |

### 7.22 Store Settings & Social Media

| Method           | Endpoint                             | Auth / Permission     | Description                                       |
| :--------------- | :----------------------------------- | :-------------------- | :------------------------------------------------ |
| `GET`            | `/api/settings`                      | Public                | Safe public store configuration & business hours  |
| `GET`            | `/api/admin/settings`                | `settings.read`       | Full store configuration with admin metadata      |
| `PUT` \| `PATCH` | `/api/admin/settings`                | `settings.update`     | Update store hours, contact info, announcement    |
| `GET`            | `/api/social-media`                  | Public                | Active social media items (video & profile)       |
| `GET`            | `/api/social-media/active`           | Public                | Alias: active social media items                  |
| `GET`            | `/api/social-media-link`             | Public                | Active profile links grouped by platform          |
| `GET`            | `/api/social-media/profiles`         | Public                | Alias: active profile links grouped by platform   |
| `GET`            | `/api/social-media-link/active`      | Public                | Alias: active profile links                       |
| `GET`            | `/api/admin/social-media`            | `social-media.read`   | Paginated social media items with platform counts |
| `POST`           | `/api/admin/social-media`            | `social-media.create` | Create single social media item                   |
| `POST`           | `/api/admin/social-media/batch`      | `social-media.create` | Create multiple social media items in batch       |
| `GET`            | `/api/admin/social-media/:id`        | `social-media.read`   | Single social media item detail                   |
| `PUT` \| `PATCH` | `/api/admin/social-media/:id`        | `social-media.update` | Update social media item                          |
| `PATCH`          | `/api/admin/social-media/:id/status` | `social-media.update` | Activate or deactivate social media item          |
| `DELETE`         | `/api/admin/social-media/:id`        | `social-media.delete` | Delete social media item                          |
| _`PUT`_          | _`/api/admin/social-media/reorder`_  | _N/A_                 | **Forbidden (404 Not Found)**                     |

### 7.23 Media & Uploads

| Method   | Endpoint                     | Auth / Permission | Description                                      |
| :------- | :--------------------------- | :---------------- | :----------------------------------------------- |
| `POST`   | `/api/admin/media/upload`    | `media.create`    | Multipart upload to Cloudinary with purpose tag  |
| `DELETE` | `/api/admin/media/:publicId` | `media.delete`    | Delete asset from Cloudinary (blocked if in use) |

> [!NOTE]
> For a full manual testing guide, supported MIME types, purpose-specific size limits, Postman payloads, and asset cleanup safety, see [`docs/cloudinary-upload-testing.md`](file:///d:/KreativeMandu/oldLiquor/backend/docs/cloudinary-upload-testing.md).

### 7.24 Admin Analytics & Dashboard

| Method | Endpoint                                      | Auth / Permission | Description                                      |
| :----- | :-------------------------------------------- | :---------------- | :----------------------------------------------- |
| `GET`  | `/api/admin/dashboard/summary`                | `dashboard.read`  | Operational KPIs: sales, orders, AOV, stock      |
| `GET`  | `/api/admin/dashboard/overview`               | `dashboard.read`  | Alias: summary KPIs                              |
| `GET`  | `/api/admin/dashboard/sales`                  | `dashboard.read`  | Time-series sales chart by day/week/month        |
| `GET`  | `/api/admin/dashboard/sales-chart`            | `dashboard.read`  | Alias: time-series sales chart                   |
| `GET`  | `/api/admin/dashboard/order-status-breakdown` | `dashboard.read`  | Order volume distribution by fulfillment status  |
| `GET`  | `/api/admin/dashboard/top-products`           | `dashboard.read`  | Best-selling products ranked by volume & revenue |
| `GET`  | `/api/admin/dashboard/best-sellers`           | `dashboard.read`  | Alias: best-selling products                     |
| `GET`  | `/api/admin/dashboard/low-stock`              | `dashboard.read`  | Critical low-stock variants listing              |
| `GET`  | `/api/admin/dashboard/inventory`              | `dashboard.read`  | Alias: critical low-stock variants               |

### 7.25 Newsletter Module (Performance House Parity)

| Method   | Endpoint                                   | Auth / Permission   | Description                                                                |
| :------- | :----------------------------------------- | :------------------ | :------------------------------------------------------------------------- |
| `POST`   | `/api/newsletter/subscribe`                | Public              | Subscribe email (normalizes, reactivates inactive, rate limited)           |
| `POST`   | `/api/newsletter/unsubscribe`              | Public              | Unsubscribe email (normalizes, marks inactive, rate limited)               |
| `GET`    | `/api/admin/newsletter/subscribers`        | `newsletter.read`   | List all subscribers ordered by subscribedAt desc with search filter       |
| `GET`    | `/api/admin/newsletter/subscribers/active` | `newsletter.read`   | List active subscribers ordered by subscribedAt desc                       |
| `DELETE` | `/api/admin/newsletter/subscribers/:id`    | `newsletter.delete` | Delete subscriber by UUID with audit log (`NEWSLETTER_SUBSCRIBER_DELETED`) |

---

## 8. Quality Verification & Audit Commands

Run the full verification suite before any deployment or pull request:

```powershell
# Run all unit and integration test suites
npm test

# Verify ESLint rules
npm run lint

# Verify TypeScript compilation and type safety
npm run typecheck

# Verify Prettier code formatting
npm run format

# Validate Prisma schema consistency
npm run db:validate

# Verify complete TypeScript build
npm run build

# Run security vulnerability audit
npm audit
```
