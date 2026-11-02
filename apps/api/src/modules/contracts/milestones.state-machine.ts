import { Prisma, MilestoneStatus, UserRole, ContractStatus } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { logger } from '../../utils/logger.js';
import { emitMilestoneRealtimeEvent, emitProjectRealtimeEvent } from '../realtime/socket.service.js';

export interface MilestoneTransitionContext {
  milestoneId: string;
  contractId: string;
  actorId: string;
  actorRole: UserRole;
  targetStatus: MilestoneStatus;
  action: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  tx?: Prisma.TransactionClient;
}

/**
 * Authoritative Map of allowed state transitions for ContractMilestones.
 */
export const ALLOWED_MILESTONE_TRANSITIONS: Record<MilestoneStatus, readonly MilestoneStatus[]> = {
  [MilestoneStatus.PENDING]: [
    MilestoneStatus.IN_PROGRESS,
    MilestoneStatus.SUBMITTED,
    MilestoneStatus.CANCELLED,
    MilestoneStatus.DISPUTED,
  ],
  [MilestoneStatus.IN_PROGRESS]: [
    MilestoneStatus.SUBMITTED,
    MilestoneStatus.CANCELLED,
    MilestoneStatus.DISPUTED,
  ],
  [MilestoneStatus.SUBMITTED]: [
    MilestoneStatus.IN_REVISION,
    MilestoneStatus.APPROVED,
    MilestoneStatus.DISPUTED,
  ],
  [MilestoneStatus.IN_REVISION]: [
    MilestoneStatus.SUBMITTED,
    MilestoneStatus.DISPUTED,
    MilestoneStatus.CANCELLED,
  ],
  [MilestoneStatus.APPROVED]: [
    // Approved milestones are terminal and immutable; can only transition to DISPUTED under admin intervention
    MilestoneStatus.DISPUTED,
  ],
  [MilestoneStatus.DISPUTED]: [
    MilestoneStatus.IN_PROGRESS,
    MilestoneStatus.SUBMITTED,
    MilestoneStatus.APPROVED,
    MilestoneStatus.CANCELLED,
  ],
  [MilestoneStatus.CANCELLED]: [],
};

/**
 * Validates whether a proposed transition is legal.
 */
export function validateMilestoneTransition(
  currentStatus: MilestoneStatus,
  targetStatus: MilestoneStatus,
): { valid: boolean; error?: string } {
  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  const allowed = ALLOWED_MILESTONE_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    return {
      valid: false,
      error: `Illegal milestone state transition from "${currentStatus}" to "${targetStatus}". Permitted: [${allowed ? allowed.join(', ') : 'none'}]`,
    };
  }

  return { valid: true };
}

/**
 * Centralized service to execute an authorized milestone transition,
 * recording immutable MilestoneActivity and updating Project progress.
 */
export async function executeMilestoneTransition(ctx: MilestoneTransitionContext) {
  const executeInTransaction = async (tx: Prisma.TransactionClient) => {
    // 1. Fetch current milestone state with contract and project
    const milestone = await tx.contractMilestone.findFirst({
      where: { id: ctx.milestoneId, contractId: ctx.contractId },
      include: {
        contract: true,
        project: true,
      },
    });

    if (!milestone) {
      throw {
        statusCode: 404,
        code: 'MILESTONE_NOT_FOUND',
        message: 'Milestone not found in target contract',
      };
    }

    // 2. Validate contract state allows work
    if (
      ctx.targetStatus !== MilestoneStatus.CANCELLED &&
      ctx.targetStatus !== MilestoneStatus.DISPUTED &&
      milestone.contract.status !== ContractStatus.ACTIVE
    ) {
      throw {
        statusCode: 400,
        code: 'CONTRACT_NOT_ACTIVE',
        message: `Milestone transitions require an ACTIVE contract (current contract status: "${milestone.contract.status}").`,
      };
    }

    // 3. Validate state machine legality
    const validation = validateMilestoneTransition(milestone.status, ctx.targetStatus);
    if (!validation.valid) {
      throw {
        statusCode: 400,
        code: 'INVALID_MILESTONE_STATE_TRANSITION',
        message: validation.error,
      };
    }

    // 4. Update milestone status
    const updatedMilestone = await tx.contractMilestone.update({
      where: { id: milestone.id },
      data: {
        status: ctx.targetStatus,
      },
      include: {
        submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
      },
    });

    // 5. Append immutable activity log
    const activity = await tx.milestoneActivity.create({
      data: {
        contractId: ctx.contractId,
        projectId: milestone.projectId || undefined,
        milestoneId: milestone.id,
        actorId: ctx.actorId,
        actorRole: ctx.actorRole,
        action: ctx.action,
        previousState: milestone.status,
        newState: ctx.targetStatus,
        version: milestone.contract.version,
        metadata: {
          reason: ctx.reason,
          title: milestone.title,
          amountMinor: (BigInt(Math.round(Number(milestone.amount) * 100))).toString(),
          ...ctx.metadata,
        },
        requestId: ctx.requestId,
      },
    });

    // 6. Recalculate Project progress if project exists
    let updatedProgress = 0;
    const projectId = milestone.projectId || milestone.project?.id;
    if (projectId) {
      const allMilestones = await tx.contractMilestone.findMany({
        where: { projectId },
        select: { status: true },
      });

      const total = allMilestones.length;
      const approvedCount = allMilestones.filter((m) => m.status === MilestoneStatus.APPROVED).length;
      updatedProgress = total > 0 ? Math.round((approvedCount / total) * 100) : 0;

      await tx.project.update({
        where: { id: projectId },
        data: {
          progressPercentage: updatedProgress,
          ...(updatedProgress === 100 ? { status: 'COMPLETED' } : {}),
        },
      });
    }

    return {
      milestone: updatedMilestone,
      activity,
      previousStatus: milestone.status,
      newStatus: ctx.targetStatus,
      progressPercentage: updatedProgress,
      projectId,
    };
  };

  const result = ctx.tx ? await executeInTransaction(ctx.tx) : await prisma.$transaction(executeInTransaction);

  // Emit real-time notification
  emitMilestoneRealtimeEvent(
    ctx.contractId,
    ctx.milestoneId,
    'milestone:status_changed',
    {
      milestoneId: ctx.milestoneId,
      contractId: ctx.contractId,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      action: ctx.action,
      actorId: ctx.actorId,
      actorRole: ctx.actorRole,
      progressPercentage: result.progressPercentage,
    },
    result.projectId,
  );

  logger.info(
    `[Milestone State Machine] Milestone ${ctx.milestoneId} transitioned from ${result.previousStatus} -> ${result.newStatus} by actor ${ctx.actorId} (${ctx.actorRole})`,
  );

  return result;
}

