import { Router } from 'express';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { UserRole } from '@prisma/client';
import {
  submitProposal,
  submitCounteroffer,
  acceptProposal,
  declineProposal,
  toggleShortlist,
  listJobProposals,
  listMyProposals,
  withdrawProposal,
} from './proposals.controller.js';

export const proposalsRouter = Router();

// Submit proposal (Specialist / Team Lead)
proposalsRouter.post('/', authenticateUser(), requireRole(UserRole.WORKER), submitProposal);

// Worker's submitted proposals
proposalsRouter.get('/my-proposals', authenticateUser(), requireRole(UserRole.WORKER), listMyProposals);

// Withdraw/Delete submitted proposal (Specialist only)
proposalsRouter.delete('/:id', authenticateUser(), requireRole(UserRole.WORKER), withdrawProposal);

// Proposals for a specific job (Client only)
proposalsRouter.get('/job/:jobId', authenticateUser(), requireRole(UserRole.CLIENT), listJobProposals);

// Negotiation & decision endpoints
proposalsRouter.post('/:id/counteroffer', authenticateUser(), submitCounteroffer);
proposalsRouter.post('/:id/accept', authenticateUser(), requireRole(UserRole.CLIENT), acceptProposal);
proposalsRouter.post('/:id/decline', authenticateUser(), requireRole(UserRole.CLIENT), declineProposal);
proposalsRouter.post('/:id/shortlist', authenticateUser(), requireRole(UserRole.CLIENT), toggleShortlist);
