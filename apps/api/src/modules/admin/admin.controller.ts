import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { UserRole } from '@prisma/client';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog, recordAdminActivity } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { ProvisionRoleInput } from './admin.schema.js';

export async function getAdminDashboardMetrics(req: Request, res: Response): Promise<void> {
  try {
    const [
      totalUsers,
      totalClients,
      totalWorkers,
      totalAdmins,
      totalContracts,
      activeContracts,
      completedContracts,
      disputedContracts,
      totalMilestones,
      totalHiringRequests,
      pendingHiringRequests,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: { name: UserRole.CLIENT } } }),
      prisma.user.count({ where: { role: { name: UserRole.WORKER } } }),
      prisma.user.count({
        where: {
          role: { name: { in: [UserRole.ADMIN, UserRole.SUPERADMIN] } },
        },
      }),
      prisma.contract.count(),
      prisma.contract.count({ where: { status: 'ACTIVE' } }),
      prisma.contract.count({ where: { status: 'COMPLETED' } }),
      prisma.contract.count({ where: { status: 'DISPUTED' } }),
      prisma.contractMilestone.count(),
      prisma.hiringRequest.count(),
      prisma.hiringRequest.count({ where: { status: 'PENDING' } }),
    ]);

    sendSuccess(res, 200, {
      users: {
        total: totalUsers,
        clients: totalClients,
        workers: totalWorkers,
        admins: totalAdmins,
      },
      contracts: {
        total: totalContracts,
        active: activeContracts,
        completed: completedContracts,
        disputed: disputedContracts,
      },
      milestones: {
        total: totalMilestones,
      },
      hiringRequests: {
        total: totalHiringRequests,
        pending: pendingHiringRequests,
      },
    });
  } catch (error) {
    logger.error('Error fetching admin dashboard metrics:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to calculate platform metrics');
  }
}

export async function listAdminActivities(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 25;
  const skip = (page - 1) * limit;

  try {
    const [total, activities] = await Promise.all([
      prisma.adminActivity.count(),
      prisma.adminActivity.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
    ]);

    sendSuccess(res, 200, {
      items: activities,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('Error listing admin activities:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve admin logs');
  }
}

export async function provisionUserRole(req: Request, res: Response): Promise<void> {
  const superadmin = req.user!;
  const input = req.body as ProvisionRoleInput;

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: input.userId },
      include: { role: true },
    });

    if (!targetUser) {
      sendError(res, 404, 'USER_NOT_FOUND', 'Target user for role provisioning not found');
      return;
    }

    if (superadmin.id === targetUser.id && input.role !== UserRole.SUPERADMIN) {
      sendError(
        res,
        400,
        'SUPERADMIN_SELF_DEMOTION_PROHIBITED',
        'Superadmin cannot remove their own Superadmin role',
      );
      return;
    }

    const newRole = await prisma.role.findUnique({
      where: { name: input.role },
    });

    if (!newRole) {
      sendError(res, 400, 'INVALID_ROLE', `Role ${input.role} is not configured in database`);
      return;
    }

    const previousRole = targetUser.role.name;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetUser.id },
        data: { roleId: newRole.id },
        include: { role: true },
      });

      // If transitioning to WORKER, ensure worker profile exists
      if (input.role === UserRole.WORKER) {
        await tx.workerProfile.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        });
      }

      return user;
    });

    await recordAdminActivity({
      adminId: superadmin.id,
      action: 'PROVISION_ROLE',
      targetUserId: targetUser.id,
      details: {
        previousRole,
        newRole: input.role,
        reason: input.reason,
      },
    });

    await recordAuditLog({
      actorId: superadmin.id,
      action: 'ROLE_PROVISIONED',
      resource: 'UserRole',
      resourceId: targetUser.id,
      details: {
        targetUserId: targetUser.id,
        previousRole,
        newRole: input.role,
        reason: input.reason,
      },
      req,
    });

    sendSuccess(res, 200, updatedUser);
  } catch (error) {
    logger.error('Error provisioning user role:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to provision user role');
  }
}

