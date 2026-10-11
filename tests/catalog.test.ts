import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors/app-error';
import { createApp } from '../src/app';
import { createAdminAccessToken } from '../src/modules/auth/access-token';
import type { AdminAuthRepository } from '../src/modules/auth/auth.types';
import { testConfig } from './helpers';
import type {
  BrandRecord,
  CatalogRepository,
  CategoryRecord,
  PageResult,
  ProductImageRecord,
  ProductRecord,
  ProductVariantRecord,
  ProductWriteInput,
  ProductImageWriteInput,
  ProductVariantWriteInput,
} from '../src/modules/catalog/catalog.types';

function page<T>(
  items: T[],
  input: { page: number; pageSize: number },
): PageResult<T> {
  const start = (input.page - 1) * input.pageSize;
  return {
    items: items.slice(start, start + input.pageSize),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / input.pageSize),
    },
  };
}

class MemoryCatalogRepository implements CatalogRepository {
  categories: CategoryRecord[] = [];
  brands: BrandRecord[] = [];
  products: ProductRecord[] = [];
  images: ProductImageRecord[] = [];
  variants: ProductVariantRecord[] = [];
  private nextId = 100;

  private id(): string {
    this.nextId += 1;
    return `10000000-0000-4000-8000-${this.nextId.toString().padStart(12, '0')}`;
  }

  async listCategories(input: {
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }) {
    const filtered = this.categories.filter(
      (category) =>
        (input.isActive === undefined ||
          category.isActive === input.isActive) &&
        (!input.search ||
          `${category.name} ${category.slug}`
            .toLowerCase()
            .includes(input.search.toLowerCase())),
    );
    return page(filtered, input);
  }

  async findCategory(id: string) {
    return this.categories.find((category) => category.id === id) ?? null;
  }

  async createCategory(
    input: Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    if (this.categories.some((category) => category.slug === input.slug)) {
      throw new AppError(
        409,
        'DUPLICATE_RESOURCE',
        'Category slug already exists',
      );
    }
    const now = new Date();
    const row = { ...input, id: this.id(), createdAt: now, updatedAt: now };
    this.categories.push(row);
    return row;
  }

  async updateCategory(
    id: string,
    input: Partial<Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ) {
    const row = this.categories.find((category) => category.id === id);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Category was not found');
    if (
      input.slug &&
      this.categories.some(
        (category) => category.id !== id && category.slug === input.slug,
      )
    ) {
      throw new AppError(
        409,
        'DUPLICATE_RESOURCE',
        'Category slug already exists',
      );
    }
    Object.assign(row, input, { updatedAt: new Date() });
    return row;
  }

  async deleteCategory(id: string) {
    if (!this.categories.some((category) => category.id === id))
      throw new AppError(404, 'NOT_FOUND', 'Category was not found');
    if (this.products.some((product) => product.categoryId === id)) {
      throw new AppError(
        409,
        'CATEGORY_IN_USE',
        'Category has products; deactivate it instead of deleting',
      );
    }
    this.categories = this.categories.filter((category) => category.id !== id);
  }

  async listBrands(input: {
    page: number;
    pageSize: number;
    search?: string;
    isActive?: boolean;
  }) {
    const filtered = this.brands.filter(
      (brand) =>
        (input.isActive === undefined || brand.isActive === input.isActive) &&
        (!input.search ||
          `${brand.name} ${brand.slug}`
            .toLowerCase()
            .includes(input.search.toLowerCase())),
    );
    return page(filtered, input);
  }

  async findBrand(id: string) {
    return this.brands.find((brand) => brand.id === id) ?? null;
  }

  async createBrand(
    input: Omit<BrandRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    if (this.brands.some((brand) => brand.slug === input.slug)) {
      throw new AppError(
        409,
        'DUPLICATE_RESOURCE',
        'Brand slug already exists',
      );
    }
    const now = new Date();
    const row = { ...input, id: this.id(), createdAt: now, updatedAt: now };
    this.brands.push(row);
    return row;
  }

