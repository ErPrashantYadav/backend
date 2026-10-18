import PDFDocument from 'pdfkit';
import type { InvoiceOrderData, InvoiceStoreInfo } from './invoice.types';

export class InvoiceGeneratorService {
  /**
   * Generates a deterministic PDF invoice buffer in memory.
   * Uses historical persisted order snapshots exclusively.
   * Never recalculates from current catalog prices.
   * Does not write any files to the filesystem.
   */
  async generateInvoicePdf(
    order: InvoiceOrderData,
    storeInfo?: InvoiceStoreInfo,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          info: {
            Title: `Invoice - ${order.orderNumber}`,
            Author: storeInfo?.storeName || 'Old Liquor',
            Subject: `Invoice for Order ${order.orderNumber}`,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: Error) => reject(err));

        const storeName = storeInfo?.storeName || 'Old Liquor';
        const storeTagline =
          storeInfo?.storeTagline || 'Premium Spirits & Wine Delivery';
        const storePhone = storeInfo?.primaryPhone || '+977-9801234567';
        const storeEmail = storeInfo?.supportEmail || 'support@oldliquor.com';
        const storeAddress =
          [storeInfo?.address, storeInfo?.city].filter(Boolean).join(', ') ||
          'Kathmandu, Nepal';

        const orderDate = new Date(order.createdAt);
        const formattedDate = !isNaN(orderDate.getTime())
          ? orderDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : String(order.createdAt);

        // 1. Header Section
        doc
          .fillColor('#1A202C')
          .fontSize(20)
          .font('Helvetica-Bold')
          .text(storeName.toUpperCase(), 40, 40);

        doc
          .fillColor('#718096')
          .fontSize(9)
          .font('Helvetica')
          .text(storeTagline, 40, 65)
          .text(storeAddress, 40, 78)
          .text(`Phone: ${storePhone}  |  Email: ${storeEmail}`, 40, 91);

        // Right-aligned Invoice Title & Metadata
        doc
          .fillColor('#2B6CB0')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('TAX INVOICE', 350, 40, { align: 'right' });

        doc
          .fillColor('#2D3748')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(`Order #: ${order.orderNumber}`, 350, 65, { align: 'right' })
          .font('Helvetica')
          .text(`Date: ${formattedDate}`, 350, 78, { align: 'right' })
          .text(
            `Status: ${order.status.replace(/_/g, ' ')}  |  Payment: ${order.payment.status}`,
            350,
            91,
            { align: 'right' },
          );

        // Horizontal Rule
        doc.moveTo(40, 115).lineTo(555, 115).strokeColor('#E2E8F0').stroke();

        // 2. Customer & Delivery Information
        doc
          .fillColor('#2D3748')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('BILLED & DELIVERED TO:', 40, 128);

        doc
          .fillColor('#4A5568')
          .fontSize(9)
          .font('Helvetica')
          .text(`Name: ${order.customer.name}`, 40, 143)
          .text(`Phone: ${order.customer.phone}`, 40, 156);

        if (order.customer.email) {
          doc.text(`Email: ${order.customer.email}`, 40, 169);
          doc.text(`Address: ${order.customer.deliveryAddress}`, 40, 182);
        } else {
          doc.text(`Address: ${order.customer.deliveryAddress}`, 40, 169);
        }

        // Payment Info Block (Right Side)
        const paymentY = 128;
        doc
          .fillColor('#2D3748')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('PAYMENT DETAILS:', 350, paymentY, { align: 'right' });

        const paymentMethod =
          order.payment.methodName || order.payment.methodCode || 'COD';
        doc
          .fillColor('#4A5568')
          .fontSize(9)
          .font('Helvetica')
          .text(`Method: ${paymentMethod}`, 350, paymentY + 15, {
            align: 'right',
          })
          .text(`Status: ${order.payment.status}`, 350, paymentY + 28, {
            align: 'right',
          });

        if (order.payment.reference) {
          doc.text(
            `Reference: ${order.payment.reference}`,
            350,
            paymentY + 41,
            { align: 'right' },
          );
        }

        // 3. Items Table Header
        const tableTop = 210;
        doc.rect(40, tableTop, 515, 20).fillColor('#EDF2F7').fill();

        doc
          .fillColor('#2D3748')
          .fontSize(8)
          .font('Helvetica-Bold')
          .text('ITEM DESCRIPTION', 45, tableTop + 6)
          .text('SKU / SIZE', 240, tableTop + 6)
          .text('UNIT PRICE', 360, tableTop + 6, { width: 60, align: 'right' })
          .text('QTY', 430, tableTop + 6, { width: 30, align: 'center' })
          .text('TOTAL (NPR)', 475, tableTop + 6, {
            width: 75,
            align: 'right',
          });

        // Table Rows
        let currentY = tableTop + 24;

