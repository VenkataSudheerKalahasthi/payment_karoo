import { z } from 'zod';
import { UserRole, UserStatus } from '@prisma/client';

export const listUsersSchema = z.object({
  role: z.enum([UserRole.CLIENT, UserRole.WORKER, UserRole.ADMIN, UserRole.SUPERADMIN]).optional(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.DEACTIVATED]).optional(),
  search: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val > 0, { message: 'Page must be a positive integer' }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: 'Limit must be between 1 and 100',
    }),
});

export const updateUserStatusSchema = z.object({
  status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.DEACTIVATED]),
  reason: z.string().min(5, 'A reason must be provided for status modification'),
});

export type ListUsersQuery = z.infer<typeof listUsersSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

