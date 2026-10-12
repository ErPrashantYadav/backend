# Cloudinary Real Upload Test Readiness Guide

Operational test runbook for validating real Cloudinary media asset uploads, permission gates, size/format validations, asset reference protection, and safe cleanup in the Liquor Shop Backend.

---

## 1. Overview & Architecture

The Liquor Shop Backend provides a centralized, secure media management service integrated with Cloudinary via `POST /api/admin/media/upload` and `DELETE /api/admin/media`.

### 1.1 Upload Purpose Matrix

| Purpose         | Target Cloudinary Folder                                              | Size Limit                                     | Allowed Formats / MIME                                       | Required RBAC Permission                                                                   |
| :-------------- | :-------------------------------------------------------------------- | :--------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| `PRODUCT_IMAGE` | `CLOUDINARY_PRODUCT_FOLDER`<br>(default: `liquor_shop/products`)      | **5 MB**                                       | JPEG, PNG, WebP<br>(`image/jpeg`, `image/png`, `image/webp`) | `catalog.product-images.create`<br>OR `catalog.product-images.update`<br>OR `media.upload` |
| `PAYMENT_QR`    | `CLOUDINARY_PAYMENT_QR_FOLDER`<br>(default: `liquor_shop/payment_qr`) | **2 MB**                                       | JPEG, PNG, WebP<br>(`image/jpeg`, `image/png`, `image/webp`) | `payment-methods.create`<br>OR `payment-methods.update`<br>OR `media.upload`               |
| `BANNER_IMAGE`  | `CLOUDINARY_BANNER_FOLDER`<br>(default: `liquor_shop/banners`)        | **8 MB** (Validator)<br>_(Multer limit: 5 MB)_ | JPEG, PNG, WebP<br>(`image/jpeg`, `image/png`, `image/webp`) | `banners.create`<br>OR `banners.update`<br>OR `media.upload`                               |
| `GALLERY_IMAGE` | `CLOUDINARY_GALLERY_FOLDER`<br>(default: `liquor_shop/gallery`)       | **8 MB** (Validator)<br>_(Multer limit: 5 MB)_ | JPEG, PNG, WebP<br>(`image/jpeg`, `image/png`, `image/webp`) | `gallery.create`<br>OR `gallery.update`<br>OR `media.upload`                               |

> [!IMPORTANT]
> **Customer Payment Proof Slips**: Customer bank receipts are **NOT** uploaded via `/api/admin/media/upload`. Guests submit proof references via public `POST /api/payments/:orderNumber/payment-proof` with their order lookup token. The backend does not expose unauthenticated binary upload endpoints, preventing unauthorized asset hosting and storage exhaustion.

---

## 2. Environment Configuration & Safety

### 2.1 Configuration Variables

The backend inspects the following variables from the process environment:

- `CLOUDINARY_CLOUD_NAME`: Cloudinary account cloud name.
- `CLOUDINARY_API_KEY`: Cloudinary API key.
- `CLOUDINARY_API_SECRET`: Cloudinary API secret.
- `CLOUDINARY_PRODUCT_FOLDER` (optional): Default `liquor_shop/products`.
- `CLOUDINARY_PAYMENT_QR_FOLDER` (optional): Default `liquor_shop/payment_qr`.
- `CLOUDINARY_BANNER_FOLDER` (optional): Default `liquor_shop/banners`.
- `CLOUDINARY_GALLERY_FOLDER` (optional): Default `liquor_shop/gallery`.

### 2.2 Atomic Configuration Validation

The application enforces atomic configuration (`src/config/env.ts`):

- If any of `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, or `CLOUDINARY_API_SECRET` is set, **all three must be provided**.
- If none are set, the app starts with `UnconfiguredCloudinaryClient` (throws `500 CLOUDINARY_CONFIG_MISSING` on upload attempts) or `MemoryCloudinaryClient` (in memory/test mode).

### 2.3 Safe Local Injection (Without Committing Secrets)

**Never edit `.env` or commit API credentials.** Inject credentials into your active PowerShell session:

```powershell
# Set credentials for current shell session only
$env:CLOUDINARY_CLOUD_NAME = "your-actual-cloud-name"
$env:CLOUDINARY_API_KEY = "your-actual-api-key"
$env:CLOUDINARY_API_SECRET = "your-actual-api-secret"

