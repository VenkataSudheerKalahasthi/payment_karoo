import { Request, Response } from 'express';
import { escrowService } from './escrow.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import {
  listEscrowsQuerySchema,
  updateDisputeHoldSchema,
} from './escrow.schema.js';

export async function getContractEscrow(req: Request, res: Response): Promise<void> {
  const { contractId } = req.params;
  const user = req.user!;

  try {
    const escrow = await escrowService.getEscrowForAuthorizedUser(contractId, user);
    sendSuccess(res, 200, escrow);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'BAD_REQUEST', err.message || 'Failed to retrieve escrow');
      return;
    }
    logger.error(`Error retrieving escrow for contract ${contractId}:`, error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve contract escrow');
  }
}

export async function initializeContractEscrow(req: Request, res: Response): Promise<void> {
  const { contractId } = req.params;
  const user = req.user!;

  try {
    const escrow = await escrowService.initializeContractEscrow(contractId, user);
    await recordAuditLog({
      actorId: user.id,
      action: 'ESCROW_INITIALIZED',
      resource: 'EscrowRecord',
      resourceId: escrow.id,
      details: {
        contractId,
        currency: escrow.currency,
        contractualAmountMinor: escrow.contractualAmountMinor,
      },
      req,
    });
    sendSuccess(res, 201, escrow);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'BAD_REQUEST', err.message || 'Failed to initialize contract escrow');
      return;
    }
    logger.error(`Error initializing escrow for contract ${contractId}:`, error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to initialize contract escrow');
  }
}

export async function listEscrows(req: Request, res: Response): Promise<void> {
  const query = listEscrowsQuerySchema.safeParse(req.query);
  if (!query.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', query.error.format());
    return;
  }

  try {
    const result = await escrowService.listEscrows(query.data);
    sendSuccess(res, 200, result);
  } catch (error) {
    logger.error('Error listing escrow records:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve escrow records');
  }
}

export async function setDisputeHold(req: Request, res: Response): Promise<void> {
  const { contractId } = req.params;
  const body = updateDisputeHoldSchema.safeParse(req.body);
  if (!body.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request body', body.error.format());
    return;
  }

  const actor = req.user!;

  try {
    const updated = await escrowService.setDisputeHold(
      contractId,
      body.data.disputeHold,
      actor.id,
      body.data.reason,
    );

    await recordAuditLog({
      actorId: actor.id,
      action: body.data.disputeHold ? 'ESCROW_DISPUTE_HOLD_ENABLED' : 'ESCROW_DISPUTE_HOLD_RELEASED',
      resource: 'EscrowRecord',
      resourceId: updated.id,
      details: {
        contractId,
        disputeHold: body.data.disputeHold,
        reason: body.data.reason,
      },
      req,
    });

    sendSuccess(res, 200, updated);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'BAD_REQUEST', err.message || 'Failed to update dispute hold');
      return;
    }
    logger.error(`Error updating dispute hold for contract ${contractId}:`, error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update escrow dispute status');
  }
}

export async function getEscrowActivities(req: Request, res: Response): Promise<void> {
  const { contractId } = req.params;
  const user = req.user!;

  try {
    const activities = await escrowService.getActivities(contractId, user);
    sendSuccess(res, 200, activities);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'BAD_REQUEST', err.message || 'Failed to retrieve escrow activities');
      return;
    }
    logger.error(`Error retrieving activities for contract ${contractId}:`, error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve escrow activities');
  }
}


