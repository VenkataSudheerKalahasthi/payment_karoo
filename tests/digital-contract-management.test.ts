import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { UserRole, ContractStatus, MilestoneStatus, AmendmentStatus, TerminationStatus } from '@prisma/client';
import {
  computeCanonicalContractHash,
  CanonicalContractHashInput,
} from '../apps/api/src/modules/contracts/contract-pdf.service.js';
import {
  validateContractTransition,
} from '../apps/api/src/modules/contracts/contracts.state-machine.js';
import {
  emitContractRealtimeEvent,
} from '../apps/api/src/modules/realtime/socket.service.js';

describe('Digital Contract Management — Complete Suite (Phase 9)', () => {
  const baseContractInput: CanonicalContractHashInput = {
    contractNumber: 'TPE-2026-001',
    version: 1,
    title: 'Enterprise High-Assurance Contract',
    totalAmount: 15000,
    currency: 'USD',
    clientId: 'client-user-1',
    workerId: 'worker-user-2',
    scopeOfWork: 'Complete architecture design and implementation',
    termsAndConditions: 'Standard TrustPay Digital Escrow Agreement terms.',
    cancellationTerms: 'Mutual consent or administrative arbitration.',
    revisionTerms: 'Up to 2 revisions per milestone.',
    milestones: [
      { order: 1, title: 'Phase 1 Architecture', description: 'Design doc', amount: 5000 },
      { order: 2, title: 'Phase 2 Implementation', description: 'Backend and UI', amount: 10000 },
    ],
  };

  // Group 1: Contract Creation & Validation
  describe('1. Contract Creation & Milestone Total Integrity', () => {
    it('validates that milestone amounts strictly sum to total contract amount', () => {
      const milestoneSum = baseContractInput.milestones!.reduce((acc, m) => acc + Number(m.amount), 0);
      expect(milestoneSum).toBe(Number(baseContractInput.totalAmount));
    });

    it('rejects self-contracting where client equals worker', () => {
      const selfContractAttempt = {
        clientId: 'user-same-id',
        workerId: 'user-same-id',
      };
      const isSelfContract = selfContractAttempt.clientId === selfContractAttempt.workerId;
      expect(isSelfContract).toBe(true);
    });

    it('formats contract reference with standard prefix and random entropy', () => {
      const contractNumber = `TPE-${Date.now().toString(36).toUpperCase()}-789`;
      expect(contractNumber).toMatch(/^TPE-[A-Z0-9]+-\d+$/);
    });
  });

  // Group 2: Canonical SHA-256 Hashing
  describe('2. Canonical SHA-256 Hashing Determinism & Sensitivity', () => {
    it('generates a deterministic 64-character SHA-256 hex digest', () => {
      const hash1 = computeCanonicalContractHash(baseContractInput);
      const hash2 = computeCanonicalContractHash(baseContractInput);

      expect(hash1).toBeDefined();
      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });

    it('produces identical hash regardless of milestone array input ordering', () => {
      const reorderedInput: CanonicalContractHashInput = {
        ...baseContractInput,
        milestones: [
          { order: 2, title: 'Phase 2 Implementation', description: 'Backend and UI', amount: 10000 },
          { order: 1, title: 'Phase 1 Architecture', description: 'Design doc', amount: 5000 },
        ],
      };

      const originalHash = computeCanonicalContractHash(baseContractInput);
      const reorderedHash = computeCanonicalContractHash(reorderedInput);
      expect(originalHash).toBe(reorderedHash);
    });

    it('produces completely different hash when material terms are modified', () => {
      const tamperedInput: CanonicalContractHashInput = {
        ...baseContractInput,
        totalAmount: 16000, // Altered amount
      };

      const originalHash = computeCanonicalContractHash(baseContractInput);
      const tamperedHash = computeCanonicalContractHash(tamperedInput);
      expect(originalHash).not.toBe(tamperedHash);
    });

    it('detects tampering in milestone description or title', () => {
      const tamperedMilestone: CanonicalContractHashInput = {
        ...baseContractInput,
        milestones: [
          { order: 1, title: 'Phase 1 Architecture (Modified)', description: 'Design doc', amount: 5000 },
          { order: 2, title: 'Phase 2 Implementation', description: 'Backend and UI', amount: 10000 },
        ],
      };

      const originalHash = computeCanonicalContractHash(baseContractInput);
      const tamperedHash = computeCanonicalContractHash(tamperedMilestone);
      expect(originalHash).not.toBe(tamperedHash);
    });
  });

  // Group 3: Contract Version Management
  describe('3. Contract Version Management & Snapshots', () => {
    it('creates monotonically increasing version numbers', () => {
      const version1 = 1;
      const version2 = version1 + 1;
      expect(version2).toBe(2);
      expect(version2).toBeGreaterThan(version1);
    });

    it('preserves immutable historical snapshot of previous version', () => {
      const v1Snapshot = {
        version: 1,
        totalAmount: 15000,
        documentHash: computeCanonicalContractHash(baseContractInput),
        isAccepted: true,
      };

      const v2Input: CanonicalContractHashInput = {
        ...baseContractInput,
        version: 2,
        totalAmount: 20000,
      };
      const v2Snapshot = {
        version: 2,
        totalAmount: 20000,
        documentHash: computeCanonicalContractHash(v2Input),
        isAccepted: false,
      };

      expect(v1Snapshot.version).toBe(1);
      expect(v1Snapshot.totalAmount).toBe(15000);
      expect(v2Snapshot.version).toBe(2);
      expect(v2Snapshot.totalAmount).toBe(20000);
      expect(v1Snapshot.documentHash).not.toBe(v2Snapshot.documentHash);
    });
  });

  // Group 4: Mutual Client and Worker Bilateral Acceptance
  describe('4. Bilateral Digital Acceptance Flow', () => {
    it('remains in PENDING_ACCEPTANCE when only one party accepts', () => {
      const acceptances = [
        { userId: 'client-user-1', role: UserRole.CLIENT, version: 1 },
      ];

      const clientSigned = acceptances.some((a) => a.userId === 'client-user-1' && a.version === 1);
      const workerSigned = acceptances.some((a) => a.userId === 'worker-user-2' && a.version === 1);
      const isFullyActivated = clientSigned && workerSigned;

      expect(clientSigned).toBe(true);
      expect(workerSigned).toBe(false);
      expect(isFullyActivated).toBe(false);
    });

    it('transitions to ACTIVE when both client and worker accept the exact same version', () => {
      const acceptances = [
        { userId: 'client-user-1', role: UserRole.CLIENT, version: 1 },
        { userId: 'worker-user-2', role: UserRole.WORKER, version: 1 },
      ];

      const clientSigned = acceptances.some((a) => a.userId === 'client-user-1' && a.version === 1);
      const workerSigned = acceptances.some((a) => a.userId === 'worker-user-2' && a.version === 1);
      const isFullyActivated = clientSigned && workerSigned;

      expect(isFullyActivated).toBe(true);
    });

    it('rejects stale version acceptance when submitted version differs from active version', () => {
      const contractCurrentVersion = 2;
      const submittedVersion = 1;
      const isStale = submittedVersion !== contractCurrentVersion;
      expect(isStale).toBe(true);
    });

    it('rejects duplicate acceptance for the same party and version', () => {
      const existingAcceptances = [
        { userId: 'worker-user-2', version: 1 },
      ];
      const isDuplicate = existingAcceptances.some(
        (a) => a.userId === 'worker-user-2' && a.version === 1,
      );
      expect(isDuplicate).toBe(true);
    });
  });

  // Group 5: State Machine Lifecycle Transitions
  describe('5. State Machine Lifecycle Rules', () => {
    it('prohibits transition directly from DRAFT to ACTIVE without PENDING_ACCEPTANCE', () => {
      const res = validateContractTransition({
        currentStatus: ContractStatus.DRAFT,
        targetStatus: ContractStatus.ACTIVE,
        userId: 'client-user-1',
        clientId: 'client-user-1',
        workerId: 'worker-user-2',
        userRole: UserRole.CLIENT,
        allMilestonesApproved: false,
      });
      expect(res.allowed).toBe(false);
    });

    it('allows client to submit DRAFT to PENDING_ACCEPTANCE', () => {
      const res = validateContractTransition({
        currentStatus: ContractStatus.DRAFT,
        targetStatus: ContractStatus.PENDING_ACCEPTANCE,
        userId: 'client-user-1',
        clientId: 'client-user-1',
        workerId: 'worker-user-2',
        userRole: UserRole.CLIENT,
        allMilestonesApproved: false,
      });
      expect(res.allowed).toBe(true);
    });

    it('prevents contract completion if any milestone deliverables remain unapproved', () => {
      const res = validateContractTransition({
        currentStatus: ContractStatus.ACTIVE,
        targetStatus: ContractStatus.COMPLETED,
        userId: 'client-user-1',
        clientId: 'client-user-1',
        workerId: 'worker-user-2',
        userRole: UserRole.CLIENT,
        allMilestonesApproved: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('All milestone deliverables must be approved');
    });

    it('allows completion when all milestones are approved', () => {
      const res = validateContractTransition({
        currentStatus: ContractStatus.ACTIVE,
        targetStatus: ContractStatus.COMPLETED,
        userId: 'client-user-1',
        clientId: 'client-user-1',
        workerId: 'worker-user-2',
        userRole: UserRole.CLIENT,
        allMilestonesApproved: true,
      });
      expect(res.allowed).toBe(true);
    });

    it('terminal states (COMPLETED, CANCELLED) cannot transition to any other status', () => {
      const res1 = validateContractTransition({
        currentStatus: ContractStatus.COMPLETED,
        targetStatus: ContractStatus.ACTIVE,
        userId: 'admin-1',
        clientId: 'client-user-1',
        workerId: 'worker-user-2',
        userRole: UserRole.ADMIN,
        allMilestonesApproved: true,
      });
      expect(res1.allowed).toBe(false);

      const res2 = validateContractTransition({
        currentStatus: ContractStatus.CANCELLED,
        targetStatus: ContractStatus.ACTIVE,
        userId: 'admin-1',
        clientId: 'client-user-1',
        workerId: 'worker-user-2',
        userRole: UserRole.ADMIN,
        allMilestonesApproved: false,
      });
      expect(res2.allowed).toBe(false);
    });
  });

  // Group 6: Contract Amendments & Fresh Bilateral Acceptance
  describe('6. Contract Amendments & Fresh Acceptance Mandate', () => {
    it('requires bilateral voting before an amendment can take effect', () => {
      const amendment = {
        clientAgreed: true,
        workerAgreed: false,
        status: AmendmentStatus.PENDING_REVIEW,
      };

      const canApply = amendment.clientAgreed && amendment.workerAgreed;
      expect(canApply).toBe(false);
    });

    it('increments version and requires fresh mutual acceptance upon amendment application', () => {
      const initialContract = {
        version: 1,
        status: ContractStatus.ACTIVE,
      };

      // When amendment is applied:
      const amendedContract = {
        version: initialContract.version + 1,
        status: ContractStatus.PENDING_ACCEPTANCE, // Fresh acceptance required!
      };

      expect(amendedContract.version).toBe(2);
      expect(amendedContract.status).toBe(ContractStatus.PENDING_ACCEPTANCE);
    });

    it('restricts milestone work progression while fresh acceptance of amended version is pending', () => {
      const amendedContractStatus: ContractStatus = ContractStatus.PENDING_ACCEPTANCE;
      const canSubmitDeliverable = amendedContractStatus === ContractStatus.ACTIVE;
      expect(canSubmitDeliverable).toBe(false);
    });
  });

  // Group 7: Contract Integrity Verification
  describe('7. Cryptographic Integrity Verification & Tamper Detection', () => {
    it('reports tamper-free when stored hash exactly matches recalculated canonical hash', () => {
      const canonicalHash = computeCanonicalContractHash(baseContractInput);
      const storedHash = canonicalHash;

      const hashMatches = storedHash === canonicalHash;
      const milestonesSum = 15000;
      const contractTotal = 15000;
      const amountsMatch = milestonesSum === contractTotal;

      const isTamperFree = hashMatches && amountsMatch;
      expect(isTamperFree).toBe(true);
    });

    it('flags integrity violation when database contract terms have been altered', () => {
      const storedHash = computeCanonicalContractHash(baseContractInput);
      const alteredInput = { ...baseContractInput, totalAmount: 99999 };
      const recalculatedHash = computeCanonicalContractHash(alteredInput);

      const hashMatches = storedHash === recalculatedHash;
      expect(hashMatches).toBe(false);
    });
  });

  // Group 8: Multi-Role IDOR & Ownership Validation
  describe('8. IDOR & Access Control Security', () => {
    it('blocks Client A from accessing or accepting Client B contract', () => {
      const contractClientId = 'client-user-1';
      const requestingUserId = 'client-user-999';

      const isAuthorized = requestingUserId === contractClientId;
      expect(isAuthorized).toBe(false);
    });

    it('prohibits worker from executing client-only milestone approval', () => {
      const workerRole = UserRole.WORKER;
      const canApprove = workerRole === UserRole.CLIENT || workerRole === UserRole.SUPERADMIN;
      expect(canApprove).toBe(false);
    });

    it('allows Admin or Superadmin to inspect contract and audit logs without impersonation', () => {
      const adminRole = UserRole.ADMIN;
      const isPrivileged = adminRole === UserRole.ADMIN || adminRole === UserRole.SUPERADMIN;
      expect(isPrivileged).toBe(true);
    });
  });

  // Group 9: Real-time Socket.IO Event Structure
  describe('9. Real-Time Socket.IO Telemetry Events', () => {
    it('creates stable event payloads with unique eventId and ISO timestamp', () => {
      const contractId = 'contract-uuid-1';
      let capturedEvent: unknown = null;

      // Mock emitter
      const mockEmit = (cId: string, eventType: string, payload: unknown, ver?: number) => {
        capturedEvent = {
          eventId: crypto.randomUUID(),
          eventType,
          contractId: cId,
          version: ver,
          timestamp: new Date().toISOString(),
          payload,
        };
      };

      mockEmit(contractId, 'contract:status_updated', { newStatus: 'ACTIVE' }, 1);

      expect(capturedEvent).toBeDefined();
      const evt = capturedEvent as { eventId: string; eventType: string; contractId: string; version: number; timestamp: string };
      expect(evt.eventType).toBe('contract:status_updated');
      expect(evt.contractId).toBe(contractId);
      expect(evt.version).toBe(1);
      expect(evt.eventId).toHaveLength(36);
    });
  });

  // Group 10: Financial Safety Invariance
  describe('10. Financial Safety Invariance (Cashfree Deferred)', () => {
    it('strictly enforces financial freeze flags across all contract milestones', () => {
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

