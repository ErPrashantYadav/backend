export interface CartItemDetail {
  id: string;
  variantId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  };
  variant: {
    id: string;
    sku: string;
    sizeLabel: string;
    sizeMilliliters: number;
    price: string;
    discountedPrice: string;
    isActive: boolean;
  };
  unitPrice: string;
  discountedUnitPrice: string;
  subtotal: string;
  isAvailable: boolean;
  insufficientStock: boolean;
  statusMessage?: string;
}

export interface CartDetail {
  id: string;
  token: string;
  items: CartItemDetail[];
  itemCount: number;
  subtotal: string;
  discountTotal: string;
  total: string;
  hasUnavailableItems: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartRawItem {
  id: string;
  cartId: string;
  variantId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartRawRecord {
  id: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  items: CartRawItem[];
}

export interface CartRepository {
  getOrCreateCart(
    cartTokenOrId?: string,
  ): Promise<{ id: string; token: string }>;
  getCart(cartTokenOrId: string): Promise<CartRawRecord | null>;
  addItem(cartId: string, variantId: string, quantity: number): Promise<void>;
  updateItemQuantity(
    cartId: string,
    variantId: string,
    quantity: number,
  ): Promise<void>;
  removeItem(cartId: string, variantId: string): Promise<void>;
  clearCart(cartId: string): Promise<void>;
}
