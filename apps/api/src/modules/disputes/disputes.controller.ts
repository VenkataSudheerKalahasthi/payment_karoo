import { Request, Response } from 'express';
import { disputesService } from './disputes.service.js';
import {
  createDisputeSchema,
  submitDisputeResponseSchema,
  uploadDisputeEvidenceSchema,
  proposeResolutionSchema,
  respondToResolutionSchema,
  adminEnforceResolutionSchema,
  addInternalNoteSchema,
  listDisputesQuerySchema,
} from './disputes.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';
import { recordAuditLog } from '../../utils/audit.js';

export async function createDispute(req: Request, res: Response): Promise<void> {
  const parsed = createDisputeSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    return;
  }

  try {
    const dispute = await disputesService.createDispute(parsed.data, req.user!);
    await recordAuditLog({
      actorId: req.user!.id,
      action: 'DISPUTE_CREATED',
      resource: 'Dispute',
      resourceId: dispute.id,
      details: { disputeNumber: dispute.disputeNumber, contractId: parsed.data.contractId },
      req,
    });
    sendSuccess(res, 201, dispute);
  } catch (error: unknown) {
    logger.error('Error creating dispute:', error);
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', err.message || 'Failed to initiate dispute');
  }
}

export async function getDisputeById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const dispute = await disputesService.getDisputeById(id, req.user!);
    sendSuccess(res, 200, dispute);
  } catch (error: unknown) {
    logger.error('Error fetching dispute:', error);
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', err.message || 'Failed to retrieve dispute');
  }
}

export async function listDisputes(req: Request, res: Response): Promise<void> {
  const parsed = listDisputesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    return;
  }

  try {
    const result = await disputesService.listDisputes(parsed.data, req.user!);
    sendSuccess(res, 200, result);
  } catch (error: unknown) {
    logger.error('Error listing disputes:', error);
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', err.message || 'Failed to list disputes');
  }
}

export async function getDisputeMetrics(_req: Request, res: Response): Promise<void> {
  try {
    const metrics = await disputesService.getDisputeMetrics();
    sendSuccess(res, 200, metrics);
  } catch (error: unknown) {
    logger.error('Error fetching dispute metrics:', error);
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', err.message || 'Failed to fetch dispute metrics');
  }
}

export async function submitResponse(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const parsed = submitDisputeResponseSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    return;
  }

  try {
    const response = await disputesService.submitResponse(id, parsed.data.content, req.user!);
    sendSuccess(res, 201, response);
  } catch (error: unknown) {
    logger.error('Error submitting dispute response:', error);
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', err.message || 'Failed to submit response');
  }
}

export async function uploadEvidence(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const parsed = uploadDisputeEvidenceSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    return;
  }

  try {
    const evidence = await disputesService.uploadEvidence(id, parsed.data, req.user!);
    sendSuccess(res, 201, evidence);
  } catch (error: unknown) {
    logger.error('Error uploading dispute evidence:', error);
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', err.message || 'Failed to upload evidence');
  }
}

export async function proposeResolution(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const parsed = proposeResolutionSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    return;
  }

  try {
    const resolution = await disputesService.proposeResolution(id, parsed.data, req.user!);
    sendSuccess(res, 201, resolution);
  } catch (error: unknown) {
    logger.error('Error proposing resolution:', error);
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', err.message || 'Failed to propose resolution');
  }
}

export async function respondToResolution(req: Request, res: Response): Promise<void> {
  const { id, resolutionId } = req.params;
  const parsed = respondToResolutionSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    return;
  }

  try {
    const result = await disputesService.respondToResolution(id, resolutionId, parsed.data.agree, req.user!);
    sendSuccess(res, 200, result);
  } catch (error: unknown) {
    logger.error('Error responding to resolution:', error);
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', err.message || 'Failed to record resolution response');
  }
}

export async function adminEnforceResolution(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const parsed = adminEnforceResolutionSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    return;
  }

  try {
    const result = await disputesService.adminEnforceResolution(id, parsed.data, req.user!);
    await recordAuditLog({
      actorId: req.user!.id,
      action: 'DISPUTE_RESOLUTION_ENFORCED',
      resource: 'Dispute',
      resourceId: id,
      details: { resolutionType: parsed.data.resolutionType, clientAmount: parsed.data.clientAmountMinor },
      req,
    });
    sendSuccess(res, 200, result);
  } catch (error: unknown) {
    logger.error('Error enforcing dispute resolution:', error);
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', err.message || 'Failed to enforce resolution');
  }
}

export async function escalateDispute(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const reason = (req.body.reason as string) || 'Dispute escalated to platform administrators';

  try {
    const result = await disputesService.escalateDispute(id, reason, req.user!);
    sendSuccess(res, 200, result);
  } catch (error: unknown) {
    logger.error('Error escalating dispute:', error);
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', err.message || 'Failed to escalate dispute');
  }
}

export async function getInternalNotes(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const notes = await disputesService.getInternalNotes(id);
    sendSuccess(res, 200, notes);
  } catch (error: unknown) {
    logger.error('Error fetching internal notes:', error);
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', err.message || 'Failed to retrieve internal notes');
  }
}

export async function addInternalNote(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const parsed = addInternalNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0].message);
    return;
  }

  try {
    const note = await disputesService.addInternalNote(id, parsed.data.note, req.user!.id);
    sendSuccess(res, 201, note);
  } catch (error: unknown) {
    logger.error('Error adding internal note:', error);
    const err = error as { statusCode?: number; code?: string; message?: string };
    sendError(res, err.statusCode || 500, err.code || 'INTERNAL_SERVER_ERROR', err.message || 'Failed to save internal note');
  }
}
