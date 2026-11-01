import { Request, Response } from 'express';
import { webhooksService } from './webhooks.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';
import { WebhookEventStatus } from '@prisma/client';

export async function handleProviderWebhook(req: Request, res: Response): Promise<void> {
  const { provider } = req.params;
  const signature = (req.headers['x-webhook-signature'] || req.headers['x-signature']) as string | undefined;
  const timestamp = req.headers['x-webhook-timestamp'] as string | undefined;

  // 1. Dedicated Cashfree Signature Verification & Ingestion Handler
  if (provider.toLowerCase() === 'cashfree') {
    const rawBody = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body || {});
    try {
      const result = await webhooksService.processCashfreeWebhook({
        rawBody,
        signature,
        timestamp,
        payload: (req.body as Record<string, unknown>) || {},
      });

      if (result.duplicate) {
        sendSuccess(res, 200, {
          status: 'DUPLICATE_IGNORED',
          message: 'Cashfree event was already processed.',
        });
        return;
      }

      sendSuccess(res, 200, {
        status: 'PROCESSED',
        message: 'Cashfree webhook verified and acknowledged.',
        eventId: result.event.id,
      });
      return;
    } catch (error: unknown) {
      const err = error as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode) {
        sendError(res, err.statusCode, err.code || 'BAD_REQUEST', err.message || 'Webhook verification failed');
        return;
      }
      logger.error('Error handling Cashfree webhook:', error);
      sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to process Cashfree webhook');
      return;
    }
  }

  // 2. Generic Provider Ingestion (for audited holding)
  const eventId = (req.body?.id || req.body?.eventId || req.headers['x-event-id']) as string;
  const eventType = (req.body?.type || req.body?.eventType || 'UNKNOWN_EVENT') as string;

  if (!eventId) {
    sendError(res, 400, 'MISSING_EVENT_ID', 'Webhook event must specify a unique event ID');
    return;
  }

  try {
    const result = await webhooksService.ingestWebhookEvent({
      provider: provider.toUpperCase(),
      eventId,
      eventType,
      payload: req.body || {},
      signature,
    });

    if (result.duplicate) {
      sendSuccess(res, 200, {
        status: 'DUPLICATE_IGNORED',
        message: 'Event was already recorded and acknowledged.',
      });
      return;
    }

    sendSuccess(res, 202, {
      status: 'AUDITED_AND_HELD',
      message: 'Event recorded in audit logs. Live financial execution is disabled pending provider selection.',
      eventId: result.event.id,
    });
  } catch (error) {
    logger.error('Error ingesting webhook event:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to process webhook event');
  }
}

export async function listWebhookEvents(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
  const provider = req.query.provider as string | undefined;
  const status = req.query.status as WebhookEventStatus | undefined;

  try {
    const result = await webhooksService.listWebhookEvents({
      page,
      limit,
      provider,
      status,
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    logger.error('Error listing webhook events:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve webhook events');
  }
}

