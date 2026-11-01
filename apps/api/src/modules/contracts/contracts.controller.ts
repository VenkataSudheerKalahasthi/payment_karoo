import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import {
  Prisma,
  UserRole,
  ContractStatus,
  MilestoneStatus,
  SubmissionStatus,
  NotificationType,
} from '@prisma/client';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { validateContractTransition } from './contracts.state-machine.js';
import {
  CreateContractInput,
  AcceptContractInput,
  AmendContractInput,
  UpdateContractStatusInput,
  CreateSubmissionInput,
  CreateRevisionInput,
} from './contracts.schema.js';
import {
  streamContractPdf,
  computeCanonicalContractHash,
} from './contract-pdf.service.js';

export async function createContract(req: Request, res: Response): Promise<void> {
  const client = req.user!;
  const input = req.body as CreateContractInput;

  try {
    // 1. Verify worker exists and has the WORKER role
    const worker = await prisma.user.findUnique({
      where: { id: input.workerId },
      include: { role: true },
    });

    if (!worker || worker.role.name !== UserRole.WORKER) {
      sendError(
        res,
        400,
        'INVALID_WORKER',
        'Specified worker was not found or does not possess the WORKER role',
      );
      return;
    }

    if (worker.id === client.id) {
      sendError(res, 400, 'SELF_CONTRACT_PROHIBITED', 'A client cannot create a contract with themselves');
      return;
    }

    // 2. Calculate total contract amount strictly from milestone amounts
    const totalAmount = input.milestones.reduce((acc, m) => acc + m.amount, 0);
    const contractNumber = `TPE-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      100 + Math.random() * 900,
    )}`;

    // 3. Atomically create contract, milestones, conversation, and notification
    const contract = await prisma.$transaction(async (tx) => {
      const createdContract = await tx.contract.create({
        data: {
          contractNumber,
          title: input.title,
          description: input.description,
          clientId: client.id,
          workerId: worker.id,
          status: ContractStatus.PENDING_ACCEPTANCE,
          totalAmount: new Prisma.Decimal(totalAmount),
          currency: input.currency || 'USD',
          scopeOfWork: input.scopeOfWork || input.description,
          termsAndConditions: input.termsAndConditions || 'Standard TrustPay Digital Escrow Agreement terms and dispute conditions apply.',
          cancellationTerms: input.cancellationTerms || 'Cancellation permitted prior to activation, or by mutual consent/arbitration when active.',
          revisionTerms: input.revisionTerms || 'Up to 2 standard revision cycles per milestone deliverable.',
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          milestones: {
            create: input.milestones.map((m, idx) => ({
              title: m.title,
              description: m.description,
              amount: new Prisma.Decimal(m.amount),
              order: m.order ?? idx + 1,
              dueDate: m.dueDate ? new Date(m.dueDate) : null,
              status: MilestoneStatus.PENDING,
            })),
          },
        },
        include: {
          milestones: { orderBy: { order: 'asc' } },
          client: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          worker: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      // Initialize dedicated contract conversation
      const conversation = await tx.conversation.create({
        data: {
          title: `Contract Discussion: ${createdContract.title}`,
          contractId: createdContract.id,
          participants: {
            create: [{ userId: client.id }, { userId: worker.id }],
          },
        },
      });

      // Notify the worker of the new contract proposal
      await tx.notification.create({
        data: {
          recipientId: worker.id,
          title: 'New Digital Contract Proposed',
          message: `${client.firstName || client.email} proposed contract "${createdContract.title}" for $${totalAmount}.`,
          type: NotificationType.CONTRACT_UPDATE,
          metadata: { contractId: createdContract.id, conversationId: conversation.id },
        },
      });

      return createdContract;
    });

    await recordAuditLog({
      actorId: client.id,
      action: 'CONTRACT_CREATED',
      resource: 'Contract',
      resourceId: contract.id,
      details: {
        contractNumber,
        totalAmount,
        workerId: worker.id,
      },
      req,
    });

    sendSuccess(res, 201, contract);
  } catch (error) {
    logger.error('Error creating contract:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to initialize digital contract');
  }
}

export async function listContracts(req: Request, res: Response): Promise<void> {
  const currentUser = req.user!;
  const isPrivileged =
    currentUser.role.name === UserRole.ADMIN || currentUser.role.name === UserRole.SUPERADMIN;

  const where: Prisma.ContractWhereInput = {};

  if (!isPrivileged) {
    if (currentUser.role.name === UserRole.CLIENT) {
      where.clientId = currentUser.id;
    } else if (currentUser.role.name === UserRole.WORKER) {
      where.workerId = currentUser.id;
    }
  }

  try {
    const contracts = await prisma.contract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        worker: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        acceptances: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        milestones: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { submissions: true } },
          },
        },
      },
    });

    sendSuccess(res, 200, contracts);
  } catch (error) {
    logger.error('Error listing contracts:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Could not load contracts');
  }
}

