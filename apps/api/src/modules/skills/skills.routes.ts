import { Router } from 'express';
import { listSkills, createSkill } from './skills.controller.js';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { createSkillSchema } from './skills.schema.js';
import { UserRole } from '@prisma/client';

const skillsRoutes = Router();

skillsRoutes.get('/', listSkills);

skillsRoutes.post(
  '/',
  authenticateUser(),
  requireRole(UserRole.ADMIN, UserRole.SUPERADMIN),
  validateRequest({ body: createSkillSchema }),
  createSkill,
);

export { skillsRoutes };

