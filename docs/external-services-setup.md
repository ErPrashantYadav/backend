# Liquor Shop Backend — External Services Setup & Integration Guide

The Liquor Shop Backend integrates with four external services to deliver media management, GPS delivery estimation, transactional notifications, and customer communication:

1. **Cloudinary**: Digital asset management for product images, payment QR codes, promotional banners, and customer payment slips.
2. **Google Maps Platform**: Distance Matrix and Geocoding APIs for real-time Kathmandu road distance and delivery fee calculation.
3. **Transactional Email (Console / SMTP / Resend)**: Customer order status updates, invoices, inquiry receipts, and administrative alerts.
4. **WhatsApp Business (Meta Cloud API)**: Real-time store owner order notifications.

This document explains how each service is configured, tested locally without live credentials, and enabled in staging or production.

---

## 1. Cloudinary Asset Management

### 1.1 Architecture & Reference Safety

Cloudinary stores all binary image assets uploaded via the administrative portal or submitted by customers as payment proofs. The integration enforces strict **reference safety**:

- Before deleting an asset (`DELETE /api/admin/media`), the backend queries PostgreSQL to ensure the `publicId` or image URL is not referenced by any active Product, Product Image, Payment Method QR, Banner, Gallery item, or Social Media thumbnail.
- If referenced, deletion is aborted with `409 Conflict: ASSET_IN_USE`.

### 1.2 Local Development & Automated Testing (Mock / Memory Mode)

- In local development and automated testing, Cloudinary configuration is **completely optional**.
- When `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, or `CLOUDINARY_API_SECRET` are omitted, the backend initializes an `UnconfiguredCloudinaryClient` (in database mode) or `MemoryCloudinaryClient` (in memory test mode).
- Uploads in automated test suites bypass network calls and return deterministic mock Cloudinary URLs (`https://res.cloudinary.com/mock-cloud/image/upload/...`).

### 1.3 Live Configuration

