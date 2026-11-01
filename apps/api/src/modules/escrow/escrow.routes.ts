import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { generalRateLimiter } from '../../middleware/rateLimiter.js';
import {
  getContractEscrow,
  initializeContractEscrow,
  listEscrows,
  setDisputeHold,
  getEscrowActivities,
} from './escrow.controller.js';

const router = Router();

router.use(authenticateUser());
router.use(generalRateLimiter);

// 1. Escrow status for contract participants (strictly read-only)
router.get('/contracts/:contractId', getContractEscrow);

// 2. Immutable escrow activity audit log for contract participants
router.get('/contracts/:contractId/activities', getEscrowActivities);

// 2. Explicit escrow initialization (POST-only, idempotent)
router.post('/contracts/:contractId/initialize', initializeContractEscrow);

// 3. All platform escrows (Admin & Superadmin only)
router.get('/', requireRole(UserRole.ADMIN, UserRole.SUPERADMIN), listEscrows);

// 4. Dispute hold management (Admin & Superadmin only)
router.patch('/contracts/:contractId/dispute-hold', requireRole(UserRole.ADMIN, UserRole.SUPERADMIN), setDisputeHold);

export { router as escrowRoutes };

