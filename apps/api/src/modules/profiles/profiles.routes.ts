import { Router } from 'express';
import { getMyProfile, updateMyProfile, getPublicProfile } from './profiles.controller.js';
import { authenticateUser } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { updateProfileSchema } from './profiles.schema.js';

const profilesRoutes = Router();

// Current authenticated user profile
profilesRoutes.get('/me', authenticateUser(), getMyProfile);
profilesRoutes.put(
  '/me',
  authenticateUser(),
  validateRequest({ body: updateProfileSchema }),
  updateMyProfile,
);

// View public profile (safe fields only)
profilesRoutes.get('/:userId', authenticateUser(), getPublicProfile);

export { profilesRoutes };

