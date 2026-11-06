import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';
import { recordAuditLog } from '../../utils/audit.js';
import {
  UserRole,
  HiringRequestStatus,
  NotificationType,
  ContractStatus,
  MilestoneStatus,
  Prisma,
} from '@prisma/client';
import {
  CreateHiringRequestInput,
  RespondHiringRequestInput,
  CounterofferHiringRequestInput,
} from './hiring-requests.schema.js';
import { computeCanonicalContractHash } from '../contracts/contract-pdf.service.js';
import { createContractVersionSnapshot } from '../contracts/contract-version.service.js';
import { emitContractRealtimeEvent } from '../realtime/socket.service.js';

/**
 * Create a new hiring request (Client only).
 */
export async function createHiringRequest(req: Request, res: Response): Promise<void> {
  const client = req.user!;
  const input = req.body as CreateHiringRequestInput;

  try {
    // 1. Verify target worker exists and has the WORKER role
    const worker = await prisma.user.findUnique({
      where: { id: input.workerId },
      include: { role: true },
    });

    if (!worker || worker.role.name !== UserRole.WORKER) {
      sendError(res, 404, 'WORKER_NOT_FOUND', 'Target worker not found or is not a registered worker');
      return;
    }

    if (worker.id === client.id) {
      sendError(res, 400, 'INVALID_OPERATION', 'You cannot send a hiring request to yourself');
      return;
    }

    // 2. Prevent duplicate active hiring request with identical title
    const existing = await prisma.hiringRequest.findFirst({
      where: {
        clientId: client.id,
        workerId: worker.id,
        title: input.title,
        status: { in: [HiringRequestStatus.PENDING, HiringRequestStatus.NEGOTIATION] },
      },
    });

    if (existing) {
      sendError(
        res,
        409,
        'DUPLICATE_HIRING_REQUEST',
        'An active hiring request with this title already exists for this worker',
      );
      return;
    }

    // 3. Create hiring request and notification in transaction
    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.hiringRequest.create({
        data: {
          clientId: client.id,
          workerId: worker.id,
          title: input.title,
          description: input.description,
          proposedBudget: new Prisma.Decimal(input.proposedBudget),
          currency: input.currency || 'USD',
          requiredSkills: input.requiredSkills || [],
          proposedStartDate: input.proposedStartDate ? new Date(input.proposedStartDate) : null,
          expectedCompletionDate: input.expectedCompletionDate ? new Date(input.expectedCompletionDate) : null,
          clientMessage: input.clientMessage,
          status: HiringRequestStatus.PENDING,
        },
        include: {
          worker: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
        },
      });

      await tx.notification.create({
        data: {
          recipientId: worker.id,
          title: 'New Hiring Request',
          message: `${client.firstName || client.email} sent you a hiring request for "${created.title}" ($${input.proposedBudget} ${created.currency}).`,
          type: NotificationType.HIRING_REQUEST_RECEIVED,
          metadata: { hiringRequestId: created.id },
        },
      });

      return created;
    });

    await recordAuditLog({
      actorId: client.id,
      action: 'HIRING_REQUEST_CREATED',
      resource: 'HiringRequest',
      resourceId: request.id,
      details: { workerId: worker.id, title: input.title, budget: input.proposedBudget },
      req,
    });

    sendSuccess(res, 201, request);
  } catch (error) {
    logger.error('Error creating hiring request:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to submit hiring request');
  }
}

/**
 * List hiring requests (Role-scoped: Client sees sent, Worker sees received, Admin sees all).
 */
export async function listHiringRequests(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
  const skip = (page - 1) * limit;
  const statusFilter = req.query.status as HiringRequestStatus | undefined;

  try {
    const where: Prisma.HiringRequestWhereInput = {};

    if (user.role.name === UserRole.CLIENT) {
      where.clientId = user.id;
    } else if (user.role.name === UserRole.WORKER) {
      where.workerId = user.id;
    }

    if (statusFilter && Object.values(HiringRequestStatus).includes(statusFilter)) {
      where.status = statusFilter;
    }

    const [total, items] = await Promise.all([
      prisma.hiringRequest.count({ where }),
      prisma.hiringRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
          worker: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
          contract: {
            select: { id: true, contractNumber: true, status: true },
          },
        },
      }),
    ]);

    sendSuccess(res, 200, {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('Error listing hiring requests:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve hiring requests');
  }
}

/**
 * Get single hiring request by ID with strict ownership validation.
 */
