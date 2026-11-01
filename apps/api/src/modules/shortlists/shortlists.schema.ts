import { z } from 'zod';

export const createShortlistSchema = z.object({
  workerProfileId: z.string().uuid('Invalid worker profile ID'),
  notes: z.string().trim().max(500).optional(),
});

export type CreateShortlistInput = z.infer<typeof createShortlistSchema>;

