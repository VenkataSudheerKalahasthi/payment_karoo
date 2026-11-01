import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';
import { CreateShortlistInput } from './shortlists.schema.js';

/**
 * Add a worker to the client's shortlist.
 */
export async function addWorkerToShortlist(req: Request, res: Response): Promise<void> {
  const client = req.user!;
  const input = req.body as CreateShortlistInput;

  try {
    // 1. Verify target worker profile exists
    const workerProfile = await prisma.workerProfile.findUnique({
      where: { id: input.workerProfileId },
    });

    if (!workerProfile) {
      sendError(res, 404, 'NOT_FOUND', 'Worker profile not found');
      return;
    }

    // 2. Upsert shortlist record
    const shortlist = await prisma.workerShortlist.upsert({
      where: {
        clientId_workerProfileId: {
          clientId: client.id,
          workerProfileId: input.workerProfileId,
        },
      },
      update: {
        notes: input.notes,
      },
      create: {
        clientId: client.id,
        workerProfileId: input.workerProfileId,
        notes: input.notes,
      },
      include: {
        workerProfile: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
            skills: { include: { skill: true } },
          },
        },
      },
    });

    sendSuccess(res, 201, shortlist);
  } catch (error) {
    logger.error('Error adding to shortlist:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to add worker to shortlist');
  }
}

/**
 * List all shortlisted workers for the authenticated client.
 */
export async function listShortlistedWorkers(req: Request, res: Response): Promise<void> {
  const client = req.user!;

  try {
    const items = await prisma.workerShortlist.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      include: {
        workerProfile: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
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
            skills: { include: { skill: true } },
            portfolioItems: { take: 2 },
          },
        },
      },
    });

    sendSuccess(res, 200, items);
  } catch (error) {
    logger.error('Error listing shortlisted workers:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve shortlist');
  }
}

/**
 * Remove a worker from the client's shortlist.
 */
export async function removeWorkerFromShortlist(req: Request, res: Response): Promise<void> {
  const client = req.user!;
  const { workerProfileId } = req.params;

  try {
    await prisma.workerShortlist.deleteMany({
      where: {
        clientId: client.id,
        workerProfileId,
      },
    });

    sendSuccess(res, 200, { message: 'Worker removed from shortlist successfully' });
  } catch (error) {
    logger.error('Error removing from shortlist:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to remove from shortlist');
  }
}

