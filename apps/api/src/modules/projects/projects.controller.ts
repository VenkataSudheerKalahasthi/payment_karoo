import { Request, Response } from 'express';
import { projectsService } from './projects.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
} from './projects.schema.js';

export async function createProjectHandler(req: Request, res: Response): Promise<void> {
  const { contractId } = req.params;
  const user = req.user!;

  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid project payload', parsed.error.format());
    return;
  }

  try {
    const project = await projectsService.createProject(contractId, user, parsed.data);

    await recordAuditLog({
      actorId: user.id,
      action: 'PROJECT_CREATED',
      resource: 'Project',
      resourceId: project.id,
      details: { contractId },
      req,
    });

    sendSuccess(res, 201, project);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'BAD_REQUEST', err.message || 'Failed to create project');
      return;
    }
    logger.error('Error creating project:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create project');
  }
}

export async function getProjectHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;

  try {
    const project = await projectsService.getProject(id, user);
    sendSuccess(res, 200, project);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'NOT_FOUND', err.message || 'Project not found');
      return;
    }
    logger.error('Error fetching project:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch project');
  }
}

export async function getProjectByContractHandler(req: Request, res: Response): Promise<void> {
  const { contractId } = req.params;
  const user = req.user!;

  try {
    const project = await projectsService.getProjectByContractId(contractId, user);
    sendSuccess(res, 200, project);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'NOT_FOUND', err.message || 'Project not found for contract');
      return;
    }
    logger.error('Error fetching project by contract:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch contract project');
  }
}

export async function listProjectsHandler(req: Request, res: Response): Promise<void> {
  const user = req.user!;

  const parsed = listProjectsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', parsed.error.format());
    return;
  }

  try {
    const result = await projectsService.listProjects(user, parsed.data);
    sendSuccess(res, 200, result);
  } catch (error: unknown) {
    logger.error('Error listing projects:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to list projects');
  }
}

export async function getProjectSummaryHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;

  try {
    const summary = await projectsService.getProjectProgressSummary(id, user);
    sendSuccess(res, 200, summary);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'NOT_FOUND', err.message || 'Project summary not found');
      return;
    }
    logger.error('Error fetching project summary:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to calculate project summary');
  }
}

export async function getMilestoneActivitiesHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { milestoneId } = req.query as { milestoneId?: string };
  const user = req.user!;

  try {
    const activities = await projectsService.getMilestoneActivities(id, user, milestoneId);
    sendSuccess(res, 200, activities);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'FORBIDDEN', err.message || 'Failed to fetch activities');
      return;
    }
    logger.error('Error fetching milestone activities:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch milestone activities');
  }
}

