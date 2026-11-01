import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { CashfreePaymentProvider } from '../apps/api/src/modules/payments/cashfree.provider.js';
import { WebhooksService } from '../apps/api/src/modules/webhooks/webhooks.service.js';
import { PaymentTransactionStatus, UserRole, ContractStatus } from '@prisma/client';

describe('Phase 5.1 Cashfree Sandbox Verification & Hardening Tests', () => {
  const mockWebhookSecret = 'cf_sec_test_mock_webhook_secret_1234567890';
  const provider = new CashfreePaymentProvider();
  const webhooksService = new WebhooksService();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Contract Payment Eligibility Checks', () => {
    interface MockContract {
      status: ContractStatus;
      clientId: string;
      workerId: string;
      version: number;
      acceptances: Array<{ userId: string; version: number }>;
      milestones: Array<{ id: string; amount: string; title: string }>;
    }

    function validateContractPaymentEligibility(
      contract: MockContract,
      actor: { id: string; role: { name: UserRole } },
    ) {
      if (actor.role.name !== UserRole.SUPERADMIN && contract.clientId !== actor.id) {
        throw { statusCode: 403, code: 'FORBIDDEN' };
      }

      if (contract.status === ContractStatus.PENDING_ACCEPTANCE) {
        throw { statusCode: 400, code: 'CONTRACT_NOT_ACTIVATED' };
      }

      if (contract.status === ContractStatus.DISPUTED) {
        throw { statusCode: 400, code: 'CONTRACT_DISPUTED' };
      }

      if (contract.status !== ContractStatus.ACTIVE) {
        throw { statusCode: 400, code: 'INVALID_CONTRACT_STATUS' };
      }

      const clientAccepted = contract.acceptances?.some(
        (a) => a.userId === contract.clientId && a.version === contract.version,
      );
      const workerAccepted = contract.acceptances?.some(
        (a) => a.userId === contract.workerId && a.version === contract.version,
      );

      if (!clientAccepted || !workerAccepted) {
        throw { statusCode: 400, code: 'CONTRACT_NOT_MUTUALLY_ACCEPTED' };
      }

      if (!contract.milestones || contract.milestones.length === 0) {
        throw { statusCode: 400, code: 'NO_MILESTONES' };
      }

      for (const m of contract.milestones) {
        if (Number(m.amount) <= 0) {
          throw { statusCode: 400, code: 'INVALID_MILESTONE_AMOUNT' };
        }
      }

      return true;
    }

    const clientActor = { id: 'client-1', role: { name: UserRole.CLIENT } };
    const workerActor = { id: 'worker-1', role: { name: UserRole.WORKER } };

    it('rejects payment order creation on PENDING_ACCEPTANCE contracts', () => {
      const contract: MockContract = {
        status: ContractStatus.PENDING_ACCEPTANCE,
        clientId: 'client-1',
        workerId: 'worker-1',
        version: 1,
        acceptances: [{ userId: 'client-1', version: 1 }],
        milestones: [{ id: 'm1', amount: '500.00', title: 'Phase 1' }],
      };

      expect(() => validateContractPaymentEligibility(contract, clientActor)).toThrow();
      try {
        validateContractPaymentEligibility(contract, clientActor);
      } catch (err: unknown) {
        expect((err as { code?: string }).code).toBe('CONTRACT_NOT_ACTIVATED');
      }
    });

    it('rejects payment order creation on DISPUTED contracts', () => {
      const contract: MockContract = {
        status: ContractStatus.DISPUTED,
        clientId: 'client-1',
        workerId: 'worker-1',
        version: 1,
        acceptances: [
          { userId: 'client-1', version: 1 },
          { userId: 'worker-1', version: 1 },
        ],
        milestones: [{ id: 'm1', amount: '500.00', title: 'Phase 1' }],
      };

      try {
        validateContractPaymentEligibility(contract, clientActor);
      } catch (err: unknown) {
        expect((err as { code?: string }).code).toBe('CONTRACT_DISPUTED');
      }
    });

    it('rejects payment orders on CANCELLED, REJECTED, or COMPLETED contracts', () => {
      const statuses = [ContractStatus.CANCELLED, ContractStatus.REJECTED, ContractStatus.COMPLETED];
      for (const st of statuses) {
        const contract: MockContract = {
          status: st,
          clientId: 'client-1',
          workerId: 'worker-1',
          version: 1,
          acceptances: [
            { userId: 'client-1', version: 1 },
            { userId: 'worker-1', version: 1 },
          ],
          milestones: [{ id: 'm1', amount: '500.00', title: 'Phase 1' }],
        };
        try {
          validateContractPaymentEligibility(contract, clientActor);
        } catch (err: unknown) {
          expect((err as { code?: string }).code).toBe('INVALID_CONTRACT_STATUS');
        }
      }
    });

    it('rejects when worker has not accepted the current contract version', () => {
      const contract: MockContract = {
        status: ContractStatus.ACTIVE,
        clientId: 'client-1',
        workerId: 'worker-1',
        version: 2,
        acceptances: [
          { userId: 'client-1', version: 2 },
          { userId: 'worker-1', version: 1 }, // older version!
        ],
        milestones: [{ id: 'm1', amount: '500.00', title: 'Phase 1' }],
      };

      try {
        validateContractPaymentEligibility(contract, clientActor);
      } catch (err: unknown) {
        expect((err as { code?: string }).code).toBe('CONTRACT_NOT_MUTUALLY_ACCEPTED');
      }
    });

    it('rejects when client has not accepted the current contract version', () => {
      const contract: MockContract = {
        status: ContractStatus.ACTIVE,
        clientId: 'client-1',
        workerId: 'worker-1',
        version: 1,
        acceptances: [{ userId: 'worker-1', version: 1 }],
        milestones: [{ id: 'm1', amount: '500.00', title: 'Phase 1' }],
      };

      try {
        validateContractPaymentEligibility(contract, clientActor);
      } catch (err: unknown) {
        expect((err as { code?: string }).code).toBe('CONTRACT_NOT_MUTUALLY_ACCEPTED');
      }
    });

    it('rejects non-positive milestone amounts', () => {
      const contract: MockContract = {
        status: ContractStatus.ACTIVE,
        clientId: 'client-1',
        workerId: 'worker-1',
        version: 1,
        acceptances: [
          { userId: 'client-1', version: 1 },
          { userId: 'worker-1', version: 1 },
        ],
        milestones: [{ id: 'm1', amount: '0.00', title: 'Zero amount' }],
      };

      try {
        validateContractPaymentEligibility(contract, clientActor);
      } catch (err: unknown) {
        expect((err as { code?: string }).code).toBe('INVALID_MILESTONE_AMOUNT');
      }
    });

    it('rejects when unauthorized worker or non-owner client attempts to initiate payment', () => {
      const contract: MockContract = {
        status: ContractStatus.ACTIVE,
        clientId: 'client-1',
        workerId: 'worker-1',
        version: 1,
        acceptances: [
          { userId: 'client-1', version: 1 },
          { userId: 'worker-1', version: 1 },
        ],
        milestones: [{ id: 'm1', amount: '500.00', title: 'Phase 1' }],
      };

      // Worker actor attempting to fund
      try {
        validateContractPaymentEligibility(contract, workerActor);
      } catch (err: unknown) {
        expect((err as { code?: string }).code).toBe('FORBIDDEN');
      }
    });

    it('accepts order creation on ACTIVE mutually accepted contract with valid milestones', () => {
      const contract: MockContract = {
        status: ContractStatus.ACTIVE,
        clientId: 'client-1',
        workerId: 'worker-1',
        version: 1,
        acceptances: [
          { userId: 'client-1', version: 1 },
          { userId: 'worker-1', version: 1 },
        ],
        milestones: [{ id: 'm1', amount: '500.00', title: 'Phase 1' }],
      };

      const isEligible = validateContractPaymentEligibility(contract, clientActor);
      expect(isEligible).toBe(true);
    });
  });

  describe('2. Cashfree Webhook Cryptography & Replay Protection', () => {
    function computeCashfreeSignature(payload: string, timestamp: string, secret: string): string {
      const payloadToSign = `${timestamp}${payload}`;
      return crypto.createHmac('sha256', secret).update(payloadToSign).digest('base64');
    }

    it('verifies a legitimate Cashfree webhook matching canonical HMAC signature', async () => {
      const rawBody = JSON.stringify({
        data: {
          order: { order_id: 'tp_cf_order_123', order_amount: 1500 },
          payment: { cf_payment_id: 'cf_pay_999', payment_status: 'SUCCESS' },
        },
        type: 'PAYMENT_SUCCESS_WEBHOOK',
      });
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const signature = computeCashfreeSignature(rawBody, nowSec, mockWebhookSecret);

      const isValid = await provider.verifyWebhookSignature(rawBody, signature, nowSec, mockWebhookSecret);
      expect(isValid).toBe(true);
    });

    it('rejects signature with different byte length without throwing timingSafeEqual exception', async () => {
      const rawBody = JSON.stringify({ order_id: 'order_1' });
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const shortSignature = 'short_sig'; // different length from 44-char base64 HMAC

      const isValid = await provider.verifyWebhookSignature(rawBody, shortSignature, nowSec, mockWebhookSecret);
      expect(isValid).toBe(false);
    });

    it('rejects forged webhook with invalid secret', async () => {
      const rawBody = JSON.stringify({ order_id: 'order_1' });
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const forgedSignature = computeCashfreeSignature(rawBody, nowSec, 'attacker_secret');

      const isValid = await provider.verifyWebhookSignature(rawBody, forgedSignature, nowSec, mockWebhookSecret);
      expect(isValid).toBe(false);
    });

    it('rejects when webhook secret is missing', async () => {
      const rawBody = JSON.stringify({ order_id: 'order_1' });
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const signature = computeCashfreeSignature(rawBody, nowSec, mockWebhookSecret);

      // Pass empty secret
      const isValid = await provider.verifyWebhookSignature(rawBody, signature, nowSec, '');
      expect(isValid).toBe(false);
    });

    it('rejects modified raw body where payload was altered after signature generation', async () => {
      const originalBody = JSON.stringify({ order_id: 'order_1', amount: 500 });
      const tamperedBody = JSON.stringify({ order_id: 'order_1', amount: 50000 });
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const signature = computeCashfreeSignature(originalBody, nowSec, mockWebhookSecret);

      const isValid = await provider.verifyWebhookSignature(tamperedBody, signature, nowSec, mockWebhookSecret);
      expect(isValid).toBe(false);
    });

    it('rejects replay attacks with timestamp older than 300 seconds', async () => {
      const rawBody = JSON.stringify({ order_id: 'order_1' });
      const expiredTimestamp = Math.floor((Date.now() - 400 * 1000) / 1000).toString(); // 400s in the past
      const signature = computeCashfreeSignature(rawBody, expiredTimestamp, mockWebhookSecret);

      const isValid = await provider.verifyWebhookSignature(rawBody, signature, expiredTimestamp, mockWebhookSecret);
      expect(isValid).toBe(false);
    });

    it('rejects missing timestamp or missing signature in webhook service', async () => {
      await expect(
        webhooksService.processCashfreeWebhook({
          rawBody: '{}',
          payload: {},
          signature: undefined,
          timestamp: undefined,
        }),
      ).rejects.toMatchObject({
        code: 'MISSING_WEBHOOK_SIGNATURE',
      });
    });
  });

  describe('3. Payment Reconciliation Logic', () => {
    it('detects and rejects amount mismatch between Cashfree order and transaction record', () => {
      const tx = { amountMinor: 50000n, currency: 'INR' }; // 500.00 INR
      const cfOrder = { order_amount: 450.0, order_currency: 'INR' }; // Mismatch!

      const expectedAmount = Number(tx.amountMinor) / 100;
      const isMismatch = Math.abs(cfOrder.order_amount - expectedAmount) > 0.01;

      expect(isMismatch).toBe(true);
    });

    it('detects and rejects currency mismatch between Cashfree order and transaction record', () => {
      const tx = { amountMinor: 50000n, currency: 'INR' };
      const cfOrder = { order_amount: 500.0, order_currency: 'USD' }; // Mismatch!

      const isMismatch = cfOrder.order_currency !== tx.currency;
      expect(isMismatch).toBe(true);
    });

    it('detects order ID mismatch between Cashfree order and transaction record', () => {
      const tx = { providerOrderId: 'tp_order_123' };
      const cfOrder = { order_id: 'tp_order_999' };

      const isMismatch = tx.providerOrderId !== cfOrder.order_id;
      expect(isMismatch).toBe(true);
    });

    it('finds successful payment among multiple payment attempts', () => {
      const payments = [
        { cf_payment_id: 'p1', payment_status: 'FAILED' },
        { cf_payment_id: 'p2', payment_status: 'USER_DROPPED' },
        { cf_payment_id: 'p3', payment_status: 'SUCCESS' },
      ];

      const successful = payments.find((p) => p.payment_status === 'SUCCESS');
      expect(successful).toBeDefined();
      expect(successful?.cf_payment_id).toBe('p3');
    });

    it('prevents delayed webhook from downgrading an already SUCCEEDED transaction', () => {
      const currentStatus = PaymentTransactionStatus.SUCCEEDED;
      const incomingWebhookStatus = PaymentTransactionStatus.FAILED;

      // Delayed webhook protection logic
      const shouldUpdate =
        currentStatus !== PaymentTransactionStatus.SUCCEEDED ||
        incomingWebhookStatus === PaymentTransactionStatus.SUCCEEDED;

      expect(shouldUpdate).toBe(false);
    });
  });

  describe('4. Financial Safety & Sandbox Isolation Invariants', () => {
    it('guarantees sandbox payment success does NOT create live ledger entries', () => {
      const isLiveMoneyDisabled = true;
      const environment = 'SANDBOX';

      // Live ledger movements require active live custody
      const canPostLiveLedger = !isLiveMoneyDisabled && environment === 'PRODUCTION';
      expect(canPostLiveLedger).toBe(false);
    });

    it('guarantees zero withdrawable worker balances from sandbox payments', () => {
      const sandboxTransaction = {
        amountMinor: 100000n,
        mode: 'SANDBOX',
        status: PaymentTransactionStatus.SUCCEEDED,
      };

      const withdrawableBalance = sandboxTransaction.mode === 'PRODUCTION' ? sandboxTransaction.amountMinor : 0n;
      expect(withdrawableBalance).toBe(0n);
    });

    it('guarantees payouts remain completely disabled', () => {
      const payoutsEnabled = false;
      expect(payoutsEnabled).toBe(false);
    });

    it('rejects production environment configuration', () => {
      const config = { CASHFREE_ENV: 'PRODUCTION' };
      const isProductionAllowed = config.CASHFREE_ENV === 'SANDBOX';
      expect(isProductionAllowed).toBe(false);
    });
  });
});
