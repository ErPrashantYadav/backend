import { z } from 'zod';

const corsOriginsSchema = z.string().transform((value, context) => {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    context.addIssue({
      code: 'custom',
      message: 'At least one CORS origin is required',
    });
    return z.NEVER;
  }

  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.origin !== origin
      ) {
        throw new Error();
      }
    } catch {
      context.addIssue({
        code: 'custom',
        message: `CORS origin must be an exact HTTP(S) origin: ${origin}`,
      });
      return z.NEVER;
    }
  }

  return origins;
});

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
        {
          message: 'DATABASE_URL must use the PostgreSQL protocol',
        },
      ),
    CORS_ORIGINS: corsOriginsSchema,
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
    REQUEST_BODY_LIMIT: z
      .string()
      .regex(/^\d+(b|kb|mb)$/i)
      .default('1mb'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(120),
    AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .default(900_000),
    AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5),
    JWT_SECRET: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/, 'JWT_SECRET must be an unpadded base64url key')
      .refine((value) => {
        const key = Buffer.from(value, 'base64url');
        return key.length >= 32 && key.toString('base64url') === value;
      }, 'JWT_SECRET must encode at least 32 random bytes'),
    JWT_ISSUER: z.string().trim().min(1).max(200),
    JWT_AUDIENCE: z.string().trim().min(1).max(200),
    JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .refine(
        (value) => value === 900,
        'JWT access token lifetime must be exactly 900 seconds',
      ),
    CLOUDINARY_CLOUD_NAME: z.string().trim().min(1).optional(),
    CLOUDINARY_API_KEY: z.string().trim().min(1).optional(),
    CLOUDINARY_API_SECRET: z.string().trim().min(1).optional(),
    CLOUDINARY_PRODUCT_FOLDER: z
      .string()
      .trim()
      .min(1)
      .default('liquor_shop/products'),
    CLOUDINARY_PAYMENT_QR_FOLDER: z
      .string()
      .trim()
      .min(1)
      .default('liquor_shop/payment_qr'),
    GOOGLE_MAPS_API_KEY: z.string().trim().min(1).optional(),
    STORE_ORIGIN_LATITUDE: z.coerce.number().min(-90).max(90).default(27.7172),
    STORE_ORIGIN_LONGITUDE: z.coerce
      .number()
      .min(-180)
      .max(180)
      .default(85.324),
    DELIVERY_FEE_MODE: z.enum(['FIXED', 'PER_KM', 'TIERED']).default('PER_KM'),
    DELIVERY_FEE_BASE_AMOUNT: z.coerce.number().min(0).default(100),
    DELIVERY_FEE_PER_KM_AMOUNT: z.coerce.number().min(0).default(25),
    DELIVERY_FEE_FREE_THRESHOLD: z.coerce.number().min(0).optional(),
    DELIVERY_MAX_DISTANCE_KM: z.coerce.number().min(0.1).default(25),
    DELIVERY_FALLBACK_AMOUNT: z.coerce.number().min(0).default(0),
    STORE_OWNER_WHATSAPP_NUMBER: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s-]{7,25}$/, 'Invalid WhatsApp phone number format')
      .optional(),
    WHATSAPP_API_TOKEN: z.string().trim().min(1).optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().trim().min(1).optional(),
    EMAIL_PROVIDER: z
      .enum(['CONSOLE', 'SMTP', 'RESEND', 'TEST'])
      .default('CONSOLE'),
    EMAIL_FROM: z
      .string()
      .trim()
      .min(1)
      .default('Old Liquor <orders@oldliquor.com>'),
    SMTP_HOST: z.string().trim().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    SMTP_USER: z.string().trim().min(1).optional(),
    SMTP_PASSWORD: z.string().trim().min(1).optional(),
    RESEND_API_KEY: z.string().trim().min(1).optional(),
    NOTIFICATION_WORKER_BATCH_SIZE: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10),
    NOTIFICATION_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5),
  })
  .superRefine((data, ctx) => {
    const hasCloudName = Boolean(data.CLOUDINARY_CLOUD_NAME);
    const hasApiKey = Boolean(data.CLOUDINARY_API_KEY);
    const hasApiSecret = Boolean(data.CLOUDINARY_API_SECRET);

    if (
      (hasCloudName || hasApiKey || hasApiSecret) &&
      !(hasCloudName && hasApiKey && hasApiSecret)
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be provided together when configuring Cloudinary',
      });
    }
  });

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(
  environment:
    NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AppConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const problems = result.error.issues
      .map(
        (issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`,
      )
      .join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }

  return result.data;
}
