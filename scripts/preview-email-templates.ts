import fs from 'node:fs';
import path from 'node:path';
import {
  extractStoreInfo,
  renderAdminContactInquiryEmail,
  renderAdminNewOrderEmail,
  renderCustomerContactAckEmail,
  renderCustomerOrderConfirmedEmail,
  renderCustomerOrderStatusEmail,
} from '../src/modules/notifications/templates';

const outputDir = path.resolve(process.cwd(), 'temp', 'email-previews');
fs.mkdirSync(outputDir, { recursive: true });

const sampleStoreInfo = extractStoreInfo({
  id: 'store-1',
  storeName: 'Old Liquor Store',
  storeTagline: 'Fine Spirits, Wines & Rare Malts',
  primaryPhone: '+977-1-4412345',
  secondaryPhone: '+977-9801234567',
  supportEmail: 'orders@notify.prashantyadav.com.np',
  address: 'Thamel Marg, Ward 26',
  city: 'Kathmandu, Nepal',
  locationUrl: null,
  socialLinks: null,
  businessHours: [],
  announcementText: null,
  announcementActive: false,
  announcementStartDate: null,
  announcementEndDate: null,
  timezone: 'Asia/Kathmandu',
  storeOriginLatitude: 27.7172,
  storeOriginLongitude: 85.324,
  deliveryFeeMode: 'PER_KM',
  deliveryFeeBaseAmount: '100.00',
  deliveryFeePerKmAmount: '25.00',
  deliveryFeeFreeThreshold: '5000.00',
  deliveryMaxDistanceKm: '25.00',
  deliveryFallbackAmount: '0.00',
  updatedAt: new Date(),
});

const sampleItems = [
  {
    productName: 'Old Durbar 12YO Reserve Whisky <Special & Rare>',
    sku: 'OD-12Y-750',
    sizeLabel: '750ml',
    quantity: 2,
    unitPrice: '2800.00',
    subtotal: '5600.00',
  },
  {
    productName: 'Khukri XXX Coronation Rum',
    sku: 'KH-CR-1000',
    sizeLabel: '1000ml',
    quantity: 1,
    unitPrice: '1600.00',
    subtotal: '1600.00',
  },
];