        for (const item of order.items) {
          if (currentY > 720) {
            doc.addPage();
            currentY = 40;
          }

          const unitPriceStr = item.effectiveUnitPrice || item.unitPrice;
          const isDiscounted =
            item.unitDiscount && Number(item.unitDiscount) > 0;

          doc
            .fillColor('#2D3748')
            .fontSize(9)
            .font('Helvetica')
            .text(item.productName, 45, currentY, { width: 190 });

          doc
            .fillColor('#718096')
            .fontSize(8)
            .text(`${item.sku} (${item.sizeLabel})`, 240, currentY, {
              width: 110,
            });

          doc
            .fillColor('#2D3748')
            .fontSize(8)
            .text(`NPR ${Number(unitPriceStr).toFixed(2)}`, 360, currentY, {
              width: 60,
              align: 'right',
            });

          if (isDiscounted) {
            doc
              .fillColor('#E53E3E')
              .fontSize(7)
              .text(
                `(-NPR ${Number(item.unitDiscount).toFixed(2)})`,
                360,
                currentY + 10,
                { width: 60, align: 'right' },
              );
          }

          doc
            .fillColor('#2D3748')
            .fontSize(9)
            .text(String(item.quantity), 430, currentY, {
              width: 30,
              align: 'center',
            });

          doc
            .fillColor('#2D3748')
            .fontSize(9)
            .font('Helvetica-Bold')
            .text(`NPR ${Number(item.subtotal).toFixed(2)}`, 475, currentY, {
              width: 75,
              align: 'right',
            });

          const rowHeight = isDiscounted ? 24 : 18;
          currentY += rowHeight;

          // Light divider between items
          doc
            .moveTo(40, currentY)
            .lineTo(555, currentY)
            .strokeColor('#EDF2F7')
            .stroke();
          currentY += 4;
        }

        currentY += 10;

        // 4. Totals Breakdown Section
        const totalsLeft = 350;
        const subtotal = Number(order.pricing.subtotal).toFixed(2);
        const discountTotal = order.pricing.discountTotal
          ? Number(order.pricing.discountTotal).toFixed(2)
          : '0.00';
        const deliveryFee = Number(order.pricing.deliveryFee).toFixed(2);
        const grandTotal = Number(order.pricing.total).toFixed(2);

        doc
          .fillColor('#4A5568')
          .fontSize(9)
          .font('Helvetica')
          .text('Subtotal:', totalsLeft, currentY)
          .text(`NPR ${subtotal}`, 475, currentY, {
            width: 75,
            align: 'right',
          });
        currentY += 15;

        if (Number(discountTotal) > 0) {
          doc
            .fillColor('#E53E3E')
            .text('Product Discounts:', totalsLeft, currentY)
            .text(`- NPR ${discountTotal}`, 475, currentY, {
              width: 75,
              align: 'right',
            });
          currentY += 15;
        }

        if (
          order.promoCode &&
          order.pricing.promoDiscount &&
          Number(order.pricing.promoDiscount) > 0
        ) {
          const promoDiscount = Number(order.pricing.promoDiscount).toFixed(2);
          doc
            .fillColor('#319795')
            .text(`Promo (${order.promoCode}):`, totalsLeft, currentY)
            .text(`- NPR ${promoDiscount}`, 475, currentY, {
              width: 75,
              align: 'right',
            });
          currentY += 15;
        }

        doc
          .fillColor('#4A5568')
          .text('Delivery Fee:', totalsLeft, currentY)
          .text(`NPR ${deliveryFee}`, 475, currentY, {
            width: 75,
            align: 'right',
          });
        currentY += 16;

        // Double underline before grand total
        doc
          .moveTo(totalsLeft, currentY)
          .lineTo(555, currentY)
          .strokeColor('#CBD5E0')
          .stroke();
        currentY += 5;

        doc
          .fillColor('#1A202C')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('TOTAL AMOUNT:', totalsLeft, currentY)
          .text(`NPR ${grandTotal}`, 475, currentY, {
            width: 75,
            align: 'right',
          });
        currentY += 25;

        // 5. Footer & Notice
        const footerY = Math.max(currentY + 20, 750);
        doc
          .moveTo(40, footerY)
          .lineTo(555, footerY)
          .strokeColor('#E2E8F0')
          .stroke();

        doc
          .fillColor('#718096')
          .fontSize(8)
          .font('Helvetica')
          .text(
            'Thank you for your order with Old Liquor! This is an electronically generated receipt.',
            40,
            footerY + 10,
            { align: 'center', width: 515 },
          )
          .text(
            `For customer support, please contact ${storeEmail} or call ${storePhone}.`,
            40,
            footerY + 22,
            { align: 'center', width: 515 },
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const invoiceGeneratorService = new InvoiceGeneratorService();
