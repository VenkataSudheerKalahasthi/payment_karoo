import { prisma } from '../../config/prisma.js';
import {
  EscrowStatus,
  EscrowOperationalState,
  UserRole,
  Prisma,
} from '@prisma/client';
import { majorToMinor } from '@trustpay/shared';
import { logger } from '../../utils/logger.js';

export const VALID_ESCROW_TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  [EscrowStatus.NOT_INITIALIZED]: [EscrowStatus.PENDING_FUNDING, EscrowStatus.CANCELLED],
  [EscrowStatus.PENDING_FUNDING]: [EscrowStatus.FUNDING_PROCESSING, EscrowStatus.CANCELLED],
  [EscrowStatus.FUNDING_PROCESSING]: [EscrowStatus.FUNDED, EscrowStatus.FAILED, EscrowStatus.PENDING_FUNDING],
  [EscrowStatus.FUNDED]: [
    EscrowStatus.PARTIALLY_ALLOCATED,
    EscrowStatus.RELEASE_PENDING,
    EscrowStatus.DISPUTED,
    EscrowStatus.REFUND_PENDING,
  ],
  [EscrowStatus.PARTIALLY_ALLOCATED]: [
    EscrowStatus.RELEASE_PENDING,
    EscrowStatus.DISPUTED,
    EscrowStatus.REFUND_PENDING,
  ],
  [EscrowStatus.RELEASE_PENDING]: [
    EscrowStatus.PARTIALLY_RELEASED,
    EscrowStatus.RELEASED,
    EscrowStatus.DISPUTED,
  ],
  [EscrowStatus.PARTIALLY_RELEASED]: [
    EscrowStatus.RELEASE_PENDING,
    EscrowStatus.RELEASED,
    EscrowStatus.DISPUTED,
    EscrowStatus.REFUND_PENDING,
  ],
  [EscrowStatus.RELEASED]: [], // Terminal state
  [EscrowStatus.REFUND_PENDING]: [
    EscrowStatus.PARTIALLY_REFUNDED,
    EscrowStatus.REFUNDED,
    EscrowStatus.DISPUTED,
  ],
  [EscrowStatus.PARTIALLY_REFUNDED]: [
    EscrowStatus.REFUND_PENDING,
    EscrowStatus.REFUNDED,
    EscrowStatus.DISPUTED,
  ],
  [EscrowStatus.REFUNDED]: [], // Terminal state
  [EscrowStatus.DISPUTED]: [
    EscrowStatus.FUNDED,
    EscrowStatus.PARTIALLY_ALLOCATED,
    EscrowStatus.RELEASE_PENDING,
    EscrowStatus.REFUND_PENDING,
  ],
  [EscrowStatus.CANCELLED]: [], // Terminal state
  [EscrowStatus.FAILED]: [EscrowStatus.PENDING_FUNDING, EscrowStatus.CANCELLED],
};

export class EscrowService {
  /**
   * Validates whether an escrow state transition is valid.
   */
  validateTransition(fromStatus: EscrowStatus, toStatus: EscrowStatus): boolean {
    const allowed = VALID_ESCROW_TRANSITIONS[fromStatus] || [];
    return allowed.includes(toStatus);
  }

