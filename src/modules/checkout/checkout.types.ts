export interface CheckoutCustomerInput {
  name: string;
  phone: string;
  deliveryAddress?: string;
  email?: string | null;
  coordinates?: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface CheckoutItemInput {
  variantId: string;
  quantity: number;
}

export interface CheckoutInput {
  cartId?: string;
  items?: CheckoutItemInput[];
  customer: CheckoutCustomerInput;
  idempotencyKey?: string;
  paymentMethodCode?: string;
  promoCode?: string;
}

export interface OrderSnapshotItem {
  id: string;
  orderId: string;
  variantId: string;
  productName: string;
  sku: string;
  sizeLabel: string;
  unitPrice: string;
  unitDiscount: string;
  effectiveUnitPrice: string;
  quantity: number;
  subtotal: string;
}

export interface OrderSnapshot {
  id: string;
  orderNumber: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string;
  deliveryLatitude: string | null;
  deliveryLongitude: string | null;
  status: string;
  subtotal: string;
  discountTotal: string;
  deliveryFee: string;
  total: string;
  promoCode: string | null;
  promoDiscount: string;
  lookupTokenHash: string;
  orderLookupToken?: string;
  idempotencyKey: string | null;
  requestFingerprint: string | null;
  paymentMethodCode: string | null;
  paymentMethodName: string | null;
  paymentStatus: string;
  paymentReference: string | null;
  items: OrderSnapshotItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicOrderItem {
  productName: string;
  sku: string;
  sizeLabel: string;
  unitPrice: string;
  effectiveUnitPrice: string;
  quantity: number;
  subtotal: string;
}

export interface PublicOrderView {
  orderNumber: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    name: string;
    maskedPhone: string;
    maskedEmail: string | null;
    maskedDeliveryAddress: string;
  };
  items: PublicOrderItem[];
  pricing: {
    subtotal: string;
    discountTotal: string;
    deliveryFee: string;
    total: string;
    promoCode?: string | null;
    promoDiscount?: string;
  };
  payment: {
    methodCode: string | null;
    methodName: string | null;
    status: string;
  };
}

export interface DeliveryFeeEstimator {
  estimateFee(input: {
    address: string;
    coordinates?: { latitude: number; longitude: number };
    subtotal: string;
  }): Promise<{ fee: string; currency: string }>;
}

export interface PaymentGateway {
  initiatePayment(
    order: OrderSnapshot,
  ): Promise<{ paymentId: string; status: string }>;
}

export interface CreateOrderParams {
  orderNumber: string;
  orderLookupToken: string;
  lookupTokenHash: string;
  customer: CheckoutCustomerInput & { deliveryAddress: string };
  items: Array<{
    variantId: string;
    productName: string;
    sku: string;
    sizeLabel: string;
    unitPrice: string;
    unitDiscount: string;
    effectiveUnitPrice: string;
    quantity: number;
    subtotal: string;
  }>;
  subtotal: string;
  discountTotal: string;
  deliveryFee: string;
  total: string;
  promoCode?: string | null;
  promoDiscount?: string;
  promoCodeId?: string | null;
  idempotencyKey?: string;
  requestFingerprint?: string;
  paymentMethodCode?: string | null;
  paymentMethodName?: string | null;
  paymentStatus?: string;
  paymentReference?: string | null;
  cartIdToClear?: string;
}

export interface CheckoutRepository {
  findOrderByIdempotencyKey(key: string): Promise<OrderSnapshot | null>;
  findOrderByNumber(orderNumber: string): Promise<OrderSnapshot | null>;
  createOrderWithStockDeduction(
    params: CreateOrderParams,
  ): Promise<OrderSnapshot>;
  updateOrderPayment(
    orderId: string,
    paymentStatus: string,
    paymentReference?: string | null,
  ): Promise<OrderSnapshot>;
}
