# Email Templates Developer Guide

The Liquor Shop backend features a modular, typed email templating architecture located in [`src/modules/notifications/templates/`](file:///d:/KreativeMandu/oldLiquor/backend/src/modules/notifications/templates/).

This separates email formatting, typography, branding, and HTML layout from the core transactional outbox and provider dispatch logic ([`NotificationOutboxService`](file:///d:/KreativeMandu/oldLiquor/backend/src/modules/notifications/notification-outbox.service.ts)).

---

## 1. Template Module Architecture

```
src/modules/notifications/templates/
├── index.ts                              # Barrel export for all templates and helpers
├── email-base.layout.ts                  # Common responsive wrapper, brand header, store footer
├── admin-new-order.template.ts           # Admin new order alert (ORDER_CREATED_ADMIN_ALERT)
├── customer-order-confirmed.template.ts  # Customer confirmation with invoice (ORDER_CONFIRMED_CUSTOMER_INVOICE)
├── customer-order-status.template.ts     # Customer status updates (ORDER_STATUS_CHANGED)
├── admin-contact-inquiry.template.ts     # Admin contact inquiry alert (CONTACT_INQUIRY_ADMIN_ALERT)
└── customer-contact-ack.template.ts      # Customer inquiry acknowledgement (CONTACT_INQUIRY_CUSTOMER_ACK)
```

---

## 2. Template Map: Which File Controls Which Email?

| Email Event / Purpose                | Template File                          | Trigger Condition                                                                              |
| :----------------------------------- | :------------------------------------- | :--------------------------------------------------------------------------------------------- |
| **Admin New-Order Alert**            | `admin-new-order.template.ts`          | Guest order successfully committed. Dispatched to `STORE_ORDER_NOTIFICATION_EMAIL`.            |
| **Customer Order Confirmed**         | `customer-order-confirmed.template.ts` | Administrator approves/moves order to `CONFIRMED`. Official tax PDF invoice is attached.       |
| **Customer Order Status Update**     | `customer-order-status.template.ts`    | Administrator transitions order to `OUT_FOR_DELIVERY`, `DELIVERED`, or `CANCELLED`.            |
| **Admin Contact Inquiry Alert**      | `admin-contact-inquiry.template.ts`    | Customer submits public `/api/contact` form. Dispatched to `STORE_CONTACT_NOTIFICATION_EMAIL`. |
| **Customer Contact Acknowledgement** | `customer-contact-ack.template.ts`     | Immediate auto-reply to customer confirming their contact inquiry was received.                |

---

## 3. How to Safely Edit Template Designs

Each template function returns `{ subject: string; text: string; html: string }`.

### Rule 1: Always Escape Dynamic Content

Never interpolate raw variables directly into HTML strings without escaping:

```typescript
import { escapeHtml } from '../../../utils/html-escape';

// Correct:
`<p>Hello <strong>${escapeHtml(data.customerName)}</strong></p>`
// Unsafe (XSS vulnerability):
`<p>Hello <strong>${data.customerName}</strong></p>`;
```

### Rule 2: Keep Plain Text (`text`) and HTML (`html`) Synchronized

Always provide both versions. When editing text in HTML, update the plain text array as well so clients without HTML rendering receive readable messages.

### Rule 3: Use the Base Layout Wrapper

Wrap all customer and admin emails using `renderEmailBaseLayout`:

```typescript
const html = renderEmailBaseLayout({
  title: 'Your Heading Here',
  headerBadge: {
    text: 'Delivered',
    bgColor: '#d1fae5',
    textColor: '#065f46',
  },
  accentColor: '#059669',
  contentHtml,
  storeInfo, // pulled dynamically from database StoreSettings or defaults
});
```

---

## 4. How to Add a Future Email Template

1. Create a new file in `src/modules/notifications/templates/` (e.g. `customer-password-reset.template.ts`).
2. Define a TypeScript interface for its input data (e.g. `CustomerPasswordResetEmailData`).
3. Export a render function returning `{ subject, text, html }`.
4. Export the template in `src/modules/notifications/templates/index.ts`.
5. Call the renderer from `NotificationOutboxService.processEmailRecord` when handling the new event type.
6. Add the new template to `scripts/preview-email-templates.ts` and `tests/email-templates.test.ts`.

---

## 5. Local Safe Visual Preview (Zero Network / Zero Database)

You can preview all email designs locally without triggering external network calls, calling Resend, modifying database records, or sending test emails:

```bash
npm run notifications:preview
```

This generates HTML files inside `temp/email-previews/`:

- `1-admin-new-order.html`
- `2-customer-order-confirmed.html`
- `3-customer-status-out-for-delivery.html`
- `4-customer-status-delivered.html`
- `5-customer-status-cancelled.html`
- `6-admin-contact-inquiry.html`
- `7-customer-contact-ack.html`
- `index.html` (interactive gallery)

### How to View in Browser

Open `temp/email-previews/index.html` directly in your browser:

```
file:///d:/KreativeMandu/oldLiquor/backend/temp/email-previews/index.html
```

Click **Open Preview** on any email card to visually inspect the rendered layout, status badges, typography, itemized calculations, and contact footers.
