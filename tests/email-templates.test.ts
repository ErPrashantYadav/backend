import { describe, expect, it } from 'vitest';
import {
  extractStoreInfo,
  renderAdminContactInquiryEmail,
  renderAdminNewOrderEmail,
  renderCustomerContactAckEmail,
  renderCustomerOrderConfirmedEmail,
  renderCustomerOrderStatusEmail,
  renderEmailBaseLayout,
} from '../src/modules/notifications/templates';

describe('Email Templates Module', () => {
  const storeInfo = {
    storeName: 'Old Liquor Test Store',
    storeTagline: 'Fine Spirits & Wines',
    primaryPhone: '+977-1-4499999',
    supportEmail: 'care@oldliquor.test',
    address: 'Lazimpat Road',
    city: 'Kathmandu',
  };

  describe('renderEmailBaseLayout', () => {
    it('renders responsive HTML wrapper with store information, meta tags, and escaped title', () => {
      const html = renderEmailBaseLayout({
        title: 'Welcome & Cheers <Test>',
        contentHtml: '<p>Body content</p>',
        storeInfo,
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Welcome &amp; Cheers &lt;Test&gt;');
      expect(html).toContain('Old Liquor Test Store');
      expect(html).toContain('Fine Spirits &amp; Wines');
      expect(html).toContain('+977-1-4499999');
      expect(html).toContain('care@oldliquor.test');
      expect(html).toContain('<p>Body content</p>');
    });

    it('falls back to default store info when omitted', () => {
      const defaultStore = extractStoreInfo();
      expect(defaultStore.storeName).toBe('Old Liquor');
      expect(defaultStore.primaryPhone).toBe('+977-1-4412345');
    });
  });

  describe('renderAdminNewOrderEmail', () => {
    it('renders admin new order notification with plain text, HTML, and safely escaped dynamic data', () => {
      const result = renderAdminNewOrderEmail(
        {
          orderNumber: 'ORD-2026-999',
          customerName: 'Bikash & Sons <VIP>',
          customerPhone: '+977-9800000000',
          customerEmail: 'bikash@example.com',
          deliveryAddress: 'Baluwatar <Sector 4>',
          subtotal: '5000.00',
          deliveryFee: '150.00',
          discountTotal: '200.00',
          promoCode: 'FESTIVE2026',
          promoDiscount: '200.00',
          total: '4950.00',
          paymentMethod: 'Cash on Delivery',
          paymentStatus: 'PENDING',
          itemCount: 2,
          items: [
            {
              productName: 'Yarchagumba Whiskey <Special>',
              sku: 'YW-750',
              sizeLabel: '750ml',
              quantity: 2,
              unitPrice: '2500.00',
              subtotal: '5000.00',
            },
          ],
        },
        storeInfo,
      );

      expect(result.subject).toBe('New Order Received - ORD-2026-999');
      expect(result.text).toContain('ORD-2026-999');
      expect(result.text).toContain('Bikash & Sons <VIP>');
      expect(result.text).toContain('NPR 4950.00');

      // Verify HTML escaping
      expect(result.html).toContain('&lt;VIP&gt;');
      expect(result.html).toContain('&lt;Sector 4&gt;');
      expect(result.html).toContain('&lt;Special&gt;');
      expect(result.html).not.toContain('<VIP>');
      expect(result.html).toContain('FESTIVE2026');
    });
  });

  describe('renderCustomerOrderConfirmedEmail', () => {
    it('renders customer confirmation with order summary and tax invoice callout', () => {
      const result = renderCustomerOrderConfirmedEmail(
        {
          orderNumber: 'ORD-CONFIRM-123',
          customerName: 'Sita Sharma',
          deliveryAddress: 'Patan Durbar Area',
          paymentMethod: 'eSewa / Fonepay QR',
          subtotal: '3200.00',
          deliveryFee: '100.00',
          discountTotal: '0.00',
          total: '3300.00',
          items: [
            {
              productName: 'Khukri XXX Rum',
              sizeLabel: '1000ml',
              quantity: 2,
              unitPrice: '1600.00',
              subtotal: '3200.00',
            },
          ],
        },
        storeInfo,
      );

      expect(result.subject).toBe('Order Confirmation - ORD-CONFIRM-123');
      expect(result.text).toContain('ORD-CONFIRM-123');
      expect(result.text).toContain('Khukri XXX Rum');
      expect(result.text).toContain('tax invoice is attached as a PDF');

      expect(result.html).toContain('Thank you for your order!');
      expect(result.html).toContain('invoice-ORD-CONFIRM-123.pdf');
      expect(result.html).toContain('Official Tax Invoice Attached');
      expect(result.html).toContain('NPR 3300.00');
    });
  });

  describe('renderCustomerOrderStatusEmail', () => {
    it('renders OUT_FOR_DELIVERY with appropriate amber badge, headline, and message', () => {
      const result = renderCustomerOrderStatusEmail(
        {
          orderNumber: 'ORD-STATUS-001',
          customerName: 'Ramesh Thapa',
          toStatus: 'OUT_FOR_DELIVERY',
          total: '2400.00',
          deliveryAddress: 'Jhamsikhel, Lalitpur',
        },
        storeInfo,
      );

      expect(result.subject).toBe(
        'Order ORD-STATUS-001 Update: OUT FOR DELIVERY',
      );
      expect(result.text).toContain(
        'Our delivery team has picked up your order',
      );
      expect(result.text).toContain('Jhamsikhel, Lalitpur');

      expect(result.html).toContain('Your order is on the way!');
      expect(result.html).toContain('Out for Delivery');
      expect(result.html).toContain('NPR 2400.00');
    });

    it('renders DELIVERED with green celebration badge and message', () => {
      const result = renderCustomerOrderStatusEmail(
        {
          orderNumber: 'ORD-STATUS-002',
          customerName: 'Ramesh Thapa',
          toStatus: 'DELIVERED',
          total: '2400.00',
          deliveryAddress: 'Jhamsikhel, Lalitpur',
        },
        storeInfo,
      );

      expect(result.subject).toBe('Order ORD-STATUS-002 Update: DELIVERED');
      expect(result.text).toContain('Your order has been delivered.');
      expect(result.html).toContain('Your order has been delivered!');
      expect(result.html).toContain('Delivered');
    });

    it('renders CANCELLED with red alert badge and support instructions', () => {
      const result = renderCustomerOrderStatusEmail(
        {
          orderNumber: 'ORD-STATUS-003',
          customerName: 'Ramesh Thapa',
          toStatus: 'CANCELLED',
          total: '2400.00',
          deliveryAddress: 'Jhamsikhel, Lalitpur',
        },
        storeInfo,
      );

      expect(result.subject).toBe('Order ORD-STATUS-003 Update: CANCELLED');
      expect(result.text).toContain('Your order has been cancelled.');
      expect(result.html).toContain('Order Cancelled');
      expect(result.html).toContain('Cancelled');
      expect(result.html).toContain('+977-1-4499999');
    });
  });

  describe('renderAdminContactInquiryEmail', () => {
    it('renders admin inquiry alert with sender details, inquiry ID, and message preservation', () => {
      const result = renderAdminContactInquiryEmail(
        {
          inquiryId: 'INQ-987',
          fullName: 'Anjali Shah <Customer>',
          email: 'anjali@example.com',
          phone: '+977-9851122334',
          subject: 'Special vintage wine availability',
          message: 'Do you stock 2015 Bordeaux vintages?\n\nPlease reply soon.',
        },
        storeInfo,
      );

      expect(result.subject).toBe(
        'New Contact Inquiry: Special vintage wine availability',
      );
      expect(result.text).toContain('INQ-987');
      expect(result.text).toContain('Anjali Shah <Customer>');
      expect(result.text).toContain('Do you stock 2015 Bordeaux vintages?');

      expect(result.html).toContain('Anjali Shah &lt;Customer&gt;');
      expect(result.html).toContain('anjali@example.com');
      expect(result.html).toContain('+977-9851122334');
      expect(result.html).toContain('INQ-987');
    });
  });

  describe('renderCustomerContactAckEmail', () => {
    it('renders customer inquiry acknowledgement with reassuring copy and echo of message', () => {
      const result = renderCustomerContactAckEmail(
        {
          inquiryId: 'INQ-987',
          fullName: 'Anjali Shah',
          subject: 'Special vintage wine availability',
          message: 'Do you stock 2015 Bordeaux vintages?',
        },
        storeInfo,
      );

      expect(result.subject).toBe(
        'Thank you for contacting Old Liquor Test Store - Inquiry Received',
      );
      expect(result.text).toContain('We have received your inquiry');
      expect(result.text).toContain('Special vintage wine availability');

      expect(result.html).toContain('We&#039;ve Received Your Inquiry');
      expect(result.html).toContain('Summary of Your Inquiry');
      expect(result.html).toContain('Do you stock 2015 Bordeaux vintages?');
    });
  });
});