  /**
   * Strictly READ-ONLY retrieval of contract escrow for an authorized user.
   * NEVER creates, mutates, or side-effects database records on GET.
   */
  async getEscrowForAuthorizedUser(contractId: string, user: { id: string; role: { name: UserRole } }) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        milestones: { orderBy: { order: 'asc' } },
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        worker: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!contract) {
      throw {
        statusCode: 404,
        code: 'CONTRACT_NOT_FOUND',
        message: 'Contract not found',
      };
    }

    const isClient = contract.clientId === user.id;
    const isWorker = contract.workerId === user.id;
    const isAdmin = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

    if (!isClient && !isWorker && !isAdmin) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You are not an authorized participant of this contract escrow.',
      };
    }

    const escrow = await prisma.escrowRecord.findUnique({
      where: { contractId },
      include: {
        milestoneAllocations: {
          include: {
            milestone: { select: { title: true, order: true } },
          },
        },
      },
    });

    if (!escrow) {
      // Calculate prospective contractual minor amount for display without writing to DB
      const currency = contract.currency || 'USD';
      let sumMilestonesMinor = 0n;
      const uninitializedAllocations = contract.milestones.map((m) => {
        const amountMinor = majorToMinor(Number(m.amount), currency);
        sumMilestonesMinor += amountMinor;
        return {
          id: `unallocated_${m.id}`,
          escrowRecordId: '',
          milestoneId: m.id,
          allocatedAmountMinor: amountMinor.toString(),
          releasedAmountMinor: '0',
          refundedAmountMinor: '0',
          isReleased: false,
          releasedAt: null,
          milestoneTitle: m.title,
          milestoneOrder: m.order,
        };
      });

      return {
        id: `uninitialized_${contract.id}`,
        contractId: contract.id,
        status: EscrowStatus.NOT_INITIALIZED,
        currency,
        contractualAmountMinor: sumMilestonesMinor.toString(),
        expectedFundedAmountMinor: sumMilestonesMinor.toString(),
        fundedAmountMinor: '0',
        allocatedAmountMinor: sumMilestonesMinor.toString(),
        releasedAmountMinor: '0',
        refundedAmountMinor: '0',
        remainingBalanceMinor: '0',
        disputeHold: false,
        contractNumber: contract.contractNumber,
        contractTitle: contract.title,
        milestoneAllocations: uninitializedAllocations,
        createdAt: contract.createdAt.toISOString(),
        updatedAt: contract.updatedAt.toISOString(),
      };
    }

    return this.serializeEscrow(escrow, contract);
  }

  /**
   * Explicit POST-only idempotent initialization of contract escrow.
   * Validates milestone allocation totals and contract participant authorization.
   */
  async initializeContractEscrow(contractId: string, actor: { id: string; role: { name: UserRole } }) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        milestones: { orderBy: { order: 'asc' } },
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        worker: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!contract) {
      throw {
        statusCode: 404,
        code: 'CONTRACT_NOT_FOUND',
        message: `Contract "${contractId}" not found.`,
      };
    }

    const isClient = contract.clientId === actor.id;
    const isWorker = contract.workerId === actor.id;
    const isAdmin = actor.role.name === UserRole.ADMIN || actor.role.name === UserRole.SUPERADMIN;

    if (!isClient && !isWorker && !isAdmin) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You are not authorized to initialize escrow for this contract.',
      };
    }

    // 1. Idempotency check: if escrow already exists, return existing record
    const existingEscrow = await prisma.escrowRecord.findUnique({
      where: { contractId },
      include: {
        milestoneAllocations: {
          include: {
            milestone: { select: { title: true, order: true } },
          },
        },
      },
    });

    if (existingEscrow) {
      logger.info(`[ESCROW ALREADY INITIALIZED] Returning existing escrow record ${existingEscrow.id} for contract ${contract.contractNumber}`);
      return this.serializeEscrow(existingEscrow, contract);
    }

    // 2. Validate milestone allocations
    if (!contract.milestones || contract.milestones.length === 0) {
      throw {
        statusCode: 400,
        code: 'NO_MILESTONES',
        message: 'A contract must contain at least one milestone to initialize escrow.',
      };
    }

    const currency = contract.currency || 'USD';
    let sumMilestonesMinor = 0n;

    for (const m of contract.milestones) {
      const amountNum = Number(m.amount);
      if (amountNum <= 0) {
        throw {
          statusCode: 400,
          code: 'INVALID_MILESTONE_AMOUNT',
          message: `Milestone "${m.title}" has non-positive amount (${amountNum}).`,
        };
      }
      sumMilestonesMinor += majorToMinor(amountNum, currency);
    }

    const contractTotalMinor = majorToMinor(Number(contract.totalAmount), currency);
    if (sumMilestonesMinor !== contractTotalMinor) {
      throw {
        statusCode: 400,
        code: 'ALLOCATION_MISMATCH',
        message: `Milestone allocations total (${sumMilestonesMinor.toString()}) does not match contract total amount (${contractTotalMinor.toString()}).`,
      };
    }

    const allocationsData = contract.milestones.map((m) => ({
      milestoneId: m.id,
      allocatedAmountMinor: majorToMinor(Number(m.amount), currency),
    }));

    // 3. Create atomically in transaction
    const newEscrow = await prisma.$transaction(async (tx) => {
      return await tx.escrowRecord.create({
        data: {
          contractId: contract.id,
          status: EscrowStatus.PENDING_FUNDING,
          currency,
          contractualAmountMinor: sumMilestonesMinor,
          expectedFundedAmountMinor: sumMilestonesMinor,
          fundedAmountMinor: 0n,
          allocatedAmountMinor: sumMilestonesMinor,
          releasedAmountMinor: 0n,
          refundedAmountMinor: 0n,
          disputeHold: false,
          milestoneAllocations: {
            create: allocationsData,
          },
        },
        include: {
          milestoneAllocations: {
            include: {
              milestone: { select: { title: true, order: true } },
            },
          },
        },
      });
    });

    logger.info(`[ESCROW INITIALIZED] Contract ${contract.contractNumber} -> EscrowRecord ${newEscrow.id} by actor ${actor.id}`);
    return this.serializeEscrow(newEscrow, contract);
  }

  /**
   * Updates dispute hold on an escrow record.
   */
  async setDisputeHold(contractId: string, disputeHold: boolean, actorId: string, reason: string) {
    const escrow = await prisma.escrowRecord.findUnique({
      where: { contractId },
    });

    if (!escrow) {
      throw {
        statusCode: 404,
        code: 'ESCROW_NOT_FOUND',
        message: `Escrow record for contract "${contractId}" not found.`,
      };
    }

    let nextStatus = escrow.status;
    let nextOperationalState = escrow.operationalState;
    if (disputeHold) {
      nextStatus = EscrowStatus.DISPUTED;
      nextOperationalState = EscrowOperationalState.DISPUTED;
    } else if (escrow.status === EscrowStatus.DISPUTED) {
      nextStatus = EscrowStatus.FUNDED;
      nextOperationalState = EscrowOperationalState.WORK_IN_PROGRESS;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rec = await tx.escrowRecord.update({
        where: { id: escrow.id },
        data: {
          disputeHold,
          status: nextStatus,
          operationalState: nextOperationalState,
        },
        include: {
          milestoneAllocations: {
            include: {
              milestone: { select: { title: true, order: true } },
            },
          },
          contract: true,
        },
      });

      await tx.escrowActivity.create({
        data: {
          escrowRecordId: escrow.id,
          actorId,
          operationalState: nextOperationalState,
          previousState: escrow.operationalState,
          eventType: disputeHold ? 'ESCROW_DISPUTE_HOLD_ACTIVATED' : 'ESCROW_DISPUTE_HOLD_CLEARED',
          description: `Dispute hold ${disputeHold ? 'activated' : 'cleared'} by actor ${actorId}. Reason: ${reason}`,
          isLiveFinancialMovement: false,
        },
      });

      return rec;
    });

    logger.info(`[ESCROW DISPUTE HOLD] Escrow ${escrow.id} disputeHold=${disputeHold} by actor ${actorId}. Reason: ${reason}`);
    return this.serializeEscrow(updated, updated.contract);
  }

  /**
   * Records an immutable EscrowActivity audit log.
   */
  async recordActivity(data: {
    escrowRecordId: string;
    milestoneId?: string | null;
    actorId?: string | null;
    operationalState: EscrowOperationalState;
    previousState?: EscrowOperationalState | null;
    eventType: string;
    description: string;
    metadata?: Record<string, unknown> | null;
    isLiveFinancialMovement?: boolean;
  }) {
    return prisma.escrowActivity.create({
      data: {
        escrowRecordId: data.escrowRecordId,
        milestoneId: data.milestoneId || null,
        actorId: data.actorId || null,
        operationalState: data.operationalState,
        previousState: data.previousState || null,
        eventType: data.eventType,
        description: data.description,
        metadata: (data.metadata as Prisma.InputJsonValue) || Prisma.JsonNull,
        isLiveFinancialMovement: data.isLiveFinancialMovement ?? false,
      },
    });
  }

  /**
   * Retrieves all immutable escrow activity entries for a contract.
   */
  async getActivities(contractId: string, actor: { id: string; role: { name: UserRole } }) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, clientId: true, workerId: true },
    });

    if (!contract) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Contract not found' };
    }

    const isParticipant = contract.clientId === actor.id || contract.workerId === actor.id;
    const isAdmin = actor.role.name === UserRole.ADMIN || actor.role.name === UserRole.SUPERADMIN;

    if (!isParticipant && !isAdmin) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Access denied to escrow activities' };
    }

    const escrow = await prisma.escrowRecord.findUnique({ where: { contractId } });
    if (!escrow) return [];

    const activities = await prisma.escrowActivity.findMany({
      where: { escrowRecordId: escrow.id },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return activities.map((a) => ({
      id: a.id,
      escrowRecordId: a.escrowRecordId,
      contractId,
      milestoneId: a.milestoneId,
      actorId: a.actorId,
      actorName: a.actor ? `${a.actor.firstName || ''} ${a.actor.lastName || ''}`.trim() || a.actor.email : 'System',
      operationalState: a.operationalState,
      previousState: a.previousState,
      eventType: a.eventType,
      description: a.description,
      metadata: a.metadata,
      isLiveFinancialMovement: a.isLiveFinancialMovement,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  /**
   * Lists all escrow records across the platform (Admin/Superadmin).
   */
  async listEscrows(filter: { page?: number; limit?: number; status?: EscrowStatus }) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.EscrowRecordWhereInput = {};
    if (filter.status) where.status = filter.status;

    const [total, escrows] = await Promise.all([
      prisma.escrowRecord.count({ where }),
      prisma.escrowRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contract: {
            select: {
              contractNumber: true,
              title: true,
              client: { select: { firstName: true, lastName: true, email: true } },
              worker: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          milestoneAllocations: {
            include: {
              milestone: { select: { title: true, order: true } },
            },
          },
        },
      }),
    ]);

    const items = escrows.map((e) => this.serializeEscrow(e, e.contract));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Serializes an EscrowRecord entity with string-formatted minor units.
   */
  private serializeEscrow(
    escrow: {
      id: string;
      contractId: string;
      status: EscrowStatus;
      operationalState?: EscrowOperationalState;
      currency: string;
      contractualAmountMinor: bigint;
      expectedFundedAmountMinor: bigint;
      fundedAmountMinor: bigint;
      allocatedAmountMinor: bigint;
      releasedAmountMinor: bigint;
      refundedAmountMinor: bigint;
      disputeHold: boolean;
      createdAt: Date;
      updatedAt: Date;
      milestoneAllocations?: Array<{
        id: string;
        escrowRecordId: string;
        milestoneId: string;
        allocatedAmountMinor: bigint;
        releasedAmountMinor: bigint;
        refundedAmountMinor: bigint;
        isReleased: boolean;
        releasedAt: Date | null;
        milestone?: { title: string; order: number };
      }>;
    },
    contract?: { contractNumber?: string; title?: string } | null,
  ) {
    const remaining = escrow.fundedAmountMinor - escrow.releasedAmountMinor - escrow.refundedAmountMinor;

    return {
      id: escrow.id,
      contractId: escrow.contractId,
      status: escrow.status,
      operationalState: escrow.operationalState || EscrowOperationalState.PAYMENT_VERIFIED_SANDBOX,
      currency: escrow.currency,
      contractualAmountMinor: escrow.contractualAmountMinor.toString(),
      expectedFundedAmountMinor: escrow.expectedFundedAmountMinor.toString(),
      fundedAmountMinor: escrow.fundedAmountMinor.toString(),
      allocatedAmountMinor: escrow.allocatedAmountMinor.toString(),
      releasedAmountMinor: escrow.releasedAmountMinor.toString(),
      refundedAmountMinor: escrow.refundedAmountMinor.toString(),
      remainingBalanceMinor: remaining.toString(),
      disputeHold: escrow.disputeHold,
      contractNumber: contract?.contractNumber,
      contractTitle: contract?.title,
      milestoneAllocations: escrow.milestoneAllocations?.map((m) => ({
        id: m.id,
        escrowRecordId: m.escrowRecordId,
        milestoneId: m.milestoneId,
        allocatedAmountMinor: m.allocatedAmountMinor.toString(),
        releasedAmountMinor: m.releasedAmountMinor.toString(),
        refundedAmountMinor: m.refundedAmountMinor.toString(),
        isReleased: m.isReleased,
        releasedAt: m.releasedAt?.toISOString() || null,
        milestoneTitle: m.milestone?.title,
        milestoneOrder: m.milestone?.order,
      })),
      createdAt: escrow.createdAt.toISOString(),
      updatedAt: escrow.updatedAt.toISOString(),
    };
  }
}

export const escrowService = new EscrowService();

