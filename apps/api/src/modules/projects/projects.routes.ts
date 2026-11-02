import { Router } from 'express';
import { authenticateUser } from '../../middleware/auth.js';
import {
  createProjectHandler,
  getProjectHandler,
  getProjectByContractHandler,
  listProjectsHandler,
  getProjectSummaryHandler,
  getMilestoneActivitiesHandler,
} from './projects.controller.js';

const projectsRoutes = Router();

// All project routes require authentication
projectsRoutes.use(authenticateUser());

// List projects for the authenticated actor
projectsRoutes.get('/', listProjectsHandler);

// Single project access
projectsRoutes.get('/:id', getProjectHandler);

// Project progress breakdown in minor units
projectsRoutes.get('/:id/summary', getProjectSummaryHandler);

// Milestone chronological append-only activity history
projectsRoutes.get('/:id/activities', getMilestoneActivitiesHandler);

// Direct contract-to-project linkage
projectsRoutes.get('/contract/:contractId', getProjectByContractHandler);
projectsRoutes.post('/contract/:contractId', createProjectHandler);

export { projectsRoutes };

