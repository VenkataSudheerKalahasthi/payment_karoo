import { Request, Response } from 'express';
import { projectsService } from './projects.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/prisma.js';
import { UserRole, NotificationType, HiringRequestStatus } from '@prisma/client';
import { ProjectOpportunityDto, SubmitOpportunityProposalRequest } from '@trustpay/shared';
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

/**
 * List verified project discovery opportunities for specialists.
 */
export async function listOpportunitiesHandler(req: Request, res: Response): Promise<void> {
  const { search, category, minBudget, maxBudget } = req.query as {
    search?: string;
    category?: string;
    minBudget?: string;
    maxBudget?: string;
  };

  try {
    const contracts = await prisma.contract.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        milestones: {
          select: { id: true, title: true, amount: true, status: true },
        },
      },
    });

    const opportunities: ProjectOpportunityDto[] = contracts.map((c) => {
      const budget = Number(c.totalAmount || 0);
      const clientName = `${c.client.firstName || ''} ${c.client.lastName || ''}`.trim() || 'Verified Client';

      // Default category tags based on title/desc keywords
      let derivedCat = 'Full-Stack Development';
      const text = `${c.title} ${c.description}`.toLowerCase();
      if (text.includes('contract') || text.includes('escrow') || text.includes('crypto')) {
        derivedCat = 'Smart Contracts & Escrow';
      } else if (text.includes('design') || text.includes('ui') || text.includes('frontend')) {
        derivedCat = 'UI/UX & Frontend';
      } else if (text.includes('api') || text.includes('database') || text.includes('backend')) {
        derivedCat = 'Backend & Cloud Systems';
      }

      const skills = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Tailwind CSS'];

      return {
        id: c.id,
        title: c.title,
        description: c.description || 'Project opportunities seeking specialist expertise.',
        scope: c.scopeOfWork,
        budget,
        currency: c.currency || 'USD',
        category: derivedCat,
        requiredSkills: skills,
        clientId: c.clientId,
        clientName,
        deadline: c.endDate ? c.endDate.toISOString() : null,
        status: c.status,
        milestonesCount: c.milestones.length,
        createdAt: c.createdAt.toISOString(),
      };
    });

    // Apply filtering if provided
    let filtered = opportunities;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          o.clientName.toLowerCase().includes(q),
      );
    }
    if (category && category !== 'ALL') {
      filtered = filtered.filter((o) => o.category === category);
    }
    if (minBudget) {
      filtered = filtered.filter((o) => o.budget >= Number(minBudget));
    }
    if (maxBudget) {
      filtered = filtered.filter((o) => o.budget <= Number(maxBudget));
    }

    sendSuccess(res, 200, {
      items: filtered,
      total: filtered.length,
    });
  } catch (error) {
    logger.error('Error fetching project opportunities:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve project opportunities');
  }
}

/**
 * Specialist submits formal proposal for an open project opportunity.
 */
export async function submitOpportunityProposalHandler(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const input = req.body as SubmitOpportunityProposalRequest;

  if (!input.opportunityId || !input.proposedBudget || !input.proposalScope) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Opportunity ID, proposed budget, and proposal scope are required');
    return;
  }

  try {
    const targetContract = await prisma.contract.findUnique({
      where: { id: input.opportunityId },
      include: { client: true },
    });

    if (!targetContract) {
      sendError(res, 404, 'NOT_FOUND', 'Target opportunity not found');
      return;
    }

    // Create HiringRequest / Proposal record
    const proposal = await prisma.$transaction(async (tx) => {
      const request = await tx.hiringRequest.create({
        data: {
          clientId: targetContract.clientId,
          workerId: user.id,
          title: `Proposal: ${targetContract.title}`,
          description: `${input.proposalScope}${input.coverLetter ? `\n\nCover Letter: ${input.coverLetter}` : ''}`,
          proposedBudget: input.proposedBudget,
          currency: targetContract.currency || 'USD',
          status: HiringRequestStatus.PENDING,
          workerResponse: `Specialist proposal of $${input.proposedBudget} submitted for review.`,
        },
      });

      // Notify the Client
      await tx.notification.create({
        data: {
          recipientId: targetContract.clientId,
          title: `New Proposal Received: ${targetContract.title}`,
          message: `${user.firstName || 'A specialist'} submitted a proposal of $${input.proposedBudget} for "${targetContract.title}".`,
          type: NotificationType.HIRING_REQUEST_RECEIVED,
          metadata: {
            hiringRequestId: request.id,
            contractId: targetContract.id,
          },
        },
      });

      return request;
    });

    sendSuccess(res, 201, proposal);
  } catch (error) {
    logger.error('Error submitting opportunity proposal:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to submit proposal');
  }
}