export async function getContractById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const currentUser = req.user!;
  const isPrivileged =
    currentUser.role.name === UserRole.ADMIN || currentUser.role.name === UserRole.SUPERADMIN;

  try {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        worker: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        acceptances: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        milestones: {
          orderBy: { order: 'asc' },
          include: {
            submissions: {
              orderBy: { submittedAt: 'desc' },
              include: {
                worker: { select: { id: true, firstName: true, lastName: true } },
                revisionRequests: {
                  include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!contract) {
      sendError(res, 404, 'NOT_FOUND', 'Contract not found');
      return;
    }

    // Strict resource ownership check: only parties to the contract or governance administrators may view
    if (
      !isPrivileged &&
      contract.clientId !== currentUser.id &&
      contract.workerId !== currentUser.id
    ) {
      await recordAuditLog({
        actorId: currentUser.id,
        action: 'UNAUTHORIZED_CONTRACT_ACCESS_ATTEMPT',
        resource: 'Contract',
        resourceId: id,
        req,
      });

      sendError(res, 403, 'FORBIDDEN', 'Access denied to this contract');
      return;
    }

    sendSuccess(res, 200, contract);
  } catch (error) {
    logger.error('Error fetching contract by ID:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve contract details');
  }
}

export async function updateContractStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const currentUser = req.user!;
  const input = req.body as UpdateContractStatusInput;
  const isPrivileged =
    currentUser.role.name === UserRole.ADMIN || currentUser.role.name === UserRole.SUPERADMIN;

  try {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { milestones: true },
    });

    if (!contract) {
      sendError(res, 404, 'NOT_FOUND', 'Contract not found');
      return;
    }

    if (
      !isPrivileged &&
      contract.clientId !== currentUser.id &&
      contract.workerId !== currentUser.id
    ) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied to update contract status');
      return;
    }

    // Enforce formal finite state machine for all contract lifecycle transitions
    const allMilestonesApproved =
      contract.milestones.length > 0 &&
      contract.milestones.every((m) => m.status === MilestoneStatus.APPROVED);

    const validation = validateContractTransition({
      currentStatus: contract.status,
      targetStatus: input.status,
      userId: currentUser.id,
      clientId: contract.clientId,
      workerId: contract.workerId,
      userRole: currentUser.role.name,
      allMilestonesApproved,
    });

    if (!validation.allowed) {
      await recordAuditLog({
        actorId: currentUser.id,
        action: 'INVALID_CONTRACT_TRANSITION_ATTEMPT',
        resource: 'Contract',
        resourceId: contract.id,
        details: {
          currentStatus: contract.status,
          targetStatus: input.status,
          reason: validation.reason,
        },
        req,
      });

      sendError(res, 400, 'INVALID_TRANSITION', validation.reason || 'Invalid contract state transition');
      return;
    }

    const updated = await prisma.contract.update({
      where: { id },
      data: { status: input.status },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        worker: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Notify counterpart of status transition
    const recipientId = currentUser.id === contract.clientId ? contract.workerId : contract.clientId;
    await prisma.notification.create({
      data: {
        recipientId,
        title: 'Contract Status Updated',
        message: `Contract "${contract.title}" status changed to ${input.status}.`,
        type: NotificationType.CONTRACT_UPDATE,
        metadata: { contractId: contract.id, status: input.status },
      },
    });

    await recordAuditLog({
      actorId: currentUser.id,
      action: 'CONTRACT_STATUS_TRANSITION',
      resource: 'Contract',
      resourceId: contract.id,
      details: {
        previousStatus: contract.status,
        newStatus: input.status,
        reason: input.reason,
      },
      req,
    });

    sendSuccess(res, 200, updated);
  } catch (error) {
    logger.error('Error updating contract status:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update contract status');
  }
}

export async function submitMilestone(req: Request, res: Response): Promise<void> {
  const { id: contractId, milestoneId } = req.params;
  const worker = req.user!;
  const input = req.body as CreateSubmissionInput;

  try {
    const milestone = await prisma.contractMilestone.findFirst({
      where: { id: milestoneId, contractId },
      include: { contract: true },
    });

    if (!milestone) {
      sendError(res, 404, 'NOT_FOUND', 'Milestone not found in target contract');
      return;
    }

    // Strict validation: Only the assigned worker can submit milestone deliverables
    if (milestone.contract.workerId !== worker.id) {
      sendError(res, 403, 'FORBIDDEN', 'Only the assigned worker can submit milestone deliverables');
      return;
    }

    if (milestone.contract.status !== ContractStatus.ACTIVE) {
      sendError(
        res,
        400,
        'INVALID_CONTRACT_STATE',
        `Deliverables can only be submitted for ACTIVE contracts (current: ${milestone.contract.status})`,
      );
      return;
    }

    if (milestone.status === MilestoneStatus.APPROVED) {
      sendError(res, 400, 'ALREADY_APPROVED', 'This milestone deliverable has already been approved and cannot be resubmitted');
      return;
    }

    if (milestone.status === MilestoneStatus.CANCELLED) {
      sendError(res, 400, 'MILESTONE_CANCELLED', 'This milestone deliverable is cancelled');
      return;
    }

    const submission = await prisma.$transaction(async (tx) => {
      const createdSubmission = await tx.milestoneSubmission.create({
        data: {
          milestoneId: milestone.id,
          workerId: worker.id,
          notes: input.notes,
          attachmentUrls: input.attachmentUrls,
          status: SubmissionStatus.SUBMITTED,
        },
      });

      await tx.contractMilestone.update({
        where: { id: milestone.id },
        data: { status: MilestoneStatus.SUBMITTED },
      });

      await tx.notification.create({
        data: {
          recipientId: milestone.contract.clientId,
          title: 'Milestone Work Submitted',
          message: `${worker.firstName || worker.email} submitted deliverable for "${milestone.title}".`,
          type: NotificationType.MILESTONE_SUBMITTED,
          metadata: {
            contractId: milestone.contractId,
            milestoneId: milestone.id,
            submissionId: createdSubmission.id,
          },
        },
      });

      return createdSubmission;
    });

    await recordAuditLog({
      actorId: worker.id,
      action: 'MILESTONE_SUBMITTED',
      resource: 'MilestoneSubmission',
      resourceId: submission.id,
      details: { milestoneId: milestone.id, contractId },
      req,
    });

    sendSuccess(res, 201, submission);
  } catch (error) {
    logger.error('Error submitting milestone deliverable:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to process milestone submission');
  }
}

export async function requestRevision(req: Request, res: Response): Promise<void> {
  const { id: contractId, milestoneId } = req.params;
  const client = req.user!;
  const input = req.body as CreateRevisionInput;

  try {
    const milestone = await prisma.contractMilestone.findFirst({
      where: { id: milestoneId, contractId },
      include: { contract: true },
    });

    if (!milestone) {
      sendError(res, 404, 'NOT_FOUND', 'Milestone not found');
      return;
    }

    // Only the contract client can request revisions
    if (milestone.contract.clientId !== client.id) {
      sendError(res, 403, 'FORBIDDEN', 'Only the contract client can request milestone revisions');
      return;
    }

    if (milestone.status !== MilestoneStatus.SUBMITTED) {
      sendError(
        res,
        400,
        'INVALID_STATE',
        `Revisions can only be requested for SUBMITTED milestones (current: ${milestone.status})`,
      );
      return;
    }

    // Verify target submission belongs to this milestone to prevent IDOR
    const targetSubmission = await prisma.milestoneSubmission.findFirst({
      where: { id: input.submissionId, milestoneId: milestone.id },
    });

    if (!targetSubmission) {
      sendError(res, 404, 'SUBMISSION_NOT_FOUND', 'Specified submission was not found on this milestone');
      return;
    }

    const revision = await prisma.$transaction(async (tx) => {
      const createdRevision = await tx.revisionRequest.create({
        data: {
          submissionId: input.submissionId,
          requestedById: client.id,
          reason: input.reason,
        },
      });

      await tx.contractMilestone.update({
        where: { id: milestone.id },
        data: { status: MilestoneStatus.IN_REVISION },
      });

      await tx.milestoneSubmission.update({
        where: { id: input.submissionId },
        data: { status: SubmissionStatus.REJECTED },
      });

      await tx.notification.create({
        data: {
          recipientId: milestone.contract.workerId,
          title: 'Revision Requested on Deliverable',
          message: `${client.firstName || client.email} requested a revision on "${milestone.title}".`,
          type: NotificationType.REVISION_REQUESTED,
          metadata: {
            contractId: milestone.contractId,
            milestoneId: milestone.id,
            revisionId: createdRevision.id,
          },
        },
      });

      return createdRevision;
    });

    await recordAuditLog({
      actorId: client.id,
      action: 'REVISION_REQUESTED',
      resource: 'RevisionRequest',
      resourceId: revision.id,
      details: { milestoneId: milestone.id, submissionId: input.submissionId },
      req,
    });

    sendSuccess(res, 201, revision);
  } catch (error) {
    logger.error('Error requesting revision:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to record revision request');
  }
}

export async function approveMilestone(req: Request, res: Response): Promise<void> {
  const { id: contractId, milestoneId } = req.params;
  const client = req.user!;

  try {
    const milestone = await prisma.contractMilestone.findFirst({
      where: { id: milestoneId, contractId },
      include: {
        contract: true,
        submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
      },
    });

    if (!milestone) {
      sendError(res, 404, 'NOT_FOUND', 'Milestone not found in target contract');
      return;
    }

    if (milestone.contract.clientId !== client.id && client.role.name !== UserRole.SUPERADMIN) {
      sendError(res, 403, 'FORBIDDEN', 'Only the contract client can approve milestone deliverables');
      return;
    }

    if (milestone.status !== MilestoneStatus.SUBMITTED) {
      sendError(res, 400, 'INVALID_STATE', 'Only submitted milestones can be approved');
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const approvedMilestone = await tx.contractMilestone.update({
        where: { id: milestone.id },
        data: { status: MilestoneStatus.APPROVED },
      });

      if (milestone.submissions.length > 0) {
        await tx.milestoneSubmission.update({
          where: { id: milestone.submissions[0].id },
          data: { status: SubmissionStatus.APPROVED },
        });
      }

      await tx.notification.create({
        data: {
          recipientId: milestone.contract.workerId,
          title: 'Milestone Approved',
          message: `${client.firstName || client.email} approved milestone "${milestone.title}".`,
          type: NotificationType.CONTRACT_UPDATE,
          metadata: { contractId: milestone.contractId, milestoneId: milestone.id },
        },
      });

      return approvedMilestone;
    });

    await recordAuditLog({
      actorId: client.id,
      action: 'MILESTONE_APPROVED',
      resource: 'ContractMilestone',
      resourceId: milestone.id,
      details: { contractId },
      req,
    });

    sendSuccess(res, 200, updated);
  } catch (error) {
    logger.error('Error approving milestone:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to approve milestone deliverable');
  }
}

