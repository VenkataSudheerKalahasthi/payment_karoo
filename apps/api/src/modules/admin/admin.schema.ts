import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const provisionRoleSchema = z.object({
  userId: z.string().uuid('Valid user ID required'),
  role: z.enum([UserRole.CLIENT, UserRole.WORKER, UserRole.ADMIN, UserRole.SUPERADMIN]),
  reason: z.string().min(10, 'A detailed justification must be provided for role provisioning'),
});

export type ProvisionRoleInput = z.infer<typeof provisionRoleSchema>;