export async function getHiringRequestById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;

  try {
    const request = await prisma.hiringRequest.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        worker: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        contract: {
          select: { id: true, contractNumber: true, title: true, status: true },
        },
      },
    });

    if (!request) {
      sendError(res, 404, 'NOT_FOUND', 'Hiring request not found');
      return;
    }

    const isClient = request.clientId === user.id;
    const isWorker = request.workerId === user.id;
    const isPrivileged = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

    if (!isClient && !isWorker && !isPrivileged) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied to this hiring request');
      return;
    }

    sendSuccess(res, 200, request);
  } catch (error) {
    logger.error('Error retrieving hiring request:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to load hiring request');
  }
}

/**
 * Worker responds to a hiring request (ACCEPT, DECLINE, or NEGOTIATE).
 */
export async function respondHiringRequest(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const worker = req.user!;
  const input = req.body as RespondHiringRequestInput;

  try {
    const request = await prisma.hiringRequest.findUnique({
      where: { id },
    });

    if (!request) {
      sendError(res, 404, 'NOT_FOUND', 'Hiring request not found');
      return;
    }

    if (request.workerId !== worker.id) {
      sendError(res, 403, 'FORBIDDEN', 'Only the assigned worker can respond to this hiring request');
      return;
    }

    if (request.status !== HiringRequestStatus.PENDING && request.status !== HiringRequestStatus.NEGOTIATION) {
      sendError(res, 400, 'INVALID_STATE', `Cannot respond to a request in ${request.status} status`);
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        status: input.status,
        workerResponse: input.workerResponse,
        respondedAt: new Date(),
      };

      if (input.proposedBudget !== undefined) {
        updateData.proposedBudget = input.proposedBudget;
      }
      if (input.proposedStartDate !== undefined) {
        updateData.proposedStartDate = input.proposedStartDate ? new Date(input.proposedStartDate) : null;
      }
      if (input.expectedCompletionDate !== undefined) {
        updateData.expectedCompletionDate = input.expectedCompletionDate ? new Date(input.expectedCompletionDate) : null;
      }

      const result = await tx.hiringRequest.update({
        where: { id },
        data: updateData,
        include: {
          client: { select: { id: true, firstName: true, email: true } },
          worker: { select: { id: true, firstName: true, email: true } },
        },
      });

      let notifType: NotificationType = NotificationType.HIRING_REQUEST_ACCEPTED;
      let statusText = 'accepted';
      if (input.status === HiringRequestStatus.DECLINED) {
        notifType = NotificationType.HIRING_REQUEST_DECLINED;
        statusText = 'declined';
      } else if (input.status === HiringRequestStatus.NEGOTIATION) {
        notifType = NotificationType.HIRING_REQUEST_NEGOTIATION;
        statusText = 'requested terms negotiation for';
      }

      await tx.notification.create({
        data: {
          recipientId: request.clientId,
          title: `Hiring Request ${input.status}`,
          message: `${worker.firstName || worker.email} ${statusText} your request "${request.title}".`,
          type: notifType,
          metadata: { hiringRequestId: request.id, response: input.workerResponse },
        },
      });

      return result;
    });

    await recordAuditLog({
      actorId: worker.id,
      action: `HIRING_REQUEST_${input.status}`,
      resource: 'HiringRequest',
      resourceId: request.id,
      details: { response: input.workerResponse },
      req,
    });

    sendSuccess(res, 200, updated);
  } catch (error) {
    logger.error('Error responding to hiring request:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to record response');
  }
}

/**
 * Client withdraws a pending hiring request.
 */
export async function withdrawHiringRequest(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const client = req.user!;

  try {
    const request = await prisma.hiringRequest.findUnique({
      where: { id },
    });

    if (!request) {
      sendError(res, 404, 'NOT_FOUND', 'Hiring request not found');
      return;
    }

    if (request.clientId !== client.id && client.role.name !== UserRole.SUPERADMIN) {
      sendError(res, 403, 'FORBIDDEN', 'Only the requesting client can withdraw this hiring request');
      return;
    }

    if (request.status !== HiringRequestStatus.PENDING && request.status !== HiringRequestStatus.NEGOTIATION) {
      sendError(res, 400, 'INVALID_STATE', `Only pending or negotiation requests can be withdrawn (current: ${request.status})`);
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.hiringRequest.update({
        where: { id },
        data: { status: HiringRequestStatus.WITHDRAWN },
      });

      await tx.notification.create({
        data: {
          recipientId: request.workerId,
          title: 'Hiring Request Withdrawn',
          message: `${client.firstName || client.email} withdrew their hiring request for "${request.title}".`,
          type: NotificationType.CONTRACT_UPDATE,
          metadata: { hiringRequestId: request.id },
        },
      });

      return result;
    });

    await recordAuditLog({
      actorId: client.id,
      action: 'HIRING_REQUEST_WITHDRAWN',
      resource: 'HiringRequest',
      resourceId: request.id,
      req,
    });

    sendSuccess(res, 200, updated);
  } catch (error) {
    logger.error('Error withdrawing hiring request:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to withdraw request');
  }
}

