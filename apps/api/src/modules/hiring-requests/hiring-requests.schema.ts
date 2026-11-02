import { z } from 'zod';
import { HiringRequestStatus } from '@prisma/client';

export const createHiringRequestSchema = z.object({
  workerId: z.string().uuid('Invalid worker ID'),
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(150, 'Title cannot exceed 150 characters'),
  description: z.string().trim().min(20, 'Description must be at least 20 characters').max(5000),
  proposedBudget: z.number().positive('Budget must be positive'),
  currency: z.string().min(3).max(3).default('USD'),
  requiredSkills: z.array(z.string().trim()).default([]),
  proposedStartDate: z.string().datetime().optional().nullable(),
  expectedCompletionDate: z.string().datetime().optional().nullable(),
  clientMessage: z.string().trim().max(1000).optional(),
});

export const respondHiringRequestSchema = z.object({
  status: z.enum([
    HiringRequestStatus.ACCEPTED,
    HiringRequestStatus.DECLINED,
    HiringRequestStatus.NEGOTIATION,
  ]),
  workerResponse: z.string().trim().max(1000).optional(),
  proposedBudget: z.number().positive('Budget must be positive').optional(),
  proposedStartDate: z.string().datetime().optional().nullable(),
  expectedCompletionDate: z.string().datetime().optional().nullable(),
});

export const counterofferHiringRequestSchema = z.object({
  proposedBudget: z.number().positive('Budget must be positive').optional(),
  proposedStartDate: z.string().datetime().optional().nullable(),
  expectedCompletionDate: z.string().datetime().optional().nullable(),
  clientMessage: z.string().trim().min(5, 'Message must be at least 5 characters').max(1000),
});

export type CreateHiringRequestInput = z.infer<typeof createHiringRequestSchema>;
export type RespondHiringRequestInput = z.infer<typeof respondHiringRequestSchema>;
export type CounterofferHiringRequestInput = z.infer<typeof counterofferHiringRequestSchema>;

