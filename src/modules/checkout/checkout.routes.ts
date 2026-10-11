import { Router, type Request, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import { validateBody } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import type { CartRepository } from '../cart/cart.types';
import type { ProductRepository } from '../products/products.types';
import type { PaymentMethodRepository } from '../payment-method/payment-method.types';
import type { PromoCodeService } from '../promo-code/promo-code.service';
import type { PromoCodeRepository } from '../promo-code/promo-code.types';
import { CheckoutService } from './checkout.service';
import type {
  CheckoutRepository,
  DeliveryFeeEstimator,
} from './checkout.types';

function asyncHandler(
  handler: (
    request: Parameters<RequestHandler>[0],
    response: Parameters<RequestHandler>[1],
  ) => Promise<void>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response).catch(next);
  };
}

function extractIdempotencyKey(request: Request): string | undefined {
  const header =
    request.header('idempotency-key') || request.header('x-idempotency-key');
  if (header?.trim()) return header.trim();
  return undefined;
}

function extractCartToken(request: Request): string | undefined {
  const header = request.header('x-cart-id') || request.header('x-cart-token');
  if (header?.trim()) return header.trim();
  return undefined;
}

export function extractOrderLookupToken(request: Request): string | undefined {
  const header =
    request.header('x-order-token') || request.header('order-lookup-token');
  if (header?.trim()) return header.trim();
  if (typeof request.query.token === 'string' && request.query.token.trim()) {
    return request.query.token.trim();
  }
  if (
    typeof request.query.orderToken === 'string' &&
    request.query.orderToken.trim()
  ) {
    return request.query.orderToken.trim();
  }
  return undefined;
}

const checkoutSchema = z.object({
  cartId: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .optional(),
  customer: z.object({
    name: z.string().trim().min(1, 'Customer name is required').max(100),
    phone: z
      .string()
      .trim()
      .min(7, 'Valid phone number is required')
      .max(20)
      .regex(/^\+?[0-9\s-]{7,20}$/, 'Invalid phone number format'),
    deliveryAddress: z
      .string()
      .trim()
      .min(5, 'Delivery address is required')
      .max(255),
    email: z.string().trim().email().optional().nullable(),
    coordinates: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .optional()
      .nullable(),
  }),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
  paymentMethodCode: z.string().trim().min(2).max(50).optional(),
  promoCode: z.string().trim().min(1).max(50).optional(),
});

export function createCheckoutRouter(
  checkoutRepository: CheckoutRepository,
  productRepository: ProductRepository,
  cartRepository?: CartRepository,
  paymentMethodRepository?: PaymentMethodRepository,
  deliveryFeeEstimator?: DeliveryFeeEstimator,
  promoCodeRepository?: PromoCodeRepository,
  promoCodeService?: PromoCodeService,
): Router {
  const router = Router();
  const service = new CheckoutService(
    checkoutRepository,
    productRepository,
    cartRepository,
    deliveryFeeEstimator,
    undefined,
    paymentMethodRepository,
    promoCodeRepository,
    promoCodeService,
  );

  const orderLookupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Too many order lookup requests; try again later',
        ),
      );
    },
  });

  router.post(
    '/',
    validateBody(checkoutSchema),
    asyncHandler(async (request, response) => {
      const headerIdempotencyKey = extractIdempotencyKey(request);
      const headerCartId = extractCartToken(request);

      const idempotencyKey =
        request.body.idempotencyKey || headerIdempotencyKey;
      const cartId = request.body.cartId || headerCartId;

      const order = await service.processCheckout({
        ...request.body,
        cartId,
        idempotencyKey,
      });

      response
        .status(201)
        .json(successResponse('Order placed successfully', order));
    }),
  );

  router.get(
    '/orders/:orderNumber',
    orderLookupLimiter,
    asyncHandler(async (request, response) => {
      const orderNumber = z.string().min(1).parse(request.params.orderNumber);
      const token = extractOrderLookupToken(request);
      const order = await service.getPublicOrderByNumber(orderNumber, token);
      response
        .status(200)
        .json(successResponse('Order retrieved successfully', order));
    }),
  );

  return router;
}
