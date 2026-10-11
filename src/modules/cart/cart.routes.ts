import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../errors/app-error';
import { validateBody } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import { CartService } from './cart.service';
import type { CartRepository } from './cart.types';
import type { CatalogRepository } from '../catalog/catalog.types';

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

function extractCartToken(request: Request): string | undefined {
  const header = request.header('x-cart-id') || request.header('x-cart-token');
  if (header?.trim()) return header.trim();
  if (typeof request.query.cartId === 'string' && request.query.cartId.trim()) {
    return request.query.cartId.trim();
  }
  return undefined;
}

const addItemSchema = z
  .object({
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100).default(1),
  })
  .strict();

const updateItemSchema = z
  .object({
    quantity: z.number().int().min(0).max(100),
  })
  .strict();

function requireCartToken(request: Request): string {
  const token = extractCartToken(request);
  if (!token || !token.trim()) {
    throw new AppError(
      400,
      'CART_TOKEN_REQUIRED',
      'Cart token header (X-Cart-Id) is required for this operation',
    );
  }
  return token.trim();
}

export function createCartRouter(
  cartRepository: CartRepository,
  catalogRepository: CatalogRepository,
): Router {
  const router = Router();
  const service = new CartService(cartRepository, catalogRepository);

  router.get(
    '/',
    asyncHandler(async (request, response) => {
      const cartToken = extractCartToken(request);
      const cart = cartToken
        ? await service.getCartDetail(cartToken)
        : await service.getCartDetail('');
      response.setHeader('X-Cart-Id', cart.token);
      response
        .status(200)
        .json(successResponse('Cart retrieved successfully', cart));
    }),
  );

  router.post(
    '/items',
    validateBody(addItemSchema),
    asyncHandler(async (request, response) => {
      const cartToken = extractCartToken(request);
      const { variantId, quantity } = request.body;
      const { cartToken: newOrExistingToken, cart } = await service.addItem(
        cartToken,
        variantId,
        quantity,
      );
      response.setHeader('X-Cart-Id', newOrExistingToken);
      response.status(200).json(successResponse('Item added to cart', cart));
    }),
  );

  router.patch(
    '/items/:variantId',
    validateBody(updateItemSchema),
    asyncHandler(async (request, response) => {
      const cartToken = requireCartToken(request);
      const variantId = z.string().uuid().parse(request.params.variantId);
      const { quantity } = request.body;
      const cart = await service.updateItemQuantity(
        cartToken,
        variantId,
        quantity,
      );
      response.setHeader('X-Cart-Id', cart.token);
      response.status(200).json(successResponse('Cart item updated', cart));
    }),
  );

  router.delete(
    '/items/:variantId',
    asyncHandler(async (request, response) => {
      const cartToken = requireCartToken(request);
      const variantId = z.string().uuid().parse(request.params.variantId);
      const cart = await service.removeItem(cartToken, variantId);
      response.setHeader('X-Cart-Id', cart.token);
      response.status(200).json(successResponse('Cart item removed', cart));
    }),
  );

  router.delete(
    '/',
    asyncHandler(async (request, response) => {
      const cartToken = requireCartToken(request);
      const cart = await service.clearCart(cartToken);
      response.setHeader('X-Cart-Id', cart.token);
      response.status(200).json(successResponse('Cart cleared', cart));
    }),
  );

  return router;
}
