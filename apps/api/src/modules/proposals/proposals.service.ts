import { prisma } from '../../config/prisma.js';
import { CreateJobProposalRequest, CounterofferProposalRequest } from '@trustpay/shared';

export class ProposalsService {
  /**
   * Submit a proposal on a published job
   */
  async submitProposal(workerId: string, data: CreateJobProposalRequest) {
    const job = await prisma.jobPost.findUnique({
      where: { id: data.jobPostId },
    });

    if (!job) {
      throw { statusCode: 404, code: 'JOB_NOT_FOUND', message: 'Job not found' };
    }

    if (job.status !== 'PUBLISHED') {
      throw { statusCode: 400, code: 'JOB_NOT_ACCEPTING_PROPOSALS', message: `Job is currently ${job.status}` };
    }

    if (job.applicationDeadline && new Date() > job.applicationDeadline) {
      throw { statusCode: 400, code: 'DEADLINE_PASSED', message: 'The application deadline for this job has passed' };
    }

    // Check duplicate active proposal by same worker
    const existingActive = await prisma.jobProposal.findFirst({
      where: {
        jobPostId: data.jobPostId,
        workerId,
        status: { in: ['PENDING', 'ACCEPTED', 'UNDER_REVISION'] },
      },
    });

    if (existingActive) {
      throw {
        statusCode: 409,
        code: 'DUPLICATE_PROPOSAL',
        message: 'You already have an active proposal submitted for this job',
      };
    }

    // If TEAM proposal, verify worker is Team Lead
    if (data.proposalType === 'TEAM') {
      if (!data.teamId) {
        throw { statusCode: 400, code: 'TEAM_ID_REQUIRED', message: 'Team ID required for team proposals' };
      }
      const team = await prisma.specialistTeam.findUnique({
        where: { id: data.teamId },
        include: { members: true },
      });
      if (!team) {
        throw { statusCode: 404, code: 'TEAM_NOT_FOUND', message: 'Specialist team not found' };
      }
      if (team.leadId !== workerId) {
        throw { statusCode: 403, code: 'NOT_TEAM_LEAD', message: 'Only the authorized Team Lead can submit team proposals' };
      }
      const activeMembers = team.members.filter((m: any) => m.status === 'ACTIVE' && m.consentGiven);
      if (activeMembers.length === 0) {
        throw { statusCode: 400, code: 'INSUFFICIENT_MEMBERS', message: 'Team must have active consenting members' };
      }
    }

    return prisma.$transaction(async (tx: any) => {
      const proposal = await tx.jobProposal.create({
        data: {
          jobPostId: data.jobPostId,
          workerId,
          teamId: data.teamId || null,
          proposalType: data.proposalType || 'INDIVIDUAL',
          coverLetter: data.coverLetter,
          proposedAmount: data.proposedAmount,
          currency: data.currency || job.currency,
          estimatedTimeline: data.estimatedTimeline,
          workApproach: data.workApproach,
          deliverables: data.deliverables,
          attachmentUrl: data.attachmentUrl,
          status: 'PENDING',
        },
      });

      // Record initial negotiation version (v1)
      await tx.proposalNegotiationVersion.create({
        data: {
          proposalId: proposal.id,
          versionNumber: 1,
          proposedAmount: data.proposedAmount,
          timeline: data.estimatedTimeline,
          scope: data.workApproach,
          deliverables: data.deliverables,
          message: data.coverLetter,
          counterOfferBy: 'SPECIALIST',
          status: 'PENDING',
        },
      });

      return tx.jobProposal.findUnique({
        where: { id: proposal.id },
        include: {
          jobPost: { select: { id: true, title: true, status: true, clientId: true } },
          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              workerProfile: true,
            },
          },
          team: {
            include: {
              members: { include: { worker: { select: { id: true, firstName: true, lastName: true } } } },
            },
          },
          negotiations: { orderBy: { versionNumber: 'desc' } },
        },
      });
    });
  }

  /**
   * Submit counteroffer / revision (Versioned negotiation)
   */
  async submitCounteroffer(proposalId: string, actorId: string, actorRole: 'CLIENT' | 'SPECIALIST', data: CounterofferProposalRequest) {
    const proposal = await prisma.jobProposal.findUnique({
      where: { id: proposalId },
      include: {
        jobPost: true,
        negotiations: { orderBy: { versionNumber: 'desc' } },
      },
    });

    if (!proposal) {
      throw { statusCode: 404, code: 'PROPOSAL_NOT_FOUND', message: 'Proposal not found' };
    }

    if (proposal.status === 'ACCEPTED' || proposal.status === 'DECLINED' || proposal.status === 'WITHDRAWN') {
      throw { statusCode: 400, code: 'INVALID_STATUS', message: `Cannot negotiate a ${proposal.status} proposal` };
    }

    if (actorRole === 'CLIENT' && proposal.jobPost.clientId !== actorId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Only the client who posted the job can counteroffer' };
    }
    if (actorRole === 'SPECIALIST' && proposal.workerId !== actorId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Only the proposal applicant can counteroffer' };
    }

    const nextVersion = (proposal.negotiations[0]?.versionNumber || 1) + 1;

    return prisma.$transaction(async (tx: any) => {
      await tx.jobProposal.update({
        where: { id: proposalId },
        data: {
          proposedAmount: data.proposedAmount,
          estimatedTimeline: data.timeline || proposal.estimatedTimeline,
          deliverables: data.deliverables || proposal.deliverables,
          status: 'UNDER_REVISION',
        },
      });

      await tx.proposalNegotiationVersion.create({
        data: {
          proposalId,
          versionNumber: nextVersion,
          proposedAmount: data.proposedAmount,
          timeline: data.timeline,
          scope: data.scope,
          deliverables: data.deliverables,
          message: data.message,
          counterOfferBy: actorRole,
          status: 'PENDING',
        },
      });

      return tx.jobProposal.findUnique({
        where: { id: proposalId },
        include: {
          jobPost: true,
          negotiations: { orderBy: { versionNumber: 'desc' } },
        },
      });
    });
  }

  /**
   * Client accepts proposal
   */
  async acceptProposal(proposalId: string, clientId: string) {
    const proposal = await prisma.jobProposal.findUnique({
      where: { id: proposalId },
      include: { jobPost: true },
    });

    if (!proposal) {
      throw { statusCode: 404, code: 'PROPOSAL_NOT_FOUND', message: 'Proposal not found' };
    }

    if (proposal.jobPost.clientId !== clientId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Only the job poster can accept proposals' };
    }

    if (proposal.status === 'ACCEPTED') {
      return proposal; // idempotent
    }

    if (proposal.status === 'DECLINED' || proposal.status === 'WITHDRAWN') {
      throw { statusCode: 400, code: 'INVALID_STATE', message: `Cannot accept a ${proposal.status} proposal` };
    }

    return prisma.$transaction(async (tx: any) => {
      const updated = await tx.jobProposal.update({
        where: { id: proposalId },
        data: { status: 'ACCEPTED' },
        include: {
          jobPost: true,
          worker: { select: { id: true, firstName: true, lastName: true, email: true } },
          team: { include: { members: true } },
        },
      });

      // Update latest negotiation version to ACCEPTED
      const latestNegotiation = await tx.proposalNegotiationVersion.findFirst({
        where: { proposalId },
        orderBy: { versionNumber: 'desc' },
      });
      if (latestNegotiation) {
        await tx.proposalNegotiationVersion.update({
          where: { id: latestNegotiation.id },
          data: { status: 'ACCEPTED' },
        });
      }

      return updated;
    });
  }

  /**
   * Client declines proposal
   */
  async declineProposal(proposalId: string, clientId: string, reason?: string) {
    const proposal = await prisma.jobProposal.findUnique({
      where: { id: proposalId },
      include: { jobPost: true },
    });

    if (!proposal) {
      throw { statusCode: 404, code: 'PROPOSAL_NOT_FOUND', message: 'Proposal not found' };
    }

    if (proposal.jobPost.clientId !== clientId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Only the job poster can decline proposals' };
    }

    return prisma.$transaction(async (tx: any) => {
      const updated = await tx.jobProposal.update({
        where: { id: proposalId },
        data: { status: 'DECLINED' },
      });

      const latestNegotiation = await tx.proposalNegotiationVersion.findFirst({
        where: { proposalId },
        orderBy: { versionNumber: 'desc' },
      });
      if (latestNegotiation) {
        await tx.proposalNegotiationVersion.update({
          where: { id: latestNegotiation.id },
          data: { status: 'DECLINED' },
        });
      }

      return updated;
    });
  }

  /**
   * Toggle proposal shortlist status
   */
  async toggleShortlist(proposalId: string, clientId: string) {
    const proposal = await prisma.jobProposal.findUnique({
      where: { id: proposalId },
      include: { jobPost: true },
    });

    if (!proposal) {
      throw { statusCode: 404, code: 'PROPOSAL_NOT_FOUND', message: 'Proposal not found' };
    }
    if (proposal.jobPost.clientId !== clientId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Unauthorized' };
    }

    return prisma.jobProposal.update({
      where: { id: proposalId },
      data: { isShortlisted: !proposal.isShortlisted },
    });
  }

  /**
   * List proposals for a job (Client view)
   */
  async listJobProposals(jobId: string, clientId: string, includeDeclined = false) {
    const job = await prisma.jobPost.findUnique({ where: { id: jobId } });
    if (!job) {
      throw { statusCode: 404, code: 'JOB_NOT_FOUND', message: 'Job not found' };
    }
    if (job.clientId !== clientId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Unauthorized to view applicants for this job' };
    }

    const where: any = { jobPostId: jobId };
    if (!includeDeclined) {
      where.status = { notIn: ['DECLINED', 'WITHDRAWN'] };
    }

    return prisma.jobProposal.findMany({
      where,
      orderBy: [{ isShortlisted: 'desc' }, { createdAt: 'desc' }],
      include: {
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            workerProfile: {
              include: {
                skills: { include: { skill: true } },
              },
            },
          },
        },
        team: {
          include: {
            members: {
              include: {
                worker: {
                  select: { id: true, firstName: true, lastName: true, avatarUrl: true, workerProfile: true },
                },
              },
            },
          },
        },
        negotiations: { orderBy: { versionNumber: 'desc' } },
      },
    });
  }

  /**
   * Specialist withdraws/deletes their submitted proposal
   */
  async withdrawProposal(proposalId: string, workerId: string) {
    const proposal = await prisma.jobProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw { statusCode: 404, code: 'PROPOSAL_NOT_FOUND', message: 'Proposal not found' };
    }

    if (proposal.workerId !== workerId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Only the proposal applicant can withdraw this proposal' };
    }

    if (proposal.status === 'ACCEPTED') {
      throw { statusCode: 400, code: 'INVALID_STATUS', message: 'Cannot withdraw an accepted proposal with an active contract' };
    }

    return prisma.$transaction(async (tx: any) => {
      await tx.proposalNegotiationVersion.deleteMany({ where: { proposalId } });
      return tx.jobProposal.delete({ where: { id: proposalId } });
    });
  }

  /**
   * List worker's submitted proposals
   */
  async listWorkerProposals(workerId: string) {
    return prisma.jobProposal.findMany({
      where: {
        workerId,
        status: { notIn: ['DECLINED', 'WITHDRAWN'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        jobPost: {
          select: {
            id: true,
            title: true,
            category: true,
            status: true,
            currency: true,
            minBudget: true,
            maxBudget: true,
            client: { select: { firstName: true, lastName: true } },
          },
        },
        team: true,
        negotiations: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });
  }
}

export const proposalsService = new ProposalsService();
