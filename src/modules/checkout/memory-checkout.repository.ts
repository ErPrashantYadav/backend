import { AppError } from '../../errors/app-error';
import type { CartRepository } from '../cart/cart.types';
import type { InventoryMovementRecord } from '../inventory/inventory.types';
import type { MemoryVariantItem } from '../inventory/memory-inventory.repository';
import type {
  CheckoutRepository,
  CreateOrderParams,
  OrderSnapshot,
} from './checkout.types';
import type { NotificationOutboxService } from '../notifications/notification-outbox.service';
import type { PromoCodeRepository } from '../promo-code/promo-code.types';

export class MemoryCheckoutRepository implements CheckoutRepository {
  orders: OrderSnapshot[] = [];

  constructor(
    public variants: MemoryVariantItem[] = [],
    public movements: InventoryMovementRecord[] = [],
    private readonly cartRepository?: CartRepository,
    public notificationOutboxService?: NotificationOutboxService,
    public promoCodeRepository?: PromoCodeRepository,
  ) {}

  setNotificationOutboxService(service: NotificationOutboxService): void {
    this.notificationOutboxService = service;
  }

  setPromoCodeRepository(repo: PromoCodeRepository): void {
    this.promoCodeRepository = repo;
  }

  async findOrderByIdempotencyKey(key: string): Promise<OrderSnapshot | null> {
    return this.orders.find((o) => o.idempotencyKey === key) ?? null;
  }

  async findOrderByNumber(orderNumber: string): Promise<OrderSnapshot | null> {
    return this.orders.find((o) => o.orderNumber === orderNumber) ?? null;
  }

  async createOrderWithStockDeduction(
    params: CreateOrderParams,
  ): Promise<OrderSnapshot> {
    if (params.idempotencyKey) {
      const existing = await this.findOrderByIdempotencyKey(
        params.idempotencyKey,
      );
      if (existing) {
        if (
          params.requestFingerprint &&
          existing.requestFingerprint &&
          existing.requestFingerprint !== params.requestFingerprint
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

    // Atomic pre-validation: verify all variants before any stock changes
    for (const item of params.items) {
      const variant = this.variants.find((v) => v.id === item.variantId);
      if (
        !variant ||
        !variant.isActive ||
        (variant.product && !variant.product.isActive)
      ) {
        throw new AppError(
          400,
          'INACTIVE_VARIANT',
          `Variant ${item.sku} is no longer active or available for checkout`,
        );
      }

      if (variant.stock < item.quantity) {
        throw new AppError(
          400,
          'INSUFFICIENT_STOCK',
          `Insufficient stock for ${item.productName} (${item.sizeLabel}). Available: ${variant.stock}, requested: ${item.quantity}`,
        );
      }
    }

    if (params.promoCodeId && this.promoCodeRepository) {
      const updatedPromo = await this.promoCodeRepository.incrementUsedCount(
        params.promoCodeId,
      );
      if (!updatedPromo) {
        throw new AppError(
          400,
          'PROMO_USAGE_LIMIT_EXCEEDED',
          'Promo code usage limit has been reached or promo is inactive',
        );
      }
    }

    // Deduct stock and record movements
    for (const item of params.items) {
      const variant = this.variants.find((v) => v.id === item.variantId)!;
      const stockBefore = variant.stock;
      const stockAfter = stockBefore - item.quantity;
      variant.stock = stockAfter;

      const movement: InventoryMovementRecord = {
        id: crypto.randomUUID(),
        variantId: variant.id,
        quantityDelta: -item.quantity,
        stockBefore,
        stockAfter,
        type: 'SALE',
        reason: `Checkout order ${params.orderNumber} placed`,
        actorAdminId: null,
        createdAt: new Date(),
        variant: {
          id: variant.id,
          sku: variant.sku,
          sizeLabel: variant.sizeLabel,
          product: {
            id: variant.productId,
            name: variant.product?.name ?? item.productName,
            slug: variant.product?.slug ?? 'product',
          },
        },
        actorAdmin: null,
      };
      this.movements.push(movement);
    }

    const orderId = crypto.randomUUID();
    const order: OrderSnapshot = {
      id: orderId,
      orderNumber: params.orderNumber,
      customerId: crypto.randomUUID(),
      customerName: params.customer.name,
      customerPhone: params.customer.phone,
      customerEmail: params.customer.email || null,
      deliveryAddress: params.customer.deliveryAddress,
      deliveryLatitude: params.customer.coordinates?.latitude
        ? params.customer.coordinates.latitude.toString()
        : null,
      deliveryLongitude: params.customer.coordinates?.longitude
        ? params.customer.coordinates.longitude.toString()
        : null,
      status: 'PENDING',
      subtotal: params.subtotal,
      discountTotal: params.discountTotal,
      deliveryFee: params.deliveryFee,
      total: params.total,
      promoCode: params.promoCode || null,
      promoDiscount: params.promoDiscount || '0.00',
      lookupTokenHash: params.lookupTokenHash,
      orderLookupToken: params.orderLookupToken,
      idempotencyKey: params.idempotencyKey || null,
      requestFingerprint: params.requestFingerprint || null,
      paymentMethodCode: params.paymentMethodCode || null,
      paymentMethodName: params.paymentMethodName || null,
      paymentStatus: params.paymentStatus || 'PENDING',
      paymentReference: params.paymentReference || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: params.items.map((item) => ({
        id: crypto.randomUUID(),
        orderId,
        variantId: item.variantId,
        productName: item.productName,
        sku: item.sku,
        sizeLabel: item.sizeLabel,
        unitPrice: item.unitPrice,
        unitDiscount: item.unitDiscount,
        effectiveUnitPrice: item.effectiveUnitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
    };

    this.orders.push(order);

    if (params.promoCodeId && this.promoCodeRepository) {
      await this.promoCodeRepository.recordRedemption({
        promoCodeId: params.promoCodeId,
        orderId,
        discountAmount: params.promoDiscount || '0.00',
      });
    }

    if (this.notificationOutboxService) {
      await this.notificationOutboxService.enqueueOrderCreatedWhatsApp({
        ...order,
        items: params.items,
      });
    }

    if (params.cartIdToClear && this.cartRepository) {
      await this.cartRepository.clearCart(params.cartIdToClear);
    }

    return order;
  }

  async updateOrderPayment(
    orderId: string,
    paymentStatus: string,
    paymentReference?: string | null,
  ): Promise<OrderSnapshot> {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }
    order.paymentStatus = paymentStatus;
    if (paymentReference !== undefined) {
      order.paymentReference = paymentReference;
    }
    order.updatedAt = new Date();
    return order;
  }
}
