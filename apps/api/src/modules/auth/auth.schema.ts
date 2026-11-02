import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const syncUserSchema = z.object({
  role: z
    .enum([UserRole.CLIENT, UserRole.WORKER], {
      message: 'Self-registration only permits CLIENT or WORKER roles. Administrative roles require provisioning.',
    })
    .default(UserRole.CLIENT),
  email: z.string().email('Valid email address required').optional().nullable(),
  firstName: z.string().max(100).optional().nullable(),
  lastName: z.string().max(100).optional().nullable(),
  avatarUrl: z.string().max(2048).optional().nullable().or(z.literal('')),
});

export type SyncUserInput = z.infer<typeof syncUserSchema>;

