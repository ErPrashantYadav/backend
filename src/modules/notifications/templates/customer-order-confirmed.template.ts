import { escapeHtml } from '../../../utils/html-escape';
import {
  type EmailStoreInfo,
  extractStoreInfo,
  renderEmailBaseLayout,
} from './email-base.layout';

export interface CustomerOrderConfirmedEmailData {
  orderNumber: string;
  customerName: string;
  deliveryAddress: string;
  paymentMethod: string;
  subtotal: string;
  deliveryFee: string;
  discountTotal: string;
  promoCode?: string | null;
  promoDiscount?: string | null;
  total: string;
  items: Array<{
    productName: string;
    sku?: string;
    sizeLabel: string;
    quantity: number;
    unitPrice: string;
    subtotal?: string;
  }>;
}

export function renderCustomerOrderConfirmedEmail(
  data: CustomerOrderConfirmedEmailData,
  storeInfo?: EmailStoreInfo,
): { subject: string; text: string; html: string } {
  const store = storeInfo || extractStoreInfo();
  const subject = `Order Confirmation - ${data.orderNumber}`;

  const itemsText = (data.items || [])
    .map(
      (i) =>
        `- ${i.productName} (${i.sizeLabel}) x${i.quantity} = NPR ${
          i.subtotal ?? (Number(i.unitPrice) * Number(i.quantity)).toFixed(2)
        }`,
    )
    .join('\n');

  const text = [
    `Dear ${data.customerName},`,
    ``,
    `Thank you for ordering with ${store.storeName || 'Old Liquor'}! Your order ${data.orderNumber} has been received and confirmed.`,
    ``,
    `Delivery Address: ${data.deliveryAddress}`,
    `Payment Method: ${data.paymentMethod}`,
    ``,
    `Items Ordered:`,
    itemsText || 'Order items confirmed',
    ``,
    `Total: NPR ${data.total}`,
    ``,
    `Your official tax invoice is attached as a PDF to this email.`,
    ``,
    `Warm regards,`,
    `The ${store.storeName || 'Old Liquor'} Team`,
  ].join('\n');

  const itemsHtml = (data.items || [])
    .map(
      (i) =>
        `<tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">
            <div style="font-weight: 600; color: #111827;">${escapeHtml(String(i.productName))}</div>
            <div style="font-size: 12px; color: #6b7280;">Size: ${escapeHtml(String(i.sizeLabel))}</div>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 13px; color: #374151;">
            ${escapeHtml(String(i.quantity))}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 13px; font-weight: 600; color: #111827;">
            NPR ${escapeHtml(String(i.subtotal ?? (Number(i.unitPrice) * Number(i.quantity)).toFixed(2)))}
          </td>
        </tr>`,
    )
    .join('');

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.5;">
      Dear <strong>${escapeHtml(data.customerName)}</strong>,
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
      We are delighted to confirm that your order <strong>${escapeHtml(data.orderNumber)}</strong> has been verified and is now being carefully prepared for dispatch.
    </p>

    <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #f3f4f6;">
      <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.04em;">
        Delivery & Payment Information
      </h3>
      <table style="width: 100%; font-size: 13px; line-height: 1.6;">
        <tr>
          <td style="color: #6b7280; width: 130px;">Delivery Address:</td>
          <td style="color: #111827; font-weight: 500;">${escapeHtml(data.deliveryAddress)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Payment Method:</td>
          <td style="color: #111827; font-weight: 500;">${escapeHtml(data.paymentMethod)}</td>
        </tr>
      </table>
    </div>

    <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.04em;">
      Order Items
    </h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <thead>
        <tr style="background-color: #f3f4f6; text-align: left; font-size: 12px; color: #4b5563;">
          <th style="padding: 8px;">Item</th>
          <th style="padding: 8px; text-align: center;">Qty</th>
          <th style="padding: 8px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #6b7280;">Order items confirmed</td></tr>'}
      </tbody>
    </table>

    <div style="background-color: #f9fafb; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #f3f4f6;">
      <table style="width: 100%; font-size: 13px; line-height: 1.6;">
        <tr>
          <td style="color: #6b7280;">Subtotal:</td>
          <td style="text-align: right; color: #374151;">NPR ${escapeHtml(data.subtotal)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Delivery Fee:</td>
          <td style="text-align: right; color: #374151;">NPR ${escapeHtml(data.deliveryFee)}</td>
        </tr>
        ${
          data.discountTotal && data.discountTotal !== '0.00'
            ? `<tr>
                <td style="color: #6b7280;">Discounts:</td>
                <td style="text-align: right; color: #374151;">-NPR ${escapeHtml(data.discountTotal)}</td>
              </tr>`
            : ''
        }
        <tr style="border-top: 1px solid #e5e7eb;">
          <td style="padding-top: 8px; font-size: 15px; font-weight: 700; color: #111827;">Total Amount:</td>
          <td style="padding-top: 8px; font-size: 15px; font-weight: 700; text-align: right; color: #991b1b;">NPR ${escapeHtml(data.total)}</td>
        </tr>
      </table>
    </div>

    <!-- PDF Invoice Notification Callout -->
    <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 14px 16px; border-radius: 4px; margin-bottom: 20px;">
      <p style="margin: 0; color: #065f46; font-size: 13px; line-height: 1.5;">
        📄 <strong>Official Tax Invoice Attached:</strong> Your tax invoice is attached to this email as a PDF document (<code>invoice-${escapeHtml(data.orderNumber)}.pdf</code>).
      </p>
    </div>

    <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;">
      If you have questions about your delivery or need to update your order details, please reply directly to this email or call our hotline at <strong>${escapeHtml(store.primaryPhone || '')}</strong>.
    </p>
  `;

  const html = renderEmailBaseLayout({
    title: 'Thank you for your order!',
    headerBadge: {
      text: 'Order Confirmed',
      bgColor: '#d1fae5',
      textColor: '#065f46',
    },
    accentColor: '#991b1b',
    contentHtml,
    storeInfo: store,
  });

  return { subject, text, html };
}
