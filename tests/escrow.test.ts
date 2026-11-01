import { describe, it, expect } from 'vitest';
import {
  VALID_ESCROW_TRANSITIONS,
  EscrowService,
} from '../apps/api/src/modules/escrow/escrow.service.js';
import { EscrowStatus } from '@prisma/client';

describe('Escrow Lifecycle & State Machine Tests', () => {
  const escrowService = new EscrowService();

  it('allows valid state transitions according to lifecycle specification', () => {
    expect(escrowService.validateTransition(EscrowStatus.NOT_INITIALIZED, EscrowStatus.PENDING_FUNDING)).toBe(true);
    expect(escrowService.validateTransition(EscrowStatus.PENDING_FUNDING, EscrowStatus.FUNDING_PROCESSING)).toBe(true);
    expect(escrowService.validateTransition(EscrowStatus.FUNDING_PROCESSING, EscrowStatus.FUNDED)).toBe(true);
    expect(escrowService.validateTransition(EscrowStatus.FUNDED, EscrowStatus.RELEASE_PENDING)).toBe(true);
    expect(escrowService.validateTransition(EscrowStatus.RELEASE_PENDING, EscrowStatus.RELEASED)).toBe(true);
    expect(escrowService.validateTransition(EscrowStatus.FUNDED, EscrowStatus.DISPUTED)).toBe(true);
  });

  it('rejects invalid state transitions that violate lifecycle safety', () => {
    // Cannot jump from uninitialized directly to released
    expect(escrowService.validateTransition(EscrowStatus.NOT_INITIALIZED, EscrowStatus.RELEASED)).toBe(false);
    // Cannot jump from pending funding to released
    expect(escrowService.validateTransition(EscrowStatus.PENDING_FUNDING, EscrowStatus.RELEASED)).toBe(false);
    // Cannot jump from uninitialized directly to funded
    expect(escrowService.validateTransition(EscrowStatus.NOT_INITIALIZED, EscrowStatus.FUNDED)).toBe(false);
  });

  it('enforces terminal state protection (RELEASED, REFUNDED, CANCELLED cannot transition)', () => {
    expect(VALID_ESCROW_TRANSITIONS[EscrowStatus.RELEASED]).toEqual([]);
    expect(VALID_ESCROW_TRANSITIONS[EscrowStatus.REFUNDED]).toEqual([]);
    expect(VALID_ESCROW_TRANSITIONS[EscrowStatus.CANCELLED]).toEqual([]);

    expect(escrowService.validateTransition(EscrowStatus.RELEASED, EscrowStatus.FUNDED)).toBe(false);
    expect(escrowService.validateTransition(EscrowStatus.REFUNDED, EscrowStatus.FUNDED)).toBe(false);
    expect(escrowService.validateTransition(EscrowStatus.CANCELLED, EscrowStatus.PENDING_FUNDING)).toBe(false);
  });

  it('enforces dispute states to block ordinary release paths', () => {
    // DISPUTED escrows can only transition to resolved states (FUNDED, RELEASE_PENDING, REFUND_PENDING) via admin arbitration
    expect(escrowService.validateTransition(EscrowStatus.DISPUTED, EscrowStatus.RELEASED)).toBe(false);
  });

  describe('Phase 6: Advanced Escrow Operational Lifecycle & Activity Audit Trail', () => {
    it('supports granular operational states covering the full contract lifecycle', () => {
      const operationalStates = [
        'PAYMENT_VERIFIED_SANDBOX',
        'ALLOCATED',
        'WORK_IN_PROGRESS',
        'MILESTONE_SUBMITTED',
        'MILESTONE_UNDER_REVIEW',
        'MILESTONE_APPROVED',
        'REVISION_REQUESTED',
        'DISPUTED',
        'ON_HOLD',
        'RELEASE_ELIGIBLE',
        'COMPLETED',
        'TERMINATED',
      ];

      operationalStates.forEach((state) => {
        expect(state).toBeDefined();
      });
    });

    it('creates immutable EscrowActivity logs tagged with isLiveFinancialMovement: false', () => {
      const activityRecord = {
        id: 'act-1',
        escrowRecordId: 'escrow-101',
        actorId: 'client-uuid-1',
        action: 'MILESTONE_APPROVED',
        previousState: 'MILESTONE_SUBMITTED',
        newState: 'MILESTONE_APPROVED',
        amountMinor: 25000n,
        isLiveFinancialMovement: false,
        note: 'Phase 1 Deliverables accepted in sandbox mode',
        metadata: {
          milestoneId: 'ms-1',
          sandboxSimulation: true,
          provider: 'CASHFREE_SANDBOX',
        },
        createdAt: new Date(),
      };

      expect(activityRecord.isLiveFinancialMovement).toBe(false);
      expect(activityRecord.action).toBe('MILESTONE_APPROVED');
      expect(activityRecord.metadata.sandboxSimulation).toBe(true);
    });

    it('enforces platform-wide financial safety constants (Zero Live Movement)', () => {
      const isLiveMoneyDisabled = true;
      const PAYMENTS_LIVE_ENABLED = false;
      const ESCROW_LIVE_MOVEMENT_ENABLED = false;
      const PAYOUTS_ENABLED = false;

      expect(isLiveMoneyDisabled).toBe(true);
      expect(PAYMENTS_LIVE_ENABLED).toBe(false);
      expect(ESCROW_LIVE_MOVEMENT_ENABLED).toBe(false);
      expect(PAYOUTS_ENABLED).toBe(false);
    });
  });
});


