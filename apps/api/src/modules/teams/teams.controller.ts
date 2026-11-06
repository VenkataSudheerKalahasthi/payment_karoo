import { Request, Response } from 'express';
import { teamsService } from './teams.service.js';
import { createSpecialistTeamSchema, inviteTeamMemberSchema, respondTeamInvitationSchema } from './teams.schema.js';

export async function createTeam(req: Request, res: Response) {
  try {
    const input = createSpecialistTeamSchema.parse(req.body);
    const team = await teamsService.createTeam(req.user!.id, {
      ...input,
      logoUrl: input.logoUrl ?? undefined,
    });
    return res.status(201).json({
      success: true,
      data: team,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.errors[0]?.message || 'Validation failed' },
      });
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to create team' },
    });
  }
}

export async function inviteMember(req: Request, res: Response) {
  try {
    const input = inviteTeamMemberSchema.parse(req.body);
    const invitation = await teamsService.inviteMember(req.params.id, req.user!.id, input);
    return res.status(201).json({
      success: true,
      data: invitation,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.errors[0]?.message || 'Validation failed' },
      });
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to send invitation' },
    });
  }
}

export async function respondInvitation(req: Request, res: Response) {
  try {
    const input = respondTeamInvitationSchema.parse(req.body);
    const result = await teamsService.respondToInvitation(req.params.invitationId, req.user!.id, input.status);
    return res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to respond to invitation' },
    });
  }
}

export async function getTeam(req: Request, res: Response) {
  try {
    const team = await teamsService.getTeamById(req.params.id);
    return res.json({
      success: true,
      data: team,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to retrieve team' },
    });
  }
}

export async function listMyTeams(req: Request, res: Response) {
  try {
    const teams = await teamsService.listWorkerTeams(req.user!.id);
    return res.json({
      success: true,
      data: teams,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to list teams' },
    });
  }
}

export async function listInvitations(req: Request, res: Response) {
  try {
    const invitations = await teamsService.listPendingInvitations(req.user!.id);
    return res.json({
      success: true,
      data: invitations,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to list invitations' },
    });
  }
}
