import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../../errors/app-error';
import type { CartRepository } from '../cart/cart.types';
import { calculateDiscountedPrice } from '../../utils/discount';
import type { ProductRepository } from '../products/products.types';
import type { PaymentMethodRepository } from '../payment-method/payment-method.types';
import { PromoCodeService } from '../promo-code/promo-code.service';
import type {
  ManagedPromoCode,
  PromoCodeRepository,
} from '../promo-code/promo-code.types';
import { isStoreOpenAt } from '../../utils/business-hours';
import type { GeocodingProvider } from '../routing/routing.types';
import type { StoreSettingsRepository } from '../store-settings/store-settings.types';
import type {
  CheckoutCustomerInput,
  CheckoutInput,
  CheckoutRepository,
  DeliveryFeeEstimator,
  OrderSnapshot,
  PaymentGateway,
  PublicOrderView,
} from './checkout.types';

export const MINIMUM_ORDER_SUBTOTAL = '800.00';

export class ZeroDeliveryFeeEstimator implements DeliveryFeeEstimator {
  async estimateFee(): Promise<{ fee: string; currency: string }> {
    return { fee: '0.00', currency: 'NPR' };
  }
}

function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return '***';
  return `***-***-${trimmed.slice(-4)}`;
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return '***@***';
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (!domain) return '***@***';
  const maskedLocal =
    local.length > 2 ? `${local[0]}***${local.slice(-1)}` : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

function maskAddress(address: string): string {
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length > 1) {
    return `***, ${parts.slice(1).join(', ')}`;
  }
  return `${address.slice(0, 3)}***`;
}

export class CheckoutService {
  constructor(
    private readonly checkoutRepository: CheckoutRepository,
    private readonly productRepository: ProductRepository,
    private readonly cartRepository?: CartRepository,
    public readonly deliveryFeeEstimator: DeliveryFeeEstimator = new ZeroDeliveryFeeEstimator(),
    public readonly paymentGateway?: PaymentGateway,
    private readonly paymentMethodRepository?: PaymentMethodRepository,
    private readonly promoCodeRepository?: PromoCodeRepository,
    private readonly promoCodeService?: PromoCodeService,
    private readonly storeSettingsRepository?: StoreSettingsRepository,
    private readonly geocodingProvider?: GeocodingProvider,
  ) {}

