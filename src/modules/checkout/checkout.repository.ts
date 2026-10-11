import { PaymentStatus, Prisma } from '@prisma/client';
import { AppError } from '../../errors/app-error';
import { prisma } from '../../lib/prisma';
import type {
  CheckoutRepository,
  CreateOrderParams,
  OrderSnapshot,
} from './checkout.types';

function mapOrder(
  row: Prisma.OrderGetPayload<{ include: { items: true } }>,
): OrderSnapshot {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customerId: row.customerId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    deliveryAddress: row.deliveryAddress,
    deliveryLatitude: row.deliveryLatitude
      ? row.deliveryLatitude.toString()
      : null,
    deliveryLongitude: row.deliveryLongitude
      ? row.deliveryLongitude.toString()
      : null,
    status: row.status,
    subtotal: row.subtotal.toFixed(2),
    discountTotal: row.discountTotal.toFixed(2),
    deliveryFee: row.deliveryFee.toFixed(2),
    total: row.total.toFixed(2),
    promoCode: row.promoCode,
    promoDiscount: row.promoDiscount.toFixed(2),
    lookupTokenHash: row.lookupTokenHash,
    idempotencyKey: row.idempotencyKey,
    requestFingerprint: row.requestFingerprint,
    paymentMethodCode: row.paymentMethodCode,
    paymentMethodName: row.paymentMethodName,
    paymentStatus: row.paymentStatus,
    paymentReference: row.paymentReference,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: row.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      variantId: item.variantId,
      productName: item.productName,
      sku: item.sku,
      sizeLabel: item.sizeLabel,
      unitPrice: item.unitPrice.toFixed(2),
      unitDiscount: item.unitDiscount.toFixed(2),
      effectiveUnitPrice: item.effectiveUnitPrice.toFixed(2),
      quantity: item.quantity,
      subtotal: item.subtotal.toFixed(2),
    })),
  };
}

import type { NotificationOutboxService } from '../notifications/notification-outbox.service';

export class PrismaCheckoutRepository implements CheckoutRepository {
  constructor(private notificationOutboxService?: NotificationOutboxService) {}

  setNotificationOutboxService(service: NotificationOutboxService): void {
    this.notificationOutboxService = service;
  }

  async findOrderByIdempotencyKey(key: string): Promise<OrderSnapshot | null> {
    const row = await prisma.order.findUnique({
      where: { idempotencyKey: key },
      include: { items: true },
    });
    return row ? mapOrder(row) : null;
  }

  async findOrderByNumber(orderNumber: string): Promise<OrderSnapshot | null> {
    const row = await prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    return row ? mapOrder(row) : null;
  }

