import crypto from 'crypto';
import { env } from '../../config/env.config.js';
import { logger } from '../../utils/logger.js';
import {
  IPaymentProvider,
  PaymentIntentInput,
  PaymentIntentResult,
} from './provider.interface.js';

export interface CashfreeCreateOrderInput {
  orderId: string;
  orderAmount: number;
  orderCurrency: string;
  customerId: string;
  customerName?: string;
  customerEmail: string;
  customerPhone?: string;
  orderNote?: string;
  returnUrl?: string;
  notifyUrl?: string;
}

export interface CashfreeOrderResult {
  orderId: string;
  cfOrderId: string;
  paymentSessionId: string;
  orderStatus: string;
  orderAmount: number;
  orderCurrency: string;
}

export interface CashfreeOrderDetails {
  cf_order_id: string;
  order_id: string;
  entity: string;
  order_currency: string;
  order_amount: number;
  order_status: 'ACTIVE' | 'PAID' | 'EXPIRED' | 'TERMINATED' | 'TERMINATION_REQUESTED';
  payment_session_id?: string;
  order_expiry_time?: string;
}

export interface CashfreePaymentItem {
  cf_payment_id: string;
  payment_status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'USER_DROPPED' | 'CANCELLED';
  payment_amount: number;
  payment_currency: string;
  payment_time: string;
  payment_method?: Record<string, unknown>;
  payment_message?: string;
}

/**
 * Official Cashfree Payment Gateway Adapter (SANDBOX / TEST ONLY)
 * Strictly enforces sandbox API endpoints and live custody locks.
 */
export class CashfreePaymentProvider implements IPaymentProvider {
  readonly name = 'CASHFREE';
  private readonly sandboxBaseUrl = 'https://sandbox.cashfree.com/pg';

  constructor() {
    this.assertSafetyGuards();
  }

  /**
   * Asserts that live money movement, production endpoints, or live custody are completely blocked.
   */
  private assertSafetyGuards(): void {
    if (env.CASHFREE_ENV !== 'SANDBOX') {
      throw new Error(
        'CRITICAL FINANCIAL SAFETY VIOLATION: Cashfree provider must be configured with CASHFREE_ENV=SANDBOX. Production mode is strictly prohibited in Phase 5.',
      );
    }
    if (env.PAYMENTS_LIVE_ENABLED || env.ESCROW_LIVE_MOVEMENT_ENABLED || env.PAYOUTS_ENABLED) {
      throw new Error(
        'CRITICAL FINANCIAL SAFETY VIOLATION: Live money custody or payouts are enabled in environment variables. Phase 5 requires live money execution to remain disabled.',
      );
    }
  }

  /**
   * Returns true only when legitimate credentials are configured in the environment.
   */
  isAvailable(): boolean {
    return Boolean(
      env.CASHFREE_CLIENT_ID &&
        env.CASHFREE_CLIENT_SECRET &&
        env.CASHFREE_ENV === 'SANDBOX' &&
        !env.PAYMENTS_LIVE_ENABLED,
    );
  }

  /**
   * Compatibility method matching generic IPaymentProvider interface.
   */
  async createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    if (!this.isAvailable()) {
      throw {
        statusCode: 503,
        code: 'CASHFREE_CREDENTIALS_MISSING',
        message:
          'Cashfree sandbox credentials (CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET) are not configured. Please provide your test API credentials in .env to initiate checkout.',
      };
    }

    const orderAmount = Number(input.amountMinor) / 100;
    const orderResult = await this.createOrder({
      orderId: input.idempotencyKey,
      orderAmount,
      orderCurrency: input.currency || 'INR',
      customerId: input.payerId,
      customerEmail: (input.metadata?.customerEmail as string) || 'client@trustpay.internal',
      customerName: (input.metadata?.customerName as string) || 'TrustPay Client',
      orderNote: `TrustPay Contract #${input.contractId} Milestone Escrow (SANDBOX)`,
    });

