import { Request, Response } from 'express';
import { paymentsService } from './payments.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';
import { recordAuditLog } from '../../utils/audit.js';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

const createOrderSchema = z.object({
  contractId: z.string().uuid('Contract ID must be a valid UUID'),
  idempotencyKey: z.string().optional(),
});

export async function createPaymentOrder(req: Request, res: Response): Promise<void> {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request body', parsed.error.format());
    return;
  }

  const user = req.user!;

  try {
    const result = await paymentsService.createPaymentOrder({
      contractId: parsed.data.contractId,
      actor: user,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'PAYMENT_ORDER_CREATED',
      resource: 'PaymentTransaction',
      resourceId: result.orderId,
      details: {
        contractId: result.contractId,
        orderId: result.orderId,
        amount: result.amount,
        currency: result.currency,
        environment: result.environment,
      },
      req,
    });

    sendSuccess(res, 201, result);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string; details?: unknown };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'BAD_REQUEST', err.message || 'Payment order creation failed', err.details);
      return;
    }
    logger.error('Error creating payment order:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create payment order');
  }
}

export async function verifyPaymentStatus(req: Request, res: Response): Promise<void> {
  const { orderId } = req.params;
  const user = req.user!;

  if (!orderId) {
    sendError(res, 400, 'MISSING_ORDER_ID', 'Order ID is required');
    return;
  }

  try {
    const result = await paymentsService.verifyPaymentStatus({
      orderId,
      actor: user,
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'PAYMENT_STATUS_VERIFIED',
      resource: 'PaymentTransaction',
      resourceId: result.id,
      details: {
        orderId: result.orderId,
        status: result.status,
        cashfreeStatus: result.cashfreeOrderStatus,
        amount: result.amount,
      },
      req,
    });

    sendSuccess(res, 200, result);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    if (err.statusCode) {
      sendError(res, err.statusCode, err.code || 'BAD_REQUEST', err.message || 'Payment verification failed');
      return;
    }
    logger.error(`Error verifying payment for order ${orderId}:`, error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to verify payment status');
  }
}

export async function listPaymentTransactions(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const isAdmin = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
  const contractId = req.query.contractId as string | undefined;

  const filter: Parameters<typeof paymentsService.listPaymentTransactions>[0] = {
    page,
    limit,
    contractId,
  };

  // If not admin, restrict strictly to transactions where user is payer or payee
  if (!isAdmin) {
    if (user.role.name === UserRole.CLIENT) {
      filter.payerId = user.id;
    } else {
      filter.payeeId = user.id;
    }
  }

  try {
    const result = await paymentsService.listPaymentTransactions(filter);
    sendSuccess(res, 200, result);
  } catch (error) {
    logger.error('Error listing payment transactions:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve payment transactions');
  }
}

export async function getPaymentTransaction(req: Request, res: Response): Promise<void> {
  const { reference } = req.params;
  const user = req.user!;
  const isAdmin = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

  try {
    const tx = await paymentsService.getTransactionByReference(reference);
    if (!tx) {
      sendError(res, 404, 'NOT_FOUND', `Payment transaction "${reference}" was not found.`);
      return;
    }

    if (!isAdmin && tx.payerId !== user.id && tx.payeeId !== user.id) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied to payment transaction details.');
      return;
    }

    sendSuccess(res, 200, tx);
  } catch (error) {
    logger.error(`Error retrieving transaction ${reference}:`, error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve transaction');
  }
}

export async function getPlatformFinancialConfig(req: Request, res: Response): Promise<void> {
  try {
    const config = await paymentsService.getPlatformConfig();
    sendSuccess(res, 200, config);
  } catch (error) {
    logger.error('Error fetching platform financial config:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve platform financial config');
  }
}

