import dotenv from 'dotenv';
import { z } from 'zod';

// Load local environment files if present
dotenv.config();

const rawPort = process.env.PORT || process.env.API_PORT || '5000';
const rawCors =
  process.env.CORS_ALLOWED_ORIGINS ||
  process.env.CORS_ORIGINS ||
  'http://localhost:3000,http://localhost:3001,http://localhost:3002';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PORT: z
      .string()
      .default(rawPort)
      .transform((val) => parseInt(val, 10))
      .refine((port) => !isNaN(port) && port > 0 && port <= 65535, {
        message: 'API_PORT/PORT must be a valid port number (1-65535)',
      }),
    API_HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL environment variable is required'),
    DIRECT_URL: z.string().optional(),
    CLIENT_URL: z.string().default('http://localhost:3000'),
    ADMIN_URL: z.string().default('http://localhost:3001'),
    SUPERADMIN_URL: z.string().default('http://localhost:3002'),
    CORS_ORIGINS: z
      .string()
      .default(rawCors)
      .transform((val) =>
        val
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    CLERK_SECRET_KEY: z.string().optional().default(''),
    CLERK_PUBLISHABLE_KEY: z.string().optional().default(''),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    STORAGE_SIGNING_SECRET: z.string().optional(),

    // Cashfree Payment Gateway Configuration (DEFERRED in Phase 8 - Non-live only)
    CASHFREE_ENV: z.enum(['SANDBOX', 'PRODUCTION']).default('SANDBOX'),
    CASHFREE_CLIENT_ID: z.string().optional().default(''),
    CASHFREE_CLIENT_SECRET: z.string().optional().default(''),
    CASHFREE_API_VERSION: z.string().default('2023-08-01'),
    CASHFREE_WEBHOOK_SECRET: z.string().optional().default(''),
    CASHFREE_RETURN_URL: z
      .string()
      .default('http://localhost:3000/payments/callback?order_id={order_id}'),
    CASHFREE_WEBHOOK_URL: z
      .string()
      .default('http://localhost:5000/api/v1/webhooks/cashfree'),

    // Financial Safety Invariants (Strictly Enforced Across All Phases)
    PAYMENTS_LIVE_ENABLED: z
      .string()
      .default('false')
      .transform((val) => val === 'true'),
    ESCROW_LIVE_MOVEMENT_ENABLED: z
      .string()
      .default('false')
      .transform((val) => val === 'true'),
    PAYOUTS_ENABLED: z
      .string()
      .default('false')
      .transform((val) => val === 'true'),
  })
  .superRefine((data, ctx) => {
    // Strict production safety rules
    if (data.NODE_ENV === 'production') {
      // 1. Production must not silently fall back to localhost
      if (
        data.CLIENT_URL.includes('localhost') ||
        data.ADMIN_URL.includes('localhost') ||
        data.SUPERADMIN_URL.includes('localhost')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Production configuration error: CLIENT_URL, ADMIN_URL, and SUPERADMIN_URL must specify public production domain URLs, not localhost.',
          path: ['CLIENT_URL'],
        });
      }

      // 2. Production must not use exclusively localhost CORS
      const hasOnlyLocalhostCors = data.CORS_ORIGINS.every(
        (origin) => origin.includes('localhost') || origin.includes('127.0.0.1'),
      );
      if (hasOnlyLocalhostCors) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Production configuration error: CORS_ORIGINS (or CORS_ALLOWED_ORIGINS) must include production frontend domains in production mode.',
          path: ['CORS_ORIGINS'],
        });
      }

      // 3. Clerk secret key must be provided in production
      if (!data.CLERK_SECRET_KEY || data.CLERK_SECRET_KEY.includes('placeholder')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Production configuration error: Valid CLERK_SECRET_KEY is mandatory in production mode.',
          path: ['CLERK_SECRET_KEY'],
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Critical: Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type EnvironmentConfig = typeof env;
