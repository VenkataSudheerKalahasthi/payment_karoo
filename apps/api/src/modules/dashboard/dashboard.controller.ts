import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';
import {
  UserRole,
  ContractStatus,
  MilestoneStatus,
  HiringRequestStatus,
} from '@prisma/client';

/**
 * Get real database dashboard metrics based on authenticated user role.
 * Strictly calculates live metrics with zero mock or dummy values.
 */
export async function getDashboardMetrics(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const role = user.role.name;

  try {
    const isClient = role === UserRole.CLIENT;
    const isWorker = role === UserRole.WORKER;

    if (!isClient && !isWorker) {
      // Admin / Superadmin overview metrics
      const [totalContracts, activeContracts, pendingRequests, completedContracts, totalUsers] = await Promise.all([
        prisma.contract.count(),
        prisma.contract.count({ where: { status: ContractStatus.ACTIVE } }),
        prisma.hiringRequest.count({ where: { status: HiringRequestStatus.PENDING } }),
        prisma.contract.count({ where: { status: ContractStatus.COMPLETED } }),
        prisma.user.count(),
      ]);

      sendSuccess(res, 200, {
        role,
        totalContracts,
        activeContracts,
        pendingHiringRequests: pendingRequests,
        contractsAwaitingAcceptance: 0,
        completedContracts,
        pendingMilestones: 0,
        unreadNotifications: 0,
        totalUsers,
        recentActivities: [],
      });
      return;
    }

    const unreadNotifications = await prisma.notification.count({
      where: { recipientId: user.id, isRead: false },
    });

    const recentNotifications = await prisma.notification.findMany({
      where: { recipientId: user.id },
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        createdAt: true,
      },
    });

    if (isClient) {
      const [
        totalContracts,
        activeContracts,
        contractsAwaitingAcceptance,
        completedContracts,
        pendingHiringRequests,
        pendingMilestones,
        openDisputes,
      ] = await Promise.all([
        prisma.contract.count({ where: { clientId: user.id } }),
        prisma.contract.count({ where: { clientId: user.id, status: ContractStatus.ACTIVE } }),
        prisma.contract.count({ where: { clientId: user.id, status: ContractStatus.PENDING_ACCEPTANCE } }),
        prisma.contract.count({ where: { clientId: user.id, status: ContractStatus.COMPLETED } }),
        prisma.hiringRequest.count({ where: { clientId: user.id, status: HiringRequestStatus.PENDING } }),
        prisma.contractMilestone.count({
          where: {
            contract: { clientId: user.id, status: ContractStatus.ACTIVE },
            status: MilestoneStatus.SUBMITTED,
          },
        }),
        prisma.dispute.count({
          where: {
            contract: { clientId: user.id },
            status: { notIn: ['RESOLVED', 'CLOSED', 'WITHDRAWN'] },
          },
        }),
      ]);

      sendSuccess(res, 200, {
        role: UserRole.CLIENT,
        totalContracts,
        activeContracts,
        contractsAwaitingAcceptance,
        completedContracts,
        pendingHiringRequests,
        pendingMilestones,
        openDisputes,
        unreadNotifications,
        recentActivities: recentNotifications.map((n) => ({
          id: n.id,
          title: n.title,
          description: n.message,
          timestamp: n.createdAt.toISOString(),
          type: n.type,
        })),
      });
      return;
    }

    // Worker Metrics
    const [
      totalContracts,
      activeContracts,
      contractsAwaitingAcceptance,
      completedContracts,
      pendingHiringRequests,
      pendingMilestones,
      openDisputes,
      revisionRequests,
    ] = await Promise.all([
      prisma.contract.count({ where: { workerId: user.id } }),
      prisma.contract.count({ where: { workerId: user.id, status: ContractStatus.ACTIVE } }),
      prisma.contract.count({ where: { workerId: user.id, status: ContractStatus.PENDING_ACCEPTANCE } }),
      prisma.contract.count({ where: { workerId: user.id, status: ContractStatus.COMPLETED } }),
      prisma.hiringRequest.count({ where: { workerId: user.id, status: HiringRequestStatus.PENDING } }),
      prisma.contractMilestone.count({
        where: {
          contract: { workerId: user.id, status: ContractStatus.ACTIVE },
          status: { in: [MilestoneStatus.PENDING, MilestoneStatus.IN_PROGRESS, MilestoneStatus.IN_REVISION] },
        },
      }),
      prisma.dispute.count({
        where: {
          contract: { workerId: user.id },
          status: { notIn: ['RESOLVED', 'CLOSED', 'WITHDRAWN'] },
        },
      }),
      prisma.contractMilestone.count({
        where: {
          contract: { workerId: user.id, status: ContractStatus.ACTIVE },
          status: MilestoneStatus.IN_REVISION,
        },
      }),
    ]);

    sendSuccess(res, 200, {
      role: UserRole.WORKER,
      totalContracts,
      activeContracts,
      contractsAwaitingAcceptance,
      completedContracts,
      pendingHiringRequests,
      pendingMilestones,
      openDisputes,
      revisionRequests,
      unreadNotifications,
      recentActivities: recentNotifications.map((n) => ({
        id: n.id,
        title: n.title,
        description: n.message,
        timestamp: n.createdAt.toISOString(),
        type: n.type,
      })),
    });
  } catch (error) {
    logger.error('Error fetching dashboard metrics:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve dashboard metrics');
  }
}