/**
 * Worker starts work on a milestone (changes status from PENDING to IN_PROGRESS).
 */
export async function startMilestone(req: Request, res: Response): Promise<void> {
  const { id: contractId, milestoneId } = req.params;
  const worker = req.user!;

  try {
    const milestone = await prisma.contractMilestone.findFirst({
      where: { id: milestoneId, contractId },
      include: { contract: true },
    });

    if (!milestone) {
      sendError(res, 404, 'NOT_FOUND', 'Milestone not found in target contract');
      return;
    }

    if (milestone.contract.workerId !== worker.id) {
      sendError(res, 403, 'FORBIDDEN', 'Only the assigned worker can start work on this milestone');
      return;
    }

    if (milestone.contract.status !== ContractStatus.ACTIVE) {
      sendError(res, 400, 'INVALID_STATE', 'Work can only begin on an ACTIVE contract');
      return;
    }

    if (milestone.status !== MilestoneStatus.PENDING && milestone.status !== MilestoneStatus.IN_REVISION) {
      sendError(res, 400, 'INVALID_STATE', `Cannot start milestone currently in ${milestone.status} status`);
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.contractMilestone.update({
        where: { id: milestone.id },
        data: { status: MilestoneStatus.IN_PROGRESS },
      });

      await tx.notification.create({
        data: {
          recipientId: milestone.contract.clientId,
          title: 'Work Started on Milestone',
          message: `${worker.firstName || worker.email} commenced work on milestone "${milestone.title}".`,
          type: NotificationType.CONTRACT_UPDATE,
          metadata: { contractId, milestoneId: milestone.id },
        },
      });

      return result;
    });

    await recordAuditLog({
      actorId: worker.id,
      action: 'MILESTONE_STARTED',
      resource: 'ContractMilestone',
      resourceId: milestone.id,
      details: { contractId },
      req,
    });

    sendSuccess(res, 200, updated);
  } catch (error) {
    logger.error('Error starting milestone:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update milestone status');
  }
}

