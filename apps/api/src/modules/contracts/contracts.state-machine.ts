import { ContractStatus, UserRole, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { emitContractRealtimeEvent } from '../realtime/socket.service.js';
import { recordAuditLog } from '../../utils/audit.js';

export interface StateTransitionContext {
  currentStatus: ContractStatus;
  targetStatus: ContractStatus;
  userId: string;
  clientId: string;
  workerId: string;
  userRole: UserRole;
  allMilestonesApproved: boolean;
  isMutualTermination?: boolean;
}

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Deterministic finite state machine enforcing all digital contract status transitions.
 * Prevents unauthorized or invalid lifecycle mutations.
 */
export function validateContractTransition(ctx: StateTransitionContext): TransitionValidationResult {
  const { currentStatus, targetStatus, userId, clientId, workerId, userRole, allMilestonesApproved, isMutualTermination } = ctx;
  const isPrivileged = userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN;
  const isClient = userId === clientId;
  const isWorker = userId === workerId;

  // Terminal states cannot be transitioned under any circumstances
  if (currentStatus === ContractStatus.COMPLETED) {
    return {
      allowed: false,
      reason: 'Completed contracts are terminal and cannot be transitioned to another status.',
    };
  }
  if (currentStatus === ContractStatus.CANCELLED) {
    return {
      allowed: false,
      reason: 'Cancelled contracts are terminal and cannot be reopened.',
    };
  }

  // Same status transition is an invalid no-op
  if (currentStatus === targetStatus) {
    return {
      allowed: false,
      reason: `Contract is already in ${currentStatus} status.`,
    };
  }

  // Enforce strictly defined transition paths
  switch (currentStatus) {
    case ContractStatus.DRAFT:
      if (targetStatus === ContractStatus.PENDING_ACCEPTANCE) {
        if (!isClient && !isPrivileged) {
          return { allowed: false, reason: 'Only the client can submit a draft contract for worker acceptance.' };
        }
        return { allowed: true };
      }
      if (targetStatus === ContractStatus.CANCELLED) {
        if (!isClient && !isPrivileged) {
          return { allowed: false, reason: 'Only the client can discard a draft contract.' };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: `Cannot transition directly from DRAFT to ${targetStatus}.` };

    case ContractStatus.PENDING_ACCEPTANCE:
      if (targetStatus === ContractStatus.ACTIVE) {
        if (!isWorker && !isClient && !isPrivileged) {
          return { allowed: false, reason: 'Only authorized contract participants can activate the agreement upon mutual acceptance.' };
        }
        return { allowed: true };
      }
      if (targetStatus === ContractStatus.CANCELLED) {
        if (!isClient && !isWorker && !isPrivileged) {
          return { allowed: false, reason: 'Only the client or assigned worker can decline or cancel the pending agreement.' };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: `Cannot transition from PENDING_ACCEPTANCE to ${targetStatus}.` };

    case ContractStatus.ACTIVE:
      if (targetStatus === ContractStatus.DISPUTED) {
        if (!isClient && !isWorker && !isPrivileged) {
          return { allowed: false, reason: 'Only direct contract parties or governance administrators can raise a dispute.' };
        }
        return { allowed: true };
      }
      if (targetStatus === ContractStatus.PENDING_ACCEPTANCE) {
        // Occurs when an amendment is proposed/executed requiring fresh bilateral acceptance
        if (!isClient && !isWorker && !isPrivileged) {
          return { allowed: false, reason: 'Only contract participants or administrators can place an active contract into pending acceptance for amendments.' };
        }
        return { allowed: true };
      }
      if (targetStatus === ContractStatus.COMPLETED) {
        if (!isClient && !isPrivileged) {
          return { allowed: false, reason: 'Only the client or administrator can approve final completion.' };
        }
        if (!allMilestonesApproved && !isPrivileged) {
          return { allowed: false, reason: 'All milestone deliverables must be approved before completing the contract.' };
        }
        return { allowed: true };
      }
      if (targetStatus === ContractStatus.CANCELLED) {
        if (!isPrivileged && !isMutualTermination) {
          return { allowed: false, reason: 'Active contracts with allocated milestones require administrative arbitration or bilateral mutual termination.' };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: `Invalid transition from ACTIVE to ${targetStatus}.` };

    case ContractStatus.DISPUTED:
      // Only Admin or Superadmin arbitration can transition a disputed contract
      if (!isPrivileged) {
        return { allowed: false, reason: 'Only administrative arbitration can resolve a disputed contract.' };
      }
      if (
        targetStatus === ContractStatus.ACTIVE ||
        targetStatus === ContractStatus.COMPLETED ||
        targetStatus === ContractStatus.CANCELLED
      ) {
        return { allowed: true };
      }
      return { allowed: false, reason: `Cannot transition from DISPUTED to ${targetStatus}.` };

    default:
      return { allowed: false, reason: `Unrecognized contract status: ${currentStatus}.` };
  }
}

/**
 * Centralized service function executing a validated contract state transition,
 * persisting the change, creating audit logs, notifying participants, and emitting real-time events.
 */
export async function executeContractTransition(params: {
  contractId: string;
  targetStatus: ContractStatus;
  userId: string;
  userRole: UserRole;
  reason: string;
  isMutualTermination?: boolean;
  tx?: Prisma.TransactionClient;
}) {
  const { contractId, targetStatus, userId, userRole, reason, isMutualTermination, tx } = params;
  const db = tx || prisma;

  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: {
      milestones: true,
      client: { select: { id: true, firstName: true, email: true } },
      worker: { select: { id: true, firstName: true, email: true } },
    },
  });

  if (!contract) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Contract not found' };
  }

  const allMilestonesApproved =
    contract.milestones.length > 0 &&
    contract.milestones.every((m) => m.status === 'APPROVED');

  const validation = validateContractTransition({
    currentStatus: contract.status,
    targetStatus,
    userId,
    clientId: contract.clientId,
    workerId: contract.workerId,
    userRole,
    allMilestonesApproved,
    isMutualTermination,
  });

  if (!validation.allowed) {
    throw {
      statusCode: 400,
      code: 'INVALID_TRANSITION',
      message: validation.reason || `Transition from ${contract.status} to ${targetStatus} is prohibited`,
    };
  }

  const updatedContract = await db.contract.update({
    where: { id: contractId },
    data: { status: targetStatus },
    include: {
      milestones: { orderBy: { order: 'asc' } },
      client: { select: { id: true, firstName: true, email: true } },
      worker: { select: { id: true, firstName: true, email: true } },
    },
  });

  // Emit Real-time event
  emitContractRealtimeEvent(
    contractId,
    'contract:status_updated',
    {
      contractId,
      previousStatus: contract.status,
      newStatus: targetStatus,
      reason,
      updatedBy: userId,
    },
    contract.version,
  );

  // Notify Counterparty
  const otherPartyId = userId === contract.clientId ? contract.workerId : contract.clientId;
  await db.notification.create({
    data: {
      recipientId: otherPartyId,
      title: `Contract Status Updated: ${targetStatus}`,
      message: `Contract #${contract.contractNumber} (${contract.title}) status changed from ${contract.status} to ${targetStatus}. Reason: ${reason}`,
      type: NotificationType.CONTRACT_UPDATE,
      metadata: { contractId, previousStatus: contract.status, newStatus: targetStatus },
    },
  });

  // Record Audit Log
  await recordAuditLog({
    actorId: userId,
    action: `CONTRACT_STATUS_TRANSITION_${targetStatus}`,
    resource: 'Contract',
    resourceId: contractId,
    details: {
      previousStatus: contract.status,
      newStatus: targetStatus,
      reason,
      version: contract.version,
    },
  });

  return updatedContract;
}
