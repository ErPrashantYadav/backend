# Liquor Shop Backend — Environment Variables Reference

Complete reference for all supported and validated environment variables in the Liquor Shop Backend (`src/config/env.ts`). Every variable listed here is verified with strict Zod parsing during process initialization.

---

## 1. Application & Core Server

| Variable             | Type    | Default       | Required? | Allowed Values / Format                                                               | Description                                                                                           |
| -------------------- | ------- | ------------- | --------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `NODE_ENV`           | String  | `development` | No        | `development`, `test`, `production`                                                   | Active runtime environment.                                                                           |
| `PORT`               | Integer | `3000`        | No        | `1` to `65535`                                                                        | HTTP port the Express server listens on.                                                              |
| `DATABASE_URL`       | String  | None          | **Yes**   | Valid `postgresql://` or `postgres://` URL                                            | PostgreSQL connection string including user, password, host, port, database, and schema.              |
| `CORS_ORIGINS`       | String  | None          | **Yes**   | Comma-separated exact URLs (e.g. `http://localhost:5173,https://admin.oldliquor.com`) | Whitelisted HTTP(S) origins permitted to make cross-origin requests.                                  |
| `LOG_LEVEL`          | String  | `info`        | No        | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`                          | Pino logging threshold.                                                                               |
| `TRUST_PROXY_HOPS`   | Integer | `1`           | No        | `0` to `10`                                                                           | Reverse proxy hops (e.g. Nginx, Cloudflare, Render load balancers) for accurate client IP resolution. |
| `REQUEST_BODY_LIMIT` | String  | `1mb`         | No        | Regex `^\d+(b\|kb\|mb)$`                                                              | Maximum allowed request JSON/form body payload size.                                                  |

---

## 2. Security, Rate Limiting & Admin Authentication

| Variable                             | Type    | Default                         | Required? | Allowed Values / Format                                  | Description                                                                |
| ------------------------------------ | ------- | ------------------------------- | --------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `JWT_SECRET`                         | String  | Deliberately invalid in example | **Yes**   | Unpadded base64url string encoding $\ge 32$ random bytes | Master symmetric secret used to sign and verify HS256 admin access tokens. |
| `JWT_ISSUER`                         | String  | None                            | **Yes**   | Non-empty string (e.g. `liquor-shop-api`)                | Expected issuer claim (`iss`) in JWT access tokens.                        |
| `JWT_AUDIENCE`                       | String  | None                            | **Yes**   | Non-empty string (e.g. `liquor-shop-admin-api`)          | Expected audience claim (`aud`) in JWT access tokens.                      |
| `JWT_ACCESS_TOKEN_TTL_SECONDS`       | Integer | None                            | **Yes**   | Must be exactly `900`                                    | Token time-to-live in seconds (fixed at 15 minutes).                       |
| `RATE_LIMIT_WINDOW_MS`               | Integer | `60000`                         | No        | $\ge 1000$ (milliseconds)                                | Time window for global IP-based rate limiting.                             |
| `RATE_LIMIT_MAX_REQUESTS`            | Integer | `120`                           | No        | $\ge 1$                                                  | Maximum allowed requests per IP within the global rate limit window.       |
| `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`    | Integer | `900000`                        | No        | $\ge 1000$ (15 minutes default)                          | Time window for strict admin login rate limiting.                          |
| `AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS` | Integer | `5`                             | No        | `1` to `20`                                              | Maximum login attempts per IP within the window before returning HTTP 429. |

---

## 3. Cloudinary Asset Management

> [!NOTE]
> `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` must **all be provided together** if configuring live Cloudinary uploads. If omitted, the server operates in unconfigured/memory mode for safe local testing.

| Variable                          | Type   | Default                      | Required?       | Description                                                 |
| --------------------------------- | ------ | ---------------------------- | --------------- | ----------------------------------------------------------- |
| `CLOUDINARY_CLOUD_NAME`           | String | None                         | Optional in dev | Cloudinary account cloud name.                              |
| `CLOUDINARY_API_KEY`              | String | None                         | Optional in dev | Cloudinary API key.                                         |
| `CLOUDINARY_API_SECRET`           | String | None                         | Optional in dev | Cloudinary API secret key.                                  |
| `CLOUDINARY_PRODUCT_FOLDER`       | String | `liquor_shop/products`       | No              | Remote folder prefix for product cover and variant images.  |
| `CLOUDINARY_PAYMENT_QR_FOLDER`    | String | `liquor_shop/payment_qr`     | No              | Remote folder prefix for static payment QR code assets.     |
| `CLOUDINARY_BANNER_FOLDER`        | String | `liquor_shop/banners`        | No              | Remote folder prefix for promotional hero banners.          |
| `CLOUDINARY_GALLERY_FOLDER`       | String | `liquor_shop/gallery`        | No              | Remote folder prefix for showcase gallery images.           |
| `CLOUDINARY_PAYMENT_PROOF_FOLDER` | String | `liquor_shop/payment_proofs` | No              | Remote folder prefix for customer payment slip screenshots. |

---

## 4. Google Maps & Delivery Routing

| Variable                      | Type   | Default   | Required?       | Description                                                                                                   |
| ----------------------------- | ------ | --------- | --------------- | ------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_MAPS_API_KEY`         | String | None      | Optional in dev | Google Cloud API key with Routes API & Geocoding enabled. Falls back to memory routing provider when omitted. |
| `STORE_ORIGIN_LATITUDE`       | Number | `27.7172` | No              | Store dispatch latitude in Kathmandu (also accepts alias `STORE_ORIGIN_LAT`).                                 |
| `STORE_ORIGIN_LONGITUDE`      | Number | `85.3240` | No              | Store dispatch longitude in Kathmandu (also accepts alias `STORE_ORIGIN_LNG`).                                |
| `DELIVERY_FEE_MODE`           | String | `PER_KM`  | No              | Fee mode: `FIXED`, `PER_KM`, or `TIERED`.                                                                     |
| `DELIVERY_FEE_BASE_AMOUNT`    | Number | `100`     | No              | Base dispatch fee in NPR.                                                                                     |
| `DELIVERY_FEE_PER_KM_AMOUNT`  | Number | `25`      | No              | Incremental delivery fee per road kilometer in NPR.                                                           |
| `DELIVERY_FEE_FREE_THRESHOLD` | Number | Unset     | Optional        | Cart subtotal in NPR at which delivery fee is waived to 0. Overridden by database settings if configured.     |
| `DELIVERY_MAX_DISTANCE_KM`    | Number | `25`      | No              | Maximum allowed delivery radius from store origin in kilometers.                                              |
| `DELIVERY_FALLBACK_AMOUNT`    | Number | `0`       | No              | Flat delivery fee in NPR when GPS coordinates are omitted.                                                    |

