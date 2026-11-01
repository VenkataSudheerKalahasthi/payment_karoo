import { ContractStatus, UserRole } from '@prisma/client';

export interface StateTransitionContext {
  currentStatus: ContractStatus;
  targetStatus: ContractStatus;
  userId: string;
  clientId: string;
  workerId: string;
  userRole: UserRole;
  allMilestonesApproved: boolean;
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
  const { currentStatus, targetStatus, userId, clientId, workerId, userRole, allMilestonesApproved } = ctx;
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
        if (!isWorker && !isPrivileged) {
          return { allowed: false, reason: 'Only the assigned worker can accept and activate the agreement.' };
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
        if (!isPrivileged) {
          return { allowed: false, reason: 'Active contracts with allocated milestones require administrative arbitration to cancel.' };
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

