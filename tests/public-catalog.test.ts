import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { AppError } from '../src/errors/app-error';
import type {
  BrandRecord,
  CatalogRepository,
  CategoryRecord,
  PageResult,
  ProductDetailRecord,
  ProductImageRecord,
  ProductImageWriteInput,
  ProductRecord,
  ProductVariantRecord,
  ProductVariantWriteInput,
  ProductWriteInput,
} from '../src/modules/catalog/catalog.types';
import { calculateDiscountedPrice } from '../src/modules/catalog/catalog.service';
import { testConfig } from './helpers';

class MemoryPublicCatalogRepository implements CatalogRepository {
  categories: CategoryRecord[] = [];
  brands: BrandRecord[] = [];
  products: ProductRecord[] = [];
  variants: ProductVariantRecord[] = [];
  private nextId = 100;

  private id(): string {
    this.nextId += 1;
    return `30000000-0000-4000-8000-${this.nextId.toString().padStart(12, '0')}`;
  }

  async listCategories(input: {
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }): Promise<PageResult<CategoryRecord>> {
    let list = this.categories;
    if (input.isActive !== undefined) {
      list = list.filter((c) => c.isActive === input.isActive);
    }
    if (input.search) {
      const q = input.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    const start = (input.page - 1) * input.pageSize;
    return {
      items: list.slice(start, start + input.pageSize),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total: list.length,
        totalPages: Math.ceil(list.length / input.pageSize) || 0,
      },
    };
  }

  async findCategory(id: string): Promise<CategoryRecord | null> {
    return this.categories.find((c) => c.id === id || c.slug === id) ?? null;
  }

