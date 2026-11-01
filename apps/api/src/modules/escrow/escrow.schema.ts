import { z } from 'zod';
import { EscrowStatus } from '@prisma/client';

export const listEscrowsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(EscrowStatus).optional(),
});

export const updateDisputeHoldSchema = z.object({
  disputeHold: z.boolean(),
  reason: z.string().trim().min(5, 'Reason for dispute status change must be at least 5 characters'),
});

export type ListEscrowsQuery = z.infer<typeof listEscrowsQuerySchema>;
export type UpdateDisputeHoldInput = z.infer<typeof updateDisputeHoldSchema>;