/**
 * Digital contract acceptance by Client or Worker.
 * When both parties accept the active version, contract transitions to ACTIVE.
 * Concurrency-safe: performs lookups and mutual sign-off checks inside a database transaction.
 */
export async function acceptContract(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;
  const input = req.body as AcceptContractInput;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch fresh contract inside transaction
      const contract = await tx.contract.findUnique({
        where: { id },
        include: {
          acceptances: true,
          milestones: { orderBy: { order: 'asc' } },
          client: { select: { id: true, firstName: true, email: true } },
          worker: { select: { id: true, firstName: true, email: true } },
        },
      });

      if (!contract) {
        throw { statusCode: 404, code: 'NOT_FOUND', message: 'Contract not found' };
      }

      const isClient = contract.clientId === user.id;
      const isWorker = contract.workerId === user.id;

      if (!isClient && !isWorker) {
        throw {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Only the contract client or assigned worker can accept contract terms',
        };
      }

      if (contract.status !== ContractStatus.PENDING_ACCEPTANCE) {
        throw {
          statusCode: 400,
          code: 'INVALID_STATE',
          message: `Contract is in ${contract.status} status and cannot be accepted`,
        };
      }

      // Concurrency / Stale version guard
      if (input.expectedVersion !== undefined && input.expectedVersion !== contract.version) {
        throw {
          statusCode: 409,
          code: 'STALE_CONTRACT_VERSION',
          message: `Contract version has changed (current: v${contract.version}, submitted: v${input.expectedVersion}). Please review and accept the updated terms.`,
        };
      }

      // Check if this party already accepted THIS version
      const alreadyAccepted = contract.acceptances.some(
        (a) => a.userId === user.id && a.version === contract.version,
      );

      if (alreadyAccepted) {
        throw {
          statusCode: 400,
          code: 'ALREADY_ACCEPTED',
          message: 'You have already recorded acceptance for this contract version',
        };
      }

      // Compute deterministic canonical document hash
      const docHash = computeCanonicalContractHash({
        contractNumber: contract.contractNumber,
        version: contract.version,
        title: contract.title,
        totalAmount: contract.totalAmount.toNumber(),
        currency: contract.currency,
        clientId: contract.clientId,
        workerId: contract.workerId,
        scopeOfWork: contract.scopeOfWork,
        termsAndConditions: contract.termsAndConditions,
        cancellationTerms: contract.cancellationTerms,
        revisionTerms: contract.revisionTerms,
        milestones: contract.milestones.map((m) => ({
          order: m.order,
          title: m.title,
          description: m.description,
          amount: m.amount.toNumber(),
        })),
      });

      // Record individual digital sign-off
      const acceptance = await tx.contractAcceptance.create({
        data: {
          contractId: contract.id,
          userId: user.id,
          version: contract.version,
          role: user.role.name,
          acceptanceMethod: input.acceptanceMethod || 'DIGITAL_CONFIRMATION',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          documentHash: docHash,
        },
      });

      // Check if counterparty has already accepted this exact version
      const otherPartyId = isClient ? contract.workerId : contract.clientId;
      const otherAccepted = contract.acceptances.some(
        (a) => a.userId === otherPartyId && a.version === contract.version,
      );

      let updatedContract = contract;

      if (otherAccepted) {
        // Both parties have accepted the exact same version: activate contract!
        updatedContract = await tx.contract.update({
          where: { id: contract.id },
          data: {
            status: ContractStatus.ACTIVE,
            documentHash: docHash,
          },
          include: {
            milestones: { orderBy: { order: 'asc' } },
            acceptances: true,
            client: { select: { id: true, firstName: true, email: true } },
            worker: { select: { id: true, firstName: true, email: true } },
          },
        });

        // Notify both parties of activation
        await tx.notification.createMany({
          data: [
            {
              recipientId: contract.clientId,
              title: 'Contract Activated',
              message: `Contract #${contract.contractNumber} (${contract.title}) has been mutually signed by both parties and is now ACTIVE.`,
              type: NotificationType.CONTRACT_ACCEPTED,
              metadata: { contractId: contract.id, version: contract.version },
            },
            {
              recipientId: contract.workerId,
              title: 'Contract Activated',
              message: `Contract #${contract.contractNumber} (${contract.title}) has been mutually signed by both parties and is now ACTIVE.`,
              type: NotificationType.CONTRACT_ACCEPTED,
              metadata: { contractId: contract.id, version: contract.version },
            },
          ],
        });
      } else {
        // Notify the other party that this party has signed
        await tx.notification.create({
          data: {
            recipientId: otherPartyId,
            title: 'Contract Terms Accepted',
            message: `${user.firstName || user.email} signed Contract #${contract.contractNumber} (v${contract.version}). Awaiting your digital acceptance to activate.`,
            type: NotificationType.CONTRACT_UPDATE,
            metadata: { contractId: contract.id, version: contract.version },
          },
        });
      }

      return { acceptance, contract: updatedContract, fullyActivated: otherAccepted, version: contract.version };
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'CONTRACT_DIGITALLY_ACCEPTED',
      resource: 'Contract',
      resourceId: id,
      details: { version: result.version, method: input.acceptanceMethod, fullyActivated: result.fullyActivated },
      req,
    });

    sendSuccess(res, 200, result);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string } | undefined;
    if (err?.statusCode) {
      sendError(res, err.statusCode, err.code || 'ERROR', err.message || 'Operation failed');
      return;
    }
    logger.error('Error accepting contract:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to record digital acceptance');
  }
}