/**
 * Delete / Remove a hiring request (Client or Worker can delete their hiring request).
 */
export async function deleteHiringRequest(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;

  try {
    const request = await prisma.hiringRequest.findUnique({
      where: { id },
    });

    if (!request) {
      sendError(res, 404, 'NOT_FOUND', 'Hiring request not found');
      return;
    }

    const isParty = request.clientId === user.id || request.workerId === user.id || user.role.name === UserRole.SUPERADMIN;
    if (!isParty) {
      sendError(res, 403, 'FORBIDDEN', 'Unauthorized to delete this hiring request');
      return;
    }

    if (request.contractId) {
      sendError(res, 400, 'CANNOT_DELETE_ACTIVE_CONTRACT', 'Cannot delete a hiring request that has been converted into an active contract');
      return;
    }

    await prisma.hiringRequest.delete({
      where: { id },
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'HIRING_REQUEST_DELETED',
      resource: 'HiringRequest',
      resourceId: id,
      req,
    });

    sendSuccess(res, 200, { deletedId: id });
  } catch (error) {
    logger.error('Error deleting hiring request:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete hiring request');
  }
}

/**
 * Client submits a counteroffer / revised terms during negotiation.
 */
export async function counterofferHiringRequest(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const client = req.user!;
  const input = req.body as CounterofferHiringRequestInput;

  try {
    const request = await prisma.hiringRequest.findUnique({
      where: { id },
    });

    if (!request) {
      sendError(res, 404, 'NOT_FOUND', 'Hiring request not found');
      return;
    }

    if (request.clientId !== client.id) {
      sendError(res, 403, 'FORBIDDEN', 'Only the hiring client can propose counteroffers');
      return;
    }

    if (request.status !== HiringRequestStatus.NEGOTIATION && request.status !== HiringRequestStatus.PENDING) {
      sendError(res, 400, 'INVALID_STATE', `Counteroffer can only be submitted for requests in negotiation or pending status (current: ${request.status})`);
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateData: Prisma.HiringRequestUpdateInput = {
        status: HiringRequestStatus.PENDING,
        clientMessage: input.clientMessage,
      };

      if (input.proposedBudget) {
        updateData.proposedBudget = new Prisma.Decimal(input.proposedBudget);
      }
      if (input.proposedStartDate !== undefined) {
        updateData.proposedStartDate = input.proposedStartDate ? new Date(input.proposedStartDate) : null;
      }
      if (input.expectedCompletionDate !== undefined) {
        updateData.expectedCompletionDate = input.expectedCompletionDate ? new Date(input.expectedCompletionDate) : null;
      }

      const result = await tx.hiringRequest.update({
        where: { id },
        data: updateData,
        include: {
          client: { select: { id: true, firstName: true, email: true } },
          worker: { select: { id: true, firstName: true, email: true } },
        },
      });

      await tx.notification.create({
        data: {
          recipientId: request.workerId,
          title: 'Hiring Proposal Terms Updated',
          message: `${client.firstName || client.email} submitted a counteroffer for "${request.title}" (${input.proposedBudget ? `$${input.proposedBudget}` : ''}).`,
          type: NotificationType.HIRING_REQUEST_RECEIVED,
          metadata: { hiringRequestId: request.id, counteroffer: input.clientMessage },
        },
      });

      return result;
    });

    await recordAuditLog({
      actorId: client.id,
      action: 'HIRING_REQUEST_COUNTEROFFER_SUBMITTED',
      resource: 'HiringRequest',
      resourceId: request.id,
      details: { proposedBudget: input.proposedBudget, message: input.clientMessage },
      req,
    });

    sendSuccess(res, 200, updated);
  } catch (error) {
    logger.error('Error submitting counteroffer:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to submit counteroffer');
  }
}

/**
 * Convert an accepted hiring request into a digital contract draft.
 */