To enable live Cloudinary uploads in staging or production, register an account at [cloudinary.com](https://cloudinary.com) and configure these variables in `.env`:

```ini
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-api-secret-key

# Optional folder organizational names (defaults shown)
CLOUDINARY_PRODUCT_FOLDER=liquor_shop/products
CLOUDINARY_PAYMENT_QR_FOLDER=liquor_shop/payment_qr
CLOUDINARY_BANNER_FOLDER=liquor_shop/banners
CLOUDINARY_GALLERY_FOLDER=liquor_shop/gallery
CLOUDINARY_PAYMENT_PROOF_FOLDER=liquor_shop/payment_proofs
```

> [!IMPORTANT]
> The configuration parser enforces all-or-nothing validation: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` must all be provided together. Setting one without the others will throw an environment validation error on boot.

---

## 2. Google Maps Platform (Routes API & Geocoding)

### 2.1 How Delivery Calculation Works

When a guest customer proceeds to checkout:

1. The customer provides delivery coordinates (`latitude`, `longitude`) in Kathmandu.
2. The `RoutingService` calls the Google Maps Routes API (`computeRouteMatrix` v2: `POST https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix`) with an explicit `X-Goog-FieldMask` header (`originIndex,destinationIndex,status,condition,distanceMeters,duration`), comparing customer coordinates with the configured store origin (`STORE_ORIGIN_LATITUDE`, `STORE_ORIGIN_LONGITUDE`).
3. If road distance exceeds `DELIVERY_MAX_DISTANCE_KM` (default 25 km), checkout rejects with `400 MAX_DISTANCE_EXCEEDED`.
4. If within radius, `RoutingDeliveryFeeEstimator` computes the delivery fee based on store settings:
   - Base fee (e.g. NPR 100) + Per-km fee (e.g. NPR 25 × distance km).
   - If cart subtotal exceeds `deliveryFeeFreeThreshold` (or environment fallback `DELIVERY_FEE_FREE_THRESHOLD`), fee is waived to NPR 0.
5. In parallel, `GoogleMapsGeocodingProvider` uses the Geocoding API (`GET https://maps.googleapis.com/maps/api/geocode/json`) to resolve a human-readable street address for orders submitted via map pin coordinates.

### 2.2 Local Development & Automated Testing

- `GOOGLE_MAPS_API_KEY` is optional in development.
- If omitted, the application uses `MemoryRoutingProvider` and `MemoryGeocodingProvider`.
- This allows full local end-to-end checkout testing with zero external API dependencies.

### 2.3 Live Configuration

Obtain an API key from the Google Cloud Console with **Routes API** and **Geocoding API** enabled:

```ini
GOOGLE_MAPS_API_KEY=AIzaSy...your-google-maps-api-key

# Store Origin Coordinates (Kathmandu / Thamel default)
STORE_ORIGIN_LATITUDE=27.7172
STORE_ORIGIN_LONGITUDE=85.3240

# Delivery fee defaults
DELIVERY_FEE_MODE=PER_KM
DELIVERY_FEE_BASE_AMOUNT=100
DELIVERY_FEE_PER_KM_AMOUNT=25
DELIVERY_FEE_FREE_THRESHOLD=5000
DELIVERY_MAX_DISTANCE_KM=25
DELIVERY_FALLBACK_AMOUNT=0
```

---

## 3. Transactional Email Providers

The backend features an abstraction supporting multiple email backends:

| Provider Mode | Best Used For                  | Configuration Required                               | Description                                                    |
| ------------- | ------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------- |
| `CONSOLE`     | Local Development & Unit Tests | None (`EMAIL_PROVIDER=CONSOLE`)                      | Pretty-prints email to terminal stdout; zero network requests. |
| `TEST`        | Vitest Automated Tests         | None (`EMAIL_PROVIDER=TEST`)                         | Records sent emails in memory array for test assertions.       |
| `SMTP`        | Production / Staging           | Mailgun, SendGrid, Amazon SES, or custom SMTP server | Standards-compliant TLS SMTP transmission via Nodemailer.      |
| `RESEND`      | Modern Production API          | Resend API Key                                       | Lightweight HTTP API delivery via Resend.                      |

### 3.1 Console Provider (Recommended Default)

```ini
EMAIL_PROVIDER=CONSOLE
EMAIL_FROM=Old Liquor <orders@oldliquor.com>
STORE_ORDER_NOTIFICATION_EMAIL=orders@oldliquor.test
STORE_CONTACT_NOTIFICATION_EMAIL=contact@oldliquor.test
```

### 3.2 Live SMTP Configuration

```ini
EMAIL_PROVIDER=SMTP
EMAIL_FROM=Old Liquor <orders@oldliquor.com>
STORE_ORDER_NOTIFICATION_EMAIL=orders@oldliquor.com
STORE_CONTACT_NOTIFICATION_EMAIL=contact@oldliquor.com
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASSWORD=your_smtp_password
```

### 3.3 Live Resend Configuration

```ini
EMAIL_PROVIDER=RESEND
EMAIL_FROM=Old Liquor <orders@oldliquor.com>
STORE_ORDER_NOTIFICATION_EMAIL=orders@oldliquor.com
STORE_CONTACT_NOTIFICATION_EMAIL=contact@oldliquor.com
RESEND_API_KEY=re_1234567890abcdef
```

---

## 4. WhatsApp Business (Meta Cloud API)

### 4.1 Owner Order Alerts

When a new guest order is placed, the backend outbox enqueues an instant notification to the store owner's WhatsApp number.

### 4.2 Local Development & Automated Testing

- If `WHATSAPP_API_TOKEN` is omitted, the outbox service falls back to `ConsoleWhatsAppProvider` or `MemoryWhatsAppProvider`.
- It logs the formatted WhatsApp text payload to the console and marks the outbox message as dispatched.

### 4.3 Live Meta Cloud API Configuration

Obtain credentials from the [Meta for Developers Portal](https://developers.facebook.com):

```ini
STORE_OWNER_WHATSAPP_NUMBER=+9779801234567
WHATSAPP_PHONE_NUMBER_ID=109876543210987
WHATSAPP_API_TOKEN=EAA...your_system_user_token
```

---

## 5. Security & Secret Management Best Practices

1. **Never commit `.env` or paste live API keys into source control, issues, or commit messages.**
2. **Use separate Cloudinary folders and credentials per environment** to prevent development tests from polluting production assets.
3. **Restrict Google Maps API keys** in Google Cloud Console using HTTP Referrer or IP Address restrictions.
4. **Use unguessable token generation** for JWT secrets and lookup keys:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
