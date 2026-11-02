import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { Prisma, UserRole } from '@prisma/client';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog, recordAdminActivity } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { ListUsersQuery, UpdateUserStatusInput } from './users.schema.js';

export async function listUsers(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListUsersQuery;
  const page = query.page || 1;
  const limit = query.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (query.role) {
    where.role = { name: query.role };
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: 'insensitive' } },
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  try {
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          role: true,
          profile: true,
          workerProfile: {
            include: {
              skills: { include: { skill: true } },
            },
          },
        },
      }),
    ]);

    sendSuccess(res, 200, {
      items: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('Error listing users:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve users');
  }
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const currentUser = req.user!;

  // Authorization check: User can view their own record; ADMIN or SUPERADMIN can view any
  const isPrivileged =
    currentUser.role.name === UserRole.ADMIN || currentUser.role.name === UserRole.SUPERADMIN;

  if (currentUser.id !== id && !isPrivileged) {
    sendError(res, 403, 'FORBIDDEN', 'Access denied to target user details');
    return;
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id },
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

    if (!targetUser) {
      sendError(res, 404, 'USER_NOT_FOUND', 'User not found');
      return;
    }

    sendSuccess(res, 200, targetUser);
  } catch (error) {
    logger.error('Error fetching user by ID:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve user details');
  }
}

export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const admin = req.user!;
  const input = req.body as UpdateUserStatusInput;

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!target) {
      sendError(res, 404, 'USER_NOT_FOUND', 'Target user not found');
      return;
    }

    // Protection: Disallow self-suspension / self-deactivation
    if (admin.id === target.id && input.status !== 'ACTIVE') {
      sendError(
        res,
        400,
        'SELF_SUSPENSION_PROHIBITED',
        'Administrators cannot suspend or deactivate their own account.',
      );
      return;
    }

    // Protection: Only Superadmins can modify the status of an Admin or Superadmin
    if (
      (target.role.name === UserRole.ADMIN || target.role.name === UserRole.SUPERADMIN) &&
      admin.role.name !== UserRole.SUPERADMIN
    ) {
      sendError(
        res,
        403,
        'FORBIDDEN',
        'Only Superadmins can modify the status of an Administrator or Superadmin account.',
      );
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: input.status },
      include: { role: true },
    });

    await recordAdminActivity({
      adminId: admin.id,
      action: 'UPDATE_USER_STATUS',
      targetUserId: target.id,
      details: {
        previousStatus: target.status,
        newStatus: input.status,
        reason: input.reason,
      },
    });

    await recordAuditLog({
      actorId: admin.id,
      action: 'ADMIN_USER_STATUS_CHANGE',
      resource: 'User',
      resourceId: target.id,
      details: { newStatus: input.status, reason: input.reason },
      req,
    });

    sendSuccess(res, 200, updated);
  } catch (error) {
    logger.error('Error updating user status:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update user status');
  }
}

