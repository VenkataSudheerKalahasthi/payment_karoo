import { Router } from 'express';
import {
  addWorkerToShortlist,
  listShortlistedWorkers,
  removeWorkerFromShortlist,
} from './shortlists.controller.js';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { createShortlistSchema } from './shortlists.schema.js';
import { UserRole } from '@prisma/client';

const shortlistsRoutes = Router();

// Add worker to shortlist (Client only)
shortlistsRoutes.post(
  '/',
  authenticateUser(),
  requireRole(UserRole.CLIENT),
  validateRequest({ body: createShortlistSchema }),
  addWorkerToShortlist,
);

// List shortlisted workers (Client only)
shortlistsRoutes.get(
  '/',
  authenticateUser(),
  requireRole(UserRole.CLIENT),
  listShortlistedWorkers,
);

// Remove worker from shortlist (Client only)
shortlistsRoutes.delete(
  '/:workerProfileId',
  authenticateUser(),
  requireRole(UserRole.CLIENT),
  removeWorkerFromShortlist,
);

export { shortlistsRoutes };