const templates = [
  {
    filename: '1-admin-new-order.html',
    title: 'Admin New Order Alert',
    rendered: renderAdminNewOrderEmail(
      {
        orderNumber: 'ORD-20261018-8821',
        customerName: 'Aarav Shrestha & Family <VIP Guest>',
        customerPhone: '+977-9841234567',
        customerEmail: 'aarav.shrestha@example.com',
        deliveryAddress: 'Baluwatar, Kathmandu (Opposite Embassy Gate)',
        subtotal: '7200.00',
        deliveryFee: '125.00',
        discountTotal: '500.00',
        promoCode: 'DASHAIN2026',
        promoDiscount: '500.00',
        total: '6825.00',
        paymentMethod: 'Fonepay QR / Digital Wallet',
        paymentStatus: 'PAID',
        itemCount: 3,
        items: sampleItems,
      },
      sampleStoreInfo,
    ),
  },
  {
    filename: '2-customer-order-confirmed.html',
    title: 'Customer Order Confirmed (With Invoice Attachment)',
    rendered: renderCustomerOrderConfirmedEmail(
      {
        orderNumber: 'ORD-20261018-8821',
        customerName: 'Aarav Shrestha',
        deliveryAddress: 'Baluwatar, Kathmandu (Opposite Embassy Gate)',
        paymentMethod: 'Fonepay QR / Digital Wallet',
        subtotal: '7200.00',
        deliveryFee: '125.00',
        discountTotal: '500.00',
        promoCode: 'DASHAIN2026',
        promoDiscount: '500.00',
        total: '6825.00',
        items: sampleItems,
      },
      sampleStoreInfo,
    ),
  },
  {
    filename: '3-customer-status-out-for-delivery.html',
    title: 'Customer Status: OUT FOR DELIVERY',
    rendered: renderCustomerOrderStatusEmail(
      {
        orderNumber: 'ORD-20261018-8821',
        customerName: 'Aarav Shrestha',
        fromStatus: 'CONFIRMED',
        toStatus: 'OUT_FOR_DELIVERY',
        total: '6825.00',
        deliveryAddress: 'Baluwatar, Kathmandu (Opposite Embassy Gate)',
      },
      sampleStoreInfo,
    ),
  },
  {
    filename: '4-customer-status-delivered.html',
    title: 'Customer Status: DELIVERED',
    rendered: renderCustomerOrderStatusEmail(
      {
        orderNumber: 'ORD-20261018-8821',
        customerName: 'Aarav Shrestha',
        fromStatus: 'OUT_FOR_DELIVERY',
        toStatus: 'DELIVERED',
        total: '6825.00',
        deliveryAddress: 'Baluwatar, Kathmandu (Opposite Embassy Gate)',
      },
      sampleStoreInfo,
    ),
  },
  {
    filename: '5-customer-status-cancelled.html',
    title: 'Customer Status: CANCELLED',
    rendered: renderCustomerOrderStatusEmail(
      {
        orderNumber: 'ORD-20261018-8821',
        customerName: 'Aarav Shrestha',
        fromStatus: 'PENDING',
        toStatus: 'CANCELLED',
        total: '6825.00',
        deliveryAddress: 'Baluwatar, Kathmandu (Opposite Embassy Gate)',
      },
      sampleStoreInfo,
    ),
  },
  {
    filename: '6-admin-contact-inquiry.html',
    title: 'Admin Contact Inquiry Alert',
    rendered: renderAdminContactInquiryEmail(
      {
        inquiryId: 'INQ-2026-0412',
        fullName: 'Sunita Pradhan <Wedding Planner>',
        email: 'sunita.events@example.com',
        phone: '+977-9801122334',
        subject: 'Bulk wine pricing for 200 guests banquet',
        message:
          'Hello Old Liquor team,\n\nWe are organizing a reception next Saturday and would like to order 4 cases of red wine and 2 cases of single malt.\nDo you offer delivery to Godavari?\n\nThank you,\nSunita',
      },
      sampleStoreInfo,
    ),
  },
  {
    filename: '7-customer-contact-ack.html',
    title: 'Customer Contact Inquiry Acknowledgement',
    rendered: renderCustomerContactAckEmail(
      {
        inquiryId: 'INQ-2026-0412',
        fullName: 'Sunita Pradhan',
        subject: 'Bulk wine pricing for 200 guests banquet',
        message:
          'Hello Old Liquor team,\n\nWe are organizing a reception next Saturday and would like to order 4 cases of red wine and 2 cases of single malt.\nDo you offer delivery to Godavari?\n\nThank you,\nSunita',
      },
      sampleStoreInfo,
    ),
  },
];

console.log('--- Generating Safe Local Email Previews ---');
console.log(`Target directory: ${outputDir}`);

// Build an index gallery file linking to each preview
const indexCardsHtml: string[] = [];

for (const t of templates) {
  const filePath = path.join(outputDir, t.filename);
  fs.writeFileSync(filePath, t.rendered.html, 'utf8');
  console.log(`[Generated] ${t.filename} (Subject: ${t.rendered.subject})`);

  indexCardsHtml.push(`
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #111827;">${t.title}</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">Subject: <strong>${t.rendered.subject}</strong></p>
      </div>
      <div>
        <a href="./${t.filename}" target="_blank" style="display: inline-block; background-color: #991b1b; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">
          Open Preview &rarr;
        </a>
      </div>
    </div>
  `);
}

const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Old Liquor - Email Template Previews</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f3f4f6; padding: 32px 16px; color: #1f2937; margin: 0; }
    .container { max-width: 800px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="container">
    <div style="background: #111827; color: white; border-radius: 8px; padding: 24px; margin-bottom: 24px; border-bottom: 4px solid #991b1b;">
      <h1 style="margin: 0 0 8px 0; font-size: 22px;">Old Liquor &bull; Email Template Gallery</h1>
      <p style="margin: 0; color: #9ca3af; font-size: 14px;">Preview all transactional email designs locally with realistic mock data. Zero network or database operations.</p>
    </div>
    ${indexCardsHtml.join('')}
  </div>
</body>
</html>`;

const indexPath = path.join(outputDir, 'index.html');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

console.log('\nPreview generation complete!');
console.log(`Open in browser: file://${indexPath.replace(/\\/g, '/')}`);
