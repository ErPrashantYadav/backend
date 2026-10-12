# Email & WhatsApp Notification Provider Testing Runbook

Operational testing runbook for the Transactional Notification Outbox, Email providers (Console, SMTP, Resend), and Meta WhatsApp Business Cloud API integration in the Liquor Shop Backend.

---

## 1. Architecture & Delivery Guarantees

The notification system uses the **Transactional Outbox Pattern** to decouple business operations from external network dependencies:

1. **Transactional Enqueueing**:
   - Order creation or status changes write a pending notification record into PostgreSQL within the same atomic transaction.
   - If the order transaction rolls back, no notification record is committed.
2. **At-Least-Once Delivery**:
   - The worker claims a batch of pending records, transitions them to `PROCESSING`, delivers them via the configured provider adapter, and marks them `DELIVERED`.
   - If a worker crashes or network fails after sending but before committing `DELIVERED`, records stalled in `PROCESSING` for > 5 minutes are safely reclaimed by the next worker run.
3. **Deduplication & Idempotency**:
   - Every notification has a unique `idempotencyKey` enforced by a database unique index (`@@unique([idempotencyKey])`).
   - Duplicate events (e.g. repeated checkout submission or multiple status change clicks) will not create duplicate outbox entries.

---

## 2. Notification Trigger Rules

The system implements strict, verified rules for when notifications are enqueued:

### 2.1 Order Creation (`POST /api/checkout`)

- **WhatsApp**: Enqueues an owner alert (`ORDER_CREATED_OWNER_ALERT`) to `STORE_OWNER_WHATSAPP_NUMBER`.
  - **Graceful Skip**: If `STORE_OWNER_WHATSAPP_NUMBER` is not set, WhatsApp enqueueing is skipped without error.
  - **Idempotency Key**: `whatsapp:order-created:${order.orderNumber}`
- **Customer Email**: **NO email is enqueued** upon order creation. Customer emails are reserved for fulfillment status updates.

### 2.2 Order Fulfillment Updates (`PATCH /api/admin/orders/:id/status`)

- **Customer Email**: Enqueues an update email (`ORDER_STATUS_CHANGED`) **ONLY** for the following 4 eligible statuses:
  - `CONFIRMED`
  - `OUT_FOR_DELIVERY`
  - `DELIVERED`
  - `CANCELLED`
- **Non-Eligible Statuses**: Transitions to `PENDING` or `PREPARING` do **NOT** trigger customer emails.
- **Missing Email**: If a guest customer did not provide an email address during checkout, the notification is skipped gracefully.
- **Idempotency Key**: `email:order-status:${order.id}:${toStatus}`

---

## 3. Configuration Variables & Provider Selection

All notification configuration is loaded via `src/config/env.ts`:

