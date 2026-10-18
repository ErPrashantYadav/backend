import type { ManagedOrderDetail } from '../order-management/order-management.types';
import type { OrderSnapshot } from '../checkout/checkout.types';

export interface InvoiceCustomerInfo {
  name: string;
  phone: string;
  email?: string | null;
  deliveryAddress: string;
}

export interface InvoiceItem {
  productName: string;
  sku: string;
  sizeLabel: string;
  quantity: number;
  unitPrice: string;
  unitDiscount?: string;
  effectiveUnitPrice?: string;
  subtotal: string;
}

export interface InvoicePricing {
  subtotal: string;
  discountTotal?: string;
  deliveryFee: string;
  promoDiscount?: string;
  total: string;
}

export interface InvoicePayment {
  methodCode?: string | null;
  methodName?: string | null;
  status: string;
  reference?: string | null;
}

export interface InvoiceStoreInfo {
  storeName?: string;
  storeTagline?: string | null;
  primaryPhone?: string;
  supportEmail?: string;
  address?: string;
  city?: string;
}

export interface InvoiceOrderData {
  orderNumber: string;
  createdAt: Date | string;
  customer: InvoiceCustomerInfo;
  items: InvoiceItem[];
  pricing: InvoicePricing;
  promoCode?: string | null;
  payment: InvoicePayment;
  status: string;
}

export function toInvoiceOrderDataFromDetail(
  detail: ManagedOrderDetail,
): InvoiceOrderData {
  return {
    orderNumber: detail.orderNumber,
    createdAt: detail.createdAt,
    customer: {
      name: detail.customer.name,
      phone: detail.customer.phone,
      email: detail.customer.email,
      deliveryAddress: detail.customer.deliveryAddress,
    },
    items: detail.items.map((i) => ({
      productName: i.productName,
      sku: i.sku,
      sizeLabel: i.sizeLabel,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      unitDiscount: i.unitDiscount,
      effectiveUnitPrice: i.effectiveUnitPrice,
      subtotal: i.subtotal,
    })),
    pricing: {
      subtotal: detail.pricing.subtotal,
      discountTotal: detail.pricing.discountTotal,
      deliveryFee: detail.pricing.deliveryFee,
      total: detail.pricing.total,
    },
    payment: {
      methodCode: detail.payment.methodCode,
      methodName: detail.payment.methodName,
      status: detail.payment.status,
      reference: detail.payment.reference,
    },
    status: detail.status,
  };
}

export function toInvoiceOrderDataFromSnapshot(
  snapshot: OrderSnapshot,
): InvoiceOrderData {
  return {
    orderNumber: snapshot.orderNumber,
    createdAt: snapshot.createdAt,
    customer: {
      name: snapshot.customerName,
      phone: snapshot.customerPhone,
      email: snapshot.customerEmail,
      deliveryAddress: snapshot.deliveryAddress,
    },
    items: (snapshot.items || []).map((i) => ({
      productName: i.productName,
      sku: i.sku || 'N/A',
      sizeLabel: i.sizeLabel || 'Standard',
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      unitDiscount: i.unitDiscount,
      effectiveUnitPrice: i.effectiveUnitPrice,
      subtotal: i.subtotal,
    })),
    pricing: {
      subtotal: snapshot.subtotal,
      discountTotal: snapshot.discountTotal,
      deliveryFee: snapshot.deliveryFee,
      promoDiscount: snapshot.promoDiscount,
      total: snapshot.total,
    },
    promoCode: snapshot.promoCode,
    payment: {
      methodCode: snapshot.paymentMethodCode,
      methodName: snapshot.paymentMethodName,
      status: snapshot.paymentStatus,
      reference: snapshot.paymentReference,
    },
    status: snapshot.status,
  };
}
