import { Prisma } from '@prisma/client';
import { AppError } from '../../errors/app-error';
import { calculateDiscountedPrice } from '../catalog/catalog.service';
import type { CatalogRepository } from '../catalog/catalog.types';
import type { CartDetail, CartItemDetail, CartRepository } from './cart.types';

export class CartService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly catalogRepository: CatalogRepository,
  ) {}

  async getOrCreateCart(
    cartTokenOrId?: string,
  ): Promise<{ id: string; token: string }> {
    return this.cartRepository.getOrCreateCart(cartTokenOrId);
  }

  async getCartDetail(cartTokenOrId: string): Promise<CartDetail> {
    const cart = await this.cartRepository.getCart(cartTokenOrId);
    if (!cart) {
      const created = await this.cartRepository.getOrCreateCart(cartTokenOrId);
      return {
        id: created.id,
        token: created.token,
        items: [],
        itemCount: 0,
        subtotal: '0.00',
        discountTotal: '0.00',
        total: '0.00',
        hasUnavailableItems: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const items: CartItemDetail[] = [];
    let subtotalDecimal = new Prisma.Decimal(0);
    let discountTotalDecimal = new Prisma.Decimal(0);
    let totalDecimal = new Prisma.Decimal(0);
    let totalItemCount = 0;
    let hasUnavailable = false;

    for (const item of cart.items) {
      // Find variant and its parent product
      // We look up all products or find product by variantId
      let foundProduct = null;
      let foundVariant = null;

      // Scan products in repository (or findProduct)
      // Since catalogRepository.listProducts can list products, let's find the product
      const productList = await this.catalogRepository.listProducts({
        page: 1,
        pageSize: 100,
      });

      for (const p of productList.items) {
        const v = p.variants.find((variant) => variant.id === item.variantId);
        if (v) {
          foundProduct = p;
          foundVariant = v;
          break;
        }
      }

      if (!foundProduct || !foundVariant) {
        hasUnavailable = true;
        items.push({
          id: item.id,
          variantId: item.variantId,
          quantity: item.quantity,
          product: {
            id: '',
            name: 'Unavailable Product',
            slug: '',
            isActive: false,
          },
          variant: {
            id: item.variantId,
            sku: 'UNKNOWN',
            sizeLabel: '',
            sizeMilliliters: 0,
            price: '0.00',
            discountedPrice: '0.00',
            isActive: false,
          },
          unitPrice: '0.00',
          discountedUnitPrice: '0.00',
          subtotal: '0.00',
          isAvailable: false,
          insufficientStock: true,
          statusMessage: 'This product is no longer available',
        });
        continue;
      }

      const isProductActive =
        foundProduct.isActive &&
        foundProduct.category.isActive !== false &&
        foundProduct.brand.isActive !== false;
      const isVariantActive = foundVariant.isActive;
      const isStockSufficient = foundVariant.stock >= item.quantity;
      const isItemAvailable =
        isProductActive && isVariantActive && isStockSufficient;

      if (!isItemAvailable) {
        hasUnavailable = true;
      }

      let statusMessage: string | undefined;
      if (!isProductActive || !isVariantActive) {
        statusMessage = 'This product or size is no longer active';
      } else if (!isStockSufficient) {
        statusMessage = `Only ${foundVariant.stock} items in stock`;
      }

      const unitPrice = foundVariant.sellingPrice;
      const discountedUnitPrice = calculateDiscountedPrice(
        unitPrice,
        foundProduct.discountType,
        foundProduct.discountValue,
      );

      const unitPriceDec = new Prisma.Decimal(unitPrice);
      const effectiveUnitPriceDec = new Prisma.Decimal(discountedUnitPrice);
      const unitDiscountDec = unitPriceDec.minus(effectiveUnitPriceDec);

      const itemSubtotalDec = effectiveUnitPriceDec.times(item.quantity);
      const itemDiscountDec = unitDiscountDec.times(item.quantity);

      subtotalDecimal = subtotalDecimal.plus(unitPriceDec.times(item.quantity));
      discountTotalDecimal = discountTotalDecimal.plus(itemDiscountDec);
      totalDecimal = totalDecimal.plus(itemSubtotalDec);
      totalItemCount += item.quantity;

      items.push({
        id: item.id,
        variantId: foundVariant.id,
        quantity: item.quantity,
        product: {
          id: foundProduct.id,
          name: foundProduct.name,
          slug: foundProduct.slug,
          isActive: isProductActive,
        },
        variant: {
          id: foundVariant.id,
          sku: foundVariant.sku,
          sizeLabel: foundVariant.sizeLabel,
          sizeMilliliters: foundVariant.sizeMilliliters,
          price: unitPrice,
          discountedPrice: discountedUnitPrice,
          isActive: isVariantActive,
        },
        unitPrice,
        discountedUnitPrice,
        subtotal: itemSubtotalDec.toFixed(2),
        isAvailable: isItemAvailable,
        insufficientStock: !isStockSufficient,
        statusMessage,
      });
    }

    return {
      id: cart.id,
      token: cart.token,
      items,
      itemCount: totalItemCount,
      subtotal: subtotalDecimal.toFixed(2),
      discountTotal: discountTotalDecimal.toFixed(2),
      total: totalDecimal.toFixed(2),
      hasUnavailableItems: hasUnavailable,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  async addItem(
    cartTokenOrId: string | undefined,
    variantId: string,
    quantity: number,
  ): Promise<{ cartToken: string; cart: CartDetail }> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Quantity must be a positive integer',
      );
    }
    if (quantity > 100) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Quantity cannot exceed 100 per item',
      );
    }

    // Verify product and variant
    const productList = await this.catalogRepository.listProducts({
      page: 1,
      pageSize: 100,
    });
    let foundProduct = null;
    let foundVariant = null;

    for (const p of productList.items) {
      const v = p.variants.find((variant) => variant.id === variantId);
      if (v) {
        foundProduct = p;
        foundVariant = v;
        break;
      }
    }

    if (!foundProduct || !foundVariant) {
      throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
    }

    if (
      !foundProduct.isActive ||
      foundProduct.category.isActive === false ||
      foundProduct.brand.isActive === false ||
      !foundVariant.isActive
    ) {
      throw new AppError(
        400,
        'INACTIVE_PRODUCT',
        'Product or variant is not active',
      );
    }

    const cart = await this.cartRepository.getOrCreateCart(cartTokenOrId);
    const existingCart = await this.cartRepository.getCart(cart.id);
    const existingItem = existingCart?.items.find(
      (i) => i.variantId === variantId,
    );
    const totalDesiredQuantity = (existingItem?.quantity ?? 0) + quantity;

    if (foundVariant.stock < totalDesiredQuantity) {
      throw new AppError(
        400,
        'INSUFFICIENT_STOCK',
        `Insufficient stock for ${foundProduct.name} (${foundVariant.sizeLabel}). Available: ${foundVariant.stock}`,
      );
    }

    await this.cartRepository.addItem(cart.id, variantId, quantity);
    const cartDetail = await this.getCartDetail(cart.id);
    return {
      cartToken: cart.token,
      cart: cartDetail,
    };
  }

  async updateItemQuantity(
    cartTokenOrId: string,
    variantId: string,
    quantity: number,
  ): Promise<CartDetail> {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Quantity must be a non-negative integer',
      );
    }

    const cart = await this.cartRepository.getCart(cartTokenOrId);
    if (!cart) {
      throw new AppError(404, 'NOT_FOUND', 'Cart was not found');
    }

    if (quantity > 0) {
      const productList = await this.catalogRepository.listProducts({
        page: 1,
        pageSize: 100,
      });
      let foundVariant = null;
      for (const p of productList.items) {
        const v = p.variants.find((item) => item.id === variantId);
        if (v) {
          foundVariant = v;
          break;
        }
      }
      if (foundVariant && foundVariant.stock < quantity) {
        throw new AppError(
          400,
          'INSUFFICIENT_STOCK',
          `Insufficient stock available. Requested: ${quantity}, Available: ${foundVariant.stock}`,
        );
      }
    }

    await this.cartRepository.updateItemQuantity(cart.id, variantId, quantity);
    return this.getCartDetail(cart.id);
  }

  async removeItem(
    cartTokenOrId: string,
    variantId: string,
  ): Promise<CartDetail> {
    const cart = await this.cartRepository.getCart(cartTokenOrId);
    if (!cart) {
      throw new AppError(404, 'NOT_FOUND', 'Cart was not found');
    }
    await this.cartRepository.removeItem(cart.id, variantId);
    return this.getCartDetail(cart.id);
  }

  async clearCart(cartTokenOrId: string): Promise<CartDetail> {
    const cart = await this.cartRepository.getCart(cartTokenOrId);
    if (!cart) {
      throw new AppError(404, 'NOT_FOUND', 'Cart was not found');
    }
    await this.cartRepository.clearCart(cart.id);
    return this.getCartDetail(cart.id);
  }
}