  async createOrderWithStockDeduction(
    params: CreateOrderParams,
  ): Promise<OrderSnapshot> {
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const orderSnapshot = await prisma.$transaction(
          async (tx) => {
            if (params.idempotencyKey) {
              const existing = await tx.order.findUnique({
                where: { idempotencyKey: params.idempotencyKey },
                include: { items: true },
              });
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
                return mapOrder(existing);
              }
            }

            for (const item of params.items) {
              const variant = await tx.productVariant.findUnique({
                where: { id: item.variantId },
                include: {
                  product: {
                    include: {
                      category: true,
                      brand: true,
                    },
                  },
                },
              });

              if (
                !variant ||
                !variant.isActive ||
                !variant.product.isActive ||
                !variant.product.category.isActive ||
                !variant.product.brand.isActive
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

              const stockAfter = variant.stock - item.quantity;
              await tx.productVariant.update({
                where: { id: variant.id },
                data: { stock: stockAfter },
              });

              await tx.inventoryMovement.create({
                data: {
                  variantId: variant.id,
                  quantityDelta: -item.quantity,
                  stockBefore: variant.stock,
                  stockAfter,
                  type: 'SALE',
                  reason: `Checkout order ${params.orderNumber} placed`,
                  actorAdminId: null,
                },
              });
            }

            if (params.promoCodeId) {
              const affected = await tx.$executeRaw`
                UPDATE "PromoCode"
                SET "usedCount" = "usedCount" + 1,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = ${params.promoCodeId}::uuid
                  AND "isActive" = true
                  AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
              `;
              if (affected === 0) {
                throw new AppError(
                  400,
                  'PROMO_USAGE_LIMIT_EXCEEDED',
                  'Promo code usage limit has been reached or promo is inactive',
                );
              }
            }

            const customer = await tx.customer.create({
              data: {
                name: params.customer.name,
                phone: params.customer.phone,
                deliveryAddress: params.customer.deliveryAddress,
                email: params.customer.email || null,
              },
            });

            const order = await tx.order.create({
              data: {
                orderNumber: params.orderNumber,
                customerId: customer.id,
                customerName: params.customer.name,
                customerPhone: params.customer.phone,
                customerEmail: params.customer.email || null,
                deliveryAddress: params.customer.deliveryAddress,
                deliveryLatitude: params.customer.coordinates?.latitude
                  ? new Prisma.Decimal(params.customer.coordinates.latitude)
                  : null,
                deliveryLongitude: params.customer.coordinates?.longitude
                  ? new Prisma.Decimal(params.customer.coordinates.longitude)
                  : null,
                subtotal: new Prisma.Decimal(params.subtotal),
                discountTotal: new Prisma.Decimal(params.discountTotal),
                deliveryFee: new Prisma.Decimal(params.deliveryFee),
                total: new Prisma.Decimal(params.total),
                promoCode: params.promoCode || null,
                promoDiscount: new Prisma.Decimal(params.promoDiscount || 0),
                promoCodeId: params.promoCodeId || null,
                lookupTokenHash: params.lookupTokenHash,
                idempotencyKey: params.idempotencyKey || null,
                requestFingerprint: params.requestFingerprint || null,
                paymentMethodCode: params.paymentMethodCode || null,
                paymentMethodName: params.paymentMethodName || null,
                paymentStatus:
                  (params.paymentStatus as PaymentStatus) || 'PENDING',
                paymentReference: params.paymentReference || null,
                items: {
                  create: params.items.map((item) => ({
                    variantId: item.variantId,
                    productName: item.productName,
                    sku: item.sku,
                    sizeLabel: item.sizeLabel,
                    unitPrice: new Prisma.Decimal(item.unitPrice),
                    unitDiscount: new Prisma.Decimal(item.unitDiscount),
                    effectiveUnitPrice: new Prisma.Decimal(
                      item.effectiveUnitPrice,
                    ),
                    quantity: item.quantity,
                    subtotal: new Prisma.Decimal(item.subtotal),
                  })),
                },
              },
              include: {
                items: true,
              },
            });

            if (params.promoCodeId) {
              await tx.promoCodeRedemption.create({
                data: {
                  promoCodeId: params.promoCodeId,
                  orderId: order.id,
                  discountAmount: new Prisma.Decimal(params.promoDiscount || 0),
                },
              });
            }

            if (params.cartIdToClear) {
              await tx.cartItem.deleteMany({
                where: { cartId: params.cartIdToClear },
              });
            }

            if (this.notificationOutboxService) {
              await this.notificationOutboxService.enqueueOrderCreatedWhatsApp(
                {
                  id: order.id,
                  orderNumber: order.orderNumber,
                  customerName: order.customerName,
                  customerPhone: order.customerPhone,
                  customerEmail: order.customerEmail,
                  deliveryAddress: order.deliveryAddress,
                  total: order.total.toFixed(2),
                  paymentMethodName: order.paymentMethodName,
                  paymentMethodCode: order.paymentMethodCode,
                  items: params.items.map((i) => ({
                    productName: i.productName,
                    sizeLabel: i.sizeLabel,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                  })),
                  createdAt: order.createdAt,
                },
                tx,
              );
            }

            const mapped = mapOrder(order);
            mapped.orderLookupToken = params.orderLookupToken;
            return mapped;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        return orderSnapshot;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
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
        }

        // Serialization failure conflict (P2034) retry
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < maxAttempts
        ) {
          await new Promise((res) =>
            setTimeout(res, 25 * attempt + Math.floor(Math.random() * 20)),
          );
          continue;
        }

        throw error;
      }
    }

    throw new AppError(
      500,
      'TRANSACTION_FAILED',
      'Failed to complete checkout',
    );
  }

  async updateOrderPayment(
    orderId: string,
    paymentStatus: string,
    paymentReference?: string | null,
  ): Promise<OrderSnapshot> {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: paymentStatus as PaymentStatus,
        ...(paymentReference !== undefined ? { paymentReference } : {}),
      },
      include: { items: true },
    });
    return mapOrder(updated);
  }
}
