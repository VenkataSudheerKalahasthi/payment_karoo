import { prisma } from '../../config/prisma.js';
import { WebhookEventStatus, Prisma, PaymentTransactionStatus } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { cashfreeProvider } from '../payments/cashfree.provider.js';
import { paymentsService } from '../payments/payments.service.js';

export class WebhooksService {
  /**
   * Processes an incoming Cashfree Webhook with cryptographic signature verification.
   * Enforces strict idempotency, safe event recording, and sandbox status synchronization.
   */
  async processCashfreeWebhook(input: {
    rawBody: string;
    signature?: string;
    timestamp?: string;
    payload: Record<string, unknown>;
  }) {
    const { rawBody, signature, timestamp, payload } = input;

    // 1. Signature Verification
    if (!signature || !timestamp) {
      logger.warn('[CASHFREE WEBHOOK] Missing signature or timestamp header.');
      throw {
        statusCode: 401,
        code: 'MISSING_WEBHOOK_SIGNATURE',
        message: 'Cashfree webhook requires "x-webhook-signature" and "x-webhook-timestamp" headers.',
      };
    }

    const isValidSignature = await cashfreeProvider.verifyWebhookSignature(rawBody, signature, timestamp);
    if (!isValidSignature) {
      logger.warn('[CASHFREE WEBHOOK] Invalid HMAC signature detected.');
      throw {
        statusCode: 401,
        code: 'INVALID_WEBHOOK_SIGNATURE',
        message: 'Cashfree webhook signature verification failed.',
      };
    }

    // 2. Parse Cashfree Webhook Structure
    const eventType = (payload.type as string) || 'UNKNOWN_EVENT';
    const data = (payload.data as Record<string, unknown>) || {};
    const orderData = (data.order as Record<string, unknown>) || {};
    const paymentData = (data.payment as Record<string, unknown>) || {};

    const orderId = (orderData.order_id as string) || (data.order_id as string) || '';
    const paymentId = (paymentData.cf_payment_id as string) || (data.cf_payment_id as string) || '';
    const paymentStatus = (paymentData.payment_status as string) || (data.payment_status as string) || '';

    // Generate deterministic event ID for Cashfree idempotency
    const eventId = paymentId
      ? `cf_pay_${paymentId}`
      : `${orderId}_${eventType}_${(payload.event_time as string) || timestamp}`;

    // 3. Idempotency Check
    const existing = await prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: 'CASHFREE',
          eventId,
        },
      },
    });

    if (existing) {
      logger.info(`[CASHFREE WEBHOOK DUPLICATE] Event ${eventId} already processed.`);
      return {
        event: existing,
        duplicate: true,
      };
    }

    // 4. Update PaymentTransaction State
    let transactionStatus: PaymentTransactionStatus | null = null;
    let failureReason: string | null = null;

    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' || paymentStatus === 'SUCCESS') {
      transactionStatus = PaymentTransactionStatus.SUCCEEDED;
    } else if (eventType === 'PAYMENT_FAILED_WEBHOOK' || paymentStatus === 'FAILED') {
      transactionStatus = PaymentTransactionStatus.FAILED;
      failureReason = (paymentData.payment_message as string) || 'Payment failed on Cashfree';
    } else if (eventType === 'PAYMENT_USER_DROPPED_WEBHOOK') {
      transactionStatus = PaymentTransactionStatus.CANCELLED;
      failureReason = 'Customer dropped off before payment completion';
    }

    if (orderId && transactionStatus) {
      const tx = await prisma.paymentTransaction.findFirst({
        where: {
          OR: [{ providerOrderId: orderId }, { transactionReference: orderId }],
        },
      });

      if (tx) {
        // Amount and Currency reconciliation check
        const webhookAmount = Number(orderData.order_amount || paymentData.payment_amount);
        const txAmount = Number(tx.amountMinor) / 100;
        const webhookCurrency = (orderData.order_currency || paymentData.payment_currency) as string;

        if (webhookAmount && Math.abs(webhookAmount - txAmount) > 0.01) {
          logger.error(
            `[CASHFREE WEBHOOK RECONCILIATION ERROR] Amount mismatch: Webhook has ${webhookAmount}, transaction has ${txAmount}. State update blocked.`,
          );
          transactionStatus = null;
        }

        if (webhookCurrency && webhookCurrency !== tx.currency) {
          logger.error(
            `[CASHFREE WEBHOOK RECONCILIATION ERROR] Currency mismatch: Webhook has ${webhookCurrency}, transaction has ${tx.currency}. State update blocked.`,
          );
          transactionStatus = null;
        }

        // Delayed webhook protection: Never downgrade an already SUCCEEDED transaction
        if (tx.status === PaymentTransactionStatus.SUCCEEDED && transactionStatus !== PaymentTransactionStatus.SUCCEEDED) {
          logger.warn(
            `[CASHFREE WEBHOOK IGNORED] Cannot downgrade already verified SUCCEEDED status for transaction ${tx.transactionReference} to ${transactionStatus}.`,
          );
        } else if (transactionStatus) {
          await prisma.paymentTransaction.update({
            where: { id: tx.id },
            data: {
              status: transactionStatus,
              providerTransactionId: paymentId || tx.providerTransactionId,
              failureReason: failureReason || tx.failureReason,
            },
          });
          logger.info(
            `[CASHFREE WEBHOOK] Synchronized transaction ${tx.transactionReference} to status ${transactionStatus} (Sandbox Only - Zero Custody Movement).`,
          );

          if (transactionStatus === PaymentTransactionStatus.SUCCEEDED) {
            try {
              await paymentsService.processConfirmedFunding({
                orderId,
                providerTransactionId: paymentId || tx.providerTransactionId || undefined,
              });
            } catch (fundingErr) {
              logger.warn('[CASHFREE WEBHOOK] processConfirmedFunding note:', fundingErr);
            }
          }
        }
      }
    }

    // 5. Persist Webhook Event in Audit Log
    const recorded = await prisma.webhookEvent.create({
      data: {
        provider: 'CASHFREE',
        eventId,
        eventType,
        status: WebhookEventStatus.PROCESSED,
        payload: payload as Prisma.InputJsonValue,
        signature,
        processedAt: new Date(),
      },
    });

    logger.info(`[CASHFREE WEBHOOK AUDITED] Event ${eventType} (${eventId}) processed successfully.`);
    return {
      event: recorded,
      duplicate: false,
    };
  }

  /**
   * Ingests and audits an incoming generic webhook event.
   * Enforces strict idempotency on [provider, eventId].
   * Unverified events are flagged and rejected from triggering financial changes.
   */
  async ingestWebhookEvent(input: {
    provider: string;
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
    signature?: string;
  }) {
    const existing = await prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: input.provider,
          eventId: input.eventId,
        },
      },
    });

    if (existing) {
      logger.warn(`[WEBHOOK DUPLICATE] Provider: ${input.provider}, EventId: ${input.eventId} already recorded.`);
      return {
        event: existing,
        duplicate: true,
      };
    }

    // Since payment provider selection is pending, incoming requests cannot be authenticated
    const recorded = await prisma.webhookEvent.create({
      data: {
        provider: input.provider,
        eventId: input.eventId,
        eventType: input.eventType,
        status: WebhookEventStatus.IGNORED,
        payload: input.payload as Prisma.InputJsonValue,
        signature: input.signature,
        errorMessage: 'Payment provider selection is pending. Live webhook event processing is strictly disabled.',
      },
    });

    logger.info(`[WEBHOOK AUDITED] Provider: ${input.provider}, Event: ${input.eventType} (${input.eventId}) stored with status IGNORED.`);
    return {
      event: recorded,
      duplicate: false,
    };
  }

  /**
   * Lists audited webhook events (Admin & Superadmin).
   */
  async listWebhookEvents(filter: {
    page?: number;
    limit?: number;
    provider?: string;
    status?: WebhookEventStatus;
  }) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WebhookEventWhereInput = {};
    if (filter.provider) where.provider = filter.provider;
    if (filter.status) where.status = filter.status;

    const [total, events] = await Promise.all([
      prisma.webhookEvent.count({ where }),
      prisma.webhookEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const webhooksService = new WebhooksService();

