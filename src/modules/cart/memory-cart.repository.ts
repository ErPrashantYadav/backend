import { randomBytes, randomUUID } from 'node:crypto';
import type { CartRawItem, CartRawRecord, CartRepository } from './cart.types';

export class MemoryCartRepository implements CartRepository {
  carts: Map<
    string,
    { id: string; token: string; createdAt: Date; updatedAt: Date }
  > = new Map();
  items: Map<string, CartRawItem[]> = new Map();

  async getOrCreateCart(
    cartTokenOrId?: string,
  ): Promise<{ id: string; token: string }> {
    if (cartTokenOrId) {
      for (const cart of this.carts.values()) {
        if (cart.id === cartTokenOrId || cart.token === cartTokenOrId) {
          return { id: cart.id, token: cart.token };
        }
      }
    }

    const id = randomUUID();
    const token = randomBytes(24).toString('base64url');
    const now = new Date();
    const cart = { id, token, createdAt: now, updatedAt: now };
    this.carts.set(id, cart);
    this.items.set(id, []);
    return { id, token };
  }

  async getCart(cartTokenOrId: string): Promise<CartRawRecord | null> {
    let foundCart:
      | { id: string; token: string; createdAt: Date; updatedAt: Date }
      | undefined;
    for (const cart of this.carts.values()) {
      if (cart.id === cartTokenOrId || cart.token === cartTokenOrId) {
        foundCart = cart;
        break;
      }
    }

    if (!foundCart) return null;
    const cartItems = this.items.get(foundCart.id) ?? [];
    return {
      ...foundCart,
      items: [...cartItems],
    };
  }

  async addItem(
    cartId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    const cartItems = this.items.get(cartId) ?? [];
    const existing = cartItems.find((i) => i.variantId === variantId);
    const now = new Date();
    if (existing) {
      existing.quantity += quantity;
      existing.updatedAt = now;
    } else {
      cartItems.push({
        id: randomUUID(),
        cartId,
        variantId,
        quantity,
        createdAt: now,
        updatedAt: now,
      });
    }
    this.items.set(cartId, cartItems);
  }

  async updateItemQuantity(
    cartId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    let cartItems = this.items.get(cartId) ?? [];
    if (quantity <= 0) {
      cartItems = cartItems.filter((i) => i.variantId !== variantId);
    } else {
      const existing = cartItems.find((i) => i.variantId === variantId);
      if (existing) {
        existing.quantity = quantity;
        existing.updatedAt = new Date();
      } else {
        cartItems.push({
          id: randomUUID(),
          cartId,
          variantId,
          quantity,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
    this.items.set(cartId, cartItems);
  }

  async removeItem(cartId: string, variantId: string): Promise<void> {
    const cartItems = this.items.get(cartId) ?? [];
    this.items.set(
      cartId,
      cartItems.filter((i) => i.variantId !== variantId),
    );
  }

  async clearCart(cartId: string): Promise<void> {
    this.items.set(cartId, []);
  }
}
