import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import {
  Prisma,
  UserRole,
  ContractStatus,
  MilestoneStatus,
  SubmissionStatus,
  NotificationType,
  EscrowOperationalState,
  EscrowStatus,
  AmendmentStatus,
  TerminationStatus,
} from '@prisma/client';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { validateContractTransition, executeContractTransition } from './contracts.state-machine.js';
import {
  createContractVersionSnapshot,
  listContractVersions,
  verifyContractIntegrity,
  getContractActivityHistory,
} from './contract-version.service.js';
import { emitContractRealtimeEvent } from '../realtime/socket.service.js';
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
  formatStampDate,
} from './contract-pdf.service.js';
import { executeMilestoneTransition } from './milestones.state-machine.js';
import { projectsService } from '../projects/projects.service.js';

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

    // PART 15: CONTRACT CREATION ELIGIBILITY ENFORCEMENT
    let resolvedJobProposalId = (input as any).jobProposalId || null;
    let resolvedHiringRequestId = (input as any).hiringRequestId || null;
    let resolvedTeamId = (input as any).teamId || null;
    let teamSnapshotJson: any = null;

    if (resolvedJobProposalId) {
      const proposal = await prisma.jobProposal.findUnique({
        where: { id: resolvedJobProposalId },
        include: {
          jobPost: true,
          team: { include: { members: true } },
          contracts: true,
        },
      });

      if (!proposal) {
        sendError(res, 404, 'PROPOSAL_NOT_FOUND', 'Linked job proposal not found');
        return;
      }
      if (proposal.jobPost.clientId !== client.id) {
        sendError(res, 403, 'FORBIDDEN', 'Only the client who posted the job can create a contract from this proposal');
        return;
      }
      if (proposal.status !== 'ACCEPTED') {
        sendError(
          res,
          400,
          'UNACCEPTED_PROPOSAL',
          `Contracts can only be created from an ACCEPTED proposal (current status: ${proposal.status})`
        );
        return;
      }
      if (proposal.contracts.length > 0) {
        sendError(
          res,
          409,
          'PROPOSAL_ALREADY_CONTRACTED',
          'A contract has already been generated from this accepted proposal'
        );
        return;
      }
      if (proposal.jobPost.status === 'CLOSED' || proposal.jobPost.status === 'EXPIRED') {
        sendError(res, 400, 'JOB_CLOSED_OR_EXPIRED', `Job is ${proposal.jobPost.status}`);
        return;
      }
      if (proposal.proposalType === 'TEAM' && proposal.team) {
        resolvedTeamId = proposal.team.id;
        const activeMembers = proposal.team.members.filter((m) => m.status === 'ACTIVE' && m.consentGiven);
        if (activeMembers.length === 0) {
          sendError(res, 400, 'TEAM_CONSENT_MISSING', 'Team contract requires active consenting members');
          return;
        }
        teamSnapshotJson = activeMembers.map((m) => ({
          workerId: m.workerId,
          role: m.role,
          workloadAllocation: m.workloadAllocation,
          responsibility: m.responsibility,
        }));
      }
    } else if (resolvedHiringRequestId) {
      const hr = await prisma.hiringRequest.findUnique({
        where: { id: resolvedHiringRequestId },
      });
      if (!hr) {
        sendError(res, 404, 'HIRING_REQUEST_NOT_FOUND', 'Linked hiring request not found');
        return;
      }
      if (hr.clientId !== client.id) {
        sendError(res, 403, 'FORBIDDEN', 'Only the requesting client can create a contract from this request');
        return;
      }
      if (hr.status !== 'ACCEPTED') {
        sendError(
          res,
          400,
          'UNACCEPTED_HIRING_REQUEST',
          `Contracts can only be created from an ACCEPTED hiring request (current status: ${hr.status})`
        );
        return;
      }
      if (hr.contractId) {
        sendError(
          res,
          409,
          'REQUEST_ALREADY_CONTRACTED',
          'A contract has already been generated from this accepted hiring request'
        );
        return;
      }
    } else {
      // Check if an accepted source exists between client and worker to automatically bind
      const autoProposal = await prisma.jobProposal.findFirst({
        where: {
          workerId: worker.id,
          jobPost: { clientId: client.id },
          status: 'ACCEPTED',
          contracts: { none: {} },
        },
        include: { team: { include: { members: true } } },
      });
      if (autoProposal) {
        resolvedJobProposalId = autoProposal.id;
        if (autoProposal.proposalType === 'TEAM' && autoProposal.team) {
          resolvedTeamId = autoProposal.team.id;
          teamSnapshotJson = autoProposal.team.members
            .filter((m) => m.status === 'ACTIVE' && m.consentGiven)
            .map((m) => ({
              workerId: m.workerId,
              role: m.role,
              workloadAllocation: m.workloadAllocation,
              responsibility: m.responsibility,
            }));
        }
      } else {
        const autoHr = await prisma.hiringRequest.findFirst({
          where: {
            clientId: client.id,
            workerId: worker.id,
            status: 'ACCEPTED',
            contractId: null,
          },
        });
        if (autoHr) {
          resolvedHiringRequestId = autoHr.id;
        } else {
          // Reject if there is an unaccepted/declined pending proposal or request between them
          const pendingProp = await prisma.jobProposal.findFirst({
            where: {
              workerId: worker.id,
              jobPost: { clientId: client.id },
              status: { in: ['PENDING', 'UNDER_REVISION', 'DECLINED', 'WITHDRAWN'] },
            },
          });
          if (pendingProp) {
            sendError(
              res,
              400,
              'UNACCEPTED_PROPOSAL',
              `Cannot initialize contract while proposal is in ${pendingProp.status} status. Mutual acceptance is strictly required.`
            );
            return;
          }

          const pendingHr = await prisma.hiringRequest.findFirst({
            where: {
              clientId: client.id,
              workerId: worker.id,
              status: { in: ['PENDING', 'DECLINED'] },
            },
          });
          if (pendingHr) {
            sendError(
              res,
              400,
              'UNACCEPTED_HIRING_REQUEST',
              `Cannot initialize contract while hiring request is in ${pendingHr.status} status. Mutual acceptance is strictly required.`
            );
            return;
          }
        }
      }
    }

    // 2. Calculate total contract amount strictly from milestone amounts
    const totalAmount = input.milestones.reduce((acc, m) => acc + m.amount, 0);
    const contractNumber = `TPE-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      100 + Math.random() * 900,
    )}`;

    const initialDocHash = computeCanonicalContractHash({
      contractNumber,
      version: 1,
      title: input.title,
      totalAmount,
      currency: input.currency || 'USD',
      clientId: client.id,
      workerId: worker.id,
      scopeOfWork: input.scopeOfWork || input.description,
      termsAndConditions: input.termsAndConditions || 'Standard TrustPay Digital Escrow Agreement terms and dispute conditions apply.',
      cancellationTerms: input.cancellationTerms || 'Cancellation permitted prior to activation, or by mutual consent/arbitration when active.',
      revisionTerms: input.revisionTerms || 'Up to 2 standard revision cycles per milestone deliverable.',
      milestones: input.milestones.map((m, idx) => ({
        order: m.order ?? idx + 1,
        title: m.title,
        description: m.description,
        amount: m.amount,
      })),
    });

    // 3. Atomically create contract, milestones, version snapshot, conversation, and notification
    const contract = await prisma.$transaction(async (tx) => {
      const createdContract = await tx.contract.create({
        data: {
          contractNumber,
          title: input.title,
          description: input.description,
          clientId: client.id,
          workerId: worker.id,
          status: ContractStatus.PENDING_ACCEPTANCE,
          version: 1,
          documentHash: initialDocHash,
          totalAmount: new Prisma.Decimal(totalAmount),
          currency: input.currency || 'USD',
          scopeOfWork: input.scopeOfWork || input.description,
          termsAndConditions: input.termsAndConditions || 'Standard TrustPay Digital Escrow Agreement terms and dispute conditions apply.',
          cancellationTerms: input.cancellationTerms || 'Cancellation permitted prior to activation, or by mutual consent/arbitration when active.',
          revisionTerms: input.revisionTerms || 'Up to 2 standard revision cycles per milestone deliverable.',
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          jobProposalId: resolvedJobProposalId,
          teamId: resolvedTeamId,
          teamSnapshot: teamSnapshotJson,
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

      // Create immutable version 1 snapshot
      await createContractVersionSnapshot({
        contractId: createdContract.id,
        version: 1,
        title: createdContract.title,
        description: createdContract.description,
        totalAmount: createdContract.totalAmount,
        currency: createdContract.currency,
        scopeOfWork: createdContract.scopeOfWork,
        termsAndConditions: createdContract.termsAndConditions,
        cancellationTerms: createdContract.cancellationTerms,
        revisionTerms: createdContract.revisionTerms,
        documentHash: initialDocHash,
        milestones: input.milestones.map((m, idx) => ({
          order: m.order ?? idx + 1,
          title: m.title,
          description: m.description,
          amount: m.amount,
          dueDate: m.dueDate,
        })),
        versionReason: 'INITIAL_CONTRACT',
        createdById: client.id,
        contractStatusAtCreation: ContractStatus.PENDING_ACCEPTANCE,
        isAccepted: false,
        tx,
      });

      if (resolvedHiringRequestId) {
        await tx.hiringRequest.update({
          where: { id: resolvedHiringRequestId },
          data: { contractId: createdContract.id },
        });
      }

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
        documentHash: contract.documentHash,
        version: 1,
      },
      req,
    });

    emitContractRealtimeEvent(
      contract.id,
      'contract:created',
      {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        totalAmount: Number(contract.totalAmount),
        version: 1,
        documentHash: contract.documentHash,
      },
      1,
    );

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
        versions: {
          orderBy: { version: 'asc' },
        },
        clientStamps: {
          where: { status: 'APPLIED' },
          orderBy: { appliedAt: 'desc' },
        },
        milestones: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { submissions: true } },
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
        versions: {
          orderBy: { version: 'asc' },
        },
        clientStamps: {
          where: { status: 'APPLIED' },
          orderBy: { appliedAt: 'desc' },
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

      await executeMilestoneTransition({
        milestoneId: milestone.id,
        contractId: milestone.contractId,
        actorId: worker.id,
        actorRole: UserRole.WORKER,
        targetStatus: MilestoneStatus.SUBMITTED,
        action: 'MILESTONE_SUBMITTED',
        reason: input.notes,
        metadata: {
          submissionId: createdSubmission.id,
          attachmentUrls: input.attachmentUrls,
        },
        requestId: req.headers['x-request-id'] as string | undefined,
        tx,
      });

      const escrow = await tx.escrowRecord.findUnique({
        where: { contractId: milestone.contractId },
      });

      if (escrow) {
        await tx.escrowRecord.update({
          where: { id: escrow.id },
          data: { operationalState: EscrowOperationalState.MILESTONE_SUBMITTED },
        });

        await tx.escrowActivity.create({
          data: {
            escrowRecordId: escrow.id,
            milestoneId: milestone.id,
            actorId: worker.id,
            operationalState: EscrowOperationalState.MILESTONE_SUBMITTED,
            previousState: escrow.operationalState,
            eventType: 'MILESTONE_SUBMITTED',
            description: `Worker submitted deliverable for milestone "${milestone.title}".`,
            isLiveFinancialMovement: false,
          },
        });
      }

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

      await tx.milestoneSubmission.update({
        where: { id: input.submissionId },
        data: { status: SubmissionStatus.REJECTED },
      });

      await executeMilestoneTransition({
        milestoneId: milestone.id,
        contractId: milestone.contractId,
        actorId: client.id,
        actorRole: UserRole.CLIENT,
        targetStatus: MilestoneStatus.IN_REVISION,
        action: 'REVISION_REQUESTED',
        reason: input.reason,
        metadata: {
          submissionId: input.submissionId,
          revisionId: createdRevision.id,
        },
        requestId: req.headers['x-request-id'] as string | undefined,
        tx,
      });

      const escrow = await tx.escrowRecord.findUnique({
        where: { contractId: milestone.contractId },
      });

      if (escrow) {
        await tx.escrowRecord.update({
          where: { id: escrow.id },
          data: { operationalState: EscrowOperationalState.REVISION_REQUESTED },
        });

        await tx.escrowActivity.create({
          data: {
            escrowRecordId: escrow.id,
            milestoneId: milestone.id,
            actorId: client.id,
            operationalState: EscrowOperationalState.REVISION_REQUESTED,
            previousState: escrow.operationalState,
            eventType: 'REVISION_REQUESTED',
            description: `Client requested revision on milestone "${milestone.title}". Reason: ${input.reason}`,
            isLiveFinancialMovement: false,
          },
        });
      }

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

    if (milestone.contract.status === ContractStatus.DISPUTED) {
      sendError(res, 400, 'CONTRACT_DISPUTED', 'Cannot approve deliverables on a disputed contract');
      return;
    }

    const escrow = await prisma.escrowRecord.findUnique({
      where: { contractId: milestone.contractId },
      include: { milestoneAllocations: true },
    });

    if (escrow && escrow.disputeHold) {
      sendError(res, 400, 'DISPUTE_HOLD_ACTIVE', 'Milestone approval is blocked while escrow is on dispute hold');
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const transitionRes = await executeMilestoneTransition({
        milestoneId: milestone.id,
        contractId: milestone.contractId,
        actorId: client.id,
        actorRole: client.role.name as UserRole,
        targetStatus: MilestoneStatus.APPROVED,
        action: 'MILESTONE_APPROVED',
        reason: 'Client reviewed and approved milestone deliverable',
        metadata: {
          approvedSubmissionId: milestone.submissions[0]?.id,
        },
        requestId: req.headers['x-request-id'] as string | undefined,
        tx,
      });

      if (milestone.submissions.length > 0) {
        await tx.milestoneSubmission.update({
          where: { id: milestone.submissions[0].id },
          data: { status: SubmissionStatus.APPROVED },
        });
      }

      const approvedMilestone = transitionRes.milestone;

      // Check all milestones to see if contract completed
      const allMilestones = await tx.contractMilestone.findMany({
        where: { contractId: milestone.contractId },
      });
      const allCompleted = allMilestones.every((m) => m.id === milestone.id || m.status === MilestoneStatus.APPROVED);

      if (escrow) {
        const allocation = escrow.milestoneAllocations.find((a) => a.milestoneId === milestone.id);
        const releaseAmount = allocation ? allocation.allocatedAmountMinor : 0n;

        if (allocation) {
          await tx.escrowMilestoneAllocation.update({
            where: { id: allocation.id },
            data: {
              isReleased: true,
              releasedAmountMinor: releaseAmount,
              releasedAt: new Date(),
            },
          });
        }

        const nextOperationalState = allCompleted ? EscrowOperationalState.COMPLETED : EscrowOperationalState.MILESTONE_APPROVED;
        const newReleasedTotal = escrow.releasedAmountMinor + releaseAmount;
        const nextEscrowStatus = allCompleted ? EscrowStatus.RELEASED : (newReleasedTotal >= escrow.fundedAmountMinor ? EscrowStatus.RELEASED : EscrowStatus.PARTIALLY_RELEASED);

        await tx.escrowRecord.update({
          where: { id: escrow.id },
          data: {
            releasedAmountMinor: newReleasedTotal,
            status: nextEscrowStatus,
            operationalState: nextOperationalState,
          },
        });

        await tx.escrowActivity.create({
          data: {
            escrowRecordId: escrow.id,
            milestoneId: milestone.id,
            actorId: client.id,
            operationalState: nextOperationalState,
            previousState: escrow.operationalState,
            eventType: 'MILESTONE_APPROVED',
            description: `Client approved milestone "${milestone.title}". Sandbox escrow allocation released. No live ledger funds moved.`,
            isLiveFinancialMovement: false,
          },
        });
      }

      if (allCompleted) {
        await tx.contract.update({
          where: { id: milestone.contractId },
          data: { status: ContractStatus.COMPLETED },
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
      const transitionRes = await executeMilestoneTransition({
        milestoneId: milestone.id,
        contractId: milestone.contractId,
        actorId: worker.id,
        actorRole: UserRole.WORKER,
        targetStatus: MilestoneStatus.IN_PROGRESS,
        action: 'MILESTONE_STARTED',
        reason: 'Worker commenced development work',
        requestId: req.headers['x-request-id'] as string | undefined,
        tx,
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

      return transitionRes.milestone;
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

        // Mark version snapshot as mutually accepted
        await tx.contractVersion.updateMany({
          where: { contractId: contract.id, version: contract.version },
          data: { isAccepted: true },
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

    if (result.fullyActivated) {
      try {
        await projectsService.autoProvisionProjectForContract(id);
      } catch (projErr) {
        logger.warn('Project auto-provisioning warning:', projErr);
      }

      emitContractRealtimeEvent(
        id,
        'contract:activated',
        {
          contractId: id,
          version: result.version,
          activatedAt: new Date().toISOString(),
        },
        result.version,
      );
    } else {
      emitContractRealtimeEvent(
        id,
        'contract:accepted',
        {
          contractId: id,
          version: result.version,
          acceptedBy: user.id,
          role: user.role.name,
        },
        result.version,
      );
    }

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
        clientStamps: {
          where: { status: 'APPLIED' },
          orderBy: { appliedAt: 'desc' },
          take: 1,
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

    // Historical Version Support (?version=X)
    const requestedVersion = req.query.version ? parseInt(String(req.query.version), 10) : undefined;
    if (requestedVersion && requestedVersion !== contract.version) {
      const historicalSnapshot = await prisma.contractVersion.findUnique({
        where: {
          contractId_version: {
            contractId: contract.id,
            version: requestedVersion,
          },
        },
      });

      if (historicalSnapshot) {
        const milestones = (historicalSnapshot.milestonesSnapshot as Array<{
          order: number;
          title: string;
          description: string;
          amount: number | string;
          dueDate?: string | null;
        }>) || [];

        streamContractPdf(res, {
          contractNumber: contract.contractNumber,
          title: historicalSnapshot.title,
          description: historicalSnapshot.description,
          scopeOfWork: historicalSnapshot.scopeOfWork,
          termsAndConditions: historicalSnapshot.termsAndConditions,
          cancellationTerms: historicalSnapshot.cancellationTerms,
          revisionTerms: historicalSnapshot.revisionTerms,
          version: historicalSnapshot.version,
          totalAmount: Number(historicalSnapshot.totalAmount),
          currency: historicalSnapshot.currency,
          status: historicalSnapshot.isAccepted ? 'MUTUALLY_ACCEPTED' : 'HISTORICAL_VERSION',
          startDate: contract.startDate,
          endDate: contract.endDate,
          client: contract.client,
          worker: contract.worker,
          milestones: milestones.map((m) => ({
            order: m.order,
            title: m.title,
            description: m.description,
            amount: Number(m.amount),
            status: 'HISTORICAL',
            dueDate: m.dueDate ? new Date(m.dueDate) : null,
          })),
          acceptances: contract.acceptances
            .filter((a) => a.version === requestedVersion)
            .map((a) => ({
              role: a.role,
              acceptedAt: a.acceptedAt,
              acceptanceMethod: a.acceptanceMethod,
              ipAddress: a.ipAddress,
              documentHash: a.documentHash,
              user: a.user,
            })),
        });
        return;
      }
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
      clientStamp: contract.clientStamps?.[0]
        ? {
            profileName: contract.clientStamps[0].profileNameSnapshot,
            verifiedMobile: contract.clientStamps[0].verifiedMobileSnapshot,
            appliedAt: contract.clientStamps[0].appliedAt,
            stampPosition: contract.clientStamps[0].stampPosition,
            documentHash: contract.clientStamps[0].documentHash,
          }
        : null,
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

// ==============================================================================
// PHASE 6: CONTROLLED AMENDMENTS & TERMINATION CONTROLLERS
// ==============================================================================

export async function proposeAmendment(req: Request, res: Response): Promise<void> {
  const { id: contractId } = req.params;
  const user = req.user!;
  const {
    titleChange,
    descriptionChange,
    scopeChange,
    amountChangeMinor,
    termsChange,
    milestonesSnapshot,
    reason,
  } = req.body;

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    sendError(res, 400, 'VALIDATION_ERROR', 'A detailed justification reason (min 5 chars) is required for amendment proposals');
    return;
  }

  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { milestones: true },
    });

    if (!contract) {
      sendError(res, 404, 'NOT_FOUND', 'Contract not found');
      return;
    }

    if (contract.clientId !== user.id && contract.workerId !== user.id) {
      sendError(res, 403, 'FORBIDDEN', 'Only contract participants can propose amendments');
      return;
    }

    if (
      contract.status === ContractStatus.COMPLETED ||
      contract.status === ContractStatus.CANCELLED ||
      contract.status === ContractStatus.DISPUTED
    ) {
      sendError(
        res,
        400,
        'INVALID_STATE',
        `Cannot propose amendment on a contract in ${contract.status} status`,
      );
      return;
    }

    // Check for existing pending amendment to prevent concurrent conflicting versions
    const existingPendingAmendment = await prisma.contractAmendment.findFirst({
      where: {
        contractId: contract.id,
        status: AmendmentStatus.PENDING_REVIEW,
      },
    });

    if (existingPendingAmendment) {
      sendError(
        res,
        400,
        'PENDING_AMENDMENT_EXISTS',
        `An amendment proposal (${existingPendingAmendment.amendmentNumber}) is already pending review. The counterparty must accept or decline before proposing another.`,
      );
      return;
    }

    // Milestone protection check: Cannot remove or reduce approved milestones
    if (milestonesSnapshot && Array.isArray(milestonesSnapshot)) {
      const approvedMilestones = contract.milestones.filter((m) => m.status === MilestoneStatus.APPROVED);
      for (const approved of approvedMilestones) {
        const matchingProposed = (milestonesSnapshot as Array<{ id?: string; title?: string; amount?: number }>).find(
          (m) => m.id === approved.id || m.title === approved.title,
        );
        if (!matchingProposed) {
          sendError(
            res,
            400,
            'APPROVED_MILESTONE_PROTECTED',
            `Approved milestone "${approved.title}" cannot be removed in an amendment proposal`,
          );
          return;
        }
        if (matchingProposed.amount !== undefined && Number(matchingProposed.amount) < Number(approved.amount)) {
          sendError(
            res,
            400,
            'APPROVED_MILESTONE_PROTECTED',
            `Approved milestone "${approved.title}" amount cannot be reduced below allocated amount`,
          );
          return;
        }
      }
    }

    const isClient = contract.clientId === user.id;
    const amendmentNumber = `AMD-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const amendment = await prisma.contractAmendment.create({
      data: {
        amendmentNumber,
        contractId: contract.id,
        proposedById: user.id,
        status: AmendmentStatus.PENDING_REVIEW,
        proposedVersion: contract.version + 1,
        titleChange: titleChange || null,
        descriptionChange: descriptionChange || null,
        scopeChange: scopeChange || null,
        amountChangeMinor: amountChangeMinor ? BigInt(amountChangeMinor) : null,
        termsChange: termsChange || null,
        milestonesSnapshot: milestonesSnapshot ? (milestonesSnapshot as Prisma.InputJsonValue) : Prisma.JsonNull,
        reason,
        clientAcceptedAt: isClient ? new Date() : null,
        workerAcceptedAt: !isClient ? new Date() : null,
        previousDocumentHash: contract.documentHash,
      },
    });

    const recipientId = isClient ? contract.workerId : contract.clientId;
    await prisma.notification.create({
      data: {
        recipientId,
        title: `Amendment Proposed: ${amendmentNumber}`,
        message: `${user.firstName || user.email} proposed an amendment to Contract #${contract.contractNumber}: ${reason}`,
        type: NotificationType.AMENDMENT_PROPOSED,
        metadata: { contractId: contract.id, amendmentId: amendment.id, amendmentNumber },
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'CONTRACT_AMENDMENT_PROPOSED',
      resource: 'ContractAmendment',
      resourceId: amendment.id,
      details: { contractId: contract.id, amendmentNumber },
      req,
    });

    sendSuccess(res, 201, {
      ...amendment,
      amountChangeMinor: amendment.amountChangeMinor?.toString() || null,
    });
  } catch (error) {
    logger.error('Error proposing amendment:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to propose contract amendment');
  }
}

export async function listAmendments(req: Request, res: Response): Promise<void> {
  const { id: contractId } = req.params;
  const user = req.user!;

  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, clientId: true, workerId: true },
    });

    if (!contract) {
      sendError(res, 404, 'NOT_FOUND', 'Contract not found');
      return;
    }

    const isParticipant = contract.clientId === user.id || contract.workerId === user.id;
    const isAdmin = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

    if (!isParticipant && !isAdmin) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied to contract amendments');
      return;
    }

    const amendments = await prisma.contractAmendment.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
      include: {
        proposedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    sendSuccess(
      res,
      200,
      amendments.map((a) => ({
        ...a,
        amountChangeMinor: a.amountChangeMinor?.toString() || null,
        proposerName: `${a.proposedBy.firstName || ''} ${a.proposedBy.lastName || ''}`.trim() || a.proposedBy.email,
      })),
    );
  } catch (error) {
    logger.error('Error listing amendments:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to list contract amendments');
  }
}

export async function respondToAmendment(req: Request, res: Response): Promise<void> {
  const { id: contractId, amendmentId } = req.params;
  const user = req.user!;
  const { accept, reason } = req.body;

  if (typeof accept !== 'boolean') {
    sendError(res, 400, 'VALIDATION_ERROR', 'Accept flag (true/false) is required');
    return;
  }

  try {
    const amendment = await prisma.contractAmendment.findUnique({
      where: { id: amendmentId },
      include: {
        contract: {
          include: {
            milestones: true,
            escrowRecord: true,
          },
        },
      },
    });

    if (!amendment || amendment.contractId !== contractId) {
      sendError(res, 404, 'NOT_FOUND', 'Amendment not found');
      return;
    }

    if (amendment.status !== AmendmentStatus.PENDING_REVIEW) {
      sendError(res, 400, 'INVALID_STATE', `Amendment is already in ${amendment.status} status`);
      return;
    }

    const contract = amendment.contract;
    const isClient = contract.clientId === user.id;
    const isWorker = contract.workerId === user.id;

    if (!isClient && !isWorker) {
      sendError(res, 403, 'FORBIDDEN', 'Only contract participants can vote on amendments');
      return;
    }

    // Counterparty check: The user responding cannot be the one who proposed it
    if (amendment.proposedById === user.id) {
      sendError(res, 400, 'CANNOT_RESPOND_TO_OWN', 'You cannot respond to an amendment proposal you initiated');
      return;
    }

    if (!accept) {
      const updated = await prisma.contractAmendment.update({
        where: { id: amendment.id },
        data: { status: AmendmentStatus.REJECTED },
      });

      await prisma.notification.create({
        data: {
          recipientId: amendment.proposedById,
          title: `Amendment Rejected: ${amendment.amendmentNumber}`,
          message: `${user.firstName || user.email} declined the amendment proposal${reason ? `: ${reason}` : '.'}`,
          type: NotificationType.AMENDMENT_REJECTED,
          metadata: { contractId: contract.id, amendmentId: amendment.id },
        },
      });

      sendSuccess(res, 200, {
        ...updated,
        amountChangeMinor: updated.amountChangeMinor?.toString() || null,
      });
      return;
    }

    // Acceptance Workflow: Apply changes to contract atomically
    const result = await prisma.$transaction(async (tx) => {
      const newVersion = contract.version + 1;
      const clientAcceptedAt = isClient ? new Date() : amendment.clientAcceptedAt;
      const workerAcceptedAt = isWorker ? new Date() : amendment.workerAcceptedAt;

      // 1. Calculate new milestones and total amount
      let newTotalAmount = contract.totalAmount;
      if (amendment.milestonesSnapshot && Array.isArray(amendment.milestonesSnapshot)) {
        const proposedList = amendment.milestonesSnapshot as Array<{
          title: string;
          description: string;
          amount: number;
          order?: number;
          dueDate?: string;
        }>;
        const total = proposedList.reduce((acc, m) => acc + Number(m.amount), 0);
        newTotalAmount = new Prisma.Decimal(total);

        // Update milestones: Keep existing approved ones, update or add remaining
        for (let i = 0; i < proposedList.length; i++) {
          const item = proposedList[i];
          const existing = contract.milestones[i];
          if (existing && existing.status !== MilestoneStatus.APPROVED) {
            await tx.contractMilestone.update({
              where: { id: existing.id },
              data: {
                title: item.title,
                description: item.description,
                amount: new Prisma.Decimal(item.amount),
                order: item.order ?? i + 1,
                dueDate: item.dueDate ? new Date(item.dueDate) : null,
              },
            });
          } else if (!existing) {
            await tx.contractMilestone.create({
              data: {
                contractId: contract.id,
                title: item.title,
                description: item.description,
                amount: new Prisma.Decimal(item.amount),
                order: item.order ?? i + 1,
                dueDate: item.dueDate ? new Date(item.dueDate) : null,
                status: MilestoneStatus.PENDING,
              },
            });
          }
        }
      }

      // 2. Compute canonical document hash for the new version
      const updatedContractForHash = await tx.contract.findUnique({
        where: { id: contract.id },
        include: { milestones: { orderBy: { order: 'asc' } } },
      });

      const canonicalHash = computeCanonicalContractHash({
        contractNumber: contract.contractNumber,
        version: newVersion,
        title: amendment.titleChange || contract.title,
        totalAmount: Number(newTotalAmount),
        currency: contract.currency,
        clientId: contract.clientId,
        workerId: contract.workerId,
        scopeOfWork: amendment.scopeChange || contract.scopeOfWork,
        termsAndConditions: amendment.termsChange || contract.termsAndConditions,
        cancellationTerms: contract.cancellationTerms,
        revisionTerms: contract.revisionTerms,
        milestones: (updatedContractForHash?.milestones || contract.milestones).map((m) => ({
          order: m.order,
          title: m.title,
          description: m.description,
          amount: Number(m.amount),
        })),
      });

      // 3. Update contract record - transitions to PENDING_ACCEPTANCE requiring fresh bilateral sign-off
      const updatedContract = await tx.contract.update({
        where: { id: contract.id },
        data: {
          version: newVersion,
          status: ContractStatus.PENDING_ACCEPTANCE,
          title: amendment.titleChange || contract.title,
          description: amendment.descriptionChange || contract.description,
          scopeOfWork: amendment.scopeChange || contract.scopeOfWork,
          termsAndConditions: amendment.termsChange || contract.termsAndConditions,
          totalAmount: newTotalAmount,
          documentHash: canonicalHash,
        },
      });

      // 4. Mark amendment accepted
      const updatedAmendment = await tx.contractAmendment.update({
        where: { id: amendment.id },
        data: {
          status: AmendmentStatus.ACCEPTED,
          clientAcceptedAt,
          workerAcceptedAt,
          updatedDocumentHash: canonicalHash,
        },
      });

      // 5. Create immutable version snapshot for the new amended version (isAccepted: false)
      await createContractVersionSnapshot({
        contractId: contract.id,
        version: newVersion,
        title: updatedContract.title,
        description: updatedContract.description,
        totalAmount: updatedContract.totalAmount,
        currency: updatedContract.currency,
        scopeOfWork: updatedContract.scopeOfWork,
        termsAndConditions: updatedContract.termsAndConditions,
        cancellationTerms: updatedContract.cancellationTerms,
        revisionTerms: updatedContract.revisionTerms,
        documentHash: canonicalHash,
        milestones: (updatedContractForHash?.milestones || contract.milestones).map((m) => ({
          order: m.order,
          title: m.title,
          description: m.description,
          amount: m.amount,
          dueDate: m.dueDate,
        })),
        versionReason: `Amendment #${amendment.amendmentNumber}: ${amendment.reason}`,
        createdById: amendment.proposedById,
        contractStatusAtCreation: ContractStatus.PENDING_ACCEPTANCE,
        isAccepted: false,
        tx,
      });

      // 6. Log EscrowActivity
      if (contract.escrowRecord) {
        await tx.escrowActivity.create({
          data: {
            escrowRecordId: contract.escrowRecord.id,
            actorId: user.id,
            operationalState: contract.escrowRecord.operationalState,
            previousState: contract.escrowRecord.operationalState,
            eventType: 'CONTRACT_AMENDMENT_APPLIED',
            description: `Contract #${contract.contractNumber} successfully amended to version ${newVersion} with mutual agreement. Fresh mutual acceptance required. Hash verified.`,
            metadata: {
              amendmentId: amendment.id,
              amendmentNumber: amendment.amendmentNumber,
              newVersion,
              canonicalHash,
            },
            isLiveFinancialMovement: false,
          },
        });
      }

      // 7. Notify both parties: Fresh acceptance required before milestones resume
      await tx.notification.createMany({
        data: [
          {
            recipientId: contract.clientId,
            title: `Amendment Accepted: Contract v${newVersion}`,
            message: `Contract #${contract.contractNumber} has been updated to version ${newVersion}. Fresh mutual acceptance is required before milestones can progress.`,
            type: NotificationType.AMENDMENT_ACCEPTED,
            metadata: { contractId: contract.id, version: newVersion },
          },
          {
            recipientId: contract.workerId,
            title: `Amendment Accepted: Contract v${newVersion}`,
            message: `Contract #${contract.contractNumber} has been updated to version ${newVersion}. Fresh mutual acceptance is required before milestones can progress.`,
            type: NotificationType.AMENDMENT_ACCEPTED,
            metadata: { contractId: contract.id, version: newVersion },
          },
        ],
      });

      return { updatedContract, updatedAmendment, newVersion, canonicalHash };
    });

    emitContractRealtimeEvent(
      contract.id,
      'contract:fresh_acceptance_required',
      {
        contractId: contract.id,
        version: result.newVersion,
        canonicalHash: result.canonicalHash,
        amendmentId: amendment.id,
      },
      result.newVersion,
    );

    sendSuccess(res, 200, {
      ...result.updatedAmendment,
      amountChangeMinor: result.updatedAmendment.amountChangeMinor?.toString() || null,
      contract: result.updatedContract,
    });
  } catch (error) {
    logger.error('Error responding to amendment:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to process amendment acceptance');
  }
}

export async function proposeTermination(req: Request, res: Response): Promise<void> {
  const { id: contractId } = req.params;
  const user = req.user!;
  const { reason, proposedSettlementMinor, settlementTerms } = req.body;

  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    sendError(res, 400, 'VALIDATION_ERROR', 'A clear justification reason (min 10 chars) is required to propose contract termination');
    return;
  }

  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      sendError(res, 404, 'NOT_FOUND', 'Contract not found');
      return;
    }

    if (contract.clientId !== user.id && contract.workerId !== user.id) {
      sendError(res, 403, 'FORBIDDEN', 'Only contract participants can initiate termination requests');
      return;
    }

    if (contract.status !== ContractStatus.ACTIVE && contract.status !== ContractStatus.PENDING_ACCEPTANCE) {
      sendError(res, 400, 'INVALID_STATE', `Cannot terminate contract in ${contract.status} status`);
      return;
    }

    // Check for existing pending termination request to prevent duplicate/concurrent proposals
    const existingPendingTermination = await prisma.contractTerminationRequest.findFirst({
      where: {
        contractId: contract.id,
        status: TerminationStatus.PENDING_REVIEW,
      },
    });

    if (existingPendingTermination) {
      sendError(
        res,
        400,
        'PENDING_TERMINATION_EXISTS',
        'A termination request is already pending review for this contract. The counterparty must respond before submitting another.',
      );
      return;
    }

    const termination = await prisma.contractTerminationRequest.create({
      data: {
        contractId: contract.id,
        initiatedById: user.id,
        status: TerminationStatus.PENDING_REVIEW,
        reason,
        proposedSettlementMinor: proposedSettlementMinor ? BigInt(proposedSettlementMinor) : null,
        settlementTerms: settlementTerms || null,
      },
    });

    const isClient = contract.clientId === user.id;
    const recipientId = isClient ? contract.workerId : contract.clientId;

    await prisma.notification.create({
      data: {
        recipientId,
        title: 'Contract Termination Requested',
        message: `${user.firstName || user.email} requested termination of Contract #${contract.contractNumber}: ${reason}`,
        type: NotificationType.TERMINATION_REQUESTED,
        metadata: { contractId: contract.id, terminationId: termination.id },
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'CONTRACT_TERMINATION_REQUESTED',
      resource: 'ContractTerminationRequest',
      resourceId: termination.id,
      details: { contractId: contract.id, reason },
      req,
    });

    sendSuccess(res, 201, {
      ...termination,
      proposedSettlementMinor: termination.proposedSettlementMinor?.toString() || null,
    });
  } catch (error) {
    logger.error('Error proposing termination:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to submit termination request');
  }
}

