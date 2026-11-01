import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { webhookRateLimiter, generalRateLimiter } from '../../middleware/rateLimiter.js';
import { handleProviderWebhook, listWebhookEvents } from './webhooks.controller.js';

const router = Router();

// Ingest provider webhooks (Rate-limited, audited, held in IGNORED state)
router.post('/:provider', webhookRateLimiter, handleProviderWebhook);

// List audited webhook events (Admin & Superadmin only)
router.get('/', authenticateUser(), generalRateLimiter, requireRole(UserRole.ADMIN, UserRole.SUPERADMIN), listWebhookEvents);

export { router as webhooksRoutes };

