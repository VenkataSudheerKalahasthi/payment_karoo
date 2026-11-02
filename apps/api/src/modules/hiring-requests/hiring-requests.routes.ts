import { Router } from 'express';
import {
  createHiringRequest,
  listHiringRequests,
  getHiringRequestById,
  respondHiringRequest,
  withdrawHiringRequest,
  convertToContract,
  counterofferHiringRequest,
} from './hiring-requests.controller.js';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createHiringRequestSchema,
  respondHiringRequestSchema,
  counterofferHiringRequestSchema,
} from './hiring-requests.schema.js';
import { UserRole } from '@prisma/client';

const hiringRequestsRoutes = Router();

// Client creates hiring request for a worker
hiringRequestsRoutes.post(
  '/',
  authenticateUser(),
  requireRole(UserRole.CLIENT),
  validateRequest({ body: createHiringRequestSchema }),
  createHiringRequest,
);

// List hiring requests (Role-scoped: Client sees sent, Worker sees received, Admin sees all)
hiringRequestsRoutes.get('/', authenticateUser(), listHiringRequests);

// Get single hiring request
hiringRequestsRoutes.get('/:id', authenticateUser(), getHiringRequestById);

// Worker responds to hiring request (ACCEPT, DECLINE, NEGOTIATE)
hiringRequestsRoutes.patch(
  '/:id/respond',
  authenticateUser(),
  requireRole(UserRole.WORKER),
  validateRequest({ body: respondHiringRequestSchema }),
  respondHiringRequest,
);

// Client proposes counteroffer / renegotiated terms
hiringRequestsRoutes.patch(
  '/:id/counteroffer',
  authenticateUser(),
  requireRole(UserRole.CLIENT),
  validateRequest({ body: counterofferHiringRequestSchema }),
  counterofferHiringRequest,
);

// Client withdraws pending hiring request
hiringRequestsRoutes.patch(
  '/:id/withdraw',
  authenticateUser(),
  requireRole(UserRole.CLIENT),
  withdrawHiringRequest,
);

// Client converts accepted hiring request into a digital contract draft
hiringRequestsRoutes.post(
  '/:id/convert-to-contract',
  authenticateUser(),
  requireRole(UserRole.CLIENT),
  convertToContract,
);

export { hiringRequestsRoutes };

