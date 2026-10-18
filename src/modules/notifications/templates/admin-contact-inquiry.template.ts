import { escapeHtml } from '../../../utils/html-escape';
import {
  type EmailStoreInfo,
  extractStoreInfo,
  renderEmailBaseLayout,
} from './email-base.layout';

export interface AdminContactInquiryEmailData {
  inquiryId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  subject: string;
  message: string;
  createdAt?: string | Date;
}

export function renderAdminContactInquiryEmail(
  data: AdminContactInquiryEmailData,
  storeInfo?: EmailStoreInfo,
): { subject: string; text: string; html: string } {
  const store = storeInfo || extractStoreInfo();
  const subject = `New Contact Inquiry: ${data.subject}`;

  const text = [
    `📬 New Contact Inquiry Received`,
    ``,
    `From: ${data.fullName}`,
    `Email: ${data.email || 'Not provided'}`,
    `Phone: ${data.phone || 'Not provided'}`,
    `Subject: ${data.subject}`,
    `Inquiry ID: ${data.inquiryId}`,
    ``,
    `Message:`,
    data.message,
    ``,
    `Please respond to the customer promptly.`,
  ].join('\n');

  const contentHtml = `
    <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #f3f4f6;">
      <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.04em;">
        Sender Information
      </h3>
      <table style="width: 100%; font-size: 13px; line-height: 1.6;">
        <tr>
          <td style="color: #6b7280; width: 110px;">Name:</td>
          <td style="color: #111827; font-weight: 600;">${escapeHtml(data.fullName)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Email:</td>
          <td style="color: #111827;">
            ${
              data.email
                ? `<a href="mailto:${escapeHtml(data.email)}" style="color: #1e40af; text-decoration: none;">${escapeHtml(data.email)}</a>`
                : 'Not provided'
            }
          </td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Phone:</td>
          <td style="color: #111827;">
            ${
              data.phone
                ? `<a href="tel:${escapeHtml(data.phone)}" style="color: #1e40af; text-decoration: none;">${escapeHtml(data.phone)}</a>`
                : 'Not provided'
            }
          </td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Subject:</td>
          <td style="color: #111827; font-weight: 500;">${escapeHtml(data.subject)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280;">Inquiry ID:</td>
          <td style="color: #6b7280; font-family: monospace; font-size: 12px;">${escapeHtml(data.inquiryId)}</td>
        </tr>
      </table>
    </div>

    <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.04em;">
      Inquiry Message
    </h3>
    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; font-size: 13px; color: #1f2937; line-height: 1.6; white-space: pre-wrap; margin-bottom: 20px;">${escapeHtml(data.message)}</div>

    <p style="margin: 0; font-size: 12px; color: #6b7280;">
      Please reply directly to the customer's email or phone number as appropriate.
    </p>
  `;

  const html = renderEmailBaseLayout({
    title: '📬 New Contact Inquiry',
    headerBadge: {
      text: 'Inquiry Alert',
      bgColor: '#dbeafe',
      textColor: '#1e40af',
    },
    accentColor: '#1e40af',
    contentHtml,
    storeInfo: store,
    footerNotesHtml: `Administrative inquiry alert dispatched from ${escapeHtml(store.storeName || 'Old Liquor')}.`,
  });

  return { subject, text, html };
}
