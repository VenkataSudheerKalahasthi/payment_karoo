import { Router } from 'express';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { generalRateLimiter } from '../../middleware/rateLimiter.js';
import { UserRole } from '@trustpay/shared';
import {
  createDispute,
  getDisputeById,
  listDisputes,
  getDisputeMetrics,
  submitResponse,
  uploadEvidence,
  proposeResolution,
  respondToResolution,
  adminEnforceResolution,
  escalateDispute,
  getInternalNotes,
  addInternalNote,
} from './disputes.controller.js';

const router = Router();

// Metrics endpoint (Admin & Superadmin only)
router.get(
  '/metrics',
  authenticateUser(),
  requireRole(UserRole.ADMIN, UserRole.SUPERADMIN),
  getDisputeMetrics,
);

// General dispute listing & creation
router.get('/', authenticateUser(), listDisputes);
router.post('/', authenticateUser(), generalRateLimiter, createDispute);

// Individual dispute operations
router.get('/:id', authenticateUser(), getDisputeById);
router.post('/:id/responses', authenticateUser(), generalRateLimiter, submitResponse);
router.post('/:id/evidence', authenticateUser(), generalRateLimiter, uploadEvidence);
router.post('/:id/resolutions', authenticateUser(), generalRateLimiter, proposeResolution);
router.post('/:id/resolutions/:resolutionId/respond', authenticateUser(), generalRateLimiter, respondToResolution);
router.post(
  '/:id/resolutions/enforce',
  authenticateUser(),
  requireRole(UserRole.ADMIN, UserRole.SUPERADMIN),
  generalRateLimiter,
  adminEnforceResolution,
);
router.post('/:id/escalate', authenticateUser(), generalRateLimiter, escalateDispute);
router.get(
  '/:id/notes',
  authenticateUser(),
  requireRole(UserRole.ADMIN, UserRole.SUPERADMIN),
  getInternalNotes,
);
router.post(
  '/:id/notes',
  authenticateUser(),
  requireRole(UserRole.ADMIN, UserRole.SUPERADMIN),
  generalRateLimiter,
  addInternalNote,
);

export default router;
