import { escapeHtml } from '../../../utils/html-escape';
import type { StoreSettingsRecord } from '../../store-settings/store-settings.types';

export interface EmailStoreInfo {
  storeName?: string;
  storeTagline?: string | null;
  primaryPhone?: string;
  supportEmail?: string;
  address?: string;
  city?: string;
}

export function extractStoreInfo(
  settings?: StoreSettingsRecord | null,
): EmailStoreInfo {
  return {
    storeName: settings?.storeName || 'Old Liquor',
    storeTagline: settings?.storeTagline || 'Premium Spirits & Wine',
    primaryPhone: settings?.primaryPhone || '+977-1-4412345',
    supportEmail: settings?.supportEmail || 'support@oldliquor.com',
    address: settings?.address || 'Thamel Marg',
    city: settings?.city || 'Kathmandu, Nepal',
  };
}

export interface BaseLayoutOptions {
  preheader?: string;
  title: string;
  headerBadge?: {
    text: string;
    bgColor: string;
    textColor: string;
  };
  accentColor?: string;
  contentHtml: string;
  storeInfo?: EmailStoreInfo;
  footerNotesHtml?: string;
}

/**
 * Standard responsive email layout providing brand consistency, responsive meta tags,
 * modern typography, container card formatting, and customizable header/footer.
 */
export function renderEmailBaseLayout(options: BaseLayoutOptions): string {
  const store = options.storeInfo || extractStoreInfo();
  const accent = options.accentColor || '#991b1b'; // Deep burgundy/crimson for Old Liquor
  const preheaderText = options.preheader ? escapeHtml(options.preheader) : '';

  const badgeHtml = options.headerBadge
    ? `<span style="display: inline-block; background-color: ${options.headerBadge.bgColor}; color: ${options.headerBadge.textColor}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 12px;">${escapeHtml(options.headerBadge.text)}</span>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(options.title)}</title>
  <style>
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1f2937;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .stack-column {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
      .mobile-padding {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  ${
    preheaderText
      ? `<div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">${preheaderText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
      : ''
  }
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; padding: 24px 0 36px 0;">
    <tr>
      <td align="center" class="mobile-padding" style="padding: 0 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); border: 1px solid #e5e7eb;">
          
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #111827; padding: 20px 24px; text-align: center; border-bottom: 3px solid ${accent};">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;">
                ${escapeHtml(store.storeName || 'Old Liquor')}
              </h1>
              ${
                store.storeTagline
                  ? `<p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 12px; font-style: italic;">${escapeHtml(store.storeTagline)}</p>`
                  : ''
              }
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 28px 24px;">
              ${badgeHtml ? `<div>${badgeHtml}</div>` : ''}
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: 700; line-height: 1.3;">
                ${escapeHtml(options.title)}
              </h2>
              ${options.contentHtml}
            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; line-height: 1.5; text-align: center;">
              ${options.footerNotesHtml ? `<div style="margin-bottom: 12px; color: #4b5563;">${options.footerNotesHtml}</div>` : ''}
              <p style="margin: 4px 0; font-weight: 600; color: #374151;">
                ${escapeHtml(store.storeName || 'Old Liquor')}
              </p>
              <p style="margin: 2px 0;">
                ${escapeHtml(store.address || '')}${store.city ? `, ${escapeHtml(store.city)}` : ''}
              </p>
              <p style="margin: 2px 0;">
                Phone: <a href="tel:${escapeHtml(store.primaryPhone || '')}" style="color: #4b5563; text-decoration: none;">${escapeHtml(store.primaryPhone || '')}</a>
                &bull; Support: <a href="mailto:${escapeHtml(store.supportEmail || '')}" style="color: ${accent}; text-decoration: none;">${escapeHtml(store.supportEmail || '')}</a>
              </p>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: #9ca3af;">
                &copy; ${new Date().getFullYear()} ${escapeHtml(store.storeName || 'Old Liquor')}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
