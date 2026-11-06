import { z } from 'zod';

export const createSpecialistTeamSchema = z.object({
  name: z.string().min(2, 'Team name must be at least 2 characters').max(100),
  description: z.string().max(2000).optional(),
  category: z.string().max(80).optional(),
  logoUrl: z.string().url().optional().nullable(),
  maxMembers: z.number().int().min(2).max(50).default(10),
  skills: z.array(z.string().max(80)).default([]),
});

export const inviteTeamMemberSchema = z.object({
  workerId: z.string().uuid(),
  role: z.enum(['LEAD', 'MEMBER']).default('MEMBER'),
  message: z.string().max(500).optional(),
  workloadAllocation: z.number().int().min(1).max(100).default(100),
  responsibility: z.string().max(200).optional(),
});

export const respondTeamInvitationSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED']),
});