export async function listTerminationRequests(req: Request, res: Response): Promise<void> {
  const { id: contractId } = req.params;
  const user = req.user!;

  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, clientId: true, workerId: true },
    });

    if (!contract) {
      sendError(res, 404, 'NOT_FOUND', 'Contract not found');
      return;
    }

    const isParticipant = contract.clientId === user.id || contract.workerId === user.id;
    const isAdmin = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

    if (!isParticipant && !isAdmin) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied to termination requests');
      return;
    }

    const requests = await prisma.contractTerminationRequest.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
      include: {
        initiatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    sendSuccess(
      res,
      200,
      requests.map((r) => ({
        ...r,
        proposedSettlementMinor: r.proposedSettlementMinor?.toString() || null,
        initiatorName: `${r.initiatedBy.firstName || ''} ${r.initiatedBy.lastName || ''}`.trim() || r.initiatedBy.email,
      })),
    );
  } catch (error) {
    logger.error('Error listing termination requests:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to list termination requests');
  }
}

export async function respondToTermination(req: Request, res: Response): Promise<void> {
  const { id: contractId, requestId } = req.params;
  const user = req.user!;
  const { accept, responseReason } = req.body;

  if (typeof accept !== 'boolean') {
    sendError(res, 400, 'VALIDATION_ERROR', 'Accept flag (true/false) is required');
    return;
  }

  try {
    const termination = await prisma.contractTerminationRequest.findUnique({
      where: { id: requestId },
      include: {
        contract: {
          include: { escrowRecord: true },
        },
      },
    });

    if (!termination || termination.contractId !== contractId) {
      sendError(res, 404, 'NOT_FOUND', 'Termination request not found');
      return;
    }

    if (termination.status !== TerminationStatus.PENDING_REVIEW) {
      sendError(res, 400, 'INVALID_STATE', `Termination request is already in ${termination.status} status`);
      return;
    }

    const contract = termination.contract;
    const isClient = contract.clientId === user.id;
    const isWorker = contract.workerId === user.id;

    if (!isClient && !isWorker) {
      sendError(res, 403, 'FORBIDDEN', 'Only contract participants can respond to termination requests');
      return;
    }

    if (termination.initiatedById === user.id) {
      sendError(res, 400, 'CANNOT_RESPOND_TO_OWN', 'You cannot respond to your own termination request');
      return;
    }

    if (!accept) {
      const updated = await prisma.contractTerminationRequest.update({
        where: { id: termination.id },
        data: {
          status: TerminationStatus.REJECTED,
          respondedById: user.id,
          responseReason: responseReason || null,
          respondedAt: new Date(),
        },
      });

      await prisma.notification.create({
        data: {
          recipientId: termination.initiatedById,
          title: 'Termination Request Declined',
          message: `${user.firstName || user.email} declined the contract termination request${responseReason ? `: ${responseReason}` : '.'}`,
          type: NotificationType.TERMINATION_REJECTED,
          metadata: { contractId: contract.id, requestId: termination.id },
        },
      });

      sendSuccess(res, 200, {
        ...updated,
        proposedSettlementMinor: updated.proposedSettlementMinor?.toString() || null,
      });
      return;
    }

    // Process termination acceptance
    const result = await prisma.$transaction(async (tx) => {
      const updatedTermination = await tx.contractTerminationRequest.update({
        where: { id: termination.id },
        data: {
          status: TerminationStatus.ACCEPTED,
          respondedById: user.id,
          responseReason: responseReason || null,
          respondedAt: new Date(),
        },
      });

      await tx.contract.update({
        where: { id: contract.id },
        data: { status: ContractStatus.CANCELLED },
      });

      if (contract.escrowRecord) {
        await tx.escrowRecord.update({
          where: { id: contract.escrowRecord.id },
          data: {
            status: EscrowStatus.CANCELLED,
            operationalState: EscrowOperationalState.TERMINATED,
          },
        });

        await tx.escrowActivity.create({
          data: {
            escrowRecordId: contract.escrowRecord.id,
            actorId: user.id,
            operationalState: EscrowOperationalState.TERMINATED,
            previousState: contract.escrowRecord.operationalState,
            eventType: 'CONTRACT_TERMINATED_MUTUALLY',
            description: `Contract #${contract.contractNumber} terminated early by mutual agreement. Reason: ${termination.reason}`,
            metadata: {
              terminationId: termination.id,
              settlementTerms: termination.settlementTerms,
            },
            isLiveFinancialMovement: false,
          },
        });
      }

      await tx.notification.createMany({
        data: [
          {
            recipientId: contract.clientId,
            title: `Contract Cancelled: #${contract.contractNumber}`,
            message: `Contract #${contract.contractNumber} has been terminated by mutual agreement.`,
            type: NotificationType.TERMINATION_ACCEPTED,
            metadata: { contractId: contract.id },
          },
          {
            recipientId: contract.workerId,
            title: `Contract Cancelled: #${contract.contractNumber}`,
            message: `Contract #${contract.contractNumber} has been terminated by mutual agreement.`,
            type: NotificationType.TERMINATION_ACCEPTED,
            metadata: { contractId: contract.id },
          },
        ],
      });

      return updatedTermination;
    });

    sendSuccess(res, 200, {
      ...result,
      proposedSettlementMinor: result.proposedSettlementMinor?.toString() || null,
    });
  } catch (error) {
    logger.error('Error responding to termination:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to process termination response');
  }
}