# Verify credentials are set in memory without printing them:
[bool]$env:CLOUDINARY_API_SECRET
```

---

## 3. Current Testing Blockers & Workarounds

### 3.1 The Production/Render Blocker

Executing live upload requests against an instance connected to the Render database currently faces two prerequisites:

1. **Pending Migrations**: The Render database has 13 pending migrations.
2. **No Administrator Record**: The database has 0 admin accounts.

Because `/api/admin/media/upload` strictly requires an authenticated admin bearer token (`adminProfile`), calling `POST /api/admin/auth/login` will fail until:

- Migrations are applied (`npm run db:migrate`), and
- Initial admin provisioning is executed (`npm run admin:provision:initial`).

### 3.2 Bypassing Blockers for Isolated Cloudinary Testing

To test real Cloudinary uploads locally without touching the remote Render database:

#### Option A: Local Disposable PostgreSQL Database

1. Point `DATABASE_URL` in your local session to a local PostgreSQL container or test database:
   ```powershell
   $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/liquor_test?schema=public"
   ```
2. Run `npm run db:migrate` against your local database.
3. Provision a local administrator via `npm run admin:provision:initial`.
4. Log in via `POST /api/admin/auth/login` to obtain an `adminToken`.

#### Option B: Standalone Signed Test Token

Generate a valid 15-minute admin JWT token using the local `JWT_SECRET` configured in `.env`:

```powershell
npx tsx -e "
import 'dotenv/config';
import { loadConfig } from './src/config/env';
import { createAdminAccessToken } from './src/modules/auth/access-token';
const config = loadConfig();
const token = createAdminAccessToken(config, '90000000-0000-4000-8000-000000000001');
console.log('Test Admin Token:\n' + token);
"
```

_(Note: If using this token against the full server, the database must contain an admin with ID `90000000-0000-4000-8000-000000000001` or the request must be authenticated within an in-memory test runner)._

---

## 4. Step-by-Step Upload Testing Guide

### 4.1 Starting the Application

```powershell
npm run dev
```

The server will boot on `http://localhost:3000`. Verify readiness at `GET http://localhost:3000/api/health/ready`.

---

### 4.2 Supported Upload Formats

The upload endpoint supports two input formats:

1. **Multipart Form-Data** (`multipart/form-data`) with field `file` and field `purpose`.
2. **Base64 JSON** (`application/json`) with fields `fileBase64`, `mimeType`, and `purpose`.

---

### 4.3 Test Case 1: Upload Product Image (`PRODUCT_IMAGE`)

#### cURL (Multipart Form-Data)

```powershell
curl -X POST http://localhost:3000/api/admin/media/upload `
  -H "Authorization: Bearer <ADMIN_TOKEN>" `
  -F "purpose=PRODUCT_IMAGE" `
  -F "file=@./sample-product.jpg;type=image/jpeg"
```

#### Postman

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/admin/media/upload`
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Body**: `form-data`
  - Key `purpose`: `PRODUCT_IMAGE` (Text)
  - Key `file`: select a local JPEG, PNG, or WebP file (< 5 MB) (File)

#### Expected 201 Response:

```json
{
  "success": true,
  "message": "Media asset uploaded successfully",
  "data": {
    "secureUrl": "https://res.cloudinary.com/<cloud>/image/upload/v.../liquor_shop/products/<uuid>.jpg",
    "publicId": "liquor_shop/products/<uuid>",
    "format": "jpg",
    "bytes": 245120,
    "width": 800,
    "height": 800,
    "folder": "liquor_shop/products",
    "purpose": "PRODUCT_IMAGE"
  }
}
```

---

### 4.4 Test Case 2: Upload Payment Method QR (`PAYMENT_QR`)

#### Postman

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/admin/media/upload`
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Body**: `form-data`
  - Key `purpose`: `PAYMENT_QR` (Text)
  - Key `file`: select QR image file (< 2 MB) (File)

#### Expected 201 Response:

```json
{
  "success": true,
  "message": "Media asset uploaded successfully",
  "data": {
    "secureUrl": "https://res.cloudinary.com/<cloud>/image/upload/v.../liquor_shop/payment_qr/<uuid>.png",
    "publicId": "liquor_shop/payment_qr/<uuid>",
    "format": "png",
    "bytes": 102400,
    "width": 500,
    "height": 500,
    "folder": "liquor_shop/payment_qr",
    "purpose": "PAYMENT_QR"
  }
}
```

---

### 4.5 Test Case 3: Upload Promotional Banner (`BANNER_IMAGE`)

#### Postman

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/admin/media/upload`
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Body**: `form-data`
  - Key `purpose`: `BANNER_IMAGE` (Text)
  - Key `file`: select banner graphic file (< 5 MB) (File)

#### Expected 201 Response:

```json
{
  "success": true,
  "message": "Media asset uploaded successfully",
  "data": {
    "secureUrl": "https://res.cloudinary.com/<cloud>/image/upload/v.../liquor_shop/banners/<uuid>.webp",
    "publicId": "liquor_shop/banners/<uuid>",
    "format": "webp",
    "bytes": 450120,
    "width": 1920,
    "height": 600,
    "folder": "liquor_shop/banners",
    "purpose": "BANNER_IMAGE"
  }
}
```

---

### 4.6 Test Case 4: Upload Showcase Item (`GALLERY_IMAGE`)

#### Postman

- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/admin/media/upload`
- **Headers**:
  - `Authorization`: `Bearer {{adminToken}}`
- **Body**: `form-data`
  - Key `purpose`: `GALLERY_IMAGE` (Text)
  - Key `file`: select gallery item file (< 5 MB) (File)

#### Expected 201 Response:

```json
{
  "success": true,
  "message": "Media asset uploaded successfully",
  "data": {
    "secureUrl": "https://res.cloudinary.com/<cloud>/image/upload/v.../liquor_shop/gallery/<uuid>.jpg",
    "publicId": "liquor_shop/gallery/<uuid>",
    "format": "jpg",
    "bytes": 380500,
    "width": 1200,
    "height": 900,
    "folder": "liquor_shop/gallery",
    "purpose": "GALLERY_IMAGE"
  }
}
```

---

## 5. Validation Failure Test Cases

Verify that the security and validation layer correctly rejects invalid payloads:

### 5.1 Unsupported File Type (e.g. GIF, PDF)

- **Request**: Send a GIF (`image/gif`) or PDF file.
- **Expected Status**: `415 Unsupported Media Type`
- **Error Code**: `UNSUPPORTED_MEDIA_TYPE`
- **Message**: `MIME type 'image/gif' is not allowed. Allowed types: image/jpeg, image/png, image/webp`

### 5.2 Content Spoofing / Magic Bytes Mismatch

- **Request**: Rename a `.txt` or `.html` script to `photo.jpg` and upload.
- **Expected Status**: `400 Bad Request`
- **Error Code**: `INVALID_IMAGE_CONTENT`
- **Message**: `File content does not match any allowed image format signature (JPEG, PNG, WebP)`

### 5.3 Declared MIME Mismatch

- **Request**: Upload a valid PNG file with header `type=image/jpeg`.
- **Expected Status**: `400 Bad Request`
- **Error Code**: `MIME_MISMATCH`

### 5.4 File Size Limit Exceeded

- **Request**: Upload a 3 MB file with `purpose: PAYMENT_QR` (max 2 MB).
- **Expected Status**: `400 Bad Request`
- **Error Code**: `FILE_TOO_LARGE`
- **Message**: `File size exceeds maximum allowed size of 2 MB for PAYMENT_QR`

### 5.5 Missing Authentication

- **Request**: Send upload request without `Authorization` header.
- **Expected Status**: `401 Unauthorized`
- **Error Code**: `UNAUTHORIZED`

### 5.6 Insufficient RBAC Permissions

- **Request**: Send upload request with a token that lacks the required permission (e.g., token has only `orders.read` and attempts `PRODUCT_IMAGE` upload).
- **Expected Status**: `403 Forbidden`
- **Error Code**: `FORBIDDEN`
- **Message**: `Permission catalog.product-images.create or update required for product image upload`

---

## 6. Asset Verification in Cloudinary Console

Once an asset is uploaded:

1. Copy the `secureUrl` from the JSON response and open it in a browser:
   - Ensure the image loads over HTTPS.
   - Verify image dimensions, format, and aspect ratio.
2. Log in to [Cloudinary Console](https://cloudinary.com/console):
   - Navigate to **Media Library**.
   - Confirm the asset is filed in the expected folder:
     - `liquor_shop/products`
     - `liquor_shop/payment_qr`
     - `liquor_shop/banners`
     - `liquor_shop/gallery`
   - Confirm asset tags match the purpose (`product_image`, `payment_qr`, `banner_image`, `gallery_image`).

---

## 7. Safe Cleanup & Deletion Protection

### 7.1 Deleting an Unreferenced Test Asset

```powershell
curl -X DELETE http://localhost:3000/api/admin/media `
  -H "Authorization: Bearer <ADMIN_TOKEN>" `
  -H "Content-Type: application/json" `
  -d '{"publicId": "liquor_shop/products/<uuid>"}'
```

**Expected 200 Response**:

```json
{
  "success": true,
  "message": "Asset deleted successfully",
  "data": {
    "deleted": true
  }
}
```

### 7.2 Safety Guard: Reference Protection

If an asset's `publicId` or `secureUrl` has been associated with:

- An active `ProductImage`
- A configured `PaymentMethod` QR
- A `Banner`
- A `GalleryItem`
- A `SocialMedia` post thumbnail
- A customer `PaymentSubmission` proof slip

The delete request is rejected:

- **HTTP Status**: `409 Conflict`
- **Error Code**: `ASSET_IN_USE`
- **Message**: `Cannot delete asset: Asset is referenced by ...`

### 7.3 Safety Guard: Foreign Folder Target

Attempting to delete assets outside the designated folders (e.g. `{"publicId": "some_other_folder/file"}`) is blocked:

- **HTTP Status**: `403 Forbidden`
- **Error Code**: `FORBIDDEN_ASSET_TARGET`
- **Message**: `Asset public ID is outside the managed folders`

---

## 8. Customer Privacy & Financial Evidence Protection

Customer payment slips contain sensitive personal data (e.g. customer name, bank account numbers, transaction reference numbers).

- **Never upload customer bank slips as public catalog images, banners, or gallery items.**
- Customer proofs are strictly attached to orders via `POST /api/payments/:orderNumber/payment-proof` and can only be reviewed by authorized administrators (`payment-submissions.read`).
- Even after order fulfillment or cancellation, customer payment receipts are permanent financial evidence and are **never deleted from Cloudinary**.