  private generateOrderNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `ORD-${dateStr}-${randomSuffix}`;
  }

  private computeRequestFingerprint(
    customer: CheckoutCustomerInput,
    items: Array<{ variantId: string; quantity: number }>,
    promoCode?: string,
    paymentMethodCode?: string,
  ): string {
    const normalized = JSON.stringify({
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        deliveryAddress: customer.deliveryAddress
          ? customer.deliveryAddress.trim()
          : null,
        email: customer.email?.trim().toLowerCase() || null,
        coordinates: customer.coordinates
          ? {
              latitude: Number(customer.coordinates.latitude.toFixed(6)),
              longitude: Number(customer.coordinates.longitude.toFixed(6)),
            }
          : null,
      },
      items: items
        .map((i) => ({ variantId: i.variantId, quantity: i.quantity }))
        .sort((a, b) => a.variantId.localeCompare(b.variantId)),
      promoCode: promoCode?.trim().toUpperCase() || null,
      paymentMethodCode: paymentMethodCode?.trim().toUpperCase() || null,
    });
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  private async findVariantAndProduct(variantId: string) {
    let page = 1;
    while (true) {
      const productList = await this.productRepository.listProducts({
        page,
        pageSize: 100,
      });
      for (const p of productList.items) {
        const v = p.variants.find((variant) => variant.id === variantId);
        if (v) {
          return { product: p, variant: v };
        }
      }
      if (page >= productList.pagination.totalPages) {
        break;
      }
      page++;
    }
    return null;
  }

  async processCheckout(
    input: CheckoutInput,
    now: Date = new Date(),
  ): Promise<OrderSnapshot> {
    // 0. Enforce ordering switch and business hours from StoreSettings if configured
    if (this.storeSettingsRepository) {
      const settings = await this.storeSettingsRepository.get();

      if (!settings.isOrderingEnabled) {
        throw new AppError(
          400,
          'ORDERING_PAUSED',
          settings.orderingMessage?.trim() ||
            'Online ordering is currently paused. Please check back later.',
        );
      }

      if (settings.businessHours && settings.businessHours.length > 0) {
        const isOpen = isStoreOpenAt(
          settings.businessHours,
          settings.timezone || 'Asia/Kathmandu',
          now,
        );
        if (!isOpen) {
          throw new AppError(
            400,
            'STORE_CLOSED',
            'Store is currently closed for orders. Please check our opening hours.',
          );
        }
      }
    }

    // Coordinates requirement (Task 3)
    if (!input.customer.coordinates) {
      throw new AppError(
        400,
        'COORDINATES_REQUIRED',
        'Customer GPS coordinates (latitude and longitude) are required for delivery checkout',
      );
    }

    const { latitude, longitude } = input.customer.coordinates;
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new AppError(
        400,
        'INVALID_COORDINATES',
        'Delivery coordinates must have valid finite latitude [-90, 90] and longitude [-180, 180]',
      );
    }

    // Derive verified delivery address via GeocodingProvider if available
    let verifiedAddress: string;
    if (this.geocodingProvider) {
      let geocodedAddress: string;
      try {
        geocodedAddress = await this.geocodingProvider.reverseGeocode(
          input.customer.coordinates,
        );
      } catch (error) {
        if (error instanceof AppError) {
          if (
            error.code === 'GEOCODING_UNAVAILABLE' ||
            error.statusCode === 503 ||
            error.code === 'ROUTING_CONFIG_ERROR'
          ) {
            throw new AppError(
              503,
              'GEOCODING_UNAVAILABLE',
              'Geocoding service is unavailable. Delivery location could not be verified.',
            );
          }
          if (error.code === 'GEOCODING_FAILED' || error.statusCode === 404) {
            throw new AppError(
              400,
              'GEOCODING_FAILED',
              'Unable to verify delivery address from the provided coordinates. Please select a valid location.',
            );
          }
          throw error;
        }
        throw new AppError(
          400,
          'GEOCODING_FAILED',
          'Unable to verify delivery address from the provided coordinates. Please select a valid location.',
        );
      }

      const manualAddress = input.customer.deliveryAddress?.trim();
      verifiedAddress = manualAddress || geocodedAddress;
    } else {
      verifiedAddress =
        input.customer.deliveryAddress?.trim() || 'Verified GPS Location';
    }

    input.customer.deliveryAddress = verifiedAddress;

    // 1. Resolve items to checkout first so we can fingerprint the request
    let itemsToCheckout: Array<{ variantId: string; quantity: number }> = [];
    let cartIdToClear: string | undefined;

    if (input.cartId) {
      if (!this.cartRepository) {
        throw new AppError(
          500,
          'CONFIGURATION_ERROR',
          'Cart repository is not configured',
        );
      }
      const cart = await this.cartRepository.getCart(input.cartId);
      if (!cart || cart.items.length === 0) {
        throw new AppError(400, 'EMPTY_CART', 'Cart is empty or not found');
      }
      itemsToCheckout = cart.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      }));
      cartIdToClear = cart.id;
    } else if (input.items && input.items.length > 0) {
      itemsToCheckout = input.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      }));
    } else {
      throw new AppError(
        400,
        'EMPTY_CHECKOUT',
        'No cart or items provided for checkout',
      );
    }

    const requestFingerprint = this.computeRequestFingerprint(
      input.customer,
      itemsToCheckout,
      input.promoCode,
      input.paymentMethodCode,
    );

    // 2. Idempotency check with request fingerprint
    if (input.idempotencyKey) {
      const existing = await this.checkoutRepository.findOrderByIdempotencyKey(
        input.idempotencyKey,
      );
      if (existing) {
        if (
          existing.requestFingerprint &&
          existing.requestFingerprint !== requestFingerprint
        ) {
          throw new AppError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key has already been used with a different request payload',
          );
        }
        return existing;
      }
    }

    // 3. Re-fetch current product and variant details from catalog
    // and recalculate all prices on the server (never trusting client prices)
    const orderItems: Array<{
      variantId: string;
      productName: string;
      sku: string;
      sizeLabel: string;
      unitPrice: string;
      unitDiscount: string;
      effectiveUnitPrice: string;
      quantity: number;
      subtotal: string;
    }> = [];

    let subtotalDecimal = new Prisma.Decimal(0);
    let discountTotalDecimal = new Prisma.Decimal(0);

    for (const item of itemsToCheckout) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Quantity must be a positive integer',
        );
      }

      const match = await this.findVariantAndProduct(item.variantId);
      if (!match) {
        throw new AppError(
          404,
          'NOT_FOUND',
          `Variant ${item.variantId} not found in catalog`,
        );
      }

      const { product, variant } = match;

      if (
        !product.isActive ||
        product.category.isActive === false ||
        product.brand.isActive === false ||
        !variant.isActive
      ) {
        throw new AppError(
          400,
          'INACTIVE_VARIANT',
          `Variant ${variant.sku} (${product.name}) is no longer active or available for checkout`,
        );
      }

      if (variant.stock < item.quantity) {
        throw new AppError(
          400,
          'INSUFFICIENT_STOCK',
          `Insufficient stock for ${product.name} (${variant.sizeLabel}). Available: ${variant.stock}, requested: ${item.quantity}`,
        );
      }

      const unitPrice = variant.sellingPrice;
      const discountedUnitPrice = calculateDiscountedPrice(
        unitPrice,
        product.discountType,
        product.discountValue,
      );

      const unitPriceDec = new Prisma.Decimal(unitPrice);
      const effectiveUnitPriceDec = new Prisma.Decimal(discountedUnitPrice);
      const unitDiscountDec = unitPriceDec.minus(effectiveUnitPriceDec);

      const itemSubtotalDec = effectiveUnitPriceDec.times(item.quantity);
      const itemDiscountDec = unitDiscountDec.times(item.quantity);

      subtotalDecimal = subtotalDecimal.plus(unitPriceDec.times(item.quantity));
      discountTotalDecimal = discountTotalDecimal.plus(itemDiscountDec);

      orderItems.push({
        variantId: variant.id,
        productName: product.name,
        sku: variant.sku,
        sizeLabel: variant.sizeLabel,
        unitPrice: unitPriceDec.toFixed(2),
        unitDiscount: unitDiscountDec.toFixed(2),
        effectiveUnitPrice: effectiveUnitPriceDec.toFixed(2),
        quantity: item.quantity,
        subtotal: itemSubtotalDec.toFixed(2),
      });
    }

    const eligibleMerchandiseSubtotal =
      subtotalDecimal.minus(discountTotalDecimal);
    if (
      eligibleMerchandiseSubtotal.lessThan(
        new Prisma.Decimal(MINIMUM_ORDER_SUBTOTAL),
      )
    ) {
      throw new AppError(
        400,
        'MINIMUM_ORDER_SUBTOTAL_NOT_MET',
        `Minimum order merchandise subtotal of NPR ${MINIMUM_ORDER_SUBTOTAL} is required to checkout`,
      );
    }

    let promoCodeRecord: ManagedPromoCode | null = null;
    let promoDiscountDecimal = new Prisma.Decimal(0);

    if (input.promoCode) {
      const promoService =
        this.promoCodeService ??
        (this.promoCodeRepository
          ? new PromoCodeService(this.promoCodeRepository)
          : null);

      if (!promoService) {
        throw new AppError(
          400,
          'PROMO_NOT_SUPPORTED',
          'Promo codes are not supported in this environment',
        );
      }

      const eligibleItemsTotal = subtotalDecimal.minus(discountTotalDecimal);
      const validation = await promoService.validatePromoCode(
        input.promoCode,
        eligibleItemsTotal.toFixed(2),
      );

      promoCodeRecord = validation.promoCode ?? null;
      promoDiscountDecimal = new Prisma.Decimal(validation.discountAmount);
      discountTotalDecimal = discountTotalDecimal.plus(promoDiscountDecimal);
    }

    const deliveryEstimate = await this.deliveryFeeEstimator.estimateFee({
      address: input.customer.deliveryAddress,
      coordinates: input.customer.coordinates ?? undefined,
      subtotal: subtotalDecimal.toFixed(2),
    });
    const deliveryFeeDecimal = new Prisma.Decimal(deliveryEstimate.fee);

    // Reconcile totals: total = subtotal - discountTotal + deliveryFee
    const totalDecimal = subtotalDecimal
      .minus(discountTotalDecimal)
      .plus(deliveryFeeDecimal);

    const orderNumber = this.generateOrderNumber();
    const orderLookupToken = crypto.randomBytes(32).toString('base64url');
    const lookupTokenHash = crypto
      .createHash('sha256')
      .update(orderLookupToken)
      .digest('hex');

    let paymentMethodCode: string | null = null;
    let paymentMethodName: string | null = null;

    if (input.paymentMethodCode) {
      if (this.paymentMethodRepository) {
        const pm = await this.paymentMethodRepository.findByCode(
          input.paymentMethodCode,
        );
        if (!pm || !pm.isActive) {
          throw new AppError(
            400,
            'INVALID_PAYMENT_METHOD',
            `Payment method '${input.paymentMethodCode}' is not available or active`,
          );
        }
        if (
          pm.minAmount &&
          totalDecimal.lessThan(new Prisma.Decimal(pm.minAmount))
        ) {
          throw new AppError(
            400,
            'PAYMENT_AMOUNT_LIMIT',
            `Order total is below minimum amount (${pm.minAmount}) for payment method '${pm.name}'`,
          );
        }
        if (
          pm.maxAmount &&
          totalDecimal.greaterThan(new Prisma.Decimal(pm.maxAmount))
        ) {
          throw new AppError(
            400,
            'PAYMENT_AMOUNT_LIMIT',
            `Order total exceeds maximum amount (${pm.maxAmount}) for payment method '${pm.name}'`,
          );
        }
        paymentMethodCode = pm.code;
        paymentMethodName = pm.name;
      } else {
        paymentMethodCode = input.paymentMethodCode.trim().toUpperCase();
        paymentMethodName = paymentMethodCode;
      }
    }

    // 4. Create order atomically with stock deduction and inventory movement
    const order = await this.checkoutRepository.createOrderWithStockDeduction({
      orderNumber,
      orderLookupToken,
      lookupTokenHash,
      customer: {
        ...input.customer,
        deliveryAddress: verifiedAddress,
      },
      items: orderItems,
      subtotal: subtotalDecimal.toFixed(2),
      discountTotal: discountTotalDecimal.toFixed(2),
      deliveryFee: deliveryFeeDecimal.toFixed(2),
      total: totalDecimal.toFixed(2),
      promoCode: promoCodeRecord ? promoCodeRecord.code : null,
      promoDiscount: promoDiscountDecimal.toFixed(2),
      promoCodeId: promoCodeRecord ? promoCodeRecord.id : null,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint,
      paymentMethodCode,
      paymentMethodName,
      paymentStatus: 'PENDING',
      cartIdToClear,
    });

    return order;
  }

  async getPublicOrderByNumber(
    orderNumber: string,
    lookupToken?: string,
  ): Promise<PublicOrderView> {
    if (!lookupToken || !lookupToken.trim()) {
      throw new AppError(
        404,
        'ORDER_NOT_FOUND',
        'Order not found or invalid lookup token',
      );
    }

    const order = await this.checkoutRepository.findOrderByNumber(orderNumber);
    if (!order) {
      throw new AppError(
        404,
        'ORDER_NOT_FOUND',
        'Order not found or invalid lookup token',
      );
    }

    const providedHash = crypto
      .createHash('sha256')
      .update(lookupToken.trim())
      .digest('hex');

    const a = Buffer.from(providedHash, 'utf8');
    const b = Buffer.from(order.lookupTokenHash, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new AppError(
        404,
        'ORDER_NOT_FOUND',
        'Order not found or invalid lookup token',
      );
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customer: {
        name: order.customerName,
        maskedPhone: maskPhone(order.customerPhone),
        maskedEmail: maskEmail(order.customerEmail),
        maskedDeliveryAddress: maskAddress(order.deliveryAddress),
      },
      items: order.items.map((i) => ({
        productName: i.productName,
        sku: i.sku,
        sizeLabel: i.sizeLabel,
        unitPrice: i.unitPrice,
        effectiveUnitPrice: i.effectiveUnitPrice,
        quantity: i.quantity,
        subtotal: i.subtotal,
      })),
      pricing: {
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        promoCode: order.promoCode,
        promoDiscount: order.promoDiscount,
      },
      payment: {
        methodCode: order.paymentMethodCode,
        methodName: order.paymentMethodName,
        status: order.paymentStatus,
      },
    };
  }

  async getOrderByNumber(orderNumber: string): Promise<OrderSnapshot> {
    const order = await this.checkoutRepository.findOrderByNumber(orderNumber);
    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }
    return order;
  }
}
