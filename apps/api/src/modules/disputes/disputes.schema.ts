import { z } from 'zod';
import { DisputeCategory, DisputeResolutionType } from '@trustpay/shared';

export const createDisputeSchema = z.object({
  contractId: z.string().uuid('Valid contract ID is required'),
  milestoneId: z.string().uuid().optional(),
  category: z.nativeEnum(DisputeCategory, {
    message: 'A valid dispute category must be selected',
  }),
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title cannot exceed 200 characters'),
  description: z.string().min(20, 'Detailed description must be at least 20 characters').max(5000, 'Description cannot exceed 5000 characters'),
  claimedAmountMinor: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  evidence: z
    .array(
      z.object({
        fileName: z.string().min(1),
        fileKey: z.string().min(1),
        fileUrl: z.string().min(1),
        mimeType: z.string().optional(),
        fileSize: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
        description: z.string().max(500).optional(),
      }),
    )
    .optional(),
});

export const submitDisputeResponseSchema = z.object({
  content: z.string().min(5, 'Response content must be at least 5 characters').max(5000, 'Response cannot exceed 5000 characters'),
});

export const uploadDisputeEvidenceSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileKey: z.string().min(1, 'File key is required'),
  fileUrl: z.string().min(1, 'File URL is required'),
  mimeType: z.string().optional(),
  fileSize: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  description: z.string().max(500).optional(),
});

export const proposeResolutionSchema = z.object({
  resolutionType: z.nativeEnum(DisputeResolutionType, {
    message: 'Valid resolution type is required',
  }),
  clientAmountMinor: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).default(0),
  workerAmountMinor: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).default(0),
  rationale: z.string().min(10, 'Rationale must be at least 10 characters').max(3000, 'Rationale cannot exceed 3000 characters'),
});

export const respondToResolutionSchema = z.object({
  agree: z.boolean({ message: 'Agreement decision (true/false) is required' }),
});

export const adminEnforceResolutionSchema = z.object({
  resolutionType: z.nativeEnum(DisputeResolutionType),
  clientAmountMinor: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).default(0),
  workerAmountMinor: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).default(0),
  rationale: z.string().min(10, 'Rationale must be at least 10 characters').max(3000),
});

export const addInternalNoteSchema = z.object({
  note: z.string().min(3, 'Internal note must be at least 3 characters').max(3000),
});

export const listDisputesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  category: z.string().optional(),
  contractId: z.string().uuid().optional(),
});
