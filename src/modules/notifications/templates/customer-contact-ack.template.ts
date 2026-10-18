import { escapeHtml } from '../../../utils/html-escape';
import {
  type EmailStoreInfo,
  extractStoreInfo,
  renderEmailBaseLayout,
} from './email-base.layout';

export interface CustomerContactAckEmailData {
  inquiryId?: string;
  fullName: string;
  subject: string;
  message: string;
  createdAt?: string | Date;
}

export function renderCustomerContactAckEmail(
  data: CustomerContactAckEmailData,
  storeInfo?: EmailStoreInfo,
): { subject: string; text: string; html: string } {
  const store = storeInfo || extractStoreInfo();
  const subject = `Thank you for contacting ${store.storeName || 'Old Liquor'} - Inquiry Received`;

  const text = [
    `Dear ${data.fullName},`,
    ``,
    `Thank you for contacting ${store.storeName || 'Old Liquor'}. We have received your inquiry regarding "${data.subject}".`,
    ``,
    `Our team is reviewing your message and will respond as soon as possible.`,
    ``,
    `Your Submitted Message:`,
    data.message,
    ``,
    `Need immediate assistance?`,
    `Call our hotline: ${store.primaryPhone || '+977-1-4412345'}`,
    ``,
    `Warm regards,`,
    `The ${store.storeName || 'Old Liquor'} Team`,
  ].join('\n');

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.5;">
      Dear <strong>${escapeHtml(data.fullName)}</strong>,
    </p>
    <p style="margin: 0 0 20px 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
      Thank you for getting in touch with us! We have received your message regarding <strong>${escapeHtml(data.subject)}</strong>. Our customer support team is reviewing your request and will follow up shortly.
    </p>

    <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #3b82f6; border-top: 1px solid #f3f4f6; border-right: 1px solid #f3f4f6; border-bottom: 1px solid #f3f4f6;">
      <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.04em;">
        Summary of Your Inquiry:
      </h4>
      <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(data.message)}</p>
    </div>

    <div style="background-color: #f3f4f6; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #4b5563; line-height: 1.5;">
      If your inquiry is urgent or time-sensitive, please contact our store directly at
      <a href="tel:${escapeHtml(store.primaryPhone || '')}" style="color: #991b1b; text-decoration: none; font-weight: 600;">${escapeHtml(store.primaryPhone || '')}</a>.
    </div>
  `;

  const html = renderEmailBaseLayout({
    title: "We've Received Your Inquiry",
    headerBadge: {
      text: 'Inquiry Received',
      bgColor: '#dbeafe',
      textColor: '#1e40af',
    },
    accentColor: '#2563eb',
    contentHtml,
    storeInfo: store,
  });

  return { subject, text, html };
}
