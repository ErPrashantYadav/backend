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

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
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
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
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