/**
 * Propose an amendment to an active or pending contract (Client or Worker).
 * Increments contract version, resets status to PENDING_ACCEPTANCE,
 * and clears active documentHash. Previous acceptance records remain
 * immutably archived with their original versions.
 */
export async function amendContract(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;
  const input = req.body as AmendContractInput;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({
        where: { id },
        include: { milestones: true },
      });

      if (!contract) {
        throw { statusCode: 404, code: 'NOT_FOUND', message: 'Contract not found' };
      }

      if (contract.clientId !== user.id && contract.workerId !== user.id) {
        throw { statusCode: 403, code: 'FORBIDDEN', message: 'Only contract parties can propose amendments' };
      }

      if (contract.status !== ContractStatus.PENDING_ACCEPTANCE && contract.status !== ContractStatus.ACTIVE) {
        throw {
          statusCode: 400,
          code: 'INVALID_STATE',
          message: `Cannot amend contract in ${contract.status} status. Only PENDING_ACCEPTANCE or ACTIVE contracts can be amended.`,
        };
      }

      // Optimistic concurrency check against race conditions
      if (contract.version !== input.expectedVersion) {
        throw {
          statusCode: 409,
          code: 'VERSION_CONFLICT',
          message: `Contract version conflict: Expected v${input.expectedVersion}, but current contract is v${contract.version}.`,
        };
      }

      const newVersion = contract.version + 1;
      let newTotalAmount = contract.totalAmount;

      if (input.milestones && input.milestones.length > 0) {
        const total = input.milestones.reduce((acc, m) => acc + m.amount, 0);
        newTotalAmount = new Prisma.Decimal(total);

        // Replace milestones atomically for the new amended version
        await tx.contractMilestone.deleteMany({ where: { contractId: contract.id } });
        await tx.contractMilestone.createMany({
          data: input.milestones.map((m, idx) => ({
            contractId: contract.id,
            title: m.title,
            description: m.description,
            amount: new Prisma.Decimal(m.amount),
            order: m.order ?? idx + 1,
            dueDate: m.dueDate ? new Date(m.dueDate) : null,
            status: MilestoneStatus.PENDING,
          })),
        });
      }

      const amended = await tx.contract.update({
        where: { id: contract.id },
        data: {
          version: newVersion,
          status: ContractStatus.PENDING_ACCEPTANCE,
          documentHash: null, // Cleared until both parties accept the new version
          totalAmount: newTotalAmount,
          title: input.title ?? contract.title,
          description: input.description ?? contract.description,
          scopeOfWork: input.scopeOfWork ?? contract.scopeOfWork,
          termsAndConditions: input.termsAndConditions ?? contract.termsAndConditions,
          cancellationTerms: input.cancellationTerms ?? contract.cancellationTerms,
          revisionTerms: input.revisionTerms ?? contract.revisionTerms,
        },
        include: {
          milestones: { orderBy: { order: 'asc' } },
          acceptances: true,
          client: { select: { id: true, firstName: true, email: true } },
          worker: { select: { id: true, firstName: true, email: true } },
        },
      });

      const recipientId = user.id === contract.clientId ? contract.workerId : contract.clientId;
      await tx.notification.create({
        data: {
          recipientId,
          title: 'Contract Amendment Proposed',
          message: `${user.firstName || user.email} proposed an amendment to Contract #${contract.contractNumber} (v${newVersion}). Fresh acceptance is required.`,
          type: NotificationType.CONTRACT_UPDATE,
          metadata: { contractId: contract.id, version: newVersion },
        },
      });

      return amended;
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'CONTRACT_AMENDMENT_PROPOSED',
      resource: 'Contract',
      resourceId: id,
      details: { newVersion: updated.version, expectedVersion: input.expectedVersion },
      req,
    });

    sendSuccess(res, 200, updated);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string } | undefined;
    if (err?.statusCode) {
      sendError(res, err.statusCode, err.code || 'ERROR', err.message || 'Operation failed');
      return;
    }
    logger.error('Error amending contract:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to propose contract amendment');
  }
}