  async updateBrand(
    id: string,
    input: Partial<Omit<BrandRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ) {
    const row = this.brands.find((brand) => brand.id === id);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Brand was not found');
    if (
      input.slug &&
      this.brands.some((brand) => brand.id !== id && brand.slug === input.slug)
    ) {
      throw new AppError(
        409,
        'DUPLICATE_RESOURCE',
        'Brand slug already exists',
      );
    }
    Object.assign(row, input, { updatedAt: new Date() });
    return row;
  }

  async deleteBrand(id: string) {
    if (!this.brands.some((brand) => brand.id === id))
      throw new AppError(404, 'NOT_FOUND', 'Brand was not found');
    if (this.products.some((product) => product.brandId === id)) {
      throw new AppError(
        409,
        'BRAND_IN_USE',
        'Brand has products; deactivate it instead of deleting',
      );
    }
    this.brands = this.brands.filter((brand) => brand.id !== id);
  }

  async listProducts(input: {
    page: number;
    pageSize: number;
    search?: string;
    categoryId?: string;
    brandId?: string;
    isActive?: boolean;
  }) {
    const filtered = this.products.filter(
      (product) =>
        (input.isActive === undefined || product.isActive === input.isActive) &&
        (!input.categoryId || product.categoryId === input.categoryId) &&
        (!input.brandId || product.brandId === input.brandId) &&
        (!input.search ||
          `${product.name} ${product.slug} ${product.variants.map((variant) => variant.sku).join(' ')}`
            .toLowerCase()
            .includes(input.search.toLowerCase())),
    );
    return page(filtered, input);
  }

  async findProduct(id: string) {
    return this.products.find((product) => product.id === id) ?? null;
  }

  async createProduct(input: ProductWriteInput) {
    if (this.products.some((product) => product.slug === input.slug))
      throw new AppError(
        409,
        'DUPLICATE_RESOURCE',
        'Product slug already exists',
      );
    const category = this.categories.find(
      (item) => item.id === input.categoryId && item.isActive,
    );
    const brand = this.brands.find(
      (item) => item.id === input.brandId && item.isActive,
    );
    if (!category)
      throw new AppError(
        400,
        'INVALID_CATEGORY',
        'An active category is required',
      );
    if (!brand)
      throw new AppError(400, 'INVALID_BRAND', 'An active brand is required');
    const now = new Date();
    const row: ProductRecord = {
      ...input,
      id: this.id(),
      createdAt: now,
      updatedAt: now,
      category: { id: category.id, name: category.name, slug: category.slug },
      brand: { id: brand.id, name: brand.name, slug: brand.slug },
      images: [],
      variants: [],
    };
    this.products.push(row);
    return row;
  }

  async updateProduct(id: string, input: Partial<ProductWriteInput>) {
    const row = this.products.find((product) => product.id === id);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Product was not found');
    if (
      input.slug &&
      this.products.some(
        (product) => product.id !== id && product.slug === input.slug,
      )
    )
      throw new AppError(
        409,
        'DUPLICATE_RESOURCE',
        'Product slug already exists',
      );
    const categoryId = input.categoryId ?? row.categoryId;
    const brandId = input.brandId ?? row.brandId;
    const category = this.categories.find(
      (item) => item.id === categoryId && item.isActive,
    );
    const brand = this.brands.find(
      (item) => item.id === brandId && item.isActive,
    );
    if (!category)
      throw new AppError(
        400,
        'INVALID_CATEGORY',
        'An active category is required',
      );
    if (!brand)
      throw new AppError(400, 'INVALID_BRAND', 'An active brand is required');
    Object.assign(row, input, {
      categoryId,
      brandId,
      category: { id: category.id, name: category.name, slug: category.slug },
      brand: { id: brand.id, name: brand.name, slug: brand.slug },
      updatedAt: new Date(),
    });
    return row;
  }

  async deactivateProduct(id: string) {
    const product = this.products.find((item) => item.id === id);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product was not found');
    product.isActive = false;
  }

