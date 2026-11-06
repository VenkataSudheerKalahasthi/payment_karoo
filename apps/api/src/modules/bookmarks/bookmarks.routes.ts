import { Router } from 'express';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { UserRole } from '@prisma/client';
import {
  toggleSaveJob,
  listSavedJobs,
  toggleSaveSpecialist,
  listSavedSpecialists,
} from './bookmarks.controller.js';

export const bookmarksRouter = Router();

// Specialist saved jobs
bookmarksRouter.post('/jobs/:jobId/toggle', authenticateUser(), requireRole(UserRole.WORKER), toggleSaveJob);
bookmarksRouter.get('/jobs', authenticateUser(), requireRole(UserRole.WORKER), listSavedJobs);

// Client saved specialists
bookmarksRouter.post('/specialists/:specialistId/toggle', authenticateUser(), requireRole(UserRole.CLIENT), toggleSaveSpecialist);
bookmarksRouter.get('/specialists', authenticateUser(), requireRole(UserRole.CLIENT), listSavedSpecialists);
