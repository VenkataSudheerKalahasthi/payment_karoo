import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const syncUserSchema = z.object({
  role: z
    .enum([UserRole.CLIENT, UserRole.WORKER], {
      message: 'Self-registration only permits CLIENT or WORKER roles. Administrative roles require provisioning.',
    })
    .default(UserRole.CLIENT),
  email: z.string().email('Valid email address required').optional(),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  avatarUrl: z.string().url('Avatar must be a valid URL').optional().or(z.literal('')),
});

export type SyncUserInput = z.infer<typeof syncUserSchema>;

