import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import type { CartRawRecord, CartRepository } from './cart.types';

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    val,
  );
}

export class PrismaCartRepository implements CartRepository {
  async getOrCreateCart(
    cartTokenOrId?: string,
  ): Promise<{ id: string; token: string }> {
    if (cartTokenOrId) {
      const existing = await prisma.cart.findFirst({
        where: isUuid(cartTokenOrId)
          ? { OR: [{ id: cartTokenOrId }, { token: cartTokenOrId }] }
          : { token: cartTokenOrId },
        select: { id: true, token: true },
      });
      if (existing) {
        return existing;
      }
    }

    const token = randomBytes(24).toString('base64url');
    const created = await prisma.cart.create({
      data: { token },
      select: { id: true, token: true },
    });
    return created;
  }

  async getCart(cartTokenOrId: string): Promise<CartRawRecord | null> {
    const cart = await prisma.cart.findFirst({
      where: isUuid(cartTokenOrId)
        ? { OR: [{ id: cartTokenOrId }, { token: cartTokenOrId }] }
        : { token: cartTokenOrId },
      include: {
        items: {
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });
    return cart;
  }

  async addItem(
    cartId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    await prisma.cartItem.upsert({
      where: {
        cartId_variantId: { cartId, variantId },
      },
      create: {
        cartId,
        variantId,
        quantity,
      },
      update: {
        quantity: { increment: quantity },
      },
    });
  }

  async updateItemQuantity(
    cartId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    if (quantity <= 0) {
      await prisma.cartItem.deleteMany({
        where: { cartId, variantId },
      });
      return;
    }

    await prisma.cartItem.upsert({
      where: {
        cartId_variantId: { cartId, variantId },
      },
      create: {
        cartId,
        variantId,
        quantity,
      },
      update: {
        quantity,
      },
    });
  }

  async removeItem(cartId: string, variantId: string): Promise<void> {
    await prisma.cartItem.deleteMany({
      where: { cartId, variantId },
    });
  }

  async clearCart(cartId: string): Promise<void> {
    await prisma.cartItem.deleteMany({
      where: { cartId },
    });
  }
}
