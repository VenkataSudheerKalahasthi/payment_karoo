import { Router } from 'express';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { UserRole } from '@prisma/client';
import {
  createJob,
  updateJob,
  getJobById,
  listJobs,
  listClientJobs,
  deleteJobPost,
} from './jobs.controller.js';

export const jobsRouter = Router();

// Public / Authenticated discovery
jobsRouter.get('/', authenticateUser(), listJobs);
jobsRouter.get('/my-jobs', authenticateUser(), requireRole(UserRole.CLIENT), listClientJobs);
jobsRouter.get('/:id', authenticateUser(), getJobById);

// Client management
jobsRouter.post('/', authenticateUser(), requireRole(UserRole.CLIENT), createJob);
jobsRouter.patch('/:id', authenticateUser(), requireRole(UserRole.CLIENT), updateJob);
jobsRouter.delete('/:id', authenticateUser(), requireRole(UserRole.CLIENT), deleteJobPost);
