import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { Prisma } from '@prisma/client';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import {
  ListWorkersQuery,
  UpdateWorkerProfileInput,
  AddWorkerSkillInput,
  CreatePortfolioItemInput,
} from './workers.schema.js';

export async function listWorkers(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListWorkersQuery;
  const page = query.page || 1;
  const limit = query.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.WorkerProfileWhereInput = {
    user: {
      status: 'ACTIVE',
    },
  };

  if (query.availability) {
    where.availability = query.availability;
  }

  if (query.minRate !== undefined || query.maxRate !== undefined) {
    where.hourlyRate = {};
    if (query.minRate !== undefined) {
      where.hourlyRate.gte = new Prisma.Decimal(query.minRate);
    }
    if (query.maxRate !== undefined) {
      where.hourlyRate.lte = new Prisma.Decimal(query.maxRate);
    }
  }

  if (query.country) {
    where.user = {
      status: 'ACTIVE',
      profile: {
        is: {
          country: { equals: query.country, mode: 'insensitive' },
        },
      },
    };
  }

  if (query.skill) {
    where.skills = {
      some: {
        skill: {
          name: { contains: query.skill, mode: 'insensitive' },
        },
      },
    };
  }

  if (query.search) {
    where.OR = [
      { headline: { contains: query.search, mode: 'insensitive' } },
      {
        user: {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      },
    ];
  }

  const orderBy: Prisma.WorkerProfileOrderByWithRelationInput = {
    [query.sortBy || 'rating']: query.sortOrder || 'desc',
  };

  try {
    const [total, workers] = await Promise.all([
      prisma.workerProfile.count({ where }),
      prisma.workerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              createdAt: true,
              profile: {
                select: {
                  bio: true,
                  companyName: true,
                  timezone: true,
                  country: true,
                },
              },
            },
          },
          skills: {
            include: {
              skill: true,
            },
          },
          portfolioItems: {
            take: 3,
          },
        },
      }),
    ]);

    sendSuccess(res, 200, {
      items: workers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('Error listing workers:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve workers list');
  }
}

export async function getWorkerProfileMe(req: Request, res: Response): Promise<void> {
  const user = req.user!;

  try {
    const worker = await prisma.workerProfile.findUnique({
      where: { userId: user.id },
      include: {
        skills: { include: { skill: true } },
        portfolioItems: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!worker) {
      sendError(res, 404, 'NOT_FOUND', 'Worker profile not configured yet');
      return;
    }

    sendSuccess(res, 200, worker);
  } catch (error) {
    logger.error('Error fetching own worker profile:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Could not load worker profile');
  }
}

export async function getWorkerById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const worker = await prisma.workerProfile.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            createdAt: true,
            profile: {
              select: {
                bio: true,
                companyName: true,
                timezone: true,
                country: true,
              },
            },
          },
        },
        skills: {
          include: {
            skill: true,
          },
        },
        portfolioItems: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!worker) {
      sendError(res, 404, 'NOT_FOUND', 'Worker profile not found');
      return;
    }

    sendSuccess(res, 200, worker);
  } catch (error) {
    logger.error('Error fetching worker profile:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Could not load worker profile');
  }
}

export async function updateWorkerProfile(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const input = req.body as UpdateWorkerProfileInput;

  try {
    const updated = await prisma.workerProfile.upsert({
      where: { userId: user.id },
      update: {
        headline: input.headline,
        hourlyRate: input.hourlyRate !== undefined ? new Prisma.Decimal(input.hourlyRate) : undefined,
        availability: input.availability,
      },
      create: {
        userId: user.id,
        headline: input.headline,
        hourlyRate: input.hourlyRate !== undefined ? new Prisma.Decimal(input.hourlyRate) : undefined,
        availability: input.availability || 'AVAILABLE',
      },
      include: {
        skills: { include: { skill: true } },
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'WORKER_PROFILE_UPDATED',
      resource: 'WorkerProfile',
      resourceId: updated.id,
      req,
    });

    sendSuccess(res, 200, updated);
  } catch (error) {
    logger.error('Error updating worker profile:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update worker profile');
  }
}

export async function addWorkerSkill(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const input = req.body as AddWorkerSkillInput;

  try {
    let workerProfile = await prisma.workerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!workerProfile) {
      workerProfile = await prisma.workerProfile.create({
        data: { userId: user.id },
      });
    }

    const workerSkill = await prisma.workerSkill.upsert({
      where: {
        workerProfileId_skillId: {
          workerProfileId: workerProfile.id,
          skillId: input.skillId,
        },
      },
      update: {
        yearsOfExperience: input.yearsOfExperience,
      },
      create: {
        workerProfileId: workerProfile.id,
        skillId: input.skillId,
        yearsOfExperience: input.yearsOfExperience,
      },
      include: {
        skill: true,
      },
    });

    sendSuccess(res, 201, workerSkill);
  } catch (error) {
    logger.error('Error adding worker skill:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to attach skill');
  }
}

export async function removeWorkerSkill(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { skillId } = req.params;

  try {
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!workerProfile) {
      sendError(res, 404, 'NOT_FOUND', 'Worker profile not found');
      return;
    }

    await prisma.workerSkill.deleteMany({
      where: {
        workerProfileId: workerProfile.id,
        skillId,
      },
    });

    sendSuccess(res, 200, { message: 'Skill removed successfully' });
  } catch (error) {
    logger.error('Error removing worker skill:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete skill attachment');
  }
}

export async function createPortfolioItem(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const input = req.body as CreatePortfolioItemInput;

  try {
    let workerProfile = await prisma.workerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!workerProfile) {
      workerProfile = await prisma.workerProfile.create({
        data: { userId: user.id },
      });
    }

    const item = await prisma.portfolioItem.create({
      data: {
        workerProfileId: workerProfile.id,
        title: input.title,
        description: input.description,
        projectUrl: input.projectUrl || null,
        attachmentUrl: input.attachmentUrl || null,
      },
    });

    sendSuccess(res, 201, item);
  } catch (error) {
    logger.error('Error creating portfolio item:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create portfolio item');
  }
}

export async function deletePortfolioItem(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;

  try {
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!workerProfile) {
      sendError(res, 404, 'NOT_FOUND', 'Worker profile not found');
      return;
    }

    const item = await prisma.portfolioItem.findUnique({
      where: { id },
    });

    if (!item || item.workerProfileId !== workerProfile.id) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied to portfolio item');
      return;
    }

    await prisma.portfolioItem.delete({ where: { id } });
    sendSuccess(res, 200, { message: 'Portfolio item deleted' });
  } catch (error) {
    logger.error('Error deleting portfolio item:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete portfolio item');
  }
}
