import { z } from 'zod';
import { ProjectStatus } from '@prisma/client';

export const createProjectSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().max(2000).optional(),
  scope: z.string().trim().max(5000).optional(),
  startDate: z.string().datetime().optional(),
  expectedCompletionDate: z.string().datetime().optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().max(2000).optional(),
  scope: z.string().trim().max(5000).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.string().datetime().optional().nullable(),
  expectedCompletionDate: z.string().datetime().optional().nullable(),
});

export const listProjectsQuerySchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

