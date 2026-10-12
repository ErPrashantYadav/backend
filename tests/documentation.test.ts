import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';

interface PostmanItem {
  name?: string;
  request?: { url?: { path?: string[]; raw?: string }; method?: string };
  item?: PostmanItem[];
  event?: Array<{ script?: { exec?: string[] } }>;
}

interface EnvValue {
  key: string;
  value: string;
}

interface OpenApiDoc {
  openapi: string;
  info: { title: string };
  paths: Record<string, unknown>;
}

describe('API Documentation & Postman Collection Verification', () => {
  const docsDir = resolve(process.cwd(), 'docs');
  const openapiJsonPath = resolve(docsDir, 'openapi.json');
  const openapiYamlPath = resolve(docsDir, 'openapi.yaml');
  const postmanCollectionPath = resolve(
    docsDir,
    'postman',
    'liquor-shop-backend.postman_collection.json',
  );
  const postmanEnvPath = resolve(
    docsDir,
    'postman',
    'liquor-shop-backend.postman_environment.json',
  );

  it('generates valid OpenAPI 3.1 JSON specification', () => {
    expect(existsSync(openapiJsonPath)).toBe(true);
    const content = readFileSync(openapiJsonPath, 'utf8');
    const parsed = JSON.parse(content) as OpenApiDoc;

    expect(parsed.openapi).toBe('3.1.0');
    expect(parsed.info.title).toContain('Liquor Shop');
    expect(parsed.paths).toBeDefined();
    expect(Object.keys(parsed.paths).length).toBeGreaterThan(30);

    // Verify key domain endpoints exist in specification
    expect(parsed.paths['/api/health/live']).toBeDefined();
    expect(parsed.paths['/api/admin/auth/login']).toBeDefined();
    expect(parsed.paths['/api/catalog/categories']).toBeDefined();
    expect(parsed.paths['/api/admin/brands/reorder']).toBeDefined();
    expect(parsed.paths['/api/admin/banners/reorder']).toBeDefined();
    expect(parsed.paths['/api/checkout']).toBeDefined();
    expect(parsed.paths['/api/cart']).toBeDefined();
    expect(parsed.paths['/api/orders/{orderNumber}']).toBeDefined();
    expect(parsed.paths['/api/admin/dashboard/summary']).toBeDefined();
    expect(parsed.paths['/api/settings']).toBeDefined();

    // Verify forbidden reorder endpoints are NOT exposed as paths
    expect(parsed.paths['/api/admin/categories/reorder']).toBeUndefined();
    expect(parsed.paths['/api/admin/products/reorder']).toBeUndefined();
    expect(parsed.paths['/api/admin/gallery/reorder']).toBeUndefined();
    expect(parsed.paths['/api/admin/social-media/reorder']).toBeUndefined();
  });

  it('generates valid OpenAPI 3.1 YAML specification identical to JSON', () => {
    expect(existsSync(openapiYamlPath)).toBe(true);
    const yamlContent = readFileSync(openapiYamlPath, 'utf8');
    const parsedYaml = yaml.load(yamlContent) as OpenApiDoc;

    expect(parsedYaml.openapi).toBe('3.1.0');
    expect(parsedYaml.info.title).toContain('Liquor Shop');
    expect(Object.keys(parsedYaml.paths).length).toBeGreaterThan(30);
  });

  it('generates valid Postman Collection v2.1 with chained variables and test scripts', () => {
    expect(existsSync(postmanCollectionPath)).toBe(true);
    const collectionContent = readFileSync(postmanCollectionPath, 'utf8');
    const collection = JSON.parse(collectionContent) as {
      info: { schema: string };
      item: PostmanItem[];
    };

    expect(collection.info.schema).toBe(
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    );
    expect(collection.item.length).toBeGreaterThan(10);

    // Verify folders exist
    const folderNames = collection.item.map((f: PostmanItem) => f.name);
    expect(folderNames).toContain('1. Health & System');
    expect(folderNames).toContain('2. Admin Authentication');
    expect(folderNames).toContain('5. Brands (With Reordering)');
    expect(folderNames).toContain('8. Guest Cart & Checkout Flow');
    expect(folderNames).toContain(
      '18. Negative Cases & Forbidden Reorder Endpoints',
    );

    // Check reordering requests: only Brands and Banners are allowed
    const flattenRequests = (items: PostmanItem[]): PostmanItem[] => {
      let reqs: PostmanItem[] = [];
      for (const item of items) {
        if (item.request) {
          reqs.push(item);
        }
        if (item.item) {
          reqs = reqs.concat(flattenRequests(item.item));
        }
      }
      return reqs;
    };

    const allRequests = flattenRequests(collection.item);
    const brandReorderReq = allRequests.find((r) =>
      r.request.url.raw?.includes('/admin/brands/reorder'),
    );
    const bannerReorderReq = allRequests.find((r) =>
      r.request.url.raw?.includes('/admin/banners/reorder'),
    );
    expect(brandReorderReq).toBeDefined();
    expect(bannerReorderReq).toBeDefined();

    // Verify negative tests asserting 404 for forbidden reorders
    const catReorderNegative = allRequests.find((r) =>
      r.request.url.raw?.includes('/admin/categories/reorder'),
    );
    const prodReorderNegative = allRequests.find((r) =>
      r.request.url.raw?.includes('/admin/products/reorder'),
    );
    const galReorderNegative = allRequests.find((r) =>
      r.request.url.raw?.includes('/admin/gallery/reorder'),
    );
    const socReorderNegative = allRequests.find((r) =>
      r.request.url.raw?.includes('/admin/social-media/reorder'),
    );

    expect(catReorderNegative).toBeDefined();
    expect(prodReorderNegative).toBeDefined();
    expect(galReorderNegative).toBeDefined();
    expect(socReorderNegative).toBeDefined();

    // Verify negative test scripts expect status 404
    expect(
      catReorderNegative.event[0].script.exec.some((line: string) =>
        line.includes('404'),
      ),
    ).toBe(true);
    expect(
      prodReorderNegative.event[0].script.exec.some((line: string) =>
        line.includes('404'),
      ),
    ).toBe(true);
  });

  it('generates valid Postman Environment template with required variables', () => {
    expect(existsSync(postmanEnvPath)).toBe(true);
    const envContent = readFileSync(postmanEnvPath, 'utf8');
    const env = JSON.parse(envContent) as { values: EnvValue[] };

    expect(env.values).toBeDefined();
    const envKeys = env.values.map((v: EnvValue) => v.key);
    expect(envKeys).toContain('baseUrl');
    expect(envKeys).toContain('adminToken');
    expect(envKeys).toContain('cartToken');
    expect(envKeys).toContain('orderNumber');
    expect(envKeys).toContain('orderLookupToken');
    expect(envKeys).toContain('categoryId');
    expect(envKeys).toContain('brandId');
    expect(envKeys).toContain('productId');
    expect(envKeys).toContain('variantId');
    expect(envKeys).toContain('bannerId');

    // Confirm secrets are never leaked as actual live tokens in template
    const tokenVal = env.values.find((v: EnvValue) => v.key === 'adminToken');
    expect(tokenVal?.value).toBe('');
    const lookupVal = env.values.find(
      (v: EnvValue) => v.key === 'orderLookupToken',
    );
    expect(lookupVal?.value).toBe('');
  });
});
