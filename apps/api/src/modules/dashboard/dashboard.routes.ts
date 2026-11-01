import { Router } from 'express';
import { getDashboardMetrics } from './dashboard.controller.js';
import { authenticateUser } from '../../middleware/auth.js';

const dashboardRoutes = Router();

// Retrieve live dashboard metrics based on authenticated user role
dashboardRoutes.get('/metrics', authenticateUser(), getDashboardMetrics);

export { dashboardRoutes };

