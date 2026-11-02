import { Router } from 'express';
import {
  listWorkers,
  getWorkerById,
  getWorkerProfileMe,
  updateWorkerProfile,
  addWorkerSkill,
  removeWorkerSkill,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
} from './workers.controller.js';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  listWorkersQuerySchema,
  updateWorkerProfileSchema,
  addWorkerSkillSchema,
  createPortfolioItemSchema,
  updatePortfolioItemSchema,
} from './workers.schema.js';
import { UserRole } from '@prisma/client';

const workersRoutes = Router();

// Public worker marketplace browsing
workersRoutes.get('/', validateRequest({ query: listWorkersQuerySchema }), listWorkers);

// Authenticated worker self profile retrieval
workersRoutes.get(
  '/me',
  authenticateUser(),
  requireRole(UserRole.WORKER),
  getWorkerProfileMe,
);

// Worker public profile
workersRoutes.get('/:id', getWorkerById);

// Worker authenticated self-management routes
workersRoutes.put(
  '/me/profile',
  authenticateUser(),
  requireRole(UserRole.WORKER),
  validateRequest({ body: updateWorkerProfileSchema }),
  updateWorkerProfile,
);

workersRoutes.post(
  '/me/skills',
  authenticateUser(),
  requireRole(UserRole.WORKER),
  validateRequest({ body: addWorkerSkillSchema }),
  addWorkerSkill,
);

workersRoutes.delete(
  '/me/skills/:skillId',
  authenticateUser(),
  requireRole(UserRole.WORKER),
  removeWorkerSkill,
);

workersRoutes.post(
  '/me/portfolio',
  authenticateUser(),
  requireRole(UserRole.WORKER),
  validateRequest({ body: createPortfolioItemSchema }),
  createPortfolioItem,
);

workersRoutes.put(
  '/me/portfolio/:id',
  authenticateUser(),
  requireRole(UserRole.WORKER),
  validateRequest({ body: updatePortfolioItemSchema }),
  updatePortfolioItem,
);

workersRoutes.delete(
  '/me/portfolio/:id',
  authenticateUser(),
  requireRole(UserRole.WORKER),
  deletePortfolioItem,
);

export { workersRoutes };

