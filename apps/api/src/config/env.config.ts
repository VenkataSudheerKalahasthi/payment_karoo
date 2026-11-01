import dotenv from 'dotenv';
import { z } from 'zod';

// Load local environment files if present
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .refine((port) => !isNaN(port) && port > 0 && port <= 65535, {
      message: 'API_PORT must be a valid port number (1-65535)',
    }),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL environment variable is required'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  ADMIN_URL: z.string().default('http://localhost:3001'),
  SUPERADMIN_URL: z.string().default('http://localhost:3002'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001,http://localhost:3002')
    .transform((val) =>
      val
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  CLERK_SECRET_KEY: z.string().optional().default(''),
  CLERK_PUBLISHABLE_KEY: z.string().optional().default(''),

  // Cashfree Payment Gateway Configuration (Phase 5 - SANDBOX Only)
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

  // Financial Safety Invariants (Strictly Enforced)
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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Critical: Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type EnvironmentConfig = typeof env;
