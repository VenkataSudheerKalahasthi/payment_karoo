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
    const authorizedParties = Array.from(
      new Set([env.CLIENT_URL, env.ADMIN_URL, env.SUPERADMIN_URL, ...env.CORS_ORIGINS]),
    );

    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      authorizedParties,
    });

    if (!payload || !payload.sub) {
      throw new Error('Invalid Clerk token payload');
    }

    return payload as VerifiedClerkPayload;
  } catch (error) {
    logger.warn('Clerk session token verification failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