/**
 * Lists all immutable version snapshots of a contract.
 */
export async function getContractVersions(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;
  try {
    const versions = await listContractVersions(id, user.id, user.role.name as UserRole);
    sendSuccess(res, 200, versions);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err?.statusCode) {
      sendError(res, err.statusCode, err.code || 'ERROR', err.message || 'Operation failed');
      return;
    }
    logger.error('Error fetching contract versions:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch contract versions');
  }
}

/**
 * Executes authoritative cryptographic integrity verification of contract terms.
 */
export async function verifyContractIntegrityHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;
  try {
    const report = await verifyContractIntegrity(id, user.id, user.role.name as UserRole);
    sendSuccess(res, 200, report);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err?.statusCode) {
      sendError(res, err.statusCode, err.code || 'ERROR', err.message || 'Operation failed');
      return;
    }
    logger.error('Error verifying contract integrity:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to audit contract integrity');
  }
}

/**
 * Returns chronological activity history for a contract.
 */
export async function getContractActivityHistoryHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;
  try {
    const history = await getContractActivityHistory(id, user.id, user.role.name as UserRole);
    sendSuccess(res, 200, history);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err?.statusCode) {
      sendError(res, err.statusCode, err.code || 'ERROR', err.message || 'Operation failed');
      return;
    }
    logger.error('Error fetching contract activity history:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch contract activity history');
  }
}

