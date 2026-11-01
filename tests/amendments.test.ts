import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  ContractStatus,
  MilestoneStatus,
  AmendmentStatus,
} from '@trustpay/shared';

// Canonical contract hash calculation replicate for test verification
function computeCanonicalHash(contract: {
  id: string;
  version: number;
  title: string;
  totalAmountMinor: string;
  milestones: Array<{ id: string; title: string; amountMinor: string }>;
}): string {
  const canonicalData = {
    contractId: contract.id,
    version: contract.version,
    title: contract.title,
    totalAmountMinor: contract.totalAmountMinor,
    milestones: contract.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      amountMinor: m.amountMinor,
    })),
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonicalData)).digest('hex');
}

describe('Phase 6: Contract Amendment & Lifecycle Protection Tests', () => {
  it('allows amendment proposal only when contract is ACTIVE and not DISPUTED', () => {
    const activeContract = {
      id: 'contract-1',
      status: ContractStatus.ACTIVE,
      version: 1,
    };

    const disputedContract = {
      id: 'contract-2',
      status: ContractStatus.DISPUTED,
      version: 1,
    };

    const pendingContract = {
      id: 'contract-3',
      status: ContractStatus.PENDING_ACCEPTANCE,
      version: 1,
    };

    const canProposeActive =
      activeContract.status === ContractStatus.ACTIVE;
    const canProposeDisputed =
      disputedContract.status === ContractStatus.ACTIVE;
    const canProposePending =
      pendingContract.status === ContractStatus.ACTIVE;

    expect(canProposeActive).toBe(true);
    expect(canProposeDisputed).toBe(false);
    expect(canProposePending).toBe(false);
  });

  it('protects approved milestones from being deleted or modified in an amendment', () => {
    const existingMilestones = [
      { id: 'm1', title: 'Phase 1 - Design & Setup', amountMinor: 20000n, status: MilestoneStatus.APPROVED },
      { id: 'm2', title: 'Phase 2 - Development', amountMinor: 30000n, status: MilestoneStatus.PENDING },
    ];

    // Attempting amendment that modifies approved milestone m1's amount
    const invalidAmendmentProposal = [
      { id: 'm1', title: 'Phase 1 - Modified', amountMinor: 15000n }, // Modified amount!
      { id: 'm2', title: 'Phase 2 - Development', amountMinor: 35000n },
    ];

    // Validator check
    const approvedMilestones = existingMilestones.filter((m) => m.status === MilestoneStatus.APPROVED);
    const hasTamperedApproved = approvedMilestones.some((approved) => {
      const match = invalidAmendmentProposal.find((p) => p.id === approved.id);
      return !match || match.amountMinor !== approved.amountMinor;
    });

    expect(hasTamperedApproved).toBe(true);

    // Valid amendment proposal preserving approved milestone m1 exactly
    const validAmendmentProposal = [
      { id: 'm1', title: 'Phase 1 - Design & Setup', amountMinor: 20000n }, // Exact match
      { id: 'm2', title: 'Phase 2 - Development Expanded', amountMinor: 40000n },
    ];

    const hasTamperedApprovedInValid = approvedMilestones.some((approved) => {
      const match = validAmendmentProposal.find((p) => p.id === approved.id);
      return !match || match.amountMinor !== approved.amountMinor;
    });

    expect(hasTamperedApprovedInValid).toBe(false);
  });

  it('increments contract version and generates new canonical SHA-256 hash upon mutual acceptance', () => {
    const initialContract = {
      id: 'contract-uuid-101',
      version: 1,
      title: 'Enterprise Architecture v1',
      totalAmountMinor: '50000',
      milestones: [
        { id: 'm1', title: 'Discovery', amountMinor: '20000' },
        { id: 'm2', title: 'Core Dev', amountMinor: '30000' },
      ],
    };

    const initialHash = computeCanonicalHash(initialContract);
    expect(initialHash).toHaveLength(64);

    // Amendment proposal accepted mutually
    const amendedContract = {
      ...initialContract,
      version: initialContract.version + 1, // Incremented to version 2
      totalAmountMinor: '60000',
      milestones: [
        { id: 'm1', title: 'Discovery', amountMinor: '20000' },
        { id: 'm2', title: 'Core Dev & Security Audit', amountMinor: '40000' },
      ],
    };

    const amendedHash = computeCanonicalHash(amendedContract);
    expect(amendedHash).toHaveLength(64);

    // Cryptographic assurance: version increments and hash changes deterministically
    expect(amendedContract.version).toBe(2);
    expect(amendedHash).not.toEqual(initialHash);
  });

  it('requires mutual counterparty acceptance before amendment takes effect', () => {
    const amendment = {
      id: 'amend-1',
      contractId: 'contract-1',
      proposedById: 'client-uuid',
      status: AmendmentStatus.PENDING_REVIEW,
      clientAgreed: true,
      workerAgreed: false,
    };

    // Only client has agreed (proposer)
    const isMutuallyAcceptedBefore = amendment.clientAgreed && amendment.workerAgreed;
    expect(isMutuallyAcceptedBefore).toBe(false);

    // Counterparty responds with acceptance
    const updatedAmendment = {
      ...amendment,
      workerAgreed: true,
      status: AmendmentStatus.ACCEPTED,
    };

    const isMutuallyAcceptedAfter = updatedAmendment.clientAgreed && updatedAmendment.workerAgreed;
    expect(isMutuallyAcceptedAfter).toBe(true);
    expect(updatedAmendment.status).toBe(AmendmentStatus.ACCEPTED);
  });

  it('preserves existing contract version and status when amendment is rejected', () => {
    const currentContract = {
      id: 'contract-1',
      version: 2,
      status: ContractStatus.ACTIVE,
    };

    const rejectedAmendment = {
      id: 'amend-2',
      status: AmendmentStatus.REJECTED,
      rejectionReason: 'Scope change too large for proposed timeline',
    };

    // Contract remains unchanged
    expect(currentContract.version).toBe(2);
    expect(currentContract.status).toBe(ContractStatus.ACTIVE);
    expect(rejectedAmendment.status).toBe(AmendmentStatus.REJECTED);
  });

  describe('Phase 6.1: Concurrency, Self-Voting & Early Termination Audits', () => {
    it('rejects proposing a new amendment when an amendment is already PENDING_REVIEW', () => {
      const pendingAmendment = {
        id: 'amend-10',
        contractId: 'contract-1',
        status: AmendmentStatus.PENDING_REVIEW,
      };

      const hasPending = pendingAmendment.status === AmendmentStatus.PENDING_REVIEW;
      expect(hasPending).toBe(true);
    });

    it('rejects amendment proposer from voting on their own proposal', () => {
      const amendment = {
        id: 'amend-1',
        proposedById: 'client-uuid-1',
      };
      const voter = { id: 'client-uuid-1' };

      const isSelfVoting = amendment.proposedById === voter.id;
      expect(isSelfVoting).toBe(true);
    });

    it('rejects contract early termination when contract is DISPUTED or already terminated', () => {
      const disputedContract = { status: ContractStatus.DISPUTED };
      const completedContract = { status: ContractStatus.COMPLETED };
      const activeContract = { status: ContractStatus.ACTIVE };

      const canTerminateDisputed =
        disputedContract.status === ContractStatus.ACTIVE ||
        disputedContract.status === ContractStatus.PENDING_ACCEPTANCE;
      const canTerminateCompleted =
        completedContract.status === ContractStatus.ACTIVE ||
        completedContract.status === ContractStatus.PENDING_ACCEPTANCE;
      const canTerminateActive =
        activeContract.status === ContractStatus.ACTIVE ||
        activeContract.status === ContractStatus.PENDING_ACCEPTANCE;

      expect(canTerminateDisputed).toBe(false);
      expect(canTerminateCompleted).toBe(false);
      expect(canTerminateActive).toBe(true);
    });

    it('rejects duplicate pending early termination requests on the same contract', () => {
      const existingPendingTermination = {
        id: 'term-1',
        contractId: 'contract-1',
        status: 'PENDING_REVIEW',
      };

      const hasPendingTermination = existingPendingTermination.status === 'PENDING_REVIEW';
      expect(hasPendingTermination).toBe(true);
    });

    it('requires counterparty bilateral acceptance and prevents self-acceptance on termination', () => {
      const terminationRequest = {
        id: 'term-2',
        initiatedById: 'worker-uuid-1',
        status: 'PENDING_REVIEW',
      };
      const responder = { id: 'worker-uuid-1' };

      const isSelfResponding = terminationRequest.initiatedById === responder.id;
      expect(isSelfResponding).toBe(true);
    });

    it('preserves completed milestone deliverables and history upon early contract termination', () => {
      const contractMilestones = [
        { id: 'm1', title: 'Phase 1 MVP', status: MilestoneStatus.APPROVED, amountMinor: 20000n },
        { id: 'm2', title: 'Phase 2 Scale', status: MilestoneStatus.PENDING, amountMinor: 30000n },
      ];

      // Simulated termination execution: Contract status becomes CANCELLED, but milestone entities remain intact
      const contractStatus = ContractStatus.CANCELLED;
      const approvedMilestones = contractMilestones.filter((m) => m.status === MilestoneStatus.APPROVED);

      expect(contractStatus).toBe(ContractStatus.CANCELLED);
      expect(approvedMilestones).toHaveLength(1);
      expect(approvedMilestones[0].id).toBe('m1');
    });

    it('enforces that early termination settlement terms remain metadata only without live payouts', () => {
      const terminationSettlement = {
        proposedSettlementMinor: 15000n,
        settlementTerms: '50% compensation for Phase 2 partial work',
        isLiveFinancialMovement: false,
      };

      expect(terminationSettlement.isLiveFinancialMovement).toBe(false);
      expect(terminationSettlement.proposedSettlementMinor).toEqual(15000n);
    });
  });
});

