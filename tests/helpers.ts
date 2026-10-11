import type { AppConfig } from '../src/config/env';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL:
      'postgresql://user:password@localhost:5432/liquor_shop_test?schema=public',
    CORS_ORIGINS: ['http://localhost:5173'],
    LOG_LEVEL: 'silent',
    TRUST_PROXY_HOPS: 0,
    REQUEST_BODY_LIMIT: '1mb',
    RATE_LIMIT_WINDOW_MS: 60_000,
    RATE_LIMIT_MAX_REQUESTS: 120,
    AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: 900_000,
    AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS: 5,
    JWT_SECRET: Buffer.alloc(32, 1).toString('base64url'),
    JWT_ISSUER: 'https://liquor-shop.test',
    JWT_AUDIENCE: 'liquor-shop-admin-api-test',
    JWT_ACCESS_TOKEN_TTL_SECONDS: 900,
    CLOUDINARY_PRODUCT_FOLDER: 'liquor_shop/products',
    CLOUDINARY_PAYMENT_QR_FOLDER: 'liquor_shop/payment_qr',
    STORE_ORIGIN_LATITUDE: 27.7172,
    STORE_ORIGIN_LONGITUDE: 85.324,
    DELIVERY_FEE_MODE: 'PER_KM',
    DELIVERY_FEE_BASE_AMOUNT: 0,
    DELIVERY_FEE_PER_KM_AMOUNT: 0,
    DELIVERY_MAX_DISTANCE_KM: 25,
    DELIVERY_FALLBACK_AMOUNT: 0,
    STORE_OWNER_WHATSAPP_NUMBER: '+9779801234567',
    EMAIL_PROVIDER: 'TEST',
    EMAIL_FROM: 'Old Liquor Test <orders@liquor-shop.test>',
    NOTIFICATION_WORKER_BATCH_SIZE: 10,
    NOTIFICATION_MAX_ATTEMPTS: 5,
    ...overrides,
  };
}