// ==============================================================================
// CLIENT DIGITAL OFFICE STAMP CONTROLLER
// ==============================================================================

/**
 * Returns a live preview of the official TrustPay Client Office Stamp.
 * Derived from authenticated session profile and server timestamp.
 * Accessible by Client only.
 */
export async function getClientStampPreview(req: Request, res: Response): Promise<void> {
  const currentUser = req.user!;

  if (currentUser.role.name !== UserRole.CLIENT) {
    sendError(res, 403, 'FORBIDDEN', 'Only Clients can access the Client Digital Office Stamp preview');
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { profile: true, role: true },
    });

    if (!user) {
      sendError(res, 404, 'NOT_FOUND', 'Client account not found');
      return;
    }

    const clientName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    const phoneNumber = user.profile?.phoneNumber?.trim() || '';

    sendSuccess(res, 200, {
      brandWatermark: 'TRUSTPAY',
      approvedBadge: 'CLIENT APPROVED',
      profileName: clientName,
      verifiedMobile: phoneNumber,
      previewDate: formatStampDate(new Date()),
      isMobileVerified: !!phoneNumber,
      clientRole: user.role.name,
      stampPositionDefault: 'BOTTOM_RIGHT',
    });
  } catch (error) {
    logger.error('Error generating client stamp preview:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to generate office stamp preview');
  }
}