/**
 * Generate and stream professional Contract PDF document using PDFKit.
 * Strictly verifies participant authorization and verifies cryptographic integrity against tampering.
 */
export async function downloadContractPdf(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;
  const isPrivileged = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

  try {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        client: { select: { firstName: true, lastName: true, email: true } },
        worker: { select: { firstName: true, lastName: true, email: true } },
        milestones: {
          orderBy: { order: 'asc' },
          select: { order: true, title: true, description: true, amount: true, status: true, dueDate: true },
        },
        acceptances: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!contract) {
      sendError(res, 404, 'NOT_FOUND', 'Contract not found');
      return;
    }

    if (!isPrivileged && contract.clientId !== user.id && contract.workerId !== user.id) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied to this contract document');
      return;
    }

    // Verify document hash integrity if contract is ACTIVE or COMPLETED
    if (contract.status === ContractStatus.ACTIVE || contract.status === ContractStatus.COMPLETED) {
      const canonicalHash = computeCanonicalContractHash({
        contractNumber: contract.contractNumber,
        version: contract.version,
        title: contract.title,
        totalAmount: contract.totalAmount.toNumber(),
        currency: contract.currency,
        clientId: contract.clientId,
        workerId: contract.workerId,
        scopeOfWork: contract.scopeOfWork,
        termsAndConditions: contract.termsAndConditions,
        cancellationTerms: contract.cancellationTerms,
        revisionTerms: contract.revisionTerms,
        milestones: contract.milestones.map((m) => ({
          order: m.order,
          title: m.title,
          description: m.description,
          amount: m.amount.toNumber(),
        })),
      });

      if (contract.documentHash && contract.documentHash !== canonicalHash) {
        logger.warn(
          `Security Alert: Document hash mismatch on Contract #${contract.contractNumber}. Stored: ${contract.documentHash}, Computed: ${canonicalHash}`,
        );
        res.setHeader('X-TrustPay-Integrity-Status', 'MISMATCH_DETECTED');
        await recordAuditLog({
          actorId: user.id,
          action: 'CONTRACT_INTEGRITY_HASH_MISMATCH_DETECTED',
          resource: 'Contract',
          resourceId: contract.id,
          details: { storedHash: contract.documentHash, canonicalHash, version: contract.version },
          req,
        });
      } else {
        res.setHeader('X-TrustPay-Integrity-Status', 'VERIFIED');
      }
    }

    // Stream PDF
    streamContractPdf(res, {
      contractNumber: contract.contractNumber,
      title: contract.title,
      description: contract.description,
      scopeOfWork: contract.scopeOfWork,
      termsAndConditions: contract.termsAndConditions,
      cancellationTerms: contract.cancellationTerms,
      revisionTerms: contract.revisionTerms,
      version: contract.version,
      totalAmount: contract.totalAmount.toNumber(),
      currency: contract.currency,
      status: contract.status,
      startDate: contract.startDate,
      endDate: contract.endDate,
      client: contract.client,
      worker: contract.worker,
      milestones: contract.milestones.map((m) => ({
        ...m,
        amount: m.amount.toNumber(),
      })),
      acceptances: contract.acceptances.map((a) => ({
        role: a.role,
        acceptedAt: a.acceptedAt,
        acceptanceMethod: a.acceptanceMethod,
        ipAddress: a.ipAddress,
        documentHash: a.documentHash,
        user: a.user,
      })),
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'CONTRACT_PDF_DOWNLOADED',
      resource: 'Contract',
      resourceId: contract.id,
      req,
    });
  } catch (error) {
    logger.error('Error generating contract PDF:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to generate contract PDF document');
  }
}

