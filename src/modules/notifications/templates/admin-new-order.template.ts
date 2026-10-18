import { escapeHtml } from '../../../utils/html-escape';
import {
  type EmailStoreInfo,
  extractStoreInfo,
  renderEmailBaseLayout,
} from './email-base.layout';

export interface AdminNewOrderEmailData {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  deliveryAddress: string;
  subtotal: string;
  deliveryFee: string;
  discountTotal: string;
  promoCode?: string | null;
  promoDiscount?: string | null;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
  itemCount: number;
  items: Array<{
    productName: string;
    sku?: string;
    sizeLabel: string;
    quantity: number;
    unitPrice: string;
    unitDiscount?: string;
    effectiveUnitPrice?: string;
    subtotal?: string;
  }>;
  createdAt?: string | Date;
}

export function renderAdminNewOrderEmail(
  data: AdminNewOrderEmailData,
  storeInfo?: EmailStoreInfo,
): { subject: string; text: string; html: string } {
  const store = storeInfo || extractStoreInfo();
  const subject = `New Order Received - ${data.orderNumber}`;

  const itemsText = (data.items || [])
    .map(
      (i) =>
        `- ${i.productName} (${i.sizeLabel}) x${i.quantity} @ NPR ${i.unitPrice} = NPR ${
          i.subtotal ?? (Number(i.unitPrice) * Number(i.quantity)).toFixed(2)
        }`,
    )
    .join('\n');

  const text = [
    `🚨 New Order Received: ${data.orderNumber}`,
    ``,
    `Customer Details:`,
    `- Name: ${data.customerName}`,
    `- Phone: ${data.customerPhone}`,
    `- Email: ${data.customerEmail || 'N/A'}`,
    `- Delivery Address: ${data.deliveryAddress}`,
    ``,
    `Items Ordered:`,
    itemsText || 'No item details available',
    ``,
    `Financial Breakdown:`,
    `- Subtotal: NPR ${data.subtotal}`,
    `- Delivery Fee: NPR ${data.deliveryFee}`,
    `- Discount: NPR ${data.discountTotal}`,
    data.promoCode
      ? `- Promo (${data.promoCode}): -NPR ${data.promoDiscount ?? '0.00'}`
      : '',
    `- Total: NPR ${data.total}`,
    ``,
    `Payment Information:`,
    `- Method: ${data.paymentMethod}`,
    `- Status: ${data.paymentStatus}`,
    ``,
    `Manage this order in the ${store.storeName || 'Old Liquor'} Admin Portal.`,
  ]
    .filter(Boolean)
    .join('\n');

  const itemsHtml = (data.items || [])
    .map(
      (i) =>
        `<tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">
            <div style="font-weight: 600; color: #111827;">${escapeHtml(String(i.productName))}</div>
            <div style="font-size: 12px; color: #6b7280;">Size: ${escapeHtml(String(i.sizeLabel))}${i.sku ? ` &bull; SKU: ${escapeHtml(String(i.sku))}` : ''}</div>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 13px; color: #374151;">
            ${escapeHtml(String(i.quantity))}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px; color: #374151;">
            NPR ${escapeHtml(String(i.unitPrice))}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: 600; color: #111827;">
            NPR ${escapeHtml(String(i.subtotal ?? (Number(i.unitPrice) * Number(i.quantity)).toFixed(2)))}
          </td>
        </tr>`,
    )
    .join('');

  const contentHtml = `
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
      <p style="margin: 0; color: #991b1b; font-size: 13px; font-weight: 600;">
        ⚡ Action Required: A new order was committed and requires inventory/delivery processing.
      </p>
    </div>

    <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #f3f4f6;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.03em;">
        Customer Details
      </h3>
      <table style="width: 100%; font-size: 13px; line-height: 1.5;">
        <tr>
          <td style="padding: 2px 0; color: #6b7280; width: 110px;">Name:</td>
          <td style="padding: 2px 0; color: #111827; font-weight: 600;">${escapeHtml(data.customerName)}</td>
        </tr>
        <tr>
          <td style="padding: 2px 0; color: #6b7280;">Phone:</td>
          <td style="padding: 2px 0; color: #111827;"><a href="tel:${escapeHtml(data.customerPhone)}" style="color: #991b1b; text-decoration: none;">${escapeHtml(data.customerPhone)}</a></td>
        </tr>
        <tr>
          <td style="padding: 2px 0; color: #6b7280;">Email:</td>
          <td style="padding: 2px 0; color: #111827;">${escapeHtml(data.customerEmail || 'Not provided')}</td>
        </tr>
        <tr>
          <td style="padding: 2px 0; color: #6b7280;">Address:</td>
          <td style="padding: 2px 0; color: #111827;">${escapeHtml(data.deliveryAddress)}</td>
        </tr>
      </table>
    </div>

    <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.03em;">
      Ordered Items (${data.itemCount})
    </h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #f3f4f6; text-align: left; font-size: 12px; color: #4b5563;">
          <th style="padding: 8px;">Product</th>
          <th style="padding: 8px; text-align: center;">Qty</th>
          <th style="padding: 8px; text-align: right;">Unit Price</th>
          <th style="padding: 8px; text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #6b7280;">No item details available</td></tr>'}
      </tbody>
    </table>

    <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #f3f4f6;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.03em;">
        Financial & Payment Summary
      </h3>
      <table style="width: 100%; font-size: 13px; line-height: 1.6;">
        <tr>
          <td style="color: #6b7280;">Subtotal:</td>
          <td style="text-align: right; color: #374151;">NPR ${escapeHtml(data.subtotal)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Delivery Fee:</td>
          <td style="text-align: right; color: #374151;">NPR ${escapeHtml(data.deliveryFee)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Discounts:</td>
          <td style="text-align: right; color: #374151;">NPR ${escapeHtml(data.discountTotal)}</td>
        </tr>
        ${
          data.promoCode
            ? `<tr>
                <td style="color: #059669;">Promo (${escapeHtml(data.promoCode)}):</td>
                <td style="text-align: right; color: #059669;">-NPR ${escapeHtml(data.promoDiscount ?? '0.00')}</td>
              </tr>`
            : ''
        }
        <tr style="border-top: 1px solid #e5e7eb;">
          <td style="padding-top: 8px; font-size: 15px; font-weight: 700; color: #111827;">Total Amount:</td>
          <td style="padding-top: 8px; font-size: 15px; font-weight: 700; text-align: right; color: #991b1b;">NPR ${escapeHtml(data.total)}</td>
        </tr>
      </table>
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e5e7eb; font-size: 13px;">
        <span style="color: #6b7280;">Payment Method:</span> <strong>${escapeHtml(data.paymentMethod)}</strong>
        &bull;
        <span style="color: #6b7280;">Status:</span> <strong>${escapeHtml(data.paymentStatus)}</strong>
      </div>
    </div>
  `;

  const html = renderEmailBaseLayout({
    title: `🚨 New Order Received: ${data.orderNumber}`,
    headerBadge: {
      text: 'Admin Alert',
      bgColor: '#fee2e2',
      textColor: '#991b1b',
    },
    accentColor: '#991b1b',
    contentHtml,
    storeInfo: store,
    footerNotesHtml: `This is an automated administrative notification dispatched from the ${escapeHtml(store.storeName || 'Old Liquor')} backend.`,
  });

  return { subject, text, html };
}
