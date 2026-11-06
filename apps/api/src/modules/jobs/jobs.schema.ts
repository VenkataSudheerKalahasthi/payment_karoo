import { z } from 'zod';

export const baseJobPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(150),
  description: z.string().min(1, 'Description is required').max(5000),
  category: z.string().min(1, 'Category is required').max(80),
  objectives: z.string().max(3000).optional(),
  deliverables: z.string().max(3000).optional(),
  minBudget: z.number().min(0).optional(),
  maxBudget: z.number().min(0).optional(),
  currency: z.string().min(3).max(3).default('USD'),
  paymentType: z.enum(['FIXED', 'HOURLY', 'MILESTONE_BASED']).default('MILESTONE_BASED'),
  isNegotiable: z.boolean().default(true),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
  workMode: z.enum(['ON_SITE', 'REMOTE', 'HYBRID']).default('REMOTE'),
  country: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  area: z.string().max(80).optional(),
  postalCode: z.string().max(20).optional(),
  address: z.string().max(255).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  requiredSpecialists: z.number().int().min(1).max(50).default(1),
  hiringType: z.enum(['INDIVIDUAL', 'TEAM']).default('INDIVIDUAL'),
  requiredExperience: z.string().max(100).optional(),
  teamLeadRequired: z.boolean().default(false),
  startDate: z.string().datetime().optional().nullable(),
  completionDate: z.string().datetime().optional().nullable(),
  applicationDeadline: z.string().datetime().optional().nullable(),
  estimatedDuration: z.string().max(100).optional(),
  skills: z
    .array(
      z.object({
        skillId: z.string().uuid().optional(),
        name: z.string().min(1).max(80).optional(),
        isPrimary: z.boolean().default(false),
      })
    )
    .optional(),
});

export const createJobPostSchema = baseJobPostSchema.refine(
  (data) => {
    if (data.minBudget !== undefined && data.maxBudget !== undefined) {
      return data.minBudget <= data.maxBudget;
    }
    return true;
  },
  {
    message: 'Minimum budget cannot exceed maximum budget',
    path: ['minBudget'],
  }
);

export const updateJobPostSchema = baseJobPostSchema.partial().extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED']).optional(),
});

export const listJobsFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  workMode: z.enum(['ON_SITE', 'REMOTE', 'HYBRID']).optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  skill: z.string().optional(),
  hiringType: z.enum(['INDIVIDUAL', 'TEAM']).optional(),
  minBudget: z.coerce.number().optional(),
  maxBudget: z.coerce.number().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'EXPIRED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
