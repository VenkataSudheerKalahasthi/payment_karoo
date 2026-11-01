import { Router } from 'express';
import { syncUser, getCurrentUser, logoutUser } from './auth.controller.js';
import { authenticateUser } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { syncUserSchema } from './auth.schema.js';

const authRoutes = Router();

// Sync user account with database (supports registering newly authenticated Clerk users)
authRoutes.post(
  '/sync',
  authenticateUser({ allowUnregistered: true }),
  validateRequest({ body: syncUserSchema }),
  syncUser,
);

// Get current authenticated user details and profile
authRoutes.get('/me', authenticateUser(), getCurrentUser);

// Explicit logout logging
authRoutes.post('/logout', authenticateUser(), logoutUser);

export { authRoutes };

