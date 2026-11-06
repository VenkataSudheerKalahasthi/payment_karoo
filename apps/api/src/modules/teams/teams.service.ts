import { prisma } from '../../config/prisma.js';
import { CreateSpecialistTeamRequest, InviteTeamMemberRequest } from '@trustpay/shared';

export class TeamsService {
  /**
   * Create a new specialist team
   */
  async createTeam(leadId: string, data: CreateSpecialistTeamRequest) {
    return prisma.$transaction(async (tx: any) => {
      const team = await tx.specialistTeam.create({
        data: {
          name: data.name,
          description: data.description,
          category: data.category,
          logoUrl: data.logoUrl,
          maxMembers: data.maxMembers || 10,
          leadId,
          skills: data.skills || [],
          status: 'ACTIVE',
        },
      });

      // Automatically add Team Lead as active consented member
      await tx.specialistTeamMember.create({
        data: {
          teamId: team.id,
          workerId: leadId,
          role: 'LEAD',
          status: 'ACTIVE',
          consentGiven: true,
          consentDate: new Date(),
          workloadAllocation: 100,
          responsibility: 'Team Lead & Project Coordinator',
        },
      });

      return tx.specialistTeam.findUnique({
        where: { id: team.id },
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          members: {
            include: {
              worker: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                  workerProfile: {
                    select: { headline: true, rating: true, skills: { include: { skill: true } } },
                  },
                },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Invite a specialist to join the team
   */
  async inviteMember(teamId: string, leadId: string, data: InviteTeamMemberRequest) {
    const team = await prisma.specialistTeam.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) {
      throw { statusCode: 404, code: 'TEAM_NOT_FOUND', message: 'Team not found' };
    }
    if (team.leadId !== leadId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Only the Team Lead can invite new members' };
    }

    if (team.members.length >= team.maxMembers) {
      throw { statusCode: 400, code: 'TEAM_CAPACITY_REACHED', message: `Team is at maximum capacity (${team.maxMembers} members)` };
    }

    const existingMember = await prisma.specialistTeamMember.findUnique({
      where: { teamId_workerId: { teamId, workerId: data.workerId } },
    });
    if (existingMember && existingMember.status === 'ACTIVE') {
      throw { statusCode: 409, code: 'ALREADY_MEMBER', message: 'Specialist is already an active member of this team' };
    }

    return prisma.$transaction(async (tx: any) => {
      // Upsert membership record as INVITED (requiring consent)
      await tx.specialistTeamMember.upsert({
        where: { teamId_workerId: { teamId, workerId: data.workerId } },
        create: {
          teamId,
          workerId: data.workerId,
          role: data.role || 'MEMBER',
          status: 'INVITED',
          consentGiven: false,
          workloadAllocation: (data as any).workloadAllocation || 100,
          responsibility: (data as any).responsibility || null,
        },
        update: {
          role: data.role || 'MEMBER',
          status: 'INVITED',
          consentGiven: false,
        },
      });

      const invitation = await tx.teamInvitation.create({
        data: {
          teamId,
          workerId: data.workerId,
          invitedById: leadId,
          role: data.role || 'MEMBER',
          message: data.message,
          status: 'PENDING',
        },
        include: {
          team: { select: { id: true, name: true, category: true } },
          invitedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return invitation;
    });
  }

  /**
   * Specialist accepts or declines team invitation (Explicit consent)
   */
  async respondToInvitation(invitationId: string, workerId: string, status: 'ACCEPTED' | 'DECLINED') {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { team: true },
    });

    if (!invitation) {
      throw { statusCode: 404, code: 'INVITATION_NOT_FOUND', message: 'Team invitation not found' };
    }
    if (invitation.workerId !== workerId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Unauthorized to respond to this invitation' };
    }

    return prisma.$transaction(async (tx: any) => {
      await tx.teamInvitation.update({
        where: { id: invitationId },
        data: { status },
      });

      if (status === 'ACCEPTED') {
        await tx.specialistTeamMember.update({
          where: { teamId_workerId: { teamId: invitation.teamId, workerId } },
          data: {
            status: 'ACTIVE',
            consentGiven: true,
            consentDate: new Date(),
          },
        });
      } else {
        await tx.specialistTeamMember.update({
          where: { teamId_workerId: { teamId: invitation.teamId, workerId } },
          data: { status: 'DECLINED', consentGiven: false },
        });
      }

      return { invitationId, status, teamId: invitation.teamId };
    });
  }

  /**
   * Get team by ID
   */
  async getTeamById(teamId: string) {
    const team = await prisma.specialistTeam.findUnique({
      where: { id: teamId },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
        members: {
          where: { status: 'ACTIVE' },
          include: {
            worker: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                workerProfile: {
                  select: { headline: true, rating: true, skills: { include: { skill: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw { statusCode: 404, code: 'TEAM_NOT_FOUND', message: 'Team not found' };
    }

    return {
      ...team,
      memberCount: team.members.length,
    };
  }

  /**
   * List teams for a specialist (as lead or member)
   */
  async listWorkerTeams(workerId: string) {
    return prisma.specialistTeam.findMany({
      where: {
        members: {
          some: {
            workerId,
            status: 'ACTIVE',
          },
        },
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        members: {
          where: { status: 'ACTIVE' },
          include: {
            worker: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  /**
   * List pending invitations for a specialist
   */
  async listPendingInvitations(workerId: string) {
    return prisma.teamInvitation.findMany({
      where: {
        workerId,
        status: 'PENDING',
      },
      include: {
        team: {
          include: {
            lead: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            _count: { select: { members: true } },
          },
        },
        invitedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const teamsService = new TeamsService();
