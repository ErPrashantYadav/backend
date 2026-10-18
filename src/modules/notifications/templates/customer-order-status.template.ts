import { escapeHtml } from '../../../utils/html-escape';
import {
  type EmailStoreInfo,
  extractStoreInfo,
  renderEmailBaseLayout,
} from './email-base.layout';

export interface CustomerOrderStatusEmailData {
  orderNumber: string;
  customerName: string;
  fromStatus?: string;
  toStatus: string;
  total: string;
  deliveryAddress: string;
}

interface StatusTheme {
  badgeText: string;
  badgeBg: string;
  badgeTextCol: string;
  accentCol: string;
  heading: string;
  description: string;
}

function resolveStatusTheme(status: string): StatusTheme {
  const norm = status.toUpperCase();

  if (norm === 'OUT_FOR_DELIVERY') {
    return {
      badgeText: 'Out for Delivery',
      badgeBg: '#fef3c7',
      badgeTextCol: '#92400e',
      accentCol: '#d97706',
      heading: 'Your order is on the way!',
      description:
        'Our delivery team has picked up your order and is heading towards your delivery address.',
    };
  }

  if (norm === 'DELIVERED') {
    return {
      badgeText: 'Delivered',
      badgeBg: '#d1fae5',
      badgeTextCol: '#065f46',
      accentCol: '#059669',
      heading: 'Your order has been delivered!',
      description:
        'Your order has been delivered. We hope you enjoy your selection! Thank you for choosing us.',
    };
  }

  if (norm === 'CANCELLED') {
    return {
      badgeText: 'Cancelled',
      badgeBg: '#fee2e2',
      badgeTextCol: '#991b1b',
      accentCol: '#dc2626',
      heading: 'Order Cancelled',
      description:
        'Your order has been cancelled. If you believe this was in error or have any questions, please reach out to our support team.',
    };
  }

  const label = status.replace(/_/g, ' ');
  return {
    badgeText: label,
    badgeBg: '#e0e7ff',
    badgeTextCol: '#3730a3',
    accentCol: '#4f46e5',
    heading: `Order Status: ${label}`,
    description: `Your order status has been updated to ${label}.`,
  };
}

export function renderCustomerOrderStatusEmail(
  data: CustomerOrderStatusEmailData,
  storeInfo?: EmailStoreInfo,
): { subject: string; text: string; html: string } {
  const store = storeInfo || extractStoreInfo();
  const theme = resolveStatusTheme(data.toStatus);
  const formattedStatus = data.toStatus.replace(/_/g, ' ');
  const subject = `Order ${data.orderNumber} Update: ${formattedStatus}`;

  const text = [
    `Dear ${data.customerName},`,
    ``,
    `Your order ${data.orderNumber} has been updated to: ${formattedStatus}.`,
    ``,
    `${theme.description}`,
    ``,
    `Order Details:`,
    `- Order Number: ${data.orderNumber}`,
    `- Order Total: NPR ${data.total}`,
    `- Delivery Address: ${data.deliveryAddress || 'N/A'}`,
    ``,
    `Need help with your order?`,
    `Call us: ${store.primaryPhone || '+977-1-4412345'}`,
    `Email: ${store.supportEmail || 'support@oldliquor.com'}`,
    ``,
    `Thank you for shopping with ${store.storeName || 'Old Liquor'}!`,
  ].join('\n');

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.5;">
      Dear <strong>${escapeHtml(data.customerName)}</strong>,
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
      ${escapeHtml(theme.description)}
    </p>

    <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #f3f4f6;">
      <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.04em;">
        Order Information
      </h3>
      <table style="width: 100%; font-size: 13px; line-height: 1.6;">
        <tr>
          <td style="color: #6b7280; width: 120px;">Order Number:</td>
          <td style="color: #111827; font-weight: 600;">${escapeHtml(data.orderNumber)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Current Status:</td>
          <td style="color: ${theme.accentCol}; font-weight: 700;">${escapeHtml(formattedStatus)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Order Total:</td>
          <td style="color: #111827; font-weight: 600;">NPR ${escapeHtml(data.total)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Delivery Address:</td>
          <td style="color: #374151;">${escapeHtml(data.deliveryAddress || 'N/A')}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #f3f4f6; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #4b5563; line-height: 1.5;">
      Have a question about your delivery? Contact our customer support at
      <a href="tel:${escapeHtml(store.primaryPhone || '')}" style="color: #991b1b; text-decoration: none; font-weight: 600;">${escapeHtml(store.primaryPhone || '')}</a>
      or reply directly to this email.
    </div>
  `;

  const html = renderEmailBaseLayout({
    title: theme.heading,
    headerBadge: {
      text: theme.badgeText,
      bgColor: theme.badgeBg,
      textColor: theme.badgeTextCol,
    },
    accentColor: theme.accentCol,
    contentHtml,
    storeInfo: store,
  });

  return { subject, text, html };
}
