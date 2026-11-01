import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { clerkClient } from '../../config/clerk.js';
import { UserRole } from '@prisma/client';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { SyncUserInput } from './auth.schema.js';

export async function syncUser(req: Request, res: Response): Promise<void> {
  const clerkAuth = req.clerkAuth;
  if (!clerkAuth?.clerkId) {
    sendError(res, 401, 'UNAUTHORIZED', 'Verified Clerk session required');
    return;
  }

  const input = req.body as SyncUserInput;

  try {
    let email = input.email || clerkAuth.email;
    let firstName = input.firstName || clerkAuth.firstName;
    let lastName = input.lastName || clerkAuth.lastName;
    let avatarUrl = input.avatarUrl;

    // If email is missing, query Clerk directly using clerkClient
    if (!email) {
      try {
        const clerkUser = await clerkClient.users.getUser(clerkAuth.clerkId);
        email = clerkUser.emailAddresses[0]?.emailAddress;
        firstName = firstName || clerkUser.firstName || undefined;
        lastName = lastName || clerkUser.lastName || undefined;
        avatarUrl = avatarUrl || clerkUser.imageUrl || undefined;
      } catch (clerkErr) {
        logger.warn('Could not fetch user details from Clerk API directly:', clerkErr);
      }
    }

    if (!email) {
      sendError(
        res,
        400,
        'EMAIL_REQUIRED',
        'An email address is required to complete account synchronization.',
      );
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { clerkId: clerkAuth.clerkId },
      include: {
        role: true,
        profile: true,
        workerProfile: {
          include: {
            skills: { include: { skill: true } },
            portfolioItems: true,
          },
        },
      },
    });

    if (existingUser) {
      // Update existing user profile info if provided
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          email,
          firstName: firstName ?? existingUser.firstName,
          lastName: lastName ?? existingUser.lastName,
          avatarUrl: avatarUrl ?? existingUser.avatarUrl,
        },
        include: {
          role: true,
          profile: true,
          workerProfile: {
            include: {
              skills: { include: { skill: true } },
              portfolioItems: true,
            },
          },
        },
      });

      await recordAuditLog({
        actorId: updatedUser.id,
        action: 'USER_SYNC_LOGIN',
        resource: 'User',
        resourceId: updatedUser.id,
        details: { email: updatedUser.email },
        req,
      });

      sendSuccess(res, 200, updatedUser);
      return;
    }

    // Role verification: strictly ensure public users cannot self-assign ADMIN or SUPERADMIN
    const requestedRole = input.role || UserRole.CLIENT;
    if ((requestedRole as string) === UserRole.ADMIN || (requestedRole as string) === UserRole.SUPERADMIN) {
      sendError(
        res,
        403,
        'FORBIDDEN',
        'Administrative roles cannot be self-assigned. Contact governance for role provisioning.',
      );
      return;
    }

    // Find database role
    const dbRole = await prisma.role.findUnique({
      where: { name: requestedRole },
    });

    if (!dbRole) {
      sendError(res, 500, 'ROLE_NOT_CONFIGURED', `Role ${requestedRole} not found in database`);
      return;
    }

    // Create user and profiles transactionally
    const newUser = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          clerkId: clerkAuth.clerkId,
          email,
          firstName: firstName || null,
          lastName: lastName || null,
          avatarUrl: avatarUrl || null,
          roleId: dbRole.id,
          profile: {
            create: {
              avatarUrl: avatarUrl || null,
            },
          },
          ...(requestedRole === UserRole.WORKER
            ? {
                workerProfile: {
                  create: {},
                },
              }
            : {}),
        },
        include: {
          role: true,
          profile: true,
          workerProfile: {
            include: {
              skills: { include: { skill: true } },
              portfolioItems: true,
            },
          },
        },
      });

      return createdUser;
    });

    await recordAuditLog({
      actorId: newUser.id,
      action: 'USER_REGISTERED',
      resource: 'User',
      resourceId: newUser.id,
      details: { role: requestedRole, email: newUser.email },
      req,
    });

    sendSuccess(res, 201, newUser);
  } catch (error) {
    logger.error('Failed to synchronize user:', error);
    sendError(res, 500, 'USER_SYNC_FAILED', 'Failed to synchronize account credentials');
  }
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    return;
  }

  try {
    const fullUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        role: true,
        profile: true,
        workerProfile: {
          include: {
            skills: { include: { skill: true } },
            portfolioItems: true,
          },
        },
      },
    });

    if (!fullUser) {
      sendError(res, 404, 'USER_NOT_FOUND', 'User profile not found');
      return;
    }

    sendSuccess(res, 200, fullUser);
  } catch (error) {
    logger.error('Error fetching current user:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Could not fetch current user details');
  }
}

export async function logoutUser(req: Request, res: Response): Promise<void> {
  if (req.user) {
    await recordAuditLog({
      actorId: req.user.id,
      action: 'USER_LOGOUT',
      resource: 'UserSession',
      resourceId: req.user.id,
      req,
    });
  }

  sendSuccess(res, 200, { message: 'Logged out successfully' });
}
