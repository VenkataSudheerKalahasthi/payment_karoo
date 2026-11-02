import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name cannot be empty').max(50, 'First name cannot exceed 50 characters').optional(),
  lastName: z.string().max(50, 'Last name cannot exceed 50 characters').optional(),
  bio: z.string().max(1000, 'Bio cannot exceed 1000 characters').optional(),
  phoneNumber: z.string().max(25).optional(),
  companyName: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  address: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
  avatarUrl: z.string().url('Avatar must be a valid URL').optional().or(z.literal('')),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