export async function convertToContract(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const client = req.user!;

  try {
    const request = await prisma.hiringRequest.findUnique({
      where: { id },
    });

    if (!request) {
      sendError(res, 404, 'NOT_FOUND', 'Hiring request not found');
      return;
    }

    if (request.clientId !== client.id) {
      sendError(res, 403, 'FORBIDDEN', 'Only the hiring client can convert this request to a contract');
      return;
    }

    if (request.status !== HiringRequestStatus.ACCEPTED) {
      sendError(res, 400, 'INVALID_STATE', 'Only accepted hiring requests can be converted into contracts');
      return;
    }

    if (request.contractId) {
      sendError(res, 409, 'ALREADY_CONVERTED', 'A contract has already been generated from this hiring request');
      return;
    }

    // Generate unique contract reference: TP-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const contractNumber = `TP-${dateStr}-${randomSuffix}`;

    const canonicalDocHash = computeCanonicalContractHash({
      contractNumber,
      version: 1,
      title: request.title,
      totalAmount: Number(request.proposedBudget),
      currency: request.currency,
      clientId: request.clientId,
      workerId: request.workerId,
      scopeOfWork: request.description,
      termsAndConditions: 'Standard TrustPay Digital Escrow Agreement terms and milestones delivery policy.',
      cancellationTerms: 'Cancellation permitted prior to activation, or by mutual consent/arbitration when active.',
      revisionTerms: 'Standard revision terms apply.',
      milestones: [
        {
          order: 1,
          title: `${request.title} - Full Deliverable`,
          description: request.description,
          amount: Number(request.proposedBudget),
        },
      ],
    });

    const contract = await prisma.$transaction(async (tx) => {
      const createdContract = await tx.contract.create({
        data: {
          contractNumber,
          title: request.title,
          description: request.description,
          clientId: request.clientId,
          workerId: request.workerId,
          status: ContractStatus.PENDING_ACCEPTANCE,
          version: 1,
          documentHash: canonicalDocHash,
          totalAmount: request.proposedBudget,
          currency: request.currency,
          scopeOfWork: request.description,
          startDate: request.proposedStartDate,
          endDate: request.expectedCompletionDate,
          termsAndConditions: 'Standard TrustPay Digital Escrow Agreement terms and milestones delivery policy.',
          cancellationTerms: 'Cancellation permitted prior to activation, or by mutual consent/arbitration when active.',
          revisionTerms: 'Standard revision terms apply.',
          milestones: {
            create: [
              {
                title: `${request.title} - Full Deliverable`,
                description: request.description,
                amount: request.proposedBudget,
                order: 1,
                dueDate: request.expectedCompletionDate,
                status: MilestoneStatus.PENDING,
              },
            ],
          },
        },
        include: {
          milestones: true,
          client: { select: { id: true, firstName: true, email: true } },
          worker: { select: { id: true, firstName: true, email: true } },
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
        documentHash: canonicalDocHash,
        milestones: [
          {
            order: 1,
            title: `${request.title} - Full Deliverable`,
            description: request.description,
            amount: request.proposedBudget,
            dueDate: request.expectedCompletionDate,
          },
        ],
        versionReason: 'CONVERTED_FROM_HIRING_REQUEST',
        createdById: request.clientId,
        contractStatusAtCreation: ContractStatus.PENDING_ACCEPTANCE,
        isAccepted: false,
        tx,
      });

      // Link contract back to hiring request
      await tx.hiringRequest.update({
        where: { id },
        data: { contractId: createdContract.id },
      });

      // Create dedicated communication channel
      const conversation = await tx.conversation.create({
        data: {
          title: `Contract Discussion: ${createdContract.title}`,
          contractId: createdContract.id,
          participants: {
            create: [{ userId: request.clientId }, { userId: request.workerId }],
          },
        },
      });

      await tx.notification.create({
        data: {
          recipientId: request.workerId,
          title: 'Contract Created from Hiring Request',
          message: `${client.firstName || client.email} converted accepted request "${request.title}" into Contract #${createdContract.contractNumber}.`,
          type: NotificationType.CONTRACT_UPDATE,
          metadata: { contractId: createdContract.id, conversationId: conversation.id },
        },
      });

      return createdContract;
    });

    await recordAuditLog({
      actorId: client.id,
      action: 'HIRING_REQUEST_CONVERTED_TO_CONTRACT',
      resource: 'HiringRequest',
      resourceId: request.id,
      details: { contractId: contract.id, contractNumber: contract.contractNumber },
      req,
    });

    sendSuccess(res, 201, contract);
  } catch (error) {
    logger.error('Error converting hiring request to contract:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to convert request to contract');
  }
}
