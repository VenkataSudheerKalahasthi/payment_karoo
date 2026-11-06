import { Router } from 'express';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { UserRole } from '@prisma/client';
import {
  createTeam,
  inviteMember,
  respondInvitation,
  getTeam,
  listMyTeams,
  listInvitations,
} from './teams.controller.js';

export const teamsRouter = Router();

teamsRouter.post('/', authenticateUser(), requireRole(UserRole.WORKER), createTeam);
teamsRouter.get('/my-teams', authenticateUser(), requireRole(UserRole.WORKER), listMyTeams);
teamsRouter.get('/invitations', authenticateUser(), requireRole(UserRole.WORKER), listInvitations);
teamsRouter.get('/:id', authenticateUser(), getTeam);
teamsRouter.post('/:id/invitations', authenticateUser(), requireRole(UserRole.WORKER), inviteMember);
teamsRouter.post('/invitations/:invitationId/respond', authenticateUser(), requireRole(UserRole.WORKER), respondInvitation);
