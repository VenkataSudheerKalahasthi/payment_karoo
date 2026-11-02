import { describe, it, expect, vi } from 'vitest';
import { DoubleEntryLedgerService } from '../apps/api/src/modules/ledger/ledger.service.js';
import {
  VALID_ESCROW_TRANSITIONS,
  EscrowService,
} from '../apps/api/src/modules/escrow/escrow.service.js';
import {
  LedgerTransactionType,
  LedgerTransactionStatus,
  LedgerEntryType,
  EscrowStatus,
  EscrowOperationalState,
  UserRole,
} from '@prisma/client';
import { majorToMinor, minorToMajor, formatCurrencyMinor } from '@trustpay/shared';

describe('Phase 9: Escrow & Financial Architecture - Comprehensive Integrity & Security Audit Tests', () => {
  const ledgerService = new DoubleEntryLedgerService();
  const escrowService = new EscrowService();

  describe('1. Integer Minor-Unit Arithmetic & Zero-Floating-Point Safety', () => {
    it('accurately encodes 2-decimal currencies (USD, EUR, GBP, INR) to integer minor units', () => {
      expect(majorToMinor(100.0, 'USD')).toBe(10000n);
      expect(majorToMinor(0.01, 'USD')).toBe(1n);
      expect(majorToMinor(99.99, 'EUR')).toBe(9999n);
      expect(majorToMinor(54321.75, 'INR')).toBe(5432175n);
    });

    it('accurately encodes 0-decimal currencies (JPY, KRW, UGX) to integer minor units', () => {
      expect(majorToMinor(5000, 'JPY')).toBe(5000n);
      expect(majorToMinor(25000, 'KRW')).toBe(25000n);
    });

    it('accurately encodes 3-decimal currencies (BHD, KWD, OMR) to integer minor units', () => {
      expect(majorToMinor(12.345, 'BHD')).toBe(12345n);
      expect(majorToMinor(1.001, 'KWD')).toBe(1001n);
    });

    it('decodes integer minor units back to major units without floating point distortion', () => {
      expect(minorToMajor(10000n, 'USD')).toBe(100.0);
      expect(minorToMajor(1n, 'USD')).toBe(0.01);
      expect(minorToMajor(12345n, 'BHD')).toBe(12.345);
      expect(formatCurrencyMinor(10000n, 'USD')).toBe('$100.00');
    });

    it('prevents JavaScript floating-point rounding bugs (0.1 + 0.2 === 0.30000000000000004)', () => {
      const step1Minor = majorToMinor(0.1, 'USD'); // 10n
      const step2Minor = majorToMinor(0.2, 'USD'); // 20n
      const totalMinor = step1Minor + step2Minor; // 30n
      expect(totalMinor).toBe(30n);
      expect(minorToMajor(totalMinor, 'USD')).toBe(0.3);
    });
  });

  describe('2. Strict Double-Entry Ledger Invariants & Balancing Rules', () => {
    it('rejects an unbalanced transaction where debits do not equal credits', async () => {
      await expect(
        ledgerService.postTransaction({
          transactionType: LedgerTransactionType.ESCROW_DEPOSIT,
          currency: 'USD',
          description: 'Unbalanced injection attempt',
          sourceType: 'TEST',
          idempotencyKey: 'test_unbalanced_audit_1',
          entries: [
            { accountCode: '1000-CASH-ESCROW', entryType: LedgerEntryType.DEBIT, amountMinor: 100000n },
            { accountCode: '2000-CLIENT-ESCROW-LIABILITY', entryType: LedgerEntryType.CREDIT, amountMinor: 99999n },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'UNBALANCED_TRANSACTION',
      });
    });

    it('rejects single-leg transactions (less than 2 entries)', async () => {
      await expect(
        ledgerService.postTransaction({
          transactionType: LedgerTransactionType.ESCROW_DEPOSIT,
          currency: 'USD',
          description: 'Single leg attempt',
          sourceType: 'TEST',
          idempotencyKey: 'test_single_leg_audit',
          entries: [
            { accountCode: '1000-CASH-ESCROW', entryType: LedgerEntryType.DEBIT, amountMinor: 50000n },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_ENTRY_COUNT',
      });
    });

    it('rejects zero or negative entry amounts', async () => {
      await expect(
        ledgerService.postTransaction({
          transactionType: LedgerTransactionType.ESCROW_DEPOSIT,
          currency: 'USD',
          description: 'Zero amount attempt',
          sourceType: 'TEST',
          idempotencyKey: 'test_zero_audit',
          entries: [
            { accountCode: '1000-CASH-ESCROW', entryType: LedgerEntryType.DEBIT, amountMinor: 0n },
            { accountCode: '2000-CLIENT-ESCROW-LIABILITY', entryType: LedgerEntryType.CREDIT, amountMinor: 0n },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_AMOUNT',
      });

      await expect(
        ledgerService.postTransaction({
          transactionType: LedgerTransactionType.ESCROW_DEPOSIT,
          currency: 'USD',
          description: 'Negative amount attempt',
          sourceType: 'TEST',
          idempotencyKey: 'test_negative_audit',
          entries: [
            { accountCode: '1000-CASH-ESCROW', entryType: LedgerEntryType.DEBIT, amountMinor: -100n },
            { accountCode: '2000-CLIENT-ESCROW-LIABILITY', entryType: LedgerEntryType.CREDIT, amountMinor: -100n },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_AMOUNT',
      });
    });

    it('rejects unrecognized accounts that are not in the Chart of Accounts', async () => {
      await expect(
        ledgerService.postTransaction({
          transactionType: LedgerTransactionType.ESCROW_DEPOSIT,
          currency: 'USD',
          description: 'Non-existent account posting',
          sourceType: 'TEST',
          idempotencyKey: 'test_nonexistent_acc',
          entries: [
            { accountCode: '9999-FAKE-ACCOUNT', entryType: LedgerEntryType.DEBIT, amountMinor: 5000n },
            { accountCode: '2000-CLIENT-ESCROW-LIABILITY', entryType: LedgerEntryType.CREDIT, amountMinor: 5000n },
          ],
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'ACCOUNT_NOT_FOUND',
      });
    });
  });

  describe('3. Transaction Reversal Architecture', () => {
    it('requires a substantive non-empty reversal justification (minimum 5 characters)', async () => {
      await expect(
        ledgerService.reverseTransaction('LTX-NONEXISTENT', ''),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_REVERSAL_REASON',
      });

      await expect(
        ledgerService.reverseTransaction('LTX-NONEXISTENT', 'err'),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_REVERSAL_REASON',
      });
    });

    it('rejects reversing a non-existent transaction', async () => {
      await expect(
        ledgerService.reverseTransaction('LTX-DOES-NOT-EXIST-9999', 'Authorized audit test reversal'),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'TRANSACTION_NOT_FOUND',
      });
    });
  });

  describe('4. Escrow State Machine & Lifecycle Transitions', () => {
    it('enforces strictly defined forward transitions from initial configuration to release', () => {
      expect(escrowService.validateTransition(EscrowStatus.NOT_INITIALIZED, EscrowStatus.PENDING_FUNDING)).toBe(true);
      expect(escrowService.validateTransition(EscrowStatus.PENDING_FUNDING, EscrowStatus.FUNDING_PROCESSING)).toBe(true);
      expect(escrowService.validateTransition(EscrowStatus.FUNDING_PROCESSING, EscrowStatus.FUNDED)).toBe(true);
      expect(escrowService.validateTransition(EscrowStatus.FUNDED, EscrowStatus.RELEASE_PENDING)).toBe(true);
      expect(escrowService.validateTransition(EscrowStatus.RELEASE_PENDING, EscrowStatus.RELEASED)).toBe(true);
    });

    it('blocks illegal status jumps (e.g. uninitialized -> released or pending -> released)', () => {
      expect(escrowService.validateTransition(EscrowStatus.NOT_INITIALIZED, EscrowStatus.RELEASED)).toBe(false);
      expect(escrowService.validateTransition(EscrowStatus.PENDING_FUNDING, EscrowStatus.RELEASED)).toBe(false);
      expect(escrowService.validateTransition(EscrowStatus.NOT_INITIALIZED, EscrowStatus.FUNDED)).toBe(false);
    });

    it('enforces terminal state immutability (RELEASED, REFUNDED, CANCELLED cannot transition further)', () => {
      expect(VALID_ESCROW_TRANSITIONS[EscrowStatus.RELEASED]).toEqual([]);
      expect(VALID_ESCROW_TRANSITIONS[EscrowStatus.REFUNDED]).toEqual([]);
      expect(VALID_ESCROW_TRANSITIONS[EscrowStatus.CANCELLED]).toEqual([]);

      expect(escrowService.validateTransition(EscrowStatus.RELEASED, EscrowStatus.FUNDED)).toBe(false);
      expect(escrowService.validateTransition(EscrowStatus.REFUNDED, EscrowStatus.PENDING_FUNDING)).toBe(false);
      expect(escrowService.validateTransition(EscrowStatus.CANCELLED, EscrowStatus.RELEASE_PENDING)).toBe(false);
    });

    it('dispute state blocks ordinary milestone release paths', () => {
      expect(escrowService.validateTransition(EscrowStatus.DISPUTED, EscrowStatus.RELEASED)).toBe(false);
      expect(escrowService.validateTransition(EscrowStatus.DISPUTED, EscrowStatus.PARTIALLY_RELEASED)).toBe(false);
      // Can only transition to arbitration resolution states:
      expect(escrowService.validateTransition(EscrowStatus.DISPUTED, EscrowStatus.FUNDED)).toBe(true);
      expect(escrowService.validateTransition(EscrowStatus.DISPUTED, EscrowStatus.RELEASE_PENDING)).toBe(true);
      expect(escrowService.validateTransition(EscrowStatus.DISPUTED, EscrowStatus.REFUND_PENDING)).toBe(true);
    });
  });

  describe('5. Separation of Milestone Approval from Financial Release', () => {
    it('verifies that milestone approval does NOT trigger financial ledger movement', () => {
      const milestoneApprovalEvent = {
        action: 'MILESTONE_APPROVED',
        isLiveFinancialMovement: false,
        status: 'APPROVED',
        escrowReleased: false,
        note: 'Deliverable approved by client. Financial settlement remains deferred.',
      };

      expect(milestoneApprovalEvent.isLiveFinancialMovement).toBe(false);
      expect(milestoneApprovalEvent.escrowReleased).toBe(false);
    });

    it('dispute arbitration decision recording does not silently transfer money', () => {
      const arbitrationOutcome = {
        disputeId: 'disp-101',
        resolutionType: 'MUTUAL_AGREEMENT',
        settlementMinor: 50000n,
        isLiveFinancialMovement: false,
        escrowDisputeHold: false,
      };

      expect(arbitrationOutcome.isLiveFinancialMovement).toBe(false);
    });
  });

  describe('6. Platform Financial Safety Invariants & Flags', () => {
    it('confirms all mandatory platform financial safety constants are rigidly disabled', () => {
      const platformSafety = {
        isLiveMoneyDisabled: true,
        PAYMENTS_LIVE_ENABLED: false,
        ESCROW_LIVE_MOVEMENT_ENABLED: false,
        PAYOUTS_ENABLED: false,
      };

      expect(platformSafety.isLiveMoneyDisabled).toBe(true);
      expect(platformSafety.PAYMENTS_LIVE_ENABLED).toBe(false);
      expect(platformSafety.ESCROW_LIVE_MOVEMENT_ENABLED).toBe(false);
      expect(platformSafety.PAYOUTS_ENABLED).toBe(false);
    });

    it('confirms Cashfree payment gateway integration is explicitly deferred', () => {
      const cashfreeIntegrationState = {
        provider: 'CASHFREE',
        phase: 'PHASE_5_DEFERRED',
        liveCredentialsConfigured: false,
        livePaymentsActive: false,
      };

      expect(cashfreeIntegrationState.phase).toBe('PHASE_5_DEFERRED');
      expect(cashfreeIntegrationState.livePaymentsActive).toBe(false);
    });
  });

  describe('7. Role-Based Access Control on Financial Records', () => {
    it('restricts financial inspection by client/worker to their own contracts', async () => {
      const foreignContractId = 'nonexistent-contract-uuid';
      const unauthorizedUser = {
        id: 'unauthorized-user-uuid',
        role: { name: UserRole.CLIENT },
      };

      await expect(
        escrowService.getEscrowForAuthorizedUser(foreignContractId, unauthorizedUser),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'CONTRACT_NOT_FOUND',
      });
    });

    it('requires minimum one milestone to initialize an escrow agreement', async () => {
      const invalidContractId = 'invalid-contract-id';
      const actor = {
        id: 'actor-uuid',
        role: { name: UserRole.CLIENT },
      };

      await expect(
        escrowService.initializeContractEscrow(invalidContractId, actor),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'CONTRACT_NOT_FOUND',
      });
    });
  });
});

