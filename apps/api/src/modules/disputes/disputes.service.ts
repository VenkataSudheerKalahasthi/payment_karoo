import { prisma } from '../../config/prisma.js';
import {
  DisputeCategory,
  DisputeStatus,
  DisputeResolutionType,
  DisputeResolutionStatus,
  ContractStatus,
  UserRole,
  NotificationType,
  EscrowOperationalState,
  EscrowStatus,
  Prisma,
} from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { storageService } from '../storage/storage.service.js';

export class DisputesService {
  /**
   * Generates a unique, sequential dispute identifier.
   */
  private generateDisputeNumber(): string {
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    return `DSP-${year}-${randomSuffix}`;
  }

  /**
   * Creates a formal dispute on a contract with protective escrow hold.
   */
  async createDispute(
    data: {
      contractId: string;
      milestoneId?: string;
      category: DisputeCategory;
      title: string;
      description: string;
      claimedAmountMinor?: number | string;
      evidence?: Array<{
        fileName: string;
        fileKey: string;
        fileUrl: string;
        mimeType?: string;
        fileSize?: number | string;
        description?: string;
      }>;
    },
    actor: { id: string; role: { name: UserRole }; email: string; firstName?: string | null },
  ) {
    const contract = await prisma.contract.findUnique({
      where: { id: data.contractId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        worker: { select: { id: true, firstName: true, lastName: true, email: true } },
        escrowRecord: true,
      },
    });

    if (!contract) {
      throw {
        statusCode: 404,
        code: 'CONTRACT_NOT_FOUND',
        message: 'Contract not found',
      };
    }

    const isClient = contract.clientId === actor.id;
    const isWorker = contract.workerId === actor.id;

    if (!isClient && !isWorker && actor.role.name !== UserRole.ADMIN && actor.role.name !== UserRole.SUPERADMIN) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only direct contract participants or administrators can initiate a dispute',
      };
    }

    // Check for existing active dispute on this contract
    const existingActiveDispute = await prisma.dispute.findFirst({
      where: {
        contractId: data.contractId,
        status: {
          notIn: [DisputeStatus.RESOLVED, DisputeStatus.CLOSED, DisputeStatus.WITHDRAWN],
        },
      },
    });

    if (existingActiveDispute) {
      throw {
        statusCode: 400,
        code: 'ACTIVE_DISPUTE_EXISTS',
        message: `An active dispute (${existingActiveDispute.disputeNumber}) already exists for this contract. Resolve it before opening another.`,
      };
    }

    const initiatorId = actor.id;
    const respondentId = isClient ? contract.workerId : contract.clientId;
    const disputeNumber = this.generateDisputeNumber();
    const claimedAmountMinor = data.claimedAmountMinor ? BigInt(data.claimedAmountMinor) : null;

    // Transactionally create dispute, apply protective escrow hold, and log activities
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Dispute record
      const dispute = await tx.dispute.create({
        data: {
          disputeNumber,
          contractId: contract.id,
          milestoneId: data.milestoneId || null,
          initiatorId,
          respondentId,
          category: data.category,
          status: DisputeStatus.OPEN,
          title: data.title,
          description: data.description,
          claimedAmountMinor,
          disputeHoldActive: true,
        },
        include: {
          initiator: { select: { id: true, firstName: true, lastName: true, email: true } },
          respondent: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      // 2. Attach initial evidence files if provided
      if (data.evidence && data.evidence.length > 0) {
        await tx.disputeEvidence.createMany({
          data: data.evidence.map((e) => ({
            disputeId: dispute.id,
            uploadedById: actor.id,
            fileName: e.fileName,
            fileKey: e.fileKey,
            fileUrl: e.fileUrl,
            mimeType: e.mimeType || null,
            fileSize: e.fileSize ? BigInt(e.fileSize) : null,
            description: e.description || null,
          })),
        });
      }

      // 3. Update Contract status to DISPUTED
      await tx.contract.update({
        where: { id: contract.id },
        data: { status: ContractStatus.DISPUTED },
      });

      // 4. Update EscrowRecord to dispute hold & operational DISPUTED state
      if (contract.escrowRecord) {
        await tx.escrowRecord.update({
          where: { id: contract.escrowRecord.id },
          data: {
            disputeHold: true,
            status: EscrowStatus.DISPUTED,
            operationalState: EscrowOperationalState.DISPUTED,
          },
        });

        // 5. Record immutable EscrowActivity
        await tx.escrowActivity.create({
          data: {
            escrowRecordId: contract.escrowRecord.id,
            milestoneId: data.milestoneId || null,
            actorId: actor.id,
            operationalState: EscrowOperationalState.DISPUTED,
            previousState: contract.escrowRecord.operationalState,
            eventType: 'DISPUTE_RAISED',
            description: `Dispute ${disputeNumber} opened by ${actor.firstName || actor.email}. Protective escrow hold activated.`,
            metadata: {
              disputeId: dispute.id,
              disputeNumber,
              category: data.category,
            },
            isLiveFinancialMovement: false,
          },
        });
      }

      // 6. Notify respondent
      await tx.notification.create({
        data: {
          recipientId: respondentId,
          title: `Dispute Raised: ${disputeNumber}`,
          message: `${actor.firstName || actor.email} opened a dispute on contract "${contract.title}": ${data.title}`,
          type: NotificationType.DISPUTE_RAISED,
          metadata: {
            contractId: contract.id,
            disputeId: dispute.id,
            disputeNumber,
          },
        },
      });

      return dispute;
    });

    logger.info(
      `[DISPUTE CREATED] Number: ${result.disputeNumber}, Contract: ${contract.contractNumber}, Initiator: ${actor.id}`,
    );

    return this.getDisputeById(result.id, actor);
  }

  /**
   * Retrieves full dispute detail including signed evidence download links for authorized actors.
   */
  async getDisputeById(
    disputeId: string,
    actor: { id: string; role: { name: UserRole } },
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            title: true,
            clientId: true,
            workerId: true,
            totalAmount: true,
            currency: true,
          },
        },
        milestone: {
          select: {
            id: true,
            title: true,
            order: true,
            amount: true,
          },
        },
        initiator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: { select: { name: true } },
          },
        },
        respondent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: { select: { name: true } },
          },
        },
        responses: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: { select: { name: true } },
              },
            },
          },
        },
        evidence: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        resolutions: {
          orderBy: { createdAt: 'desc' },
          include: {
            proposedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        internalNotes: {
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!dispute) {
      throw {
        statusCode: 404,
        code: 'DISPUTE_NOT_FOUND',
        message: 'Dispute record not found',
      };
    }

    const isParticipant = dispute.initiatorId === actor.id || dispute.respondentId === actor.id;
    const isAdmin = actor.role.name === UserRole.ADMIN || actor.role.name === UserRole.SUPERADMIN;

    if (!isParticipant && !isAdmin) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You are not authorized to view this dispute record',
      };
    }

    // Generate signed download URLs for evidence if storage fileKey exists
    const enrichedEvidence = await Promise.all(
      dispute.evidence.map(async (ev) => {
        let downloadUrl = ev.fileUrl;
        if (ev.fileKey) {
          try {
            const urlResult = await storageService.authorizeDownload(dispute.contractId, ev.fileKey, actor);
            downloadUrl = urlResult.downloadUrl;
          } catch {
            // Fallback to stored URL if signed URL generation fails
          }
        }
        return {
          id: ev.id,
          disputeId: ev.disputeId,
          uploadedById: ev.uploadedById,
          uploaderName: ev.uploadedBy ? `${ev.uploadedBy.firstName || ''} ${ev.uploadedBy.lastName || ''}`.trim() || ev.uploadedBy.email : 'Unknown',
          fileName: ev.fileName,
          fileKey: ev.fileKey,
          fileUrl: ev.fileUrl,
          downloadUrl,
          mimeType: ev.mimeType,
          fileSize: ev.fileSize?.toString() || null,
          description: ev.description,
          createdAt: ev.createdAt.toISOString(),
        };
      }),
    );

    return {
      id: dispute.id,
      disputeNumber: dispute.disputeNumber,
      contractId: dispute.contractId,
      contractNumber: dispute.contract.contractNumber,
      contractTitle: dispute.contract.title,
      milestoneId: dispute.milestoneId,
      milestoneTitle: dispute.milestone?.title || null,
      initiatorId: dispute.initiatorId,
      initiatorName: `${dispute.initiator.firstName || ''} ${dispute.initiator.lastName || ''}`.trim() || dispute.initiator.email,
      initiatorEmail: dispute.initiator.email,
      initiatorRole: dispute.initiator.role.name,
      respondentId: dispute.respondentId,
      respondentName: `${dispute.respondent.firstName || ''} ${dispute.respondent.lastName || ''}`.trim() || dispute.respondent.email,
      respondentEmail: dispute.respondent.email,
      respondentRole: dispute.respondent.role.name,
      category: dispute.category,
      status: dispute.status,
      title: dispute.title,
      description: dispute.description,
      claimedAmountMinor: dispute.claimedAmountMinor?.toString() || null,
      disputeHoldActive: dispute.disputeHoldActive,
      resolvedAt: dispute.resolvedAt?.toISOString() || null,
      closedAt: dispute.closedAt?.toISOString() || null,
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString(),
      responses: dispute.responses.map((r) => ({
        id: r.id,
        disputeId: r.disputeId,
        authorId: r.authorId,
        authorName: `${r.author.firstName || ''} ${r.author.lastName || ''}`.trim() || r.author.email,
        authorRole: r.author.role.name,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
      })),
      evidence: enrichedEvidence,
      resolutions: dispute.resolutions.map((res) => ({
        id: res.id,
        disputeId: res.disputeId,
        proposedById: res.proposedById,
        proposerName: `${res.proposedBy.firstName || ''} ${res.proposedBy.lastName || ''}`.trim() || res.proposedBy.email,
        resolutionType: res.resolutionType,
        status: res.status,
        clientAmountMinor: res.clientAmountMinor.toString(),
        workerAmountMinor: res.workerAmountMinor.toString(),
        rationale: res.rationale,
        clientAgreed: res.clientAgreed,
        clientAgreedAt: res.clientAgreedAt?.toISOString() || null,
        workerAgreed: res.workerAgreed,
        workerAgreedAt: res.workerAgreedAt?.toISOString() || null,
        enforcedByAdminId: res.enforcedByAdminId,
        enforcedAt: res.enforcedAt?.toISOString() || null,
        createdAt: res.createdAt.toISOString(),
        updatedAt: res.updatedAt.toISOString(),
      })),
      // Internal notes only visible to Admin/Superadmin
      internalNotes: isAdmin
        ? dispute.internalNotes.map((n) => ({
            id: n.id,
            disputeId: n.disputeId,
            authorId: n.authorId,
            authorName: `${n.author.firstName || ''} ${n.author.lastName || ''}`.trim() || n.author.email,
            note: n.note,
            createdAt: n.createdAt.toISOString(),
          }))
        : undefined,
    };
  }

  /**
   * Lists disputes for authorized actor with pagination and filtering.
   */
  async listDisputes(
    query: {
      page?: number;
      limit?: number;
      status?: string;
      category?: string;
      contractId?: string;
    },
    actor: { id: string; role: { name: UserRole } },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DisputeWhereInput = {};

    const isAdmin = actor.role.name === UserRole.ADMIN || actor.role.name === UserRole.SUPERADMIN;
    if (!isAdmin) {
      where.OR = [{ initiatorId: actor.id }, { respondentId: actor.id }];
    }

    if (query.contractId) where.contractId = query.contractId;
    if (query.status) where.status = query.status as DisputeStatus;
    if (query.category) where.category = query.category as DisputeCategory;

    const [total, items] = await Promise.all([
      prisma.dispute.count({ where }),
      prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contract: { select: { contractNumber: true, title: true } },
          initiator: { select: { firstName: true, lastName: true, email: true } },
          respondent: { select: { firstName: true, lastName: true, email: true } },
          _count: { select: { responses: true, evidence: true, resolutions: true } },
        },
      }),
    ]);

    return {
      items: items.map((d) => ({
        id: d.id,
        disputeNumber: d.disputeNumber,
        contractId: d.contractId,
        contractNumber: d.contract.contractNumber,
        contractTitle: d.contract.title,
        milestoneId: d.milestoneId,
        initiatorId: d.initiatorId,
        initiatorName: `${d.initiator.firstName || ''} ${d.initiator.lastName || ''}`.trim() || d.initiator.email,
        respondentId: d.respondentId,
        respondentName: `${d.respondent.firstName || ''} ${d.respondent.lastName || ''}`.trim() || d.respondent.email,
        category: d.category,
        status: d.status,
        title: d.title,
        description: d.description,
        claimedAmountMinor: d.claimedAmountMinor?.toString() || null,
        disputeHoldActive: d.disputeHoldActive,
        resolvedAt: d.resolvedAt?.toISOString() || null,
        closedAt: d.closedAt?.toISOString() || null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        responsesCount: d._count.responses,
        evidenceCount: d._count.evidence,
        resolutionsCount: d._count.resolutions,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves aggregated metrics across all disputes for Admin & Superadmin dashboards.
   */
  async getDisputeMetrics() {
    const [
      totalDisputes,
      openDisputes,
      underReviewDisputes,
      escalatedDisputes,
      resolvedDisputes,
      closedDisputes,
      activeDisputeHoldCount,
      claimedSums,
    ] = await Promise.all([
      prisma.dispute.count(),
      prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
      prisma.dispute.count({
        where: {
          status: {
            in: [DisputeStatus.UNDER_REVIEW, DisputeStatus.EVIDENCE_SUBMITTED, DisputeStatus.MEDIATION, DisputeStatus.RESOLUTION_PROPOSED],
          },
        },
      }),
      prisma.dispute.count({ where: { status: DisputeStatus.ESCALATED } }),
      prisma.dispute.count({ where: { status: DisputeStatus.RESOLVED } }),
      prisma.dispute.count({ where: { status: DisputeStatus.CLOSED } }),
      prisma.dispute.count({ where: { disputeHoldActive: true } }),
      prisma.dispute.aggregate({
        _sum: { claimedAmountMinor: true },
      }),
    ]);

    const resolutionRatePercentage = totalDisputes > 0 ? Math.round((resolvedDisputes / totalDisputes) * 100) : 100;

    return {
      totalDisputes,
      openDisputes,
      underReviewDisputes,
      escalatedDisputes,
      resolvedDisputes,
      closedDisputes,
      resolutionRatePercentage,
      totalClaimedMinor: (claimedSums._sum.claimedAmountMinor ?? 0n).toString(),
      activeDisputeHoldCount,
    };
  }

  /**
   * Submits a response or rebuttal to an active dispute.
   */
  async submitResponse(
    disputeId: string,
    content: string,
    actor: { id: string; role: { name: UserRole }; firstName?: string | null; email: string },
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        contract: true,
      },
    });

    if (!dispute) {
      throw { statusCode: 404, code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' };
    }

    const isParticipant = dispute.initiatorId === actor.id || dispute.respondentId === actor.id;
    const isAdmin = actor.role.name === UserRole.ADMIN || actor.role.name === UserRole.SUPERADMIN;

    if (!isParticipant && !isAdmin) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Not authorized to participate in this dispute' };
    }

    if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.CLOSED) {
      throw { statusCode: 400, code: 'DISPUTE_FINALIZED', message: 'Cannot submit responses to a finalized dispute' };
    }

    const recipientId = actor.id === dispute.initiatorId ? dispute.respondentId : dispute.initiatorId;

    const response = await prisma.$transaction(async (tx) => {
      const created = await tx.disputeResponse.create({
        data: {
          disputeId: dispute.id,
          authorId: actor.id,
          content,
        },
      });

      // Advance state to UNDER_REVIEW if waiting for response or newly opened
      if (dispute.status === DisputeStatus.OPEN || dispute.status === DisputeStatus.RESPONSE_REQUIRED) {
        await tx.dispute.update({
          where: { id: dispute.id },
          data: { status: DisputeStatus.UNDER_REVIEW },
        });
      }

      await tx.notification.create({
        data: {
          recipientId,
          title: `New Response: Dispute ${dispute.disputeNumber}`,
          message: `${actor.firstName || actor.email} submitted a statement on dispute ${dispute.disputeNumber}.`,
          type: NotificationType.DISPUTE_RESPONSE_SUBMITTED,
          metadata: { disputeId: dispute.id, disputeNumber: dispute.disputeNumber },
        },
      });

      return created;
    });

    return response;
  }

  /**
   * Uploads and associates evidence files with an active dispute.
   */
  async uploadEvidence(
    disputeId: string,
    evidenceData: {
      fileName: string;
      fileKey: string;
      fileUrl: string;
      mimeType?: string;
      fileSize?: number | string;
      description?: string;
    },
    actor: { id: string; role: { name: UserRole }; firstName?: string | null; email: string },
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw { statusCode: 404, code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' };
    }

    const isParticipant = dispute.initiatorId === actor.id || dispute.respondentId === actor.id;
    const isAdmin = actor.role.name === UserRole.ADMIN || actor.role.name === UserRole.SUPERADMIN;

    if (!isParticipant && !isAdmin) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Not authorized to upload evidence to this dispute' };
    }

    const recipientId = actor.id === dispute.initiatorId ? dispute.respondentId : dispute.initiatorId;

    const evidence = await prisma.$transaction(async (tx) => {
      const created = await tx.disputeEvidence.create({
        data: {
          disputeId: dispute.id,
          uploadedById: actor.id,
          fileName: evidenceData.fileName,
          fileKey: evidenceData.fileKey,
          fileUrl: evidenceData.fileUrl,
          mimeType: evidenceData.mimeType || null,
          fileSize: evidenceData.fileSize ? BigInt(evidenceData.fileSize) : null,
          description: evidenceData.description || null,
        },
      });

      if (dispute.status === DisputeStatus.EVIDENCE_REQUESTED || dispute.status === DisputeStatus.OPEN) {
        await tx.dispute.update({
          where: { id: dispute.id },
          data: { status: DisputeStatus.EVIDENCE_SUBMITTED },
        });
      }

      await tx.notification.create({
        data: {
          recipientId,
          title: `Evidence Uploaded: Dispute ${dispute.disputeNumber}`,
          message: `${actor.firstName || actor.email} uploaded evidence document "${evidenceData.fileName}".`,
          type: NotificationType.DISPUTE_EVIDENCE_UPLOADED,
          metadata: { disputeId: dispute.id, fileName: evidenceData.fileName },
        },
      });

      return created;
    });

    return evidence;
  }

  /**
   * Proposes a dispute resolution terms settlement.
   */
  async proposeResolution(
    disputeId: string,
    data: {
      resolutionType: DisputeResolutionType;
      clientAmountMinor: number | string;
      workerAmountMinor: number | string;
      rationale: string;
    },
    actor: { id: string; role: { name: UserRole }; firstName?: string | null; email: string },
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        contract: {
          include: { escrowRecord: true },
        },
      },
    });

    if (!dispute) {
      throw { statusCode: 404, code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' };
    }

    const isClient = dispute.contract.clientId === actor.id;
    const isWorker = dispute.contract.workerId === actor.id;
    const isAdmin = actor.role.name === UserRole.ADMIN || actor.role.name === UserRole.SUPERADMIN;

    if (!isClient && !isWorker && !isAdmin) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Not authorized to propose resolutions' };
    }

    const clientAmountMinor = BigInt(data.clientAmountMinor);
    const workerAmountMinor = BigInt(data.workerAmountMinor);

    // Validate that proposed amounts do not exceed the contract's funded or agreed minor amount
    const escrow = dispute.contract.escrowRecord;
    const maxPermitted = escrow ? escrow.contractualAmountMinor : 0n;
    if (clientAmountMinor + workerAmountMinor > maxPermitted && maxPermitted > 0n) {
      throw {
        statusCode: 400,
        code: 'AMOUNTS_EXCEED_TOTAL',
        message: `Total settlement ($${Number(clientAmountMinor + workerAmountMinor) / 100}) cannot exceed contract total ($${Number(maxPermitted) / 100}).`,
      };
    }

    const recipientId = isClient ? dispute.contract.workerId : dispute.contract.clientId;

    const resolution = await prisma.$transaction(async (tx) => {
      const created = await tx.disputeResolution.create({
        data: {
          disputeId: dispute.id,
          proposedById: actor.id,
          resolutionType: data.resolutionType,
          status: DisputeResolutionStatus.PROPOSED,
          clientAmountMinor,
          workerAmountMinor,
          rationale: data.rationale,
          clientAgreed: isClient ? true : null,
          clientAgreedAt: isClient ? new Date() : null,
          workerAgreed: isWorker ? true : null,
          workerAgreedAt: isWorker ? new Date() : null,
        },
      });

      await tx.dispute.update({
        where: { id: dispute.id },
        data: { status: DisputeStatus.RESOLUTION_PROPOSED },
      });

      await tx.notification.create({
        data: {
          recipientId,
          title: `Resolution Proposed: Dispute ${dispute.disputeNumber}`,
          message: `${actor.firstName || actor.email} proposed a settlement: ${data.rationale}`,
          type: NotificationType.DISPUTE_RESOLUTION_PROPOSED,
          metadata: { disputeId: dispute.id, resolutionId: created.id },
        },
      });

      return created;
    });

    return resolution;
  }

  /**
   * Responds (accepts or rejects) a proposed dispute resolution.
   */
  async respondToResolution(
    disputeId: string,
    resolutionId: string,
    agree: boolean,
    actor: { id: string; role: { name: UserRole }; firstName?: string | null; email: string },
  ) {
    const resolution = await prisma.disputeResolution.findUnique({
      where: { id: resolutionId },
      include: {
        dispute: {
          include: {
            contract: {
              include: { escrowRecord: true },
            },
          },
        },
      },
    });

    if (!resolution || resolution.disputeId !== disputeId) {
      throw { statusCode: 404, code: 'RESOLUTION_NOT_FOUND', message: 'Proposed resolution not found' };
    }

    const dispute = resolution.dispute;
    const isClient = dispute.contract.clientId === actor.id;
    const isWorker = dispute.contract.workerId === actor.id;

    if (!isClient && !isWorker && actor.role.name !== UserRole.ADMIN && actor.role.name !== UserRole.SUPERADMIN) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Only contract participants can vote on resolution proposals' };
    }

    if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.CLOSED) {
      throw {
        statusCode: 400,
        code: 'DISPUTE_ALREADY_FINALIZED',
        message: `Dispute ${dispute.disputeNumber} is already ${dispute.status} and cannot be voted on.`,
      };
    }

    if (resolution.status !== DisputeResolutionStatus.PROPOSED) {
      throw {
        statusCode: 400,
        code: 'NOT_IN_PROPOSED_STATE',
        message: `Resolution is currently ${resolution.status} and cannot be voted on.`,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const clientAgreed = isClient ? agree : resolution.clientAgreed;
      const workerAgreed = isWorker ? agree : resolution.workerAgreed;
      const clientAgreedAt = isClient ? new Date() : resolution.clientAgreedAt;
      const workerAgreedAt = isWorker ? new Date() : resolution.workerAgreedAt;

      if (!agree) {
        // Rejection marks resolution rejected
        const res = await tx.disputeResolution.update({
          where: { id: resolution.id },
          data: {
            status: DisputeResolutionStatus.REJECTED_BY_PARTY,
            clientAgreed,
            workerAgreed,
            clientAgreedAt,
            workerAgreedAt,
          },
        });

        await tx.dispute.update({
          where: { id: dispute.id },
          data: { status: DisputeStatus.RESOLUTION_REJECTED },
        });

        return res;
      }

      // If actor agreed, check if both have now agreed
      const bothAgreed = Boolean(clientAgreed && workerAgreed);
      const nextResStatus = bothAgreed ? DisputeResolutionStatus.ACCEPTED_BY_PARTIES : DisputeResolutionStatus.PROPOSED;

      const res = await tx.disputeResolution.update({
        where: { id: resolution.id },
        data: {
          status: nextResStatus,
          clientAgreed,
          workerAgreed,
          clientAgreedAt,
          workerAgreedAt,
        },
      });

      if (bothAgreed) {
        // Dispute is officially RESOLVED
        await tx.dispute.update({
          where: { id: dispute.id },
          data: {
            status: DisputeStatus.RESOLVED,
            disputeHoldActive: false,
            resolvedAt: new Date(),
          },
        });

        // Release escrow dispute hold and restore contract to ACTIVE / RELEASE_ELIGIBLE
        if (dispute.contract.escrowRecord) {
          await tx.escrowRecord.update({
            where: { id: dispute.contract.escrowRecord.id },
            data: {
              disputeHold: false,
              status: EscrowStatus.FUNDED,
              operationalState: EscrowOperationalState.WORK_IN_PROGRESS,
            },
          });

          await tx.escrowActivity.create({
            data: {
              escrowRecordId: dispute.contract.escrowRecord.id,
              actorId: actor.id,
              operationalState: EscrowOperationalState.WORK_IN_PROGRESS,
              previousState: EscrowOperationalState.DISPUTED,
              eventType: 'DISPUTE_MUTUALLY_RESOLVED',
              description: `Dispute ${dispute.disputeNumber} resolution accepted mutually. Escrow protective hold cleared.`,
              metadata: {
                resolutionId: resolution.id,
                clientAmountMinor: resolution.clientAmountMinor.toString(),
                workerAmountMinor: resolution.workerAmountMinor.toString(),
              },
              isLiveFinancialMovement: false,
            },
          });
        }

        await tx.contract.update({
          where: { id: dispute.contractId },
          data: { status: ContractStatus.ACTIVE },
        });

        // Notify both parties
        await tx.notification.createMany({
          data: [
            {
              recipientId: dispute.contract.clientId,
              title: `Dispute Resolved: ${dispute.disputeNumber}`,
              message: `Dispute ${dispute.disputeNumber} has been resolved by mutual agreement.`,
              type: NotificationType.DISPUTE_RESOLVED,
              metadata: { disputeId: dispute.id },
            },
            {
              recipientId: dispute.contract.workerId,
              title: `Dispute Resolved: ${dispute.disputeNumber}`,
              message: `Dispute ${dispute.disputeNumber} has been resolved by mutual agreement.`,
              type: NotificationType.DISPUTE_RESOLVED,
              metadata: { disputeId: dispute.id },
            },
          ],
        });
      }

      return res;
    });

    return updated;
  }

  /**
   * Admin or Superadmin arbitrates and enforces a final dispute resolution.
   */
  async adminEnforceResolution(
    disputeId: string,
    data: {
      resolutionType: DisputeResolutionType;
      clientAmountMinor: number | string;
      workerAmountMinor: number | string;
      rationale: string;
    },
    admin: { id: string; role: { name: UserRole }; firstName?: string | null; email: string },
  ) {
    if (admin.role.name !== UserRole.ADMIN && admin.role.name !== UserRole.SUPERADMIN) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Only administrators can arbitrate and enforce dispute resolutions' };
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        contract: { include: { escrowRecord: true } },
      },
    });

    if (!dispute) {
      throw { statusCode: 404, code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' };
    }

    if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.CLOSED) {
      throw {
        statusCode: 400,
        code: 'DISPUTE_ALREADY_FINALIZED',
        message: `Dispute ${dispute.disputeNumber} is already ${dispute.status} and cannot be arbitrated further.`,
      };
    }

    const clientAmountMinor = BigInt(data.clientAmountMinor);
    const workerAmountMinor = BigInt(data.workerAmountMinor);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create enforced resolution record
      const enforcedResolution = await tx.disputeResolution.create({
        data: {
          disputeId: dispute.id,
          proposedById: admin.id,
          resolutionType: data.resolutionType,
          status: DisputeResolutionStatus.ENFORCED_BY_ADMIN,
          clientAmountMinor,
          workerAmountMinor,
          rationale: `[ADMIN ENFORCED] ${data.rationale}`,
          clientAgreed: true,
          workerAgreed: true,
          enforcedByAdminId: admin.id,
          enforcedAt: new Date(),
        },
      });

      // 2. Mark dispute as RESOLVED
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: DisputeStatus.RESOLVED,
          disputeHoldActive: false,
          resolvedAt: new Date(),
        },
      });

      // 3. Clear escrow protective hold and restore contract
      if (dispute.contract.escrowRecord) {
        await tx.escrowRecord.update({
          where: { id: dispute.contract.escrowRecord.id },
          data: {
            disputeHold: false,
            status: EscrowStatus.FUNDED,
            operationalState: EscrowOperationalState.WORK_IN_PROGRESS,
          },
        });

        await tx.escrowActivity.create({
          data: {
            escrowRecordId: dispute.contract.escrowRecord.id,
            actorId: admin.id,
            operationalState: EscrowOperationalState.WORK_IN_PROGRESS,
            previousState: EscrowOperationalState.DISPUTED,
            eventType: 'DISPUTE_ADMIN_ENFORCED',
            description: `Dispute ${dispute.disputeNumber} resolution enforced by admin ${admin.email}. Escrow hold cleared.`,
            metadata: {
              resolutionId: enforcedResolution.id,
              resolutionType: data.resolutionType,
              clientAmountMinor: clientAmountMinor.toString(),
              workerAmountMinor: workerAmountMinor.toString(),
            },
            isLiveFinancialMovement: false,
          },
        });
      }

      await tx.contract.update({
        where: { id: dispute.contractId },
        data: { status: ContractStatus.ACTIVE },
      });

      // 4. Notify both participants
      await tx.notification.createMany({
        data: [
          {
            recipientId: dispute.contract.clientId,
            title: `Dispute Arbitrated: ${dispute.disputeNumber}`,
            message: `Platform administrator resolved dispute ${dispute.disputeNumber}: ${data.rationale}`,
            type: NotificationType.DISPUTE_RESOLVED,
            metadata: { disputeId: dispute.id },
          },
          {
            recipientId: dispute.contract.workerId,
            title: `Dispute Arbitrated: ${dispute.disputeNumber}`,
            message: `Platform administrator resolved dispute ${dispute.disputeNumber}: ${data.rationale}`,
            type: NotificationType.DISPUTE_RESOLVED,
            metadata: { disputeId: dispute.id },
          },
        ],
      });

      return enforcedResolution;
    });

    logger.info(`[DISPUTE ENFORCED] Admin ${admin.id} enforced resolution on dispute ${dispute.disputeNumber}`);
    return result;
  }

  /**
   * Escalates an active dispute to Superadmin mediation.
   */
  async escalateDispute(
    disputeId: string,
    reason: string,
    actor: { id: string; role: { name: UserRole }; firstName?: string | null; email: string },
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw { statusCode: 404, code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' };
    }

    const updated = await prisma.dispute.update({
      where: { id: dispute.id },
      data: { status: DisputeStatus.ESCALATED },
    });

    logger.info(`[DISPUTE ESCALATED] Dispute ${dispute.disputeNumber} escalated by actor ${actor.id}. Reason: ${reason}`);
    return updated;
  }

  /**
   * Retrieves internal notes for a dispute (restricted to Admin/Superadmin).
   */
  async getInternalNotes(disputeId: string) {
    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) {
      throw { statusCode: 404, code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' };
    }

    const notes = await prisma.disputeInternalNote.findMany({
      where: { disputeId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true, role: { select: { name: true } } },
        },
      },
    });

    return notes.map((n) => ({
      id: n.id,
      disputeId: n.disputeId,
      authorId: n.authorId,
      authorName: `${n.author.firstName || ''} ${n.author.lastName || ''}`.trim() || n.author.email,
      authorRole: n.author.role.name,
      note: n.note,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  /**
   * Adds an internal staff note (visible only to Admin/Superadmin).
   */
  async addInternalNote(disputeId: string, note: string, authorId: string) {
    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) {
      throw { statusCode: 404, code: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' };
    }

    return prisma.disputeInternalNote.create({
      data: {
        disputeId,
        authorId,
        note,
      },
    });
  }
}

export const disputesService = new DisputesService();
