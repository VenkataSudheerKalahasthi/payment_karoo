import { z } from 'zod';

export const createSkillSchema = z.object({
  name: z.string().min(2, 'Skill name must be at least 2 characters').max(50),
  category: z.string().max(50).optional(),
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>;