  async createCategory(
    input: Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CategoryRecord> {
    const c: CategoryRecord = {
      id: this.id(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };
    this.categories.push(c);
    return c;
  }

  async updateCategory(
    id: string,
    input: Partial<Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<CategoryRecord> {
    const c = await this.findCategory(id);
    if (!c) throw new AppError(404, 'NOT_FOUND', 'Category not found');
    Object.assign(c, input, { updatedAt: new Date() });
    return c;
  }

  async deleteCategory(id: string): Promise<void> {
    this.categories = this.categories.filter((c) => c.id !== id);
  }

  async listBrands(input: {
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }): Promise<PageResult<BrandRecord>> {
    let list = this.brands;
    if (input.isActive !== undefined) {
      list = list.filter((b) => b.isActive === input.isActive);
    }
    if (input.search) {
      const q = input.search.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    const start = (input.page - 1) * input.pageSize;
    return {
      items: list.slice(start, start + input.pageSize),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total: list.length,
        totalPages: Math.ceil(list.length / input.pageSize) || 0,
      },
    };
  }

  async findBrand(id: string): Promise<BrandRecord | null> {
    return this.brands.find((b) => b.id === id || b.slug === id) ?? null;
  }

  async createBrand(
    input: Omit<BrandRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BrandRecord> {
    const b: BrandRecord = {
      id: this.id(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };
    this.brands.push(b);
    return b;
  }

  async updateBrand(
    id: string,
    input: Partial<Omit<BrandRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BrandRecord> {
    const b = await this.findBrand(id);
    if (!b) throw new AppError(404, 'NOT_FOUND', 'Brand not found');
    Object.assign(b, input, { updatedAt: new Date() });
    return b;
  }

  async deleteBrand(id: string): Promise<void> {
    this.brands = this.brands.filter((b) => b.id !== id);
  }

  async listProducts(input: {
    page: number;
    pageSize: number;
    search?: string;
    categoryId?: string;
    brandId?: string;
    isActive?: boolean;
    categoryIsActive?: boolean;
    brandIsActive?: boolean;
    sortBy?: 'name_asc' | 'name_desc' | 'newest';
  }): Promise<PageResult<ProductRecord>> {
    let list = this.products;
    if (input.isActive !== undefined) {
      list = list.filter((p) => p.isActive === input.isActive);
    }
    if (input.categoryId) {
      list = list.filter((p) => p.categoryId === input.categoryId);
    }
    if (input.brandId) {
      list = list.filter((p) => p.brandId === input.brandId);
    }
    if (input.categoryIsActive !== undefined) {
      list = list.filter((p) => {
        const cat = this.categories.find((c) => c.id === p.categoryId);
        return cat?.isActive === input.categoryIsActive;
      });
    }
    if (input.brandIsActive !== undefined) {
      list = list.filter((p) => {
        const b = this.brands.find((br) => br.id === p.brandId);
        return b?.isActive === input.brandIsActive;
      });
    }
    if (input.search) {
      const q = input.search.toLowerCase();
      list = list.filter((p) => {
        const matchingSku = p.variants.some((v) =>
          v.sku.toLowerCase().includes(q),
        );
        return (
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          matchingSku
        );
      });
    }

    if (input.sortBy === 'name_desc') {
      list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (input.sortBy === 'newest') {
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const start = (input.page - 1) * input.pageSize;
    const items = list.slice(start, start + input.pageSize).map((p) => {
      const cat = this.categories.find((c) => c.id === p.categoryId)!;
      const brand = this.brands.find((b) => b.id === p.brandId)!;
      return {
        ...p,
        category: {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          isActive: cat.isActive,
        },
        brand: {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          isActive: brand.isActive,
        },
        variants: this.variants.filter((v) => v.productId === p.id),
      };
    });

    return {
      items,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total: list.length,
        totalPages: Math.ceil(list.length / input.pageSize) || 0,
      },
    };
  }

  async findProduct(id: string): Promise<ProductDetailRecord | null> {
    const p = this.products.find((prod) => prod.id === id || prod.slug === id);
    if (!p) return null;
    const cat = this.categories.find((c) => c.id === p.categoryId)!;
    const brand = this.brands.find((b) => b.id === p.brandId)!;
    return {
      ...p,
      category: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        isActive: cat.isActive,
      },
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        isActive: brand.isActive,
      },
      images: [],
      variants: this.variants.filter((v) => v.productId === p.id),
    };
  }

  async createProduct(input: ProductWriteInput): Promise<ProductDetailRecord> {
    const cat = this.categories.find((c) => c.id === input.categoryId)!;
    const brand = this.brands.find((b) => b.id === input.brandId)!;
    const p: ProductRecord = {
      id: this.id(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
      category: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        isActive: cat.isActive,
      },
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        isActive: brand.isActive,
      },
      images: [],
      variants: [],
    };
    this.products.push(p);
    return (await this.findProduct(p.id))!;
  }

  async updateProduct(
    id: string,
    input: Partial<ProductWriteInput>,
  ): Promise<ProductDetailRecord> {
    const p = this.products.find((prod) => prod.id === id);
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    Object.assign(p, input, { updatedAt: new Date() });
    return (await this.findProduct(id))!;
  }

  async deactivateProduct(id: string): Promise<void> {
    const p = this.products.find((prod) => prod.id === id);
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    p.isActive = false;
  }

  async listProductImages(): Promise<ProductImageRecord[]> {
    return [];
  }
  async createProductImage(
    _productId: string,
    _input: ProductImageWriteInput,
  ): Promise<ProductImageRecord> {
    throw new Error('unused');
  }
  async updateProductImage(
    _productId: string,
    _imageId: string,
    _input: Partial<ProductImageWriteInput>,
  ): Promise<ProductImageRecord> {
    throw new Error('unused');
  }
  async deleteProductImage(
    _productId: string,
    _imageId: string,
  ): Promise<void> {
    throw new Error('unused');
  }

  async createProductVariant(
    productId: string,
    input: ProductVariantWriteInput,
  ): Promise<ProductVariantRecord> {
    const v: ProductVariantRecord = {
      id: this.id(),
      productId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };
    this.variants.push(v);
    return v;
  }

  async updateProductVariant(
    productId: string,
    variantId: string,
    input: Partial<ProductVariantWriteInput>,
  ): Promise<ProductVariantRecord> {
    const v = this.variants.find(
      (item) => item.id === variantId && item.productId === productId,
    );
    if (!v)
      throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
    Object.assign(v, input, { updatedAt: new Date() });
    return v;
  }

  async deactivateProductVariant(
    productId: string,
    variantId: string,
  ): Promise<void> {
    const v = this.variants.find(
      (item) => item.id === variantId && item.productId === productId,
    );
    if (!v)
      throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
    v.isActive = false;
  }
}

describe('Public Storefront Catalog API', () => {
  it('correctly calculates percentage and fixed discounts clamped at zero', () => {
    // Percentage discount (20% off 50.00 -> 40.00)
    expect(calculateDiscountedPrice('50.00', 'PERCENTAGE', '20.00')).toBe(
      '40.00',
    );
    // Percentage discount (15% off 25.50 -> 21.675 -> 21.68)
    expect(calculateDiscountedPrice('25.50', 'PERCENTAGE', '15.00')).toBe(
      '21.68',
    );
    // Fixed discount ($10.00 off 35.00 -> 25.00)
    expect(calculateDiscountedPrice('35.00', 'FIXED', '10.00')).toBe('25.00');
    // Fixed discount exceeds price ($10.00 off 5.00 -> 0.00, clamped at zero)
    expect(calculateDiscountedPrice('5.00', 'FIXED', '10.00')).toBe('0.00');
    // No discount
    expect(calculateDiscountedPrice('19.99', null, null)).toBe('19.99');
  });

  it('provides public category and brand listings, excluding inactive entries', async () => {
    const catalogRepo = new MemoryPublicCatalogRepository();
    const app = createApp(testConfig(), async () => {}, {
      catalogRepository: catalogRepo,
    });

    const activeCat = await catalogRepo.createCategory({
      name: 'Whiskey',
      slug: 'whiskey',
      description: 'Fine distilled whiskey',
      imageUrl: 'https://cdn.example.test/whiskey.webp',
      isActive: true,
    });
    await catalogRepo.createCategory({
      name: 'Inactive Category',
      slug: 'inactive-category',
      description: 'Should not appear',
      imageUrl: null,
      isActive: false,
    });

    const activeBrand = await catalogRepo.createBrand({
      name: 'Highland Park',
      slug: 'highland-park',
      logoUrl: 'https://cdn.example.test/hp-logo.webp',
      isActive: true,
    });
    await catalogRepo.createBrand({
      name: 'Inactive Brand',
      slug: 'inactive-brand',
      logoUrl: null,
      isActive: false,
    });

    // 1. GET /api/catalog/categories
    const catRes = await request(app).get('/api/catalog/categories');
    expect(catRes.status).toBe(200);
    expect(catRes.body.data.items).toHaveLength(1);
    expect(catRes.body.data.items[0]).toEqual({
      id: activeCat.id,
      name: 'Whiskey',
      slug: 'whiskey',
      description: 'Fine distilled whiskey',
      imageUrl: 'https://cdn.example.test/whiskey.webp',
    });
    // Inactive category is excluded
    expect(
      catRes.body.data.items.some(
        (c: { slug: string }) => c.slug === 'inactive-category',
      ),
    ).toBe(false);

    // 2. GET /api/catalog/brands
    const brandRes = await request(app).get('/api/catalog/brands');
    expect(brandRes.status).toBe(200);
    expect(brandRes.body.data.items).toHaveLength(1);
    expect(brandRes.body.data.items[0]).toEqual({
      id: activeBrand.id,
      name: 'Highland Park',
      slug: 'highland-park',
      logoUrl: 'https://cdn.example.test/hp-logo.webp',
    });
    // Inactive brand is excluded
    expect(
      brandRes.body.data.items.some(
        (b: { slug: string }) => b.slug === 'inactive-brand',
      ),
    ).toBe(false);
  });

  it('lists active products with safe response fields, excluding sensitive admin/inventory data', async () => {
    const catalogRepo = new MemoryPublicCatalogRepository();
    const app = createApp(testConfig(), async () => {}, {
      catalogRepository: catalogRepo,
    });

    const cat = await catalogRepo.createCategory({
      name: 'Rum',
      slug: 'rum',
      description: null,
      imageUrl: null,
      isActive: true,
    });
    const brand = await catalogRepo.createBrand({
      name: 'Kraken',
      slug: 'kraken',
      logoUrl: null,
      isActive: true,
    });

    // Active product with fixed discount
    const prod = await catalogRepo.createProduct({
      categoryId: cat.id,
      brandId: brand.id,
      name: 'Kraken Black Spiced Rum',
      slug: 'kraken-black-spiced-rum',
      description: 'Dark spiced rum',
      discountType: 'FIXED',
      discountValue: '5.00',
      isActive: true,
    });

    // Active variant with stock > 0
    const v1 = await catalogRepo.createProductVariant(prod.id, {
      sku: 'KRK-750ML',
      sizeLabel: '750 ml',
      sizeMilliliters: 750,
      purchasePrice: '12.00',
      sellingPrice: '28.00',
      stock: 15,
      lowStockThreshold: 3,
      isActive: true,
    });

    // Active variant with stock = 0 (out of stock)
    const v2 = await catalogRepo.createProductVariant(prod.id, {
      sku: 'KRK-1000ML',
      sizeLabel: '1000 ml',
      sizeMilliliters: 1000,
      purchasePrice: '16.00',
      sellingPrice: '38.00',
      stock: 0,
      lowStockThreshold: 2,
      isActive: true,
    });

    // Inactive variant (should be completely omitted from public response)
    await catalogRepo.createProductVariant(prod.id, {
      sku: 'KRK-INACTIVE',
      sizeLabel: '50 ml',
      sizeMilliliters: 50,
      purchasePrice: '2.00',
      sellingPrice: '5.00',
      stock: 10,
      lowStockThreshold: 1,
      isActive: false,
    });

    // Inactive product (should not appear in list)
    await catalogRepo.createProduct({
      categoryId: cat.id,
      brandId: brand.id,
      name: 'Secret Inactive Rum',
      slug: 'secret-inactive-rum',
      description: null,
      discountType: null,
      discountValue: null,
      isActive: false,
    });

    const res = await request(app).get('/api/catalog/products');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);

    const publicProduct = res.body.data.items[0];
    expect(publicProduct.id).toBe(prod.id);
    expect(publicProduct.name).toBe('Kraken Black Spiced Rum');
    expect(publicProduct.discount).toEqual({
      type: 'FIXED',
      value: '5.00',
    });

    // Only active variants returned
    expect(publicProduct.variants).toHaveLength(2);
    const v1Response = publicProduct.variants.find(
      (v: { id: string }) => v.id === v1.id,
    );
    const v2Response = publicProduct.variants.find(
      (v: { id: string }) => v.id === v2.id,
    );

    // v1: in stock, $5 off $28 = $23.00
    expect(v1Response).toMatchObject({
      id: v1.id,
      sku: 'KRK-750ML',
      sizeLabel: '750 ml',
      sizeMilliliters: 750,
      price: '28.00',
      discountedPrice: '23.00',
      isAvailable: true,
      inStock: true,
    });

    // v2: out of stock, $5 off $38 = $33.00
    expect(v2Response).toMatchObject({
      id: v2.id,
      sku: 'KRK-1000ML',
      sizeLabel: '1000 ml',
      sizeMilliliters: 1000,
      price: '38.00',
      discountedPrice: '33.00',
      isAvailable: false,
      inStock: false,
    });

    // SENSITIVITY CHECK: verify purchasePrice, stock count, and lowStockThreshold are NOT exposed!
    expect(v1Response.purchasePrice).toBeUndefined();
    expect(v1Response.stock).toBeUndefined();
    expect(v1Response.lowStockThreshold).toBeUndefined();
    expect(v2Response.purchasePrice).toBeUndefined();
    expect(v2Response.stock).toBeUndefined();
    expect(v2Response.lowStockThreshold).toBeUndefined();
  });

  it('fetches a single product by ID or slug, but returns 404 for inactive products', async () => {
    const catalogRepo = new MemoryPublicCatalogRepository();
    const app = createApp(testConfig(), async () => {}, {
      catalogRepository: catalogRepo,
    });

    const cat = await catalogRepo.createCategory({
      name: 'Vodka',
      slug: 'vodka',
      description: null,
      imageUrl: null,
      isActive: true,
    });
    const brand = await catalogRepo.createBrand({
      name: 'Grey Goose',
      slug: 'grey-goose',
      logoUrl: null,
      isActive: true,
    });

    const activeProduct = await catalogRepo.createProduct({
      categoryId: cat.id,
      brandId: brand.id,
      name: 'Grey Goose Vodka',
      slug: 'grey-goose-vodka',
      description: 'French vodka',
      discountType: 'PERCENTAGE',
      discountValue: '10.00',
      isActive: true,
    });

    await catalogRepo.createProductVariant(activeProduct.id, {
      sku: 'GG-750ML',
      sizeLabel: '750 ml',
      sizeMilliliters: 750,
      purchasePrice: '25.00',
      sellingPrice: '45.00',
      stock: 8,
      lowStockThreshold: 2,
      isActive: true,
    });

    const inactiveProduct = await catalogRepo.createProduct({
      categoryId: cat.id,
      brandId: brand.id,
      name: 'Discontinued Vodka',
      slug: 'discontinued-vodka',
      description: null,
      discountType: null,
      discountValue: null,
      isActive: false,
    });

    // Query active product by UUID
    const idRes = await request(app).get(
      `/api/catalog/products/${activeProduct.id}`,
    );
    expect(idRes.status).toBe(200);
    expect(idRes.body.data.id).toBe(activeProduct.id);
    expect(idRes.body.data.variants[0].discountedPrice).toBe('40.50'); // 10% off $45.00

    // Query active product by slug
    const slugRes = await request(app).get(
      '/api/catalog/products/grey-goose-vodka',
    );
    expect(slugRes.status).toBe(200);
    expect(slugRes.body.data.id).toBe(activeProduct.id);

    // Query inactive product by UUID -> 404 NOT_FOUND
    const inactiveRes = await request(app).get(
      `/api/catalog/products/${inactiveProduct.id}`,
    );
    expect(inactiveRes.status).toBe(404);
    expect(inactiveRes.body.error.code).toBe('NOT_FOUND');

    // Query non-existent product -> 404 NOT_FOUND
    const missingRes = await request(app).get(
      '/api/catalog/products/non-existent-product',
    );
    expect(missingRes.status).toBe(404);
    expect(missingRes.body.error.code).toBe('NOT_FOUND');
  });

  it('supports pagination, search, category/brand filters, and sorting on public products', async () => {
    const catalogRepo = new MemoryPublicCatalogRepository();
    const app = createApp(testConfig(), async () => {}, {
      catalogRepository: catalogRepo,
    });

    const catWhiskey = await catalogRepo.createCategory({
      name: 'Whiskey',
      slug: 'whiskey',
      description: null,
      imageUrl: null,
      isActive: true,
    });
    const catGin = await catalogRepo.createCategory({
      name: 'Gin',
      slug: 'gin',
      description: null,
      imageUrl: null,
      isActive: true,
    });

    const brandA = await catalogRepo.createBrand({
      name: 'Ardbeg',
      slug: 'ardbeg',
      logoUrl: null,
      isActive: true,
    });
    const brandB = await catalogRepo.createBrand({
      name: 'Bombay',
      slug: 'bombay',
      logoUrl: null,
      isActive: true,
    });

    const p1 = await catalogRepo.createProduct({
      categoryId: catWhiskey.id,
      brandId: brandA.id,
      name: 'Ardbeg 10 Year Old',
      slug: 'ardbeg-10-year-old',
      description: 'Peaty Islay malt',
      discountType: null,
      discountValue: null,
      isActive: true,
    });
    await catalogRepo.createProductVariant(p1.id, {
      sku: 'ARD-10-750',
      sizeLabel: '750 ml',
      sizeMilliliters: 750,
      purchasePrice: '40.00',
      sellingPrice: '65.00',
      stock: 5,
      lowStockThreshold: 1,
      isActive: true,
    });

    const p2 = await catalogRepo.createProduct({
      categoryId: catWhiskey.id,
      brandId: brandA.id,
      name: 'Ardbeg An Oa',
      slug: 'ardbeg-an-oa',
      description: 'Smoky whiskey',
      discountType: 'FIXED',
      discountValue: '10.00',
      isActive: true,
    });
    await catalogRepo.createProductVariant(p2.id, {
      sku: 'ARD-OA-750',
      sizeLabel: '750 ml',
      sizeMilliliters: 750,
      purchasePrice: '45.00',
      sellingPrice: '75.00',
      stock: 4,
      lowStockThreshold: 1,
      isActive: true,
    });

    const p3 = await catalogRepo.createProduct({
      categoryId: catGin.id,
      brandId: brandB.id,
      name: 'Bombay Sapphire',
      slug: 'bombay-sapphire',
      description: 'Botanical dry gin',
      discountType: null,
      discountValue: null,
      isActive: true,
    });
    await catalogRepo.createProductVariant(p3.id, {
      sku: 'BOM-750',
      sizeLabel: '750 ml',
      sizeMilliliters: 750,
      purchasePrice: '15.00',
      sellingPrice: '25.00',
      stock: 20,
      lowStockThreshold: 5,
      isActive: true,
    });

    // 1. Category filter: only Whiskey
    const whiskeyRes = await request(app).get(
      `/api/catalog/products?categoryId=${catWhiskey.id}`,
    );
    expect(whiskeyRes.status).toBe(200);
    expect(whiskeyRes.body.data.items).toHaveLength(2);
    expect(
      whiskeyRes.body.data.items.every(
        (p: { category: { id: string } }) => p.category.id === catWhiskey.id,
      ),
    ).toBe(true);

    // 2. Brand filter: only Bombay
    const bombayRes = await request(app).get(
      `/api/catalog/products?brandId=${brandB.id}`,
    );
    expect(bombayRes.status).toBe(200);
    expect(bombayRes.body.data.items).toHaveLength(1);
    expect(bombayRes.body.data.items[0].name).toBe('Bombay Sapphire');

    // 3. Search filter by text: 'peaty'
    const searchRes = await request(app).get('/api/catalog/products?q=10 Year');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.items).toHaveLength(1);
    expect(searchRes.body.data.items[0].name).toBe('Ardbeg 10 Year Old');

    // 4. Sorting: price_asc (Bombay at $25, Ardbeg 10 at $65, Ardbeg An Oa at $65 after $10 discount)
    const priceAscRes = await request(app).get(
      '/api/catalog/products?sortBy=price_asc',
    );
    expect(priceAscRes.status).toBe(200);
    expect(priceAscRes.body.data.items[0].name).toBe('Bombay Sapphire');

    // 5. Sorting: name_desc
    const nameDescRes = await request(app).get(
      '/api/catalog/products?sortBy=name_desc',
    );
    expect(nameDescRes.status).toBe(200);
    expect(nameDescRes.body.data.items[0].name).toBe('Bombay Sapphire');
    expect(nameDescRes.body.data.items[2].name).toBe('Ardbeg 10 Year Old');

    // 6. Pagination
    const pageRes = await request(app).get(
      '/api/catalog/products?page=1&pageSize=2',
    );
    expect(pageRes.status).toBe(200);
    expect(pageRes.body.data.items).toHaveLength(2);
    expect(pageRes.body.data.pagination).toEqual({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it('keeps admin endpoints protected while public endpoints remain open', async () => {
    const catalogRepo = new MemoryPublicCatalogRepository();
    const app = createApp(testConfig(), async () => {}, {
      catalogRepository: catalogRepo,
    });

    // Public endpoints are open
    expect((await request(app).get('/api/catalog/categories')).status).toBe(
      200,
    );
    expect((await request(app).get('/api/catalog/brands')).status).toBe(200);
    expect((await request(app).get('/api/catalog/products')).status).toBe(200);

    // Admin endpoints require auth
    expect((await request(app).get('/api/admin/categories')).status).toBe(401);
    expect((await request(app).get('/api/admin/brands')).status).toBe(401);
    expect((await request(app).get('/api/admin/products')).status).toBe(401);
  });
});
