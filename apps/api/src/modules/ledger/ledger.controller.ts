import { Request, Response } from 'express';
import { ledgerService } from './ledger.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import {
  listAccountsQuerySchema,
  listTransactionsQuerySchema,
  trialBalanceQuerySchema,
  reverseTransactionSchema,
} from './ledger.schema.js';

export async function listAccounts(req: Request, res: Response): Promise<void> {
  const query = listAccountsQuerySchema.safeParse(req.query);
  if (!query.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', query.error.format());
    return;
  }

  try {
    const result = await ledgerService.listAccounts(query.data);
    sendSuccess(res, 200, result);
  } catch (error) {
    logger.error('Error fetching ledger accounts:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve ledger accounts');
  }
}

export async function getAccountDetails(req: Request, res: Response): Promise<void> {
  const { accountCode } = req.params;

  try {
    const balance = await ledgerService.getAccountBalance(accountCode);
    sendSuccess(res, 200, {
      account: balance.account,
      debitsMinor: balance.debitsMinor.toString(),
      creditsMinor: balance.creditsMinor.toString(),
      netBalanceMinor: balance.netBalanceMinor.toString(),
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode === 404) {
      sendError(res, 404, 'ACCOUNT_NOT_FOUND', err.message || 'Account not found');
      return;
    }
    logger.error(`Error fetching account details for ${accountCode}:`, error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve account details');
  }
}

export async function listTransactions(req: Request, res: Response): Promise<void> {
  const query = listTransactionsQuerySchema.safeParse(req.query);
  if (!query.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', query.error.format());
    return;
  }

  try {
    const result = await ledgerService.listTransactions(query.data);
    sendSuccess(res, 200, result);
  } catch (error) {
    logger.error('Error fetching ledger transactions:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve ledger transactions');
  }
}

export async function getTransactionDetails(req: Request, res: Response): Promise<void> {
  const { reference } = req.params;

  try {
    const tx = await ledgerService.getTransactionByReference(reference);
    if (!tx) {
      sendError(res, 404, 'TRANSACTION_NOT_FOUND', `Ledger transaction "${reference}" was not found.`);
      return;
    }
    sendSuccess(res, 200, tx);
  } catch (error) {
    logger.error(`Error fetching transaction details for ${reference}:`, error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve transaction details');
  }
}

export async function getTrialBalance(req: Request, res: Response): Promise<void> {
  const query = trialBalanceQuerySchema.safeParse(req.query);
  if (!query.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', query.error.format());
    return;
  }

  try {
    const report = await ledgerService.getTrialBalance(query.data.currency);
    sendSuccess(res, 200, report);
  } catch (error) {
    logger.error('Error generating trial balance report:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to generate trial balance report');
  }
}

export async function reverseTransaction(req: Request, res: Response): Promise<void> {
  const { reference } = req.params;
  const body = reverseTransactionSchema.safeParse(req.body);
  if (!body.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid reversal reason', body.error.format());
    return;
  }

  const actor = req.user!;

  try {
    const reversal = await ledgerService.reverseTransaction(reference, body.data.reason);

    await recordAuditLog({
      actorId: actor.id,
      action: 'LEDGER_TRANSACTION_REVERSED',
      resource: 'LedgerTransaction',
      resourceId: reversal.id,
      details: {
        originalReference: reference,
        reversalReference: reversal.transactionReference,
        reason: body.data.reason,
      },
      req,
    });

    sendSuccess(res, 200, {
      message: 'Transaction successfully reversed with an explicit offsetting entry.',
      reversal: {
        ...reversal,
        entries: reversal.entries.map((e) => ({
          ...e,
          amountMinor: e.amountMinor.toString(),
        })),
      },
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'BAD_REQUEST', err.message || 'Failed to reverse transaction');
      return;
    }
    logger.error(`Error reversing transaction ${reference}:`, error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to reverse ledger transaction');
  }
}

export async function getFinancialOverview(req: Request, res: Response): Promise<void> {
  try {
    const overview = await ledgerService.getFinancialOverview();
    sendSuccess(res, 200, overview);
  } catch (error) {
    logger.error('Error fetching financial overview:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to calculate financial overview');
  }
}

