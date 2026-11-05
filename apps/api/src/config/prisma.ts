import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from './env.config.js';

const { Pool } = pg;

declare global {
  var __trustpay_prisma__: PrismaClient | undefined;
  var __trustpay_pg_pool__: pg.Pool | undefined;
}

const connectionString = env.DATABASE_URL;
const isSupabaseOrRemote =
  connectionString.includes('supabase.co') ||
  connectionString.includes('pooler.supabase.com') ||
  connectionString.includes('sslmode=');

export const pool =
  globalThis.__trustpay_pg_pool__ ??
  new Pool({
    connectionString,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 10,
    ssl: isSupabaseOrRemote ? { rejectUnauthorized: false } : undefined,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalThis.__trustpay_prisma__ ??
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__trustpay_prisma__ = prisma;
  globalThis.__trustpay_pg_pool__ = pool;
}

export interface DbHealthResult {
  status: 'connected' | 'disconnected' | 'error';
  database: string;
  latencyMs?: number;
  error?: string;
}

function sanitizeDatabaseError(error: unknown): string {
  if (!error) return 'Unknown database error';
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes('28P01') ||
    message.includes('password authentication failed') ||
    message.includes('Authentication failed')
  ) {
    return 'Database authentication failed. Please check your Supabase credentials in DATABASE_URL.';
  }
  if (
    message.includes('ETIMEDOUT') ||
    message.includes('timeout') ||
    message.includes('connect ETIMEDOUT')
  ) {
    return 'Database connection timed out. If using Supabase on an IPv4 network, verify you are using the Supabase connection pooler.';
  }
  if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
    return 'Database host could not be resolved. Please verify the Supabase host address in DATABASE_URL.';
  }
  if (message.includes('ECONNREFUSED')) {
    return 'Database connection was refused by the host.';
  }
  if (
    message.includes('self-signed certificate') ||
    message.includes('SSL') ||
    message.includes('ssl')
  ) {
    return 'Database SSL negotiation failed. Ensure SSL is enabled.';
  }
  return 'Unable to establish database connection. Supabase database service unavailable.';
}

export async function checkDatabaseConnection(): Promise<DbHealthResult> {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;
    return {
      status: 'connected',
      database: 'PostgreSQL (Supabase)',
      latencyMs,
    };
  } catch (error) {
    return {
      status: 'disconnected',
      database: 'PostgreSQL (Supabase)',
      error: sanitizeDatabaseError(error),
    };
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
  } finally {
    await pool.end();
  }
}