  async createProductImage(productId: string, input: ProductImageWriteInput) {
    const product = this.products.find((item) => item.id === productId);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product was not found');
    const now = new Date();
    const image = {
      ...input,
      id: this.id(),
      productId,
      createdAt: now,
      updatedAt: now,
    };
    this.images.push(image);
    product.images.push(image);
    return image;
  }

  async updateProductImage(
    productId: string,
    imageId: string,
    input: Partial<ProductImageWriteInput>,
  ) {
    const image = this.images.find(
      (item) => item.productId === productId && item.id === imageId,
    );
    if (!image)
      throw new AppError(404, 'NOT_FOUND', 'Product image was not found');
    Object.assign(image, input, { updatedAt: new Date() });
    return image;
  }

  async deleteProductImage(productId: string, imageId: string) {
    const image = this.images.find(
      (item) => item.productId === productId && item.id === imageId,
    );
    if (!image)
      throw new AppError(404, 'NOT_FOUND', 'Product image was not found');
    this.images = this.images.filter((item) => item.id !== imageId);
    const product = this.products.find((item) => item.id === productId);
    if (product)
      product.images = product.images.filter((item) => item.id !== imageId);
  }

  async createProductVariant(
    productId: string,
    input: ProductVariantWriteInput,
  ) {
    const product = this.products.find((item) => item.id === productId);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product was not found');
    if (this.variants.some((variant) => variant.sku === input.sku))
      throw new AppError(409, 'DUPLICATE_RESOURCE', 'SKU already exists');
    if (
      product.variants.some(
        (variant) => variant.sizeMilliliters === input.sizeMilliliters,
      )
    )
      throw new AppError(
        409,
        'DUPLICATE_RESOURCE',
        'Product size already exists',
      );
    const now = new Date();
    const variant = {
      ...input,
      id: this.id(),
      productId,
      createdAt: now,
      updatedAt: now,
    };
    this.variants.push(variant);
    product.variants.push(variant);
    return variant;
  }

  async updateProductVariant(
    productId: string,
    variantId: string,
    input: Partial<ProductVariantWriteInput>,
  ) {
    const variant = this.variants.find(
      (item) => item.productId === productId && item.id === variantId,
    );
    if (!variant)
      throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
    if (
      input.sku &&
      this.variants.some(
        (item) => item.id !== variantId && item.sku === input.sku,
      )
    )
      throw new AppError(409, 'DUPLICATE_RESOURCE', 'SKU already exists');
    if (
      input.sizeMilliliters &&
      this.products
        .find((item) => item.id === productId)
        ?.variants.some(
          (item) =>
            item.id !== variantId &&
            item.sizeMilliliters === input.sizeMilliliters,
        )
    )
      throw new AppError(
        409,
        'DUPLICATE_RESOURCE',
        'Product size already exists',
      );
    Object.assign(variant, input, { updatedAt: new Date() });
    return variant;
  }

  async deactivateProductVariant(productId: string, variantId: string) {
    const variant = this.variants.find(
      (item) => item.productId === productId && item.id === variantId,
    );
    if (!variant)
      throw new AppError(404, 'NOT_FOUND', 'Product variant was not found');
    variant.isActive = false;
  }
}

function catalogApp(
  repository: MemoryCatalogRepository,
  permissions: string[] = [
    'catalog.categories.read',
    'catalog.categories.create',
    'catalog.categories.update',
    'catalog.categories.delete',
    'catalog.brands.read',
    'catalog.brands.create',
    'catalog.brands.update',
    'catalog.brands.delete',
    'catalog.products.read',
    'catalog.products.create',
    'catalog.products.update',
    'catalog.products.delete',
    'catalog.product-images.read',
    'catalog.product-images.create',
    'catalog.product-images.update',
    'catalog.product-images.delete',
    'catalog.variants.read',
    'catalog.variants.create',
    'catalog.variants.update',
    'catalog.variants.delete',
  ],
) {
  const config = testConfig();
  const roleId = '10000000-0000-4000-8000-000000000100';
  const adminId = '10000000-0000-4000-8000-000000000101';
  const authRepository: AdminAuthRepository = {
    async findByEmail() {
      return null;
    },
    async findById(id) {
      if (id !== adminId) return null;
      return {
        id: adminId,
        email: 'catalog-admin@example.test',
        name: 'Catalog Admin',
        passwordHash: '$argon2id$unused-test-hash',
        isActive: true,
        role: {
          id: roleId,
          name: 'Catalog Admin',
          isActive: true,
          permissions,
        },
      };
    },
  };
  const app = createApp(config, async () => {}, {
    adminAuthRepository: authRepository,
    catalogRepository: repository,
  });
  return { app, token: createAdminAccessToken(config, adminId) };
}

