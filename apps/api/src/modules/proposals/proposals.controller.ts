import { Request, Response } from 'express';
import { proposalsService } from './proposals.service.js';
import { createJobProposalSchema, counterofferProposalSchema, respondProposalSchema } from './proposals.schema.js';

export async function submitProposal(req: Request, res: Response) {
  try {
    const input = createJobProposalSchema.parse(req.body);
    const proposal = await proposalsService.submitProposal(req.user!.id, input as any);
    return res.status(201).json({
      success: true,
      data: proposal,
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
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to submit proposal' },
    });
  }
}

export async function submitCounteroffer(req: Request, res: Response) {
  try {
    const input = counterofferProposalSchema.parse(req.body);
    const actorRole = req.user!.role.name === 'CLIENT' ? 'CLIENT' : 'SPECIALIST';
    const proposal = await proposalsService.submitCounteroffer(req.params.id, req.user!.id, actorRole, input);
    return res.json({
      success: true,
      data: proposal,
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
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to submit counteroffer' },
    });
  }
}

export async function acceptProposal(req: Request, res: Response) {
  try {
    const proposal = await proposalsService.acceptProposal(req.params.id, req.user!.id);
    return res.json({
      success: true,
      data: proposal,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to accept proposal' },
    });
  }
}

export async function declineProposal(req: Request, res: Response) {
  try {
    const proposal = await proposalsService.declineProposal(req.params.id, req.user!.id, req.body.reason);
    return res.json({
      success: true,
      data: proposal,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to decline proposal' },
    });
  }
}

export async function toggleShortlist(req: Request, res: Response) {
  try {
    const proposal = await proposalsService.toggleShortlist(req.params.id, req.user!.id);
    return res.json({
      success: true,
      data: proposal,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to toggle shortlist' },
    });
  }
}

export async function listJobProposals(req: Request, res: Response) {
  try {
    const includeDeclined = req.query.includeDeclined === 'true';
    const proposals = await proposalsService.listJobProposals(req.params.jobId, req.user!.id, includeDeclined);
    return res.json({
      success: true,
      data: proposals,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to list proposals' },
    });
  }
}

export async function listMyProposals(req: Request, res: Response) {
  try {
    const proposals = await proposalsService.listWorkerProposals(req.user!.id);
    return res.json({
      success: true,
      data: proposals,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to list proposals' },
    });
  }
}

export async function withdrawProposal(req: Request, res: Response) {
  try {
    const deleted = await proposalsService.withdrawProposal(req.params.id, req.user!.id);
    return res.json({
      success: true,
      data: deleted,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to withdraw proposal' },
    });
  }
}
