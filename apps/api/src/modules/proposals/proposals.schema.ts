import { z } from 'zod';

export const createJobProposalSchema = z.object({
  jobPostId: z.string().uuid(),
  coverLetter: z.string().min(1, 'Cover letter is required').max(5000),
  proposedAmount: z.number().min(1, 'Proposed amount must be greater than zero'),
  currency: z.string().min(3).max(3).default('USD'),
  estimatedTimeline: z.string().max(100).optional(),
  workApproach: z.string().max(3000).optional(),
  deliverables: z.string().max(3000).optional(),
  attachmentUrl: z.string().url().optional().nullable(),
  proposalType: z.enum(['INDIVIDUAL', 'TEAM']).default('INDIVIDUAL'),
  teamId: z.string().uuid().optional().nullable(),
});

export const counterofferProposalSchema = z.object({
  proposedAmount: z.number().min(1, 'Proposed counteroffer amount must exceed zero'),
  timeline: z.string().max(100).optional(),
  scope: z.string().max(3000).optional(),
  deliverables: z.string().max(3000).optional(),
  message: z.string().min(1).max(2000),
});

export const respondProposalSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED', 'WITHDRAWN']),
  message: z.string().max(1000).optional(),
});