/**
 * Applies the official circular TrustPay Office Stamp to an approved contract.
 * Strictly enforces Client ownership, approved contract state, verified mobile snapshot,
 * server-generated timestamp, duplicate prevention, and Specialist real-time notification.
 */
export async function applyClientStamp(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const currentUser = req.user!;
  const { stampPosition = 'BOTTOM_RIGHT' } = req.body || {};

  if (currentUser.role.name !== UserRole.CLIENT) {
    sendError(res, 403, 'FORBIDDEN', 'Only Clients can apply an official office stamp. Specialists use digital signatures.');
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch contract with acceptances, client profile, and worker
      const contract = await tx.contract.findUnique({
        where: { id },
        include: {
          client: {
            include: { profile: true },
          },
          worker: {
            select: { id: true, firstName: true, email: true },
          },
          acceptances: true,
          clientStamps: {
            where: { status: 'APPLIED' },
          },
        },
      });

      if (!contract) {
        throw { statusCode: 404, code: 'NOT_FOUND', message: 'Contract not found' };
      }

      // 2. Enforce Client ownership
      if (contract.clientId !== currentUser.id) {
        throw {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'You can only apply an office stamp to your own contracts',
        };
      }

      // 3. Enforce Approved contract state
      const hasClientAccepted = contract.acceptances.some(
        (a) => a.userId === currentUser.id && a.version === contract.version,
      );
      const isApproved =
        contract.status === ContractStatus.ACTIVE ||
        contract.status === ContractStatus.COMPLETED ||
        hasClientAccepted;

      if (!isApproved) {
        throw {
          statusCode: 400,
          code: 'CONTRACT_NOT_APPROVED',
          message: 'The contract must be approved or digitally signed before applying the official office stamp.',
        };
      }

      // 4. Enforce Verified Mobile Number
      const mobileNumber = contract.client.profile?.phoneNumber?.trim();
      if (!mobileNumber) {
        throw {
          statusCode: 400,
          code: 'UNVERIFIED_MOBILE_REQUIRED',
          message: 'A verified mobile number is required to apply the official TrustPay office stamp. Please update your profile.',
        };
      }

      // 5. Prevent Duplicate Stamp on same version
      const existingStamp = contract.clientStamps.find(
        (s) => s.pdfVersion === contract.version && s.status === 'APPLIED',
      );
      if (existingStamp) {
        throw {
          statusCode: 409,
          code: 'STAMP_ALREADY_APPLIED',
          message: `Official office stamp has already been applied to Contract #${contract.contractNumber} (v${contract.version}).`,
        };
      }

      // 6. Create immutable ClientStamp record with server timestamp
      const clientName =
        `${contract.client.firstName || ''} ${contract.client.lastName || ''}`.trim() ||
        contract.client.email;
      const appliedAt = new Date();

      const newStamp = await tx.clientStamp.create({
        data: {
          contractId: contract.id,
          clientId: currentUser.id,
          profileNameSnapshot: clientName,
          verifiedMobileSnapshot: mobileNumber,
          appliedAt,
          pdfVersion: contract.version,
          stampPosition: ['BOTTOM_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_CENTER'].includes(stampPosition)
            ? stampPosition
            : 'BOTTOM_RIGHT',
          documentHash: contract.documentHash,
          status: 'APPLIED',
        },
      });

      // 7. Notify Specialist that contract PDF has been officially stamped
      await tx.notification.create({
        data: {
          recipientId: contract.workerId,
          title: 'Official Office Stamp Applied',
          message: `Client ${clientName} applied official TrustPay Office Stamp to Contract #${contract.contractNumber}. The updated shared PDF is ready.`,
          type: NotificationType.CONTRACT_ACCEPTED,
          metadata: {
            contractId: contract.id,
            stampId: newStamp.id,
            version: contract.version,
            appliedAt: appliedAt.toISOString(),
          },
        },
      });

      return { stamp: newStamp, contract, clientName };
    });

    // 8. Emit Real-time Socket.IO event to contract room
    emitContractRealtimeEvent(
      result.contract.id,
      'contract:stamped',
      {
        contractId: result.contract.id,
        stampId: result.stamp.id,
        version: result.contract.version,
        appliedBy: currentUser.id,
        appliedAt: result.stamp.appliedAt.toISOString(),
      },
    );

    // 9. Record Immutable Audit Log
    await recordAuditLog({
      actorId: currentUser.id,
      action: 'CLIENT_OFFICE_STAMP_APPLIED',
      resource: 'Contract',
      resourceId: result.contract.id,
      details: {
        stampId: result.stamp.id,
        version: result.contract.version,
        profileNameSnapshot: result.stamp.profileNameSnapshot,
        stampPosition: result.stamp.stampPosition,
      },
      req,
    });

    sendSuccess(res, 201, result.stamp);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err?.statusCode) {
      sendError(res, err.statusCode, err.code || 'ERROR', err.message || 'Failed to apply stamp');
      return;
    }
    logger.error('Error applying client office stamp:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to apply client office stamp');
  }
}

