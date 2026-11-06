import { z } from 'zod';
import { ContractStatus } from '@prisma/client';

export const createMilestoneInputSchema = z.object({
  title: z.string().min(1, 'Milestone title is required').max(100),
  description: z.string().max(2000).optional().default('Milestone deliverable'),
  amount: z.number().positive('Milestone amount must be greater than zero'),
  order: z.number().int().min(1).optional(),
  dueDate: z.string().datetime().optional(),
});

export const createContractSchema = z.object({
  workerId: z.string().uuid('Valid worker ID required'),
  title: z.string().min(1, 'Contract title is required').max(150),
  description: z.string().min(1, 'Contract description is required').max(5000),
  currency: z.string().default('USD'),
  scopeOfWork: z.string().max(5000).optional(),
  termsAndConditions: z.string().max(5000).optional(),
  cancellationTerms: z.string().max(2000).optional(),
  revisionTerms: z.string().max(2000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  jobProposalId: z.string().uuid().optional(),
  hiringRequestId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  milestones: z
    .array(createMilestoneInputSchema)
    .min(1, 'Contract must contain at least one milestone deliverable'),
});

export const acceptContractSchema = z.object({
  acceptanceMethod: z.string().trim().default('DIGITAL_CONFIRMATION'),
  expectedVersion: z.number().int().min(1).optional(),
});

export const amendContractSchema = z.object({
  expectedVersion: z.number().int().min(1, 'Expected version required for concurrency control'),
  title: z.string().min(5).max(150).optional(),
  description: z.string().min(20).max(5000).optional(),
  scopeOfWork: z.string().max(5000).optional(),
  termsAndConditions: z.string().max(5000).optional(),
  cancellationTerms: z.string().max(2000).optional(),
  revisionTerms: z.string().max(2000).optional(),
  milestones: z.array(createMilestoneInputSchema).min(1).optional(),
});

export const updateContractStatusSchema = z.object({
  status: z.enum([
    ContractStatus.PENDING_ACCEPTANCE,
    ContractStatus.ACTIVE,
    ContractStatus.COMPLETED,
    ContractStatus.CANCELLED,
    ContractStatus.DISPUTED,
  ]),
  reason: z.string().optional(),
});

export const createSubmissionSchema = z.object({
  notes: z.string().min(10, 'Submission notes must be at least 10 characters').max(4000),
  attachmentUrls: z.array(z.string().url()).default([]),
});

export const createRevisionSchema = z.object({
  submissionId: z.string().uuid('Valid submission ID required'),
  reason: z.string().min(10, 'Revision reason must be at least 10 characters').max(2000),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type AcceptContractInput = z.infer<typeof acceptContractSchema>;
export type AmendContractInput = z.infer<typeof amendContractSchema>;
export type UpdateContractStatusInput = z.infer<typeof updateContractStatusSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;

