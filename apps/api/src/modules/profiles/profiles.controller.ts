import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { UpdateProfileInput } from './profiles.schema.js';

export async function getMyProfile(req: Request, res: Response): Promise<void> {
  const user = req.user!;

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });

    sendSuccess(res, 200, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
      },
      profile,
    });
  } catch (error) {
    logger.error('Error fetching profile:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Could not retrieve profile');
  }
}

export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const input = req.body as UpdateProfileInput;

  try {
    const updatedProfile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
        bio: input.bio,
        phoneNumber: input.phoneNumber,
        companyName: input.companyName,
        timezone: input.timezone,
        address: input.address,
        country: input.country,
        avatarUrl: input.avatarUrl,
      },
      create: {
        userId: user.id,
        bio: input.bio,
        phoneNumber: input.phoneNumber,
        companyName: input.companyName,
        timezone: input.timezone || 'UTC',
        address: input.address,
        country: input.country,
        avatarUrl: input.avatarUrl,
      },
    });

    if (input.avatarUrl !== undefined) {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: input.avatarUrl || null },
      });
    }

    await recordAuditLog({
      actorId: user.id,
      action: 'PROFILE_UPDATED',
      resource: 'UserProfile',
      resourceId: updatedProfile.id,
      req,
    });

    sendSuccess(res, 200, updatedProfile);
  } catch (error) {
    logger.error('Error updating profile:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update profile');
  }
}

export async function getPublicProfile(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        createdAt: true,
        role: {
          select: {
            name: true,
          },
        },
        profile: {
          select: {
            bio: true,
            companyName: true,
            timezone: true,
            country: true,
          },
        },
        workerProfile: {
          select: {
            headline: true,
            availability: true,
            rating: true,
            totalCompletedContracts: true,
            skills: {
              select: {
                yearsOfExperience: true,
                skill: {
                  select: {
                    name: true,
                    category: true,
                  },
                },
              },
            },
            portfolioItems: {
              select: {
                id: true,
                title: true,
                description: true,
                projectUrl: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      sendError(res, 404, 'NOT_FOUND', 'Public profile not found');
      return;
    }

    sendSuccess(res, 200, user);
  } catch (error) {
    logger.error('Error fetching public profile:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Could not load public profile');
  }
}

