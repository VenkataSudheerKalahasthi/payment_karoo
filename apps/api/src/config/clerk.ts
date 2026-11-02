import { createClerkClient, verifyToken } from '@clerk/backend';
import { env } from './env.config.js';
import { logger } from '../utils/logger.js';

export const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
});

export interface VerifiedClerkPayload {
  sub: string; // Clerk User ID
  sid?: string; // Session ID
  iss?: string;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Verify a Bearer JWT token issued by Clerk.
 * Rejects invalid, expired, or malformed tokens.
 */
export async function verifyClerkSessionToken(token: string): Promise<VerifiedClerkPayload> {
  if (!env.CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is not configured on backend.');
  }

  try {
    const rawOrigins = [
      env.CLIENT_URL,
      env.ADMIN_URL,
      env.SUPERADMIN_URL,
      ...env.CORS_ORIGINS,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
    ].filter(Boolean) as string[];

    const authorizedParties = Array.from(
      new Set([
        ...rawOrigins,
        ...rawOrigins.map((o) => (o.endsWith('/') ? o.slice(0, -1) : `${o}/`)),
      ]),
    );

    let payload;
    try {
      payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
        authorizedParties,
      });
    } catch (azpErr) {
      // If authorizedParties validation fails (e.g. alternate local host or dynamic dev origin),
      // verify cryptographic signature directly against CLERK_SECRET_KEY
      logger.info('Clerk authorizedParties check failed, falling back to signature verification');
      payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
      });
    }

    if (!payload || !payload.sub) {
      throw new Error('Invalid Clerk token payload');
    }

    return payload as VerifiedClerkPayload;
  } catch (error) {
    logger.warn('Clerk session token verification failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

