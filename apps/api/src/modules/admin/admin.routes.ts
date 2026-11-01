import { Router } from 'express';
import {
  getAdminDashboardMetrics,
  listAdminActivities,
  provisionUserRole,
} from './admin.controller.js';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { provisionRoleSchema } from './admin.schema.js';
import { UserRole } from '@prisma/client';

const adminRoutes = Router();

// Dashboard overview metrics (Admin & Superadmin)
adminRoutes.get(
  '/dashboard',
  authenticateUser(),
  requireRole(UserRole.ADMIN, UserRole.SUPERADMIN),
  getAdminDashboardMetrics,
);

// Admin governance activity history (Admin & Superadmin)
adminRoutes.get(
  '/activities',
  authenticateUser(),
  requireRole(UserRole.ADMIN, UserRole.SUPERADMIN),
  listAdminActivities,
);

// Provision user role (Strictly Superadmin only)
adminRoutes.post(
  '/provision-role',
  authenticateUser(),
  requireRole(UserRole.SUPERADMIN),
  validateRequest({ body: provisionRoleSchema }),
  provisionUserRole,
);

export { adminRoutes };

