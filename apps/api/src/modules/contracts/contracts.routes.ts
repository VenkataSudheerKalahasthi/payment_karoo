import { Router } from 'express';
import {
  createContract,
  listContracts,
  getContractById,
  updateContractStatus,
  submitMilestone,
  requestRevision,
  approveMilestone,
  startMilestone,
  acceptContract,
  amendContract,
  downloadContractPdf,
} from './contracts.controller.js';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createContractSchema,
  acceptContractSchema,
  amendContractSchema,
  updateContractStatusSchema,
  createSubmissionSchema,
  createRevisionSchema,
} from './contracts.schema.js';
import { UserRole } from '@prisma/client';

const contractsRoutes = Router();

// Create new contract (Client only)
contractsRoutes.post(
  '/',
  authenticateUser(),
  requireRole(UserRole.CLIENT),
  validateRequest({ body: createContractSchema }),
  createContract,
);

// List contracts (Role-scoped: Client sees own, Worker sees assigned, Admin sees all)
contractsRoutes.get('/', authenticateUser(), listContracts);

// Download professional contract PDF (Client, Worker or Admin)
contractsRoutes.get('/:id/pdf', authenticateUser(), downloadContractPdf);

// Get single contract with milestones & submissions (Strict ownership check in controller)
contractsRoutes.get('/:id', authenticateUser(), getContractById);

// Record digital contract acceptance (Client or Worker)
contractsRoutes.post(
  '/:id/accept',
  authenticateUser(),
  validateRequest({ body: acceptContractSchema }),
  acceptContract,
);

// Propose contract amendment (creates new version, resets status, requires fresh mutual acceptance)
contractsRoutes.post(
  '/:id/amend',
  authenticateUser(),
  validateRequest({ body: amendContractSchema }),
  amendContract,
);

// Update contract status (e.g. dispute or cancellation transition)
contractsRoutes.patch(
  '/:id/status',
  authenticateUser(),
  validateRequest({ body: updateContractStatusSchema }),
  updateContractStatus,
);

// Worker commences work on milestone
contractsRoutes.patch(
  '/:id/milestones/:milestoneId/start',
  authenticateUser(),
  requireRole(UserRole.WORKER),
  startMilestone,
);

// Worker submits milestone deliverable (Worker only, ownership enforced)
contractsRoutes.post(
  '/:id/milestones/:milestoneId/submissions',
  authenticateUser(),
  requireRole(UserRole.WORKER),
  validateRequest({ body: createSubmissionSchema }),
  submitMilestone,
);

// Client requests milestone revision (Client only, ownership enforced)
contractsRoutes.post(
  '/:id/milestones/:milestoneId/revisions',
  authenticateUser(),
  requireRole(UserRole.CLIENT),
  validateRequest({ body: createRevisionSchema }),
  requestRevision,
);

// Client approves milestone deliverable (Client or Superadmin only, ownership enforced)
contractsRoutes.post(
  '/:id/milestones/:milestoneId/approve',
  authenticateUser(),
  approveMilestone,
);

export { contractsRoutes };

