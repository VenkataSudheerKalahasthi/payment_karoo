import { z } from 'zod';
import { WorkerAvailability } from '@prisma/client';

export const listWorkersQuerySchema = z.object({
  skill: z.string().optional(),
  availability: z.enum([WorkerAvailability.AVAILABLE, WorkerAvailability.BUSY, WorkerAvailability.UNAVAILABLE]).optional(),
  search: z.string().optional(),
  minRate: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined)),
  maxRate: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined)),
  country: z.string().optional(),
  sortBy: z.enum(['rating', 'hourlyRate', 'totalCompletedContracts', 'createdAt']).default('rating'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
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

export const updateWorkerProfileSchema = z.object({
  headline: z.string().max(120, 'Headline cannot exceed 120 characters').optional(),
  hourlyRate: z.number().min(0, 'Hourly rate cannot be negative').optional(),
  availability: z.enum([WorkerAvailability.AVAILABLE, WorkerAvailability.BUSY, WorkerAvailability.UNAVAILABLE]).optional(),
});

export const addWorkerSkillSchema = z.object({
  skillId: z.string().uuid('Valid skill ID required'),
  yearsOfExperience: z.number().int().min(0).max(50).default(1),
});

export const createPortfolioItemSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().min(10).max(2000),
  projectUrl: z.string().url().optional().or(z.literal('')),
  attachmentUrl: z.string().url().optional().or(z.literal('')),
});

export type ListWorkersQuery = z.infer<typeof listWorkersQuerySchema>;
export type UpdateWorkerProfileInput = z.infer<typeof updateWorkerProfileSchema>;
export type AddWorkerSkillInput = z.infer<typeof addWorkerSkillSchema>;
export type CreatePortfolioItemInput = z.infer<typeof createPortfolioItemSchema>;

