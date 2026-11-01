import { Router } from 'express';
import { listUsers, getUserById, updateUserStatus } from './users.controller.js';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { listUsersSchema, updateUserStatusSchema } from './users.schema.js';
import { UserRole } from '@prisma/client';

const usersRoutes = Router();

// Administrative user listing
usersRoutes.get(
  '/',
  authenticateUser(),
  requireRole(UserRole.ADMIN, UserRole.SUPERADMIN),
  validateRequest({ query: listUsersSchema }),
  listUsers,
);

// Get user by ID (Self or Admin/Superadmin)
usersRoutes.get('/:id', authenticateUser(), getUserById);

// Update user status (Admin/Superadmin only)
usersRoutes.patch(
  '/:id/status',
  authenticateUser(),
  requireRole(UserRole.ADMIN, UserRole.SUPERADMIN),
  validateRequest({ body: updateUserStatusSchema }),
  updateUserStatus,
);

export { usersRoutes };