describe('catalog management APIs', () => {
  it('creates, normalizes, searches and paginates categories and brands', async () => {
    const repository = new MemoryCatalogRepository();
    const { app, token } = catalogApp(repository);
    const headers = { Authorization: `Bearer ${token}` };
    const category = await request(app)
      .post('/api/admin/categories')
      .set(headers)
      .send({
        name: 'Spirits',
        slug: '  Spirits & WINE ',
        isActive: true,
      });
    expect(category.status).toBe(201);
    expect(category.body.data.slug).toBe('spirits-wine');
    const updatedCategory = await request(app)
      .patch(`/api/admin/categories/${category.body.data.id}`)
      .set(headers)
      .send({ slug: 'Spirits + Wine' });
    expect(updatedCategory.status).toBe(200);
    expect(updatedCategory.body.data.slug).toBe('spirits-wine');
    await request(app)
      .post('/api/admin/categories')
      .set(headers)
      .send({ name: 'Beer', slug: 'beer', isActive: true });
    const categoryList = await request(app)
      .get('/api/admin/categories?page=1&pageSize=1&q=spirits')
      .set(headers);
    expect(categoryList.status).toBe(200);
    expect(categoryList.body.data.items).toHaveLength(1);
    expect(categoryList.body.data.pagination.total).toBe(1);

    const brand = await request(app)
      .post('/api/admin/brands')
      .set(headers)
      .send({ name: 'Acme', slug: ' ACME ', isActive: true });
    expect(brand.status).toBe(201);
    expect(brand.body.data.slug).toBe('acme');
    const updatedBrand = await request(app)
      .patch(`/api/admin/brands/${brand.body.data.id}`)
      .set(headers)
      .send({ name: 'Acme Distilling' });
    expect(updatedBrand.status).toBe(200);
    expect(updatedBrand.body.data.name).toBe('Acme Distilling');
    const duplicate = await request(app)
      .post('/api/admin/brands')
      .set(headers)
      .send({ name: 'Other', slug: 'acme', isActive: true });
    expect(duplicate.status).toBe(409);
  });

  it('validates references and discounts and creates product-level discounts only', async () => {
    const repository = new MemoryCatalogRepository();
    const { app, token } = catalogApp(repository);
    const headers = { Authorization: `Bearer ${token}` };
    const category = await repository.createCategory({
      name: 'Spirits',
      slug: 'spirits',
      description: null,
      imageUrl: null,
      isActive: true,
    });
    const brand = await repository.createBrand({
      name: 'Acme',
      slug: 'acme',
      logoUrl: null,
      isActive: true,
    });
    const invalidRef = await request(app)
      .post('/api/admin/products')
      .set(headers)
      .send({
        categoryId: category.id,
        brandId: '10000000-0000-4000-8000-999999999999',
        name: 'Gin',
        slug: 'gin',
        isActive: true,
      });
    expect(invalidRef.status).toBe(400);
    expect(invalidRef.body.error.code).toBe('INVALID_BRAND');

    const mismatch = await request(app)
      .post('/api/admin/products')
      .set(headers)
      .send({
        categoryId: category.id,
        brandId: brand.id,
        name: 'Gin',
        slug: 'gin',
        discountType: 'FIXED',
        isActive: true,
      });
    expect(mismatch.status).toBe(400);
    const excessive = await request(app)
      .post('/api/admin/products')
      .set(headers)
      .send({
        categoryId: category.id,
        brandId: brand.id,
        name: 'Gin',
        slug: 'gin',
        discountType: 'PERCENTAGE',
        discountValue: 100.01,
        isActive: true,
      });
    expect(excessive.status).toBe(400);

    const created = await request(app)
      .post('/api/admin/products')
      .set(headers)
      .send({
        categoryId: category.id,
        brandId: brand.id,
        name: 'Gin',
        slug: ' GIN BRAND ',
        discountType: 'FIXED',
        discountValue: 12.5,
        isActive: true,
      });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('gin-brand');
    expect(created.body.data.discountValue).toBe('12.50');
    expect(created.body.data.variants).toEqual([]);
    expect(created.body.data).not.toHaveProperty('countryOfOrigin');
    expect(created.body.data).not.toHaveProperty('alcoholPercentage');
    const updated = await request(app)
      .patch(`/api/admin/products/${created.body.data.id}`)
      .set(headers)
      .send({ description: 'Updated product description' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.description).toBe('Updated product description');
  });

  it('normalizes variant size and SKU and rejects duplicate SKU/size and invalid numeric input', async () => {
    const repository = new MemoryCatalogRepository();
    const { app, token } = catalogApp(repository);
    const headers = { Authorization: `Bearer ${token}` };
    const category = await repository.createCategory({
      name: 'Spirits',
      slug: 'spirits',
      description: null,
      imageUrl: null,
      isActive: true,
    });
    const brand = await repository.createBrand({
      name: 'Acme',
      slug: 'acme',
      logoUrl: null,
      isActive: true,
    });
    const product = await request(app)
      .post('/api/admin/products')
      .set(headers)
      .send({
        categoryId: category.id,
        brandId: brand.id,
        name: 'Vodka',
        slug: 'vodka',
        isActive: true,
      });
    const productId = product.body.data.id;
    const variant = await request(app)
      .post(`/api/admin/products/${productId}/variants`)
      .set(headers)
      .send({
        sku: ' ab-750 ',
        size: '0.75 L',
        purchasePrice: 10.25,
        sellingPrice: 15.5,
        lowStockThreshold: 3,
        isActive: true,
      });
    expect(variant.status).toBe(201);
    expect(variant.body.data).toMatchObject({
      sku: 'AB-750',
      sizeLabel: '750 ml',
      sizeMilliliters: 750,
      purchasePrice: '10.25',
      sellingPrice: '15.50',
    });
    const variantList = await request(app)
      .get(`/api/admin/products/${productId}/variants`)
      .set(headers);
    expect(variantList.status).toBe(200);
    expect(variantList.body.data).toHaveLength(1);
    const variantDetail = await request(app)
      .get(`/api/admin/products/${productId}/variants/${variant.body.data.id}`)
      .set(headers);
    expect(variantDetail.status).toBe(200);
    const variantUpdate = await request(app)
      .patch(
        `/api/admin/products/${productId}/variants/${variant.body.data.id}`,
      )
      .set(headers)
      .send({ stock: 4 });
    expect(variantUpdate.status).toBe(200);
    expect(variantUpdate.body.data.stock).toBe(4);
    const duplicateSize = await request(app)
      .post(`/api/admin/products/${productId}/variants`)
      .set(headers)
      .send({
        sku: 'other',
        size: '750 ML',
        purchasePrice: 1,
        sellingPrice: 2,
        lowStockThreshold: 0,
        isActive: true,
      });
    expect(duplicateSize.status).toBe(409);
    const duplicateSku = await request(app)
      .post(`/api/admin/products/${productId}/variants`)
      .set(headers)
      .send({
        sku: 'AB-750',
        size: '1 L',
        purchasePrice: 1,
        sellingPrice: 2,
        lowStockThreshold: 0,
        isActive: true,
      });
    expect(duplicateSku.status).toBe(409);
    for (const size of ['0.0005 L', '750 oz', '0 ml']) {
      const invalidSize = await request(app)
        .post(`/api/admin/products/${productId}/variants`)
        .set(headers)
        .send({
          sku: `SKU-${size}`,
          size,
          purchasePrice: 1,
          sellingPrice: 2,
          lowStockThreshold: 0,
          isActive: true,
        });
      expect(invalidSize.status).toBe(400);
    }
    const invalidMoney = await request(app)
      .post(`/api/admin/products/${productId}/variants`)
      .set(headers)
      .send({
        sku: 'BAD-MONEY',
        size: '1 L',
        purchasePrice: -1,
        sellingPrice: 1.001,
        lowStockThreshold: -1,
        isActive: true,
      });
    expect(invalidMoney.status).toBe(400);
  });

  it('manages product images, soft-deletes products/variants, and rejects deletion of referenced catalogs', async () => {
    const repository = new MemoryCatalogRepository();
    const { app, token } = catalogApp(repository);
    const headers = { Authorization: `Bearer ${token}` };
    const category = await repository.createCategory({
      name: 'Spirits',
      slug: 'spirits',
      description: null,
      imageUrl: null,
      isActive: true,
    });
    const brand = await repository.createBrand({
      name: 'Acme',
      slug: 'acme',
      logoUrl: null,
      isActive: true,
    });
    const created = await request(app)
      .post('/api/admin/products')
      .set(headers)
      .send({
        categoryId: category.id,
        brandId: brand.id,
        name: 'Vodka',
        slug: 'vodka',
        isActive: true,
      });
    const productId = created.body.data.id;
    const image = await request(app)
      .post(`/api/admin/products/${productId}/images`)
      .set(headers)
      .send({ imageUrl: 'https://cdn.example.test/vodka.webp' });
    expect(image.status).toBe(201);
    const imageId = image.body.data.id;
    const imageList = await request(app)
      .get(`/api/admin/products/${productId}/images`)
      .set(headers);
    expect(imageList.body.data).toHaveLength(1);
    const editedImage = await request(app)
      .patch(`/api/admin/products/${productId}/images/${imageId}`)
      .set(headers)
      .send({ altText: 'Vodka bottle' });
    expect(editedImage.status).toBe(200);
    expect(
      (
        await request(app)
          .delete(`/api/admin/products/${productId}/images/${imageId}`)
          .set(headers)
      ).status,
    ).toBe(200);

    const variant = await request(app)
      .post(`/api/admin/products/${productId}/variants`)
      .set(headers)
      .send({
        sku: 'VODKA-1L',
        size: '1 L',
        purchasePrice: 5,
        sellingPrice: 10,
        lowStockThreshold: 2,
        isActive: true,
      });
    const variantId = variant.body.data.id;
    const deactivatedVariant = await request(app)
      .delete(`/api/admin/products/${productId}/variants/${variantId}`)
      .set(headers);
    expect(deactivatedVariant.status).toBe(200);
    expect(repository.variants[0].isActive).toBe(false);

    const categoryConflict = await request(app)
      .delete(`/api/admin/categories/${category.id}`)
      .set(headers);
    expect(categoryConflict.status).toBe(409);
    const brandConflict = await request(app)
      .delete(`/api/admin/brands/${brand.id}`)
      .set(headers);
    expect(brandConflict.status).toBe(409);
    const deactivatedProduct = await request(app)
      .delete(`/api/admin/products/${productId}`)
      .set(headers);
    expect(deactivatedProduct.status).toBe(200);
    expect(repository.products[0].isActive).toBe(false);
  });

  it('enforces catalog permissions and validates invalid catalog payloads', async () => {
    const repository = new MemoryCatalogRepository();
    const { app: deniedApp, token: deniedToken } = catalogApp(repository, []);
    const denied = await request(deniedApp)
      .get('/api/admin/categories')
      .set('Authorization', `Bearer ${deniedToken}`);
    expect(denied.status).toBe(403);
    const unauthenticated = await request(deniedApp).get(
      '/api/admin/categories',
    );
    expect(unauthenticated.status).toBe(401);

    const { app, token } = catalogApp(repository);
    const invalidCategory = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', slug: '---', isActive: true });
    expect(invalidCategory.status).toBe(400);
    expect(invalidCategory.body.error.code).toBe('VALIDATION_ERROR');
  });
});
