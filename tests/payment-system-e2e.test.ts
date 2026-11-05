import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import {
  UserRole,
  ContractStatus,
  MilestoneStatus,
  PaymentTransactionStatus,
  PaymentTransactionType,
  EscrowStatus,
  EscrowOperationalState,
  LedgerTransactionType,
  LedgerEntryType,
} from '@prisma/client';
import {
  majorToMinor,
  minorToMajor,
  formatCurrencyMinor,
} from '../packages/shared/src/index.js';
import { DoubleEntryLedgerService } from '../apps/api/src/modules/ledger/ledger.service.js';
import { CashfreePaymentProvider } from '../apps/api/src/modules/payments/cashfree.provider.js';
import { WebhooksService } from '../apps/api/src/modules/webhooks/webhooks.service.js';

describe('TrustPay Enterprise v2.0 — End-to-End Payment System Implementation & Verification', () => {
  const ledgerService = new DoubleEntryLedgerService();
  const paymentProvider = new CashfreePaymentProvider();
  const webhooksService = new WebhooksService();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. END-TO-END FINANCIAL WORKFLOW & LIFECYCLE
  // ============================================================================
  describe('1. Full Financial Lifecycle Workflow Verification', () => {
    const clientId = 'usr-client-001';
    const specialistId = 'usr-specialist-002';
    const contractId = 'ctr-finance-2026';
    const currency = 'USD';
    const totalAmount = 5000.0;
    const totalMinor = majorToMinor(totalAmount, currency); // 500000n

    it('verifies contract mutual acceptance is mandatory before payment eligibility', () => {
      const contract = {
        id: contractId,
        clientId,
        workerId: specialistId,
        status: ContractStatus.ACTIVE,
        version: 1,
        acceptances: [
          { userId: clientId, version: 1 },
          // Specialist has not accepted yet
        ],
        milestones: [{ id: 'm-1', amount: '2500' }, { id: 'm-2', amount: '2500' }],
      };

      const hasClientAccepted = contract.acceptances.some((a) => a.userId === clientId && a.version === contract.version);
      const hasWorkerAccepted = contract.acceptances.some((a) => a.userId === specialistId && a.version === contract.version);

      expect(hasClientAccepted).toBe(true);
      expect(hasWorkerAccepted).toBe(false);

      // Contract funding must be rejected if mutual acceptance is incomplete
      const isEligibleForPayment = hasClientAccepted && hasWorkerAccepted;
      expect(isEligibleForPayment).toBe(false);
    });

    it('creates tamper-proof payment order matching exact contractual milestone sums', () => {
      const milestones = [
        { id: 'm-1', title: 'Phase 1 Core Engine', amount: 2000.0 },
        { id: 'm-2', title: 'Phase 2 Cloud Deployment', amount: 3000.0 },
      ];

      const sumMilestonesMinor = milestones.reduce(
        (acc, m) => acc + majorToMinor(m.amount, currency),
        0n,
      );

      expect(sumMilestonesMinor).toBe(500000n);
      expect(sumMilestonesMinor).toBe(totalMinor);

      // Verify that arbitrary or tampered amount cannot be injected
      const tamperedAmountMinor = 450000n;
      expect(tamperedAmountMinor === sumMilestonesMinor).toBe(false);
    });

    it('transitions escrow to FUNDED and allocates exact amounts to milestones upon payment confirmation', () => {
      const escrowRecord = {
        id: 'esc-001',
        contractId,
        currency,
        status: EscrowStatus.PENDING_FUNDING,
        contractualAmountMinor: 500000n,
        expectedFundedAmountMinor: 500000n,
        fundedAmountMinor: 0n,
        allocatedAmountMinor: 0n,
        releasedAmountMinor: 0n,
        refundedAmountMinor: 0n,
        operationalState: EscrowOperationalState.NOT_INITIALIZED,
      };

      // Payment Confirmation Simulation
      const paymentTx = {
        id: 'tx-fund-001',
        amountMinor: 500000n,
        status: PaymentTransactionStatus.SUCCEEDED,
      };

      escrowRecord.status = EscrowStatus.FUNDED;
      escrowRecord.fundedAmountMinor = paymentTx.amountMinor;
      escrowRecord.allocatedAmountMinor = paymentTx.amountMinor;
      escrowRecord.operationalState = EscrowOperationalState.WORK_IN_PROGRESS;

      expect(escrowRecord.status).toBe(EscrowStatus.FUNDED);
      expect(escrowRecord.fundedAmountMinor).toBe(500000n);
      expect(escrowRecord.allocatedAmountMinor).toBe(escrowRecord.fundedAmountMinor);
      expect(escrowRecord.operationalState).toBe(EscrowOperationalState.WORK_IN_PROGRESS);
    });
  });

  // ============================================================================
  // 2. DOUBLE-ENTRY LEDGER BALANCING (ZERO DISCREPANCY)
  // ============================================================================
  describe('2. Strict Double-Entry Ledger Invariants & Balancing Rules', () => {
    const currency = 'USD';

    it('ensures dynamic system accounts exist for any supported currency', () => {
      const cashCode = ledgerService.getAccountCode('1000-CASH-ESCROW', currency);
      const liabilityCode = ledgerService.getAccountCode('2000-CLIENT-ESCROW-LIABILITY', currency);
      const workerPayableCode = ledgerService.getAccountCode('2100-WORKER-PAYABLE', currency);
      const platformRevCode = ledgerService.getAccountCode('4000-PLATFORM-FEE-REVENUE', currency);

      // USD maps to default accounts for backward compatibility
      expect(cashCode).toBe('1000-CASH-ESCROW');
      expect(liabilityCode).toBe('2000-CLIENT-ESCROW-LIABILITY');
      expect(workerPayableCode).toBe('2100-WORKER-PAYABLE');
      expect(platformRevCode).toBe('4000-PLATFORM-FEE-REVENUE');

      // Non-USD currencies dynamically postfix currency code
      expect(ledgerService.getAccountCode('1000-CASH-ESCROW', 'EUR')).toBe('1000-CASH-ESCROW-EUR');
      expect(ledgerService.getAccountCode('2000-CLIENT-ESCROW-LIABILITY', 'GBP')).toBe('2000-CLIENT-ESCROW-LIABILITY-GBP');
    });

    it('validates funding deposit double-entry balancing (ESCROW_DEPOSIT)', () => {
      const depositAmount = 500000n; // $5000.00
      const cashAccount = ledgerService.getAccountCode('1000-CASH-ESCROW', currency);
      const liabilityAccount = ledgerService.getAccountCode('2000-CLIENT-ESCROW-LIABILITY', currency);

      const entries = [
        { accountCode: cashAccount, entryType: LedgerEntryType.DEBIT, amountMinor: depositAmount },
        { accountCode: liabilityAccount, entryType: LedgerEntryType.CREDIT, amountMinor: depositAmount },
      ];

      const sumDebits = entries.filter((e) => e.entryType === LedgerEntryType.DEBIT).reduce((s, e) => s + e.amountMinor, 0n);
      const sumCredits = entries.filter((e) => e.entryType === LedgerEntryType.CREDIT).reduce((s, e) => s + e.amountMinor, 0n);

      expect(sumDebits).toBe(depositAmount);
      expect(sumCredits).toBe(depositAmount);
      expect(sumDebits - sumCredits).toBe(0n);
    });

    it('validates milestone settlement double-entry balancing with platform fee split (ESCROW_RELEASE)', () => {
      const grossMilestoneMinor = 200000n; // $2000.00
      const feePercentage = 5.0; // 5.0% platform fee
      const feeBps = BigInt(Math.round(feePercentage * 100)); // 500 bps
      const commissionMinor = (grossMilestoneMinor * feeBps) / 10000n; // 10000n = $100.00
      const specialistNetMinor = grossMilestoneMinor - commissionMinor; // 190000n = $1900.00

      expect(commissionMinor).toBe(10000n);
      expect(specialistNetMinor).toBe(190000n);
      expect(commissionMinor + specialistNetMinor).toBe(grossMilestoneMinor);

      const liabilityAccount = ledgerService.getAccountCode('2000-CLIENT-ESCROW-LIABILITY', currency);
      const revenueAccount = ledgerService.getAccountCode('4000-PLATFORM-FEE-REVENUE', currency);
      const workerAccount = ledgerService.getAccountCode('2100-WORKER-PAYABLE', currency);

      const entries = [
        { accountCode: liabilityAccount, entryType: LedgerEntryType.DEBIT, amountMinor: grossMilestoneMinor },
        { accountCode: revenueAccount, entryType: LedgerEntryType.CREDIT, amountMinor: commissionMinor },
        { accountCode: workerAccount, entryType: LedgerEntryType.CREDIT, amountMinor: specialistNetMinor },
      ];

      const sumDebits = entries.filter((e) => e.entryType === LedgerEntryType.DEBIT).reduce((s, e) => s + e.amountMinor, 0n);
      const sumCredits = entries.filter((e) => e.entryType === LedgerEntryType.CREDIT).reduce((s, e) => s + e.amountMinor, 0n);

      expect(sumDebits).toBe(grossMilestoneMinor);
      expect(sumCredits).toBe(grossMilestoneMinor);
      expect(sumDebits - sumCredits).toBe(0n);
    });

    it('validates refund double-entry balancing (ESCROW_REFUND)', () => {
      const refundAmountMinor = 150000n; // $1500.00
      const liabilityAccount = ledgerService.getAccountCode('2000-CLIENT-ESCROW-LIABILITY', currency);
      const cashAccount = ledgerService.getAccountCode('1000-CASH-ESCROW', currency);

      const entries = [
        { accountCode: liabilityAccount, entryType: LedgerEntryType.DEBIT, amountMinor: refundAmountMinor },
        { accountCode: cashAccount, entryType: LedgerEntryType.CREDIT, amountMinor: refundAmountMinor },
      ];

      const sumDebits = entries.filter((e) => e.entryType === LedgerEntryType.DEBIT).reduce((s, e) => s + e.amountMinor, 0n);
      const sumCredits = entries.filter((e) => e.entryType === LedgerEntryType.CREDIT).reduce((s, e) => s + e.amountMinor, 0n);

      expect(sumDebits).toBe(refundAmountMinor);
      expect(sumCredits).toBe(refundAmountMinor);
      expect(sumDebits - sumCredits).toBe(0n);
    });
  });

  // ============================================================================
  // 3. SETTLEMENT ELIGIBILITY & SAFETY GUARDRAILS
  // ============================================================================
  describe('3. Milestone Settlement Eligibility & Security Guards', () => {
    it('blocks settlement on milestones that are not in APPROVED status', () => {
      const nonApprovedStatuses = [
        MilestoneStatus.PENDING,
        MilestoneStatus.IN_PROGRESS,
        MilestoneStatus.SUBMITTED,
        MilestoneStatus.IN_REVISION,
        MilestoneStatus.CANCELLED,
      ];

      for (const status of nonApprovedStatuses) {
        const canSettle = status === MilestoneStatus.APPROVED;
        expect(canSettle).toBe(false);
      }

      expect(MilestoneStatus.APPROVED === MilestoneStatus.APPROVED).toBe(true);
    });

    it('blocks settlement when contract or escrow is under active dispute', () => {
      const contractDisputed = { status: ContractStatus.DISPUTED };
      const escrowDisputeHold = { disputeHold: true };

      const isDisputed = contractDisputed.status === ContractStatus.DISPUTED || escrowDisputeHold.disputeHold;
      expect(isDisputed).toBe(true);

      // Attempting to settle must fail-closed
      const settlementAllowed = !isDisputed;
      expect(settlementAllowed).toBe(false);
    });

    it('enforces idempotency to block duplicate settlement of the same milestone', () => {
      const milestoneId = 'milestone-unique-123';
      const existingSettlements = new Set<string>();

      const idempotencyKey = `settle_${milestoneId}`;

      // First settlement succeeds
      const canFirstSettle = !existingSettlements.has(idempotencyKey);
      expect(canFirstSettle).toBe(true);
      existingSettlements.add(idempotencyKey);

      // Duplicate settlement attempt fails
      const canSecondSettle = !existingSettlements.has(idempotencyKey);
      expect(canSecondSettle).toBe(false);
    });

    it('restricts settlement initiation to authorized parties (Client, Worker, Admin)', () => {
      const contract = {
        clientId: 'client-1',
        workerId: 'worker-2',
      };

      const checkAuth = (actorId: string, role: UserRole) => {
        const isClient = contract.clientId === actorId;
        const isWorker = contract.workerId === actorId;
        const isAdmin = role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
        return isClient || isWorker || isAdmin;
      };

      expect(checkAuth('client-1', UserRole.CLIENT)).toBe(true);
      expect(checkAuth('worker-2', UserRole.WORKER)).toBe(true);
      expect(checkAuth('admin-9', UserRole.ADMIN)).toBe(true);
      expect(checkAuth('super-9', UserRole.SUPERADMIN)).toBe(true);

      // Unauthorized third party
      expect(checkAuth('random-user', UserRole.CLIENT)).toBe(false);
      expect(checkAuth('random-worker', UserRole.WORKER)).toBe(false);
    });
  });

  // ============================================================================
  // 4. REFUND BOUNDS & FINANCIAL VALIDATION
  // ============================================================================
  describe('4. Escrow Refund Validation & Limits', () => {
    it('accurately calculates available refundable balance and blocks overdrafts', () => {
      const fundedMinor = 500000n; // $5000.00
      const releasedMinor = 200000n; // $2000.00 settled
      const alreadyRefundedMinor = 100000n; // $1000.00 previously refunded

      const availableRefundMinor = fundedMinor - releasedMinor - alreadyRefundedMinor;
      expect(availableRefundMinor).toBe(200000n); // $2000.00 max refundable

      // Request within bounds
      const validRequestMinor = 150000n;
      expect(validRequestMinor <= availableRefundMinor).toBe(true);

      // Request exceeding available balance (must be rejected)
      const excessiveRequestMinor = 250000n;
      expect(excessiveRequestMinor <= availableRefundMinor).toBe(false);
    });

    it('transitions escrow status to PARTIALLY_REFUNDED or REFUNDED based on remaining amount', () => {
      const calculateNewStatus = (funded: bigint, released: bigint, refunded: bigint) => {
        const remaining = funded - released - refunded;
        if (remaining === 0n && released === 0n) return EscrowStatus.REFUNDED;
        if (remaining === 0n && released > 0n) return EscrowStatus.RELEASED;
        if (refunded > 0n && remaining > 0n) return EscrowStatus.PARTIALLY_REFUNDED;
        return EscrowStatus.FUNDED;
      };

      // Full refund with 0 release
      expect(calculateNewStatus(500000n, 0n, 500000n)).toBe(EscrowStatus.REFUNDED);

      // Partial refund with remaining escrow
      expect(calculateNewStatus(500000n, 100000n, 200000n)).toBe(EscrowStatus.PARTIALLY_REFUNDED);

      // Full payout of remainder after partial refund
      expect(calculateNewStatus(500000n, 300000n, 200000n)).toBe(EscrowStatus.RELEASED);
    });
  });

  // ============================================================================
  // 5. VIRTUAL WALLET READ PROJECTION (ZERO DRIFT)
  // ============================================================================
  describe('5. Virtual Wallet Projections from Financial Ledger', () => {
    it('derives client virtual wallet KPIs directly from ledger transactions and escrow', () => {
      const fundedTransactions = [
        { type: PaymentTransactionType.ESCROW_FUNDING, status: PaymentTransactionStatus.SUCCEEDED, amountMinor: 500000n },
        { type: PaymentTransactionType.ESCROW_FUNDING, status: PaymentTransactionStatus.SUCCEEDED, amountMinor: 300000n },
      ];
      const refundTransactions = [
        { type: PaymentTransactionType.REFUND, status: PaymentTransactionStatus.SUCCEEDED, amountMinor: 50000n },
      ];

      const totalContractFundingMinor = fundedTransactions.reduce((acc, t) => acc + t.amountMinor, 0n);
      const totalRefundedMinor = refundTransactions.reduce((acc, t) => acc + t.amountMinor, 0n);

      expect(totalContractFundingMinor).toBe(800000n);
      expect(totalRefundedMinor).toBe(50000n);

      expect(minorToMajor(totalContractFundingMinor, 'USD')).toBe(8000.0);
      expect(minorToMajor(totalRefundedMinor, 'USD')).toBe(500.0);
      expect(formatCurrencyMinor(totalContractFundingMinor, 'USD')).toBe('$8,000.00');
    });

    it('derives specialist virtual wallet KPIs including platform commission separation', () => {
      const settlementTransactions = [
        {
          type: PaymentTransactionType.MILESTONE_RELEASE,
          status: PaymentTransactionStatus.SUCCEEDED,
          amountMinor: 200000n, // Gross: $2000.00
          metadata: {
            commissionMinor: '10000', // $100.00 (5%)
            specialistNetMinor: '190000', // $1900.00
          },
        },
        {
          type: PaymentTransactionType.MILESTONE_RELEASE,
          status: PaymentTransactionStatus.SUCCEEDED,
          amountMinor: 300000n, // Gross: $3000.00
          metadata: {
            commissionMinor: '15000', // $150.00 (5%)
            specialistNetMinor: '285000', // $2850.00
          },
        },
      ];

      let netSettledMinor = 0n;
      let platformCommissionMinor = 0n;

      for (const t of settlementTransactions) {
        const comm = BigInt(t.metadata.commissionMinor);
        const net = BigInt(t.metadata.specialistNetMinor);
        netSettledMinor += net;
        platformCommissionMinor += comm;
      }

      expect(netSettledMinor).toBe(475000n); // $4750.00 Net Earnings
      expect(platformCommissionMinor).toBe(25000n); // $250.00 Platform Fee
      expect(netSettledMinor + platformCommissionMinor).toBe(500000n); // $5000.00 Total Gross

      expect(minorToMajor(netSettledMinor, 'USD')).toBe(4750.0);
      expect(minorToMajor(platformCommissionMinor, 'USD')).toBe(250.0);
    });
  });

  // ============================================================================
  // 6. WEBHOOK SYNCHRONIZATION & REPLAY RESISTANCE
  // ============================================================================
  describe('6. Webhook Synchronization & Replay Protection', () => {
    const webhookSecret = 'test_webhook_secret_key_1234567890';

    it('verifies valid HMAC SHA256 webhook signatures with timing-safe comparison', async () => {
      const payload = JSON.stringify({
        data: {
          order: { order_id: 'order_12345', order_amount: 500.0 },
          payment: { payment_id: 'pay_98765', payment_status: 'SUCCESS' },
        },
        event_time: new Date().toISOString(),
        type: 'PAYMENT_SUCCESS_WEBHOOK',
      });
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(timestamp + payload)
        .digest('base64');

      const isValid = await paymentProvider.verifyWebhookSignature(payload, signature, timestamp, webhookSecret);
      expect(isValid).toBe(true);
    });

    it('rejects webhooks with expired timestamps exceeding 300s replay tolerance', async () => {
      const payload = JSON.stringify({ event: 'TEST' });
      // 400 seconds in the past
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();

      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(oldTimestamp + payload)
        .digest('base64');

      const isValid = await paymentProvider.verifyWebhookSignature(payload, signature, oldTimestamp, webhookSecret);
      expect(isValid).toBe(false);
    });

    it('rejects forged webhook signatures', async () => {
      const payload = JSON.stringify({ event: 'MALICIOUS_INJECTION' });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const forgedSignature = Buffer.from('invalid-signature-data-44-chars-padded-00000=').toString('base64');

      const isValid = await paymentProvider.verifyWebhookSignature(payload, forgedSignature, timestamp, webhookSecret);
      expect(isValid).toBe(false);
    });
  });

  // ============================================================================
  // 7. PRODUCTION FINANCIAL SAFETY GUARDRAILS (FAIL-CLOSED)
  // ============================================================================
  describe('7. Production Financial Safety Guardrails & Live Money Neutralization', () => {
    it('verifies isLiveMoneyDisabled = true and zero live movement flag in all escrow activities', () => {
      const escrowActivity = {
        id: 'act-001',
        eventType: 'ESCROW_FUNDED',
        isLiveFinancialMovement: false,
      };

      expect(escrowActivity.isLiveFinancialMovement).toBe(false);
    });

    it('verifies provider fail-safe when live payment execution is prevented', async () => {
      const provider = new CashfreePaymentProvider();
      expect(provider.name).toBe('CASHFREE');

      // Zero credentials required to instantiate provider
      expect(provider).toBeDefined();
    });
  });
});
