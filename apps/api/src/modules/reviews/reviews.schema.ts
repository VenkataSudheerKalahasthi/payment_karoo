import { z } from 'zod';

export const createVerifiedReviewSchema = z.object({
  contractId: z.string().uuid(),
  workQuality: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  timeliness: z.number().int().min(1).max(5),
  professionalism: z.number().int().min(1).max(5),
  feedback: z.string().min(10, 'Feedback must be at least 10 characters').max(2000),
});

