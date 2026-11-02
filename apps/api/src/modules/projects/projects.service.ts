import { prisma } from '../../config/prisma.js';
import { UserRole, ProjectStatus, MilestoneStatus, ContractStatus } from '@prisma/client';
import { CreateProjectInput, UpdateProjectInput } from './projects.schema.js';
import { emitProjectRealtimeEvent } from '../realtime/socket.service.js';
import { logger } from '../../utils/logger.js';

export class ProjectsService {
  /**
   * Auto-provisions or retrieves an active Project record for a Contract.
   */
  async autoProvisionProjectForContract(contractId: string) {
    const existing = await prisma.project.findUnique({
      where: { contractId },
      include: {
        milestones: { orderBy: { order: 'asc' } },
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        worker: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (existing) {
      return existing;
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { milestones: true },
    });

    if (!contract) {
      throw { statusCode: 404, code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' };
    }

    return await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          contractId: contract.id,
          clientId: contract.clientId,
          workerId: contract.workerId,
          title: contract.title,
          description: contract.description,
          scope: contract.scopeOfWork,
          startDate: contract.startDate || new Date(),
          expectedCompletionDate: contract.endDate,
          status: ProjectStatus.ACTIVE,
          progressPercentage: 0,
        },
      });

      // Associate milestones with the new project
      await tx.contractMilestone.updateMany({
        where: { contractId: contract.id },
        data: { projectId: project.id },
      });

      // Record activity
      await tx.milestoneActivity.create({
        data: {
          contractId: contract.id,
          projectId: project.id,
          actorId: contract.clientId,
          actorRole: UserRole.CLIENT,
          action: 'PROJECT_PROVISIONED',
          previousState: null,
          newState: ProjectStatus.ACTIVE,
          metadata: {
            title: project.title,
            milestonesCount: contract.milestones.length,
          },
        },
      });

      return await tx.project.findUnique({
        where: { id: project.id },
        include: {
          milestones: { orderBy: { order: 'asc' } },
          client: { select: { id: true, firstName: true, lastName: true, email: true } },
          worker: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    });
  }

  /**
   * Explicitly creates a project for a contract with custom scope/dates.
   */
  async createProject(
    contractId: string,
    user: { id: string; role: { name: UserRole } },
    input: CreateProjectInput,
  ) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { milestones: true },
    });

    if (!contract) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Contract not found' };
    }

    const isClient = contract.clientId === user.id;
    const isWorker = contract.workerId === user.id;
    const isAdmin = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

    if (!isClient && !isWorker && !isAdmin) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Unauthorized access to contract project.' };
    }

    const existing = await prisma.project.findUnique({
      where: { contractId },
    });

    if (existing) {
      return this.getProject(existing.id, user);
    }

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          contractId: contract.id,
          clientId: contract.clientId,
          workerId: contract.workerId,
          title: input.title || contract.title,
          description: input.description || contract.description,
          scope: input.scope || contract.scopeOfWork,
          startDate: input.startDate ? new Date(input.startDate) : contract.startDate || new Date(),
          expectedCompletionDate: input.expectedCompletionDate ? new Date(input.expectedCompletionDate) : contract.endDate,
          status: ProjectStatus.ACTIVE,
          progressPercentage: 0,
        },
      });

      await tx.contractMilestone.updateMany({
        where: { contractId: contract.id },
        data: { projectId: created.id },
      });

      await tx.milestoneActivity.create({
        data: {
          contractId: contract.id,
          projectId: created.id,
          actorId: user.id,
          actorRole: user.role.name,
          action: 'PROJECT_CREATED',
          previousState: null,
          newState: ProjectStatus.ACTIVE,
          metadata: { title: created.title },
        },
      });

      return created;
    });

    emitProjectRealtimeEvent(project.id, 'project:created', project, contract.id);
    return this.getProject(project.id, user);
  }

  /**
   * Retrieves a single project with complete milestones, submissions, and ownership validation.
   */
  async getProject(projectId: string, user: { id: string; role: { name: UserRole } }) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            version: true,
            currency: true,
            totalAmount: true,
          },
        },
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        worker: { select: { id: true, firstName: true, lastName: true, email: true } },
        milestones: {
          orderBy: { order: 'asc' },
          include: {
            submissions: {
              orderBy: { submittedAt: 'desc' },
              include: {
                revisionRequests: {
                  orderBy: { createdAt: 'desc' },
                  include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                  },
                },
                worker: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw { statusCode: 404, code: 'PROJECT_NOT_FOUND', message: 'Project not found' };
    }

    const isClient = project.clientId === user.id;
    const isWorker = project.workerId === user.id;
    const isAdmin = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

    if (!isClient && !isWorker && !isAdmin) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'You are not authorized to view this project.' };
    }

    return project;
  }

  /**
   * Retrieves a project by its originating contractId.
   */
  async getProjectByContractId(contractId: string, user: { id: string; role: { name: UserRole } }) {
    let project = await prisma.project.findUnique({
      where: { contractId },
    });

    if (!project) {
      project = await this.autoProvisionProjectForContract(contractId);
    }

    return this.getProject(project!.id, user);
  }

  /**
   * Lists projects for the authenticated user (client, worker, or administrator).
   */
  async listProjects(
    user: { id: string; role: { name: UserRole } },
    filters: { status?: ProjectStatus; page?: number; limit?: number },
  ) {
    const isAdmin = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;
    const isWorker = user.role.name === UserRole.WORKER;

    const where: any = {};
    if (!isAdmin) {
      if (isWorker) {
        where.workerId = user.id;
      } else {
        where.clientId = user.id;
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, email: true } },
          worker: { select: { id: true, firstName: true, lastName: true, email: true } },
          milestones: {
            select: { id: true, title: true, amount: true, status: true, order: true },
            orderBy: { order: 'asc' },
          },
          contract: {
            select: { id: true, contractNumber: true, status: true, currency: true, totalAmount: true },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Calculates comprehensive milestone progress summary in integer minor units.
   */
  async getProjectProgressSummary(projectId: string, user: { id: string; role: { name: UserRole } }) {
    const project = await this.getProject(projectId, user);
    const milestones = project.milestones;

    let totalMinor = 0n;
    let approvedMinor = 0n;
    let pendingMinor = 0n;
    let disputedMinor = 0n;

    let completedCount = 0;
    let inProgressCount = 0;
    let pendingCount = 0;
    let inRevisionCount = 0;

    for (const m of milestones) {
      const amountMinor = BigInt(Math.round(Number(m.amount) * 100));
      totalMinor += amountMinor;

      switch (m.status) {
        case MilestoneStatus.APPROVED:
          approvedMinor += amountMinor;
          completedCount++;
          break;
        case MilestoneStatus.SUBMITTED:
          pendingMinor += amountMinor;
          inProgressCount++;
          break;
        case MilestoneStatus.IN_PROGRESS:
          pendingMinor += amountMinor;
          inProgressCount++;
          break;
        case MilestoneStatus.IN_REVISION:
          pendingMinor += amountMinor;
          inRevisionCount++;
          break;
        case MilestoneStatus.DISPUTED:
          disputedMinor += amountMinor;
          break;
        default:
          pendingMinor += amountMinor;
          pendingCount++;
          break;
      }
    }

    const remainingUnapprovedMinor = totalMinor - approvedMinor;
    const progressPercentage =
      milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

    return {
      projectId: project.id,
      contractId: project.contractId,
      totalMilestones: milestones.length,
      completedMilestones: completedCount,
      inProgressMilestones: inProgressCount,
      pendingMilestones: pendingCount,
      inRevisionMilestones: inRevisionCount,
      progressPercentage,
      totalValueMinor: totalMinor.toString(),
      approvedValueMinor: approvedMinor.toString(),
      pendingValueMinor: pendingMinor.toString(),
      disputedValueMinor: disputedMinor.toString(),
      remainingUnapprovedValueMinor: remainingUnapprovedMinor.toString(),
      currency: project.contract.currency || 'USD',
    };
  }

  /**
   * Retrieves append-only milestone activity timeline with authorization check.
   */
  async getMilestoneActivities(
    projectId: string,
    user: { id: string; role: { name: UserRole } },
    milestoneId?: string,
  ) {
    // Check access first
    await this.getProject(projectId, user);

    const where: any = { projectId };
    if (milestoneId) {
      where.milestoneId = milestoneId;
    }

    return await prisma.milestoneActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: { select: { name: true } },
          },
        },
      },
    });
  }
}

export const projectsService = new ProjectsService();