---

## 5. Transactional Notifications (Email & WhatsApp Outbox)

| Variable                           | Type    | Default                             | Required?          | Allowed Values / Format                    | Description                                                                |
| ---------------------------------- | ------- | ----------------------------------- | ------------------ | ------------------------------------------ | -------------------------------------------------------------------------- |
| `EMAIL_PROVIDER`                   | String  | `CONSOLE`                           | No                 | `CONSOLE`, `SMTP`, `RESEND`, `TEST`        | Email transport driver. Defaults to `CONSOLE` for zero-setup local dev.    |
| `EMAIL_FROM`                       | String  | `Old Liquor <orders@oldliquor.com>` | No                 | Valid RFC-5322 format                      | Sender address appearing in the `From` header.                             |
| `STORE_ORDER_NOTIFICATION_EMAIL`   | String  | None                                | Optional           | Valid email address                        | Admin inbox recipient for new guest order alerts.                          |
| `STORE_CONTACT_NOTIFICATION_EMAIL` | String  | None                                | Optional           | Valid email address                        | Admin inbox recipient for customer contact inquiry alerts.                 |
| `SMTP_HOST`                        | String  | None                                | Required if SMTP   | e.g. `smtp.mailgun.org`                    | Outgoing SMTP server hostname.                                             |
| `SMTP_PORT`                        | Integer | None                                | Required if SMTP   | `1` to `65535` (e.g. `587`, `465`)         | Outgoing SMTP server port.                                                 |
| `SMTP_USER`                        | String  | None                                | Required if SMTP   | String                                     | SMTP authentication username.                                              |
| `SMTP_PASSWORD`                    | String  | None                                | Required if SMTP   | String                                     | SMTP authentication password.                                              |
| `RESEND_API_KEY`                   | String  | None                                | Required if RESEND | String                                     | Resend API authorization token.                                            |
| `STORE_OWNER_WHATSAPP_NUMBER`      | String  | None                                | Optional           | Valid phone format (e.g. `+9779801234567`) | Store owner phone number receiving new order alerts.                       |
| `WHATSAPP_API_TOKEN`               | String  | None                                | Optional           | Meta Cloud API token                       | Meta WhatsApp Cloud API access token.                                      |
| `WHATSAPP_PHONE_NUMBER_ID`         | String  | None                                | Optional           | Meta Phone Number ID                       | WhatsApp sender phone number ID from Meta developer console.               |
| `NOTIFICATION_WORKER_BATCH_SIZE`   | Integer | `10`                                | No                 | `1` to `100`                               | Number of outbox messages fetched per polling batch.                       |
| `NOTIFICATION_MAX_ATTEMPTS`        | Integer | `5`                                 | No                 | `1` to `20`                                | Maximum retry attempts before marking an outbox record permanently failed. |

---

## 6. One-Time Admin Provisioning Variables (CLI Only)

These variables are consumed exclusively by the CLI script `scripts/provision-initial-admin.ts` (`npm run admin:provision:initial`) and are never stored in source code:

| Variable                          | Description                                                                 |
| --------------------------------- | --------------------------------------------------------------------------- |
| `INITIAL_ADMIN_EMAIL`             | Email address of the first super administrator to create.                   |
| `INITIAL_ADMIN_NAME`              | Full name of the first super administrator.                                 |
| `INITIAL_ADMIN_PASSWORD`          | Secure password (minimum 16 characters).                                    |
| `INITIAL_ADMIN_EXPECTED_DATABASE` | Target database name safety check (must equal `SELECT current_database()`). |