    return {
      provider: this.name,
      providerTransactionId: orderResult.cfOrderId,
      status: orderResult.orderStatus,
      requiresAction: true,
      clientSecret: orderResult.paymentSessionId,
    };
  }

  /**
   * Creates an official Cashfree Sandbox Order.
   */
  async createOrder(params: CashfreeCreateOrderInput): Promise<CashfreeOrderResult> {
    this.assertSafetyGuards();

    if (!this.isAvailable()) {
      throw {
        statusCode: 503,
        code: 'CASHFREE_CREDENTIALS_MISSING',
        message:
          'Cashfree sandbox credentials (CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET) are not configured. Please supply test API keys in the environment file.',
      };
    }

    const endpoint = `${this.sandboxBaseUrl}/orders`;
    const payload = {
      order_id: params.orderId,
      order_amount: params.orderAmount,
      order_currency: params.orderCurrency,
      customer_details: {
        customer_id: params.customerId,
        customer_name: params.customerName || 'TrustPay Client',
        customer_email: params.customerEmail,
        customer_phone: params.customerPhone || '9999999999',
      },
      order_meta: {
        return_url: params.returnUrl || env.CASHFREE_RETURN_URL,
        notify_url: params.notifyUrl || env.CASHFREE_WEBHOOK_URL,
      },
      order_note: params.orderNote || 'TrustPay Milestone Escrow (SANDBOX/TEST)',
    };

    logger.info(`[CASHFREE SANDBOX] Creating order ${params.orderId} for amount ${params.orderAmount} ${params.orderCurrency}`);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-client-id': env.CASHFREE_CLIENT_ID,
        'x-client-secret': env.CASHFREE_CLIENT_SECRET,
        'x-api-version': env.CASHFREE_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const errorMsg = (data.message as string) || (data.error as string) || 'Failed to create Cashfree sandbox order';
      logger.error(`[CASHFREE ERROR] HTTP ${res.status}: ${errorMsg}`);
      throw {
        statusCode: res.status,
        code: 'CASHFREE_ORDER_CREATION_FAILED',
        message: errorMsg,
        details: data,
      };
    }

    return {
      orderId: (data.order_id as string) || params.orderId,
      cfOrderId: (data.cf_order_id as string) || '',
      paymentSessionId: (data.payment_session_id as string) || '',
      orderStatus: (data.order_status as string) || 'ACTIVE',
      orderAmount: Number(data.order_amount) || params.orderAmount,
      orderCurrency: (data.order_currency as string) || params.orderCurrency,
    };
  }

  /**
   * Retrieves order status from Cashfree Sandbox.
   */
  async getOrder(orderId: string): Promise<CashfreeOrderDetails> {
    this.assertSafetyGuards();

    if (!this.isAvailable()) {
      throw {
        statusCode: 503,
        code: 'CASHFREE_CREDENTIALS_MISSING',
        message: 'Cashfree sandbox credentials are not configured.',
      };
    }

    const endpoint = `${this.sandboxBaseUrl}/orders/${encodeURIComponent(orderId)}`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-client-id': env.CASHFREE_CLIENT_ID,
        'x-client-secret': env.CASHFREE_CLIENT_SECRET,
        'x-api-version': env.CASHFREE_API_VERSION,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      throw {
        statusCode: res.status,
        code: 'CASHFREE_ORDER_FETCH_FAILED',
        message: (data.message as string) || `Cashfree order "${orderId}" not found.`,
      };
    }

    return data as unknown as CashfreeOrderDetails;
  }

  /**
   * Retrieves payment attempts for an order from Cashfree Sandbox.
   */
  async getOrderPayments(orderId: string): Promise<CashfreePaymentItem[]> {
    this.assertSafetyGuards();

    if (!this.isAvailable()) {
      throw {
        statusCode: 503,
        code: 'CASHFREE_CREDENTIALS_MISSING',
        message: 'Cashfree sandbox credentials are not configured.',
      };
    }

    const endpoint = `${this.sandboxBaseUrl}/orders/${encodeURIComponent(orderId)}/payments`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-client-id': env.CASHFREE_CLIENT_ID,
        'x-client-secret': env.CASHFREE_CLIENT_SECRET,
        'x-api-version': env.CASHFREE_API_VERSION,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? (data as CashfreePaymentItem[]) : [];
  }

  /**
   * Verifies Cashfree Webhook HMAC Signature with replay protection.
   * Signature algorithm: HMAC-SHA256(timestamp + rawBody, CASHFREE_WEBHOOK_SECRET) as Base64.
   * Rejects timestamps with >300s drift from current server time.
   */
  async verifyWebhookSignature(
    rawBody: string | Buffer,
    signature: string,
    timestamp?: string,
    secretOverride?: string,
  ): Promise<boolean> {
    const secret = secretOverride || env.CASHFREE_WEBHOOK_SECRET || env.CASHFREE_CLIENT_SECRET;
    if (!secret || !signature || !timestamp || !rawBody) {
      return false;
    }

    // Timestamp verification (300-second replay attack protection window)
    const tsNum = Number(timestamp);
    if (isNaN(tsNum)) {
      return false;
    }
    const eventTimeMs = tsNum > 1e11 ? tsNum : tsNum * 1000;
    const diffMs = Math.abs(Date.now() - eventTimeMs);
    if (diffMs > 300 * 1000) {
      logger.warn(
        `[CASHFREE WEBHOOK REPLAY GUARD] Webhook timestamp drift exceeds 300s tolerance (${Math.round(diffMs / 1000)}s)`,
      );
      return false;
    }

    try {
      const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      const payloadToSign = `${timestamp}${bodyStr}`;

      const computedHmac = crypto
        .createHmac('sha256', secret)
        .update(payloadToSign)
        .digest('base64');

      const sigBuffer = Buffer.from(signature, 'utf8');
      const computedBuffer = Buffer.from(computedHmac, 'utf8');

      // Strict length check before timingSafeEqual to avoid node exception on mismatched lengths
      if (sigBuffer.length !== computedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuffer, computedBuffer);
    } catch (err) {
      logger.error('Error verifying Cashfree webhook signature:', err);
      return false;
    }
  }
}

export const cashfreeProvider = new CashfreePaymentProvider();