| Variable                         | Provider / Component | Default / Example                   | Purpose & Source                                                     |
| :------------------------------- | :------------------- | :---------------------------------- | :------------------------------------------------------------------- |
| `EMAIL_PROVIDER`                 | Email Factory        | `CONSOLE`                           | Selects email engine: `CONSOLE`, `SMTP`, `RESEND`, or `TEST`.        |
| `EMAIL_FROM`                     | All Email Providers  | `Old Liquor <orders@oldliquor.com>` | Sender display name and verified email address.                      |
| `SMTP_HOST`                      | SMTP Provider        | `smtp.mailgun.org`                  | SMTP server hostname (Mailgun, SendGrid, Amazon SES, Mailtrap).      |
| `SMTP_PORT`                      | SMTP Provider        | `587`                               | SMTP port (`587` for STARTTLS, `465` for direct SSL/TLS).            |
| `SMTP_USER`                      | SMTP Provider        | `postmaster@...`                    | SMTP authentication username.                                        |
| `SMTP_PASSWORD`                  | SMTP Provider        | _Secret_                            | SMTP authentication password / API key.                              |
| `RESEND_API_KEY`                 | Resend Provider      | `re_123456789...`                   | API key from [Resend Dashboard](https://resend.com/api-keys).        |
| `STORE_OWNER_WHATSAPP_NUMBER`    | WhatsApp Outbox      | `+9779801234567`                    | International E.164 phone number of store manager/owner.             |
| `WHATSAPP_API_TOKEN`             | Meta WhatsApp        | _Secret_                            | System User Access Token from Meta Developer Console.                |
| `WHATSAPP_PHONE_NUMBER_ID`       | Meta WhatsApp        | `100609...`                         | WhatsApp Business Phone Number ID from WhatsApp Cloud API dashboard. |
| `NOTIFICATION_WORKER_BATCH_SIZE` | Outbox Worker        | `10`                                | Number of notifications claimed per batch (1–100).                   |
| `NOTIFICATION_MAX_ATTEMPTS`      | Outbox Worker        | `5`                                 | Maximum retry attempts before marking record permanently `FAILED`.   |

---

## 4. Current Configuration Status in Workspace

Audit of the active process environment:

- `EMAIL_PROVIDER`: Not set in `.env` (defaults to safe dry-run mode: `CONSOLE`).
- `STORE_OWNER_WHATSAPP_NUMBER`: Not set in `.env`.
- `WHATSAPP_API_TOKEN`: Not set in `.env`.
- `WHATSAPP_PHONE_NUMBER_ID`: Not set in `.env`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`: Not set in `.env`.
- `RESEND_API_KEY`: Not set in `.env`.

**Readiness State**:

- **Console / Dry-Run Testing**: Ready immediately.
- **External Network Providers**: Unconfigured. No real messages can be sent until credentials are provided in the environment.

---

## 5. Safe Testing Workflows

### 5.1 Mode 1: Dry-Run / Console Testing (Zero Network Calls, Zero Cost)

The default mode logs messages to the terminal without contacting external APIs:

```powershell
# 1. Start the worker in single-batch dry-run mode
npx tsx scripts/notification-worker.ts --once
```

**Expected Console Output (Email)**:

```text
[CONSOLE EMAIL] To: customer@example.com | Subject: Order ORD-20261012-ABC Update: CONFIRMED
Dear John Doe,
Your order ORD-20261012-ABC has been updated to: CONFIRMED.
Order Total: NPR 2500.00
Delivery Address: Lazimpat, Kathmandu
```

**Expected Console Output (WhatsApp in Development Mode)**:

```text
[CONSOLE WHATSAPP] To: 9779801234567 | Message:
*🚨 New Liquor Shop Order Placed*
*Order Number:* ORD-20261012-ABC
*Customer:* John Doe
*Phone:* 9801234567
*Items Count:* 2
*Total Amount:* NPR 2500.00
*Payment:* COD
*Address:* Lazimpat, Kathmandu
```

---

### 5.2 Mode 2: Testing Live Email Delivery (Controlled Inbox)

To test live email delivery using **Resend** or **SMTP** without hardcoding credentials in `.env`:

#### Resend Provider Setup

```powershell
# Inject Resend credentials in PowerShell session
$env:EMAIL_PROVIDER = "RESEND"
$env:RESEND_API_KEY = "re_your_actual_resend_api_key"
$env:EMAIL_FROM = "Old Liquor <onboarding@resend.dev>"

# Run single batch to transmit pending emails
npx tsx scripts/notification-worker.ts --once
```

#### SMTP / Mailtrap Provider Setup (Recommended for Sandboxing)

```powershell
$env:EMAIL_PROVIDER = "SMTP"
$env:SMTP_HOST = "sandbox.smtp.mailtrap.io"
$env:SMTP_PORT = "2525"
$env:SMTP_USER = "your_mailtrap_user"
$env:SMTP_PASSWORD = "your_mailtrap_password"
$env:EMAIL_FROM = "Old Liquor <orders@oldliquor.com>"

npx tsx scripts/notification-worker.ts --once
```

---

### 5.3 Mode 3: Testing Live WhatsApp Delivery (Meta Cloud API)

Meta requires recipient phone numbers to be explicitly authorized in the Meta App Dashboard while in Development mode:

```powershell
# 1. Inject Meta Cloud API credentials in PowerShell session
$env:WHATSAPP_API_TOKEN = "EAAG..."
$env:WHATSAPP_PHONE_NUMBER_ID = "100609..."
$env:STORE_OWNER_WHATSAPP_NUMBER = "+9779801234567"

# 2. Process pending outbox records
npx tsx scripts/notification-worker.ts --once
```

> [!WARNING]
> **Meta WhatsApp Restriction**: In Meta Developer test apps, recipient phone numbers must be added under **WhatsApp > API Setup > To (Manage phone number list)**. Unlisted phone numbers will fail with HTTP 400 (`WHATSAPP_VALIDATION_ERROR`).

---

## 6. How to Run the Notification Worker

The worker CLI supports two operational modes:

### Continuous Polling Worker

Polls PostgreSQL outbox table every 5 seconds. Gracefully finishes in-flight batches upon `Ctrl+C` (SIGINT/SIGTERM):

```powershell
npm run notifications:worker
```

### Single-Batch Mode (Best for CI, Cron, & Manual Verification)

Claims up to `NOTIFICATION_WORKER_BATCH_SIZE` pending records, processes them, prints metrics, and exits immediately with code 0:

```powershell
npx tsx scripts/notification-worker.ts --once
```

---

## 7. Retry Strategy & Failure Handling

### 7.1 Permanent Errors (Immediate Failure)

Errors that cannot succeed on retry are marked `FAILED` immediately (`nextRetryAt: null`):

- `INVALID_PHONE_NUMBER`: Phone number length < 7 or > 15 digits.
- `INVALID_RECIPIENT`: Malformed recipient address.
- `RESEND_VALIDATION_ERROR`: Domain unverified or invalid email address.
- `WHATSAPP_VALIDATION_ERROR`: Recipient not in Meta developer test list.

### 7.2 Transient Errors (Exponential Backoff with Jitter)

Transient failures (network timeouts, rate limits HTTP 429, provider HTTP 502/503):

- Re-scheduled with exponential backoff:
  $$\text{Delay} = \min(2^{\text{attempt}} \times 1000\text{ ms}, 3600000\text{ ms}) + \text{jitter}(0\text{--}25\%)$$
- Retried up to `NOTIFICATION_MAX_ATTEMPTS` (default: 5).
- If attempt count reaches 5, the record transitions to `FAILED`.

### 7.3 Secret Redaction

All provider error messages stored in `errorMessage` or emitted in logs pass through `redactSensitiveText()`, ensuring API tokens and SMTP passwords are never leaked into the database or logs.

---

## 8. Prerequisites & Blocker Notice

Before executing notifications against the remote Render database:

1. **Pending Migration Blocker**: Migration `20261011000500_notification_outbox` has not yet been applied to Render. The outbox table does not exist on the remote database yet.
2. **Admin Provisioning Blocker**: Admin status transitions (`PATCH /api/admin/orders/:id/status`) require an authenticated admin with `orders.update` permissions.
3. **Safe Local Testing Alternative**: All notification providers, queue transitions, and worker logic can be safely tested locally using in-memory mode or a local test database without touching Render.