/**
 * Returns active stamp record for a specific contract.
 * Accessible by contract participants (Client, Specialist) and Admins.
 */
export async function getContractStamp(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;
  const isPrivileged = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

  try {
    const contract = await prisma.contract.findUnique({
      where: { id },
      select: { clientId: true, workerId: true },
    });

    if (!contract) {
      sendError(res, 404, 'NOT_FOUND', 'Contract not found');
      return;
    }

    if (!isPrivileged && contract.clientId !== user.id && contract.workerId !== user.id) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied to this contract');
      return;
    }

    const stamp = await prisma.clientStamp.findFirst({
      where: { contractId: id, status: 'APPLIED' },
      orderBy: { appliedAt: 'desc' },
      include: {
        contract: {
          select: { id: true, contractNumber: true, title: true, status: true },
        },
      },
    });

    sendSuccess(res, 200, stamp || null);
  } catch (error) {
    logger.error('Error fetching contract stamp:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve contract stamp');
  }
}

/**
 * Lists all stamps applied by the authenticated Client.
 * Client only.
 */
export async function listClientStampHistory(req: Request, res: Response): Promise<void> {
  const user = req.user!;

  if (user.role.name !== UserRole.CLIENT) {
    sendError(res, 403, 'FORBIDDEN', 'Only Clients can view office stamp history');
    return;
  }

  try {
    const stamps = await prisma.clientStamp.findMany({
      where: { clientId: user.id },
      orderBy: { appliedAt: 'desc' },
      include: {
        contract: {
          select: { id: true, contractNumber: true, title: true, status: true },
        },
      },
    });

    sendSuccess(res, 200, { items: stamps, total: stamps.length });
  } catch (error) {
    logger.error('Error fetching client stamp history:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to list stamp history');
  }
}




