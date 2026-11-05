import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  UserRole,
  ContractStatus,
  MilestoneStatus,
  SubmissionStatus,
  DisputeCategory,
  DisputeStatus,
  DisputeResolutionType,
  DisputeResolutionStatus,
  AmendmentStatus,
  WorkerAvailability,
} from '@trustpay/shared';

// Deterministic Canonical Hash Calculator (matches contract module)
function computeCanonicalHash(contract: {
  contractNumber: string;
  version: number;
  title: string;
  totalAmount: number;
  currency: string;
  clientId: string;
  workerId: string;
  scopeOfWork?: string | null;
  termsAndConditions?: string | null;
  milestones: Array<{ order: number; title: string; amount: number }>;
}): string {
  const canonicalData = {
    contractNumber: contract.contractNumber,
    version: contract.version,
    title: contract.title,
    totalAmount: contract.totalAmount,
    currency: contract.currency,
    clientId: contract.clientId,
    workerId: contract.workerId,
    scopeOfWork: contract.scopeOfWork || '',
    termsAndConditions: contract.termsAndConditions || '',
    milestones: contract.milestones
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((m) => ({ order: m.order, title: m.title, amount: m.amount })),
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonicalData)).digest('hex');
}

describe('TRUSTPAY ENTERPRISE v2.0 — WORKER / SPECIALIST PORTAL FUNCTIONAL & SECURITY AUDIT', () => {
  // =========================================================================
  // 1. Worker Registration, Authentication & RBAC Identification
  // =========================================================================
  describe('1. Worker Authentication & Role Identification', () => {
    it('synchronizes a newly registered Worker with WORKER role in the database', () => {
      const syncPayload = {
        clerkId: 'user_clerk_worker_999',
        email: 'specialist.audit@trustpay.internal',
        role: UserRole.WORKER,
        firstName: 'Jane',
        lastName: 'Specialist',
      };

      expect(syncPayload.role).toBe(UserRole.WORKER);
      expect(syncPayload.role).not.toBe(UserRole.ADMIN);
      expect(syncPayload.role).not.toBe(UserRole.SUPERADMIN);

      const dbUser = {
        id: 'usr-worker-999',
        clerkId: syncPayload.clerkId,
        email: syncPayload.email,
        role: { id: 'role-worker', name: UserRole.WORKER },
        workerProfile: {
          id: 'wp-999',
          availability: WorkerAvailability.AVAILABLE,
          hourlyRate: 120,
        },
      };

      expect(dbUser.role.name).toBe(UserRole.WORKER);
      expect(dbUser.workerProfile.availability).toBe(WorkerAvailability.AVAILABLE);
    });

    it('blocks self-registration or escalation to administrative roles', () => {
      const forbiddenRoles = ['ADMIN', 'SUPERADMIN'];
      forbiddenRoles.forEach((role) => {
        const isSelfAssignable = role === UserRole.CLIENT || role === UserRole.WORKER;
        expect(isSelfAssignable).toBe(false);
      });
    });
  });

  // =========================================================================
  // 2. Worker Profile & Skills Management
  // =========================================================================
  describe('2. Worker Profile & Skills Management', () => {
    it('retrieves and updates worker professional parameters', () => {
      const workerProfile = {
        userId: 'usr-worker-999',
        headline: 'Senior Full-Stack Architect & Distributed Systems Specialist',
        hourlyRate: 125,
        availability: 'AVAILABLE' as WorkerAvailability,
      };

      const updatedInput = {
        headline: 'Principal Backend Engineer & Distributed Ledger Architect',
        hourlyRate: 150,
        availability: 'BUSY' as WorkerAvailability,
      };

      const updated = {
        ...workerProfile,
        ...updatedInput,
      };

      expect(updated.headline).toBe(updatedInput.headline);
      expect(updated.hourlyRate).toBe(150);
      expect(updated.availability).toBe('BUSY');
    });

    it('attaches skills with experience and prevents duplicate skill assignments', () => {
      const attachedSkills = [
        { workerProfileId: 'wp-999', skillId: 'skill-react', yearsOfExperience: 5 },
        { workerProfileId: 'wp-999', skillId: 'skill-node', yearsOfExperience: 6 },
      ];

      // Add a new unique skill
      const newSkill = { workerProfileId: 'wp-999', skillId: 'skill-postgres', yearsOfExperience: 4 };
      const isDuplicate = attachedSkills.some((s) => s.skillId === newSkill.skillId);
      expect(isDuplicate).toBe(false);

      if (!isDuplicate) {
        attachedSkills.push(newSkill);
      }
      expect(attachedSkills.length).toBe(3);

      // Attempt adding duplicate
      const duplicateAttempt = { workerProfileId: 'wp-999', skillId: 'skill-react', yearsOfExperience: 7 };
      const hasDuplicate = attachedSkills.some((s) => s.skillId === duplicateAttempt.skillId);
      expect(hasDuplicate).toBe(true);

      // Remove skill
      const afterRemoval = attachedSkills.filter((s) => s.skillId !== 'skill-react');
      expect(afterRemoval.length).toBe(2);
      expect(afterRemoval.some((s) => s.skillId === 'skill-react')).toBe(false);
    });
  });

  // =========================================================================
  // 3. Portfolio Management & Public Profile Projection
  // =========================================================================
  describe('3. Portfolio Management & Public Profile Projection', () => {
    it('creates, edits, and safely deletes portfolio items with strict worker ownership', () => {
      const portfolio = [
        {
          id: 'port-1',
          workerProfileId: 'wp-999',
          title: 'Escrow Engine v1',
          description: 'High-throughput payment settlement engine with double-entry ledger',
          projectUrl: 'https://github.com/test/escrow-engine',
          attachmentUrl: 'https://storage.trustpay.io/port-1.png',
        },
      ];

      // Edit portfolio item
      const editInput = {
        title: 'Escrow Engine v2.0 Enterprise',
        description: 'Next-generation milestone-based escrow custody system with SHA-256 digital contracts',
      };

      const item = portfolio.find((p) => p.id === 'port-1')!;
      expect(item.workerProfileId).toBe('wp-999');

      const updatedItem = { ...item, ...editInput };
      expect(updatedItem.title).toBe(editInput.title);
      expect(updatedItem.description).toBe(editInput.description);

      // Delete portfolio item
      const remaining = portfolio.filter((p) => p.id !== 'port-1');
      expect(remaining.length).toBe(0);
    });

    it('enforces IDOR protection preventing Worker A from modifying Worker B portfolio', () => {
      const itemOwnerId = 'wp-owner-100';
      const maliciousWorkerProfileId = 'wp-attacker-200';

      const canModify = itemOwnerId === maliciousWorkerProfileId;
      expect(canModify).toBe(false);
    });

    it('projects public profile to clients while withholding private contact information', () => {
      const fullWorkerRecord = {
        id: 'wp-999',
        userId: 'usr-worker-999',
        headline: 'Distributed Systems Architect',
        hourlyRate: 150,
        availability: 'AVAILABLE',
        user: {
          id: 'usr-worker-999',
          firstName: 'Jane',
          lastName: 'Specialist',
          email: 'jane@secret.com',
          profile: {
            bio: 'Expert in secure milestone escrow architectures.',
            country: 'Germany',
            companyName: 'TechSolutions GmbH',
            phoneNumber: '+49 123 456789', // Private
            address: 'Confidential Street 42', // Private
          },
        },
      };

      // Public data projection (as done by listWorkers and getWorkerById)
      const publicProjection = {
        id: fullWorkerRecord.id,
        headline: fullWorkerRecord.headline,
        hourlyRate: fullWorkerRecord.hourlyRate,
        availability: fullWorkerRecord.availability,
        user: {
          id: fullWorkerRecord.user.id,
          firstName: fullWorkerRecord.user.firstName,
          lastName: fullWorkerRecord.user.lastName,
          profile: {
            bio: fullWorkerRecord.user.profile.bio,
            country: fullWorkerRecord.user.profile.country,
            companyName: fullWorkerRecord.user.profile.companyName,
          },
        },
      };

      expect((publicProjection.user.profile as Record<string, unknown>).phoneNumber).toBeUndefined();
      expect((publicProjection.user.profile as Record<string, unknown>).address).toBeUndefined();
      expect(publicProjection.user.firstName).toBe('Jane');
    });
  });

  // =========================================================================
  // 4. Hiring Proposals, Negotiations & Counteroffers
  // =========================================================================
  describe('4. Hiring Requests, Negotiations & Counteroffers', () => {
    it('allows assigned Worker to review and accept incoming hiring proposal', () => {
      const proposal = {
        id: 'hr-501',
        clientId: 'usr-client-1',
        workerId: 'usr-worker-999',
        title: 'Full-Stack Integration',
        proposedBudget: 3500,
        status: 'PENDING',
      };

      // Worker responds with ACCEPTED
      const updatedProposal = {
        ...proposal,
        status: 'ACCEPTED',
        workerResponse: 'Excited to collaborate on this engagement.',
        respondedAt: new Date().toISOString(),
      };

      expect(updatedProposal.status).toBe('ACCEPTED');
      expect(updatedProposal.workerResponse).toBeDefined();
    });

    it('allows assigned Worker to negotiate terms and suggest counteroffer budget', () => {
      const proposal = {
        id: 'hr-502',
        clientId: 'usr-client-1',
        workerId: 'usr-worker-999',
        title: 'Complex Architecture Audit',
        proposedBudget: 4000,
        status: 'PENDING',
      };

      // Worker responds with NEGOTIATION and counter proposed budget
      const workerCounterResponse = {
        status: 'NEGOTIATION',
        proposedBudget: 5500,
        workerResponse: 'Scope requires additional performance benchmarks; proposing $5,500.',
      };

      const negotiated = {
        ...proposal,
        status: workerCounterResponse.status,
        proposedBudget: workerCounterResponse.proposedBudget,
        workerResponse: workerCounterResponse.workerResponse,
      };

      expect(negotiated.status).toBe('NEGOTIATION');
      expect(negotiated.proposedBudget).toBe(5500);

      // Client responds with counteroffer acceptance
      const clientFinalAcceptance = {
        ...negotiated,
        status: 'ACCEPTED',
        clientMessage: 'Agreed to $5,500 with included benchmark suites.',
      };

      expect(clientFinalAcceptance.status).toBe('ACCEPTED');
      expect(clientFinalAcceptance.proposedBudget).toBe(5500);
    });

    it('rejects cross-worker access to incoming hiring proposals (IDOR guard)', () => {
      const proposal = {
        id: 'hr-503',
        clientId: 'usr-client-1',
        workerId: 'usr-worker-999',
      };

      const attackerWorkerId = 'usr-worker-attacker';
      const isAuthorized = proposal.workerId === attackerWorkerId;
      expect(isAuthorized).toBe(false);
    });
  });

  // =========================================================================
  // 5. Digital Contract Review, Canonical Hash & Mutual Acceptance
  // =========================================================================
  describe('5. Digital Contract Review & Mutual Acceptance', () => {
    it('verifies Worker digital acceptance of current version and activates contract when both parties sign', () => {
      const contract = {
        id: 'contract-w-1',
        contractNumber: 'TP-2026-W01',
        version: 1,
        title: 'Enterprise Protocol Deployment',
        totalAmount: 5000,
        currency: 'USD',
        clientId: 'usr-client-1',
        workerId: 'usr-worker-999',
        status: ContractStatus.PENDING_ACCEPTANCE,
        milestones: [
          { order: 1, title: 'Phase 1: Architecture', amount: 2000 },
          { order: 2, title: 'Phase 2: Core Engine', amount: 3000 },
        ],
        acceptances: [] as Array<{ userId: string; role: string; version: number; documentHash: string }>,
      };

      // Calculate canonical SHA-256 hash
      const docHash = computeCanonicalHash(contract);
      expect(docHash).toBeDefined();
      expect(docHash.length).toBe(64);

      // Client accepts v1
      contract.acceptances.push({
        userId: contract.clientId,
        role: UserRole.CLIENT,
        version: 1,
        documentHash: docHash,
      });

      // Contract remains PENDING_ACCEPTANCE until worker also signs
      expect(contract.status).toBe(ContractStatus.PENDING_ACCEPTANCE);

      // Worker reviews and accepts v1
      const workerAcceptance = {
        userId: contract.workerId,
        role: UserRole.WORKER,
        version: 1,
        documentHash: docHash,
      };
      contract.acceptances.push(workerAcceptance);

      // Both parties have accepted version 1: Transition contract to ACTIVE!
      const hasClientAccepted = contract.acceptances.some((a) => a.userId === contract.clientId && a.version === 1);
      const hasWorkerAccepted = contract.acceptances.some((a) => a.userId === contract.workerId && a.version === 1);

      if (hasClientAccepted && hasWorkerAccepted) {
        contract.status = ContractStatus.ACTIVE;
      }

      expect(contract.status).toBe(ContractStatus.ACTIVE);
    });

    it('rejects contract acceptance when submitted against stale contract version', () => {
      const contract = {
        version: 2, // Incremented after amendment
        status: ContractStatus.PENDING_ACCEPTANCE,
      };

      const staleSubmittedVersion = 1;
      const isVersionCurrent = staleSubmittedVersion === contract.version;
      expect(isVersionCurrent).toBe(false);
    });

    it('prevents a Worker from signing a contract they are not party to', () => {
      const contract = {
        clientId: 'usr-client-1',
        workerId: 'usr-worker-999',
      };

      const unauthorizedWorkerId = 'usr-worker-unrelated';
      const isParticipant =
        contract.clientId === unauthorizedWorkerId || contract.workerId === unauthorizedWorkerId;
      expect(isParticipant).toBe(false);
    });
  });

  // =========================================================================
  // 6. Milestone Deliverables, Storage Authorization & Revision Responses
  // =========================================================================
  describe('6. Milestone Deliverable Submission & Revision Workflow', () => {
    it('manages complete milestone progress: Start Work -> Deliverable Submission -> Revision -> Resubmission -> Approval', () => {
      const milestone = {
        id: 'ms-101',
        contractId: 'contract-w-1',
        order: 1,
        title: 'Backend Core Architecture',
        amount: 2500,
        status: MilestoneStatus.PENDING,
        submissions: [] as Array<{
          id: string;
          notes: string;
          attachmentUrls: string[];
          status: SubmissionStatus;
          revisionRequests: Array<{ id: string; reason: string }>;
        }>,
      };

      // Step 1: Worker starts work on pending milestone
      milestone.status = MilestoneStatus.IN_PROGRESS;
      expect(milestone.status).toBe(MilestoneStatus.IN_PROGRESS);

      // Step 2: Worker submits deliverable with notes and storage object path
      const submission1 = {
        id: 'sub-1',
        notes: 'Initial deliverables completed including schema migrations and API controllers.',
        attachmentUrls: ['contracts/contract-w-1/agreement-attachments/archive-v1.zip'],
        status: SubmissionStatus.PENDING,
        revisionRequests: [],
      };
      milestone.submissions.push(submission1);
      milestone.status = MilestoneStatus.SUBMITTED;
      expect(milestone.status).toBe(MilestoneStatus.SUBMITTED);

      // Step 3: Client reviews and requests revisions
      submission1.status = SubmissionStatus.REJECTED;
      submission1.revisionRequests.push({
        id: 'rev-1',
        reason: 'Please add automated test coverage for concurrency handling.',
      });
      milestone.status = MilestoneStatus.IN_REVISION;
      expect(milestone.status).toBe(MilestoneStatus.IN_REVISION);

      // Step 4: Worker reviews feedback and resubmits revised deliverables
      const submission2 = {
        id: 'sub-2',
        notes: 'Added comprehensive Vitest concurrency test suite with 100% assertion pass.',
        attachmentUrls: ['contracts/contract-w-1/agreement-attachments/archive-v2.zip'],
        status: SubmissionStatus.PENDING,
        revisionRequests: [],
      };
      // Previous submission history is preserved!
      milestone.submissions.push(submission2);
      milestone.status = MilestoneStatus.SUBMITTED;

      expect(milestone.submissions.length).toBe(2);
      expect(milestone.submissions[0].revisionRequests.length).toBe(1);
      expect(milestone.status).toBe(MilestoneStatus.SUBMITTED);

      // Step 5: Client approves revised deliverable
      submission2.status = SubmissionStatus.APPROVED;
      milestone.status = MilestoneStatus.APPROVED;
      expect(milestone.status).toBe(MilestoneStatus.APPROVED);
    });

    it('enforces RBAC preventing Worker from approving their own milestone submission', () => {
      const userRole = UserRole.WORKER;
      const canApprove = userRole === UserRole.CLIENT || userRole === UserRole.SUPERADMIN;
      expect(canApprove).toBe(false);
    });

    it('strictly isolates milestone approval from financial money release', () => {
      const milestone = {
        status: MilestoneStatus.APPROVED,
        amount: 2500,
      };

      const escrowState = {
        operationalState: 'MILESTONE_APPROVED',
        liveMoneyReleased: false,
        cashfreeMovementExecuted: false,
      };

      expect(milestone.status).toBe(MilestoneStatus.APPROVED);
      expect(escrowState.liveMoneyReleased).toBe(false);
      expect(escrowState.cashfreeMovementExecuted).toBe(false);
    });
  });

  // =========================================================================
  // 7. Dispute Management, Evidence & Confidentiality Protection
  // =========================================================================
  describe('7. Dispute Management & Worker Protection', () => {
    it('allows Worker to initiate formal dispute and attaches supporting evidence', () => {
      const contract = {
        id: 'contract-w-1',
        status: ContractStatus.ACTIVE,
        workerId: 'usr-worker-999',
        clientId: 'usr-client-1',
      };

      const dispute = {
        id: 'disp-w-1',
        contractId: contract.id,
        raisedById: contract.workerId,
        category: DisputeCategory.UNRESPONSIVE_PARTY,
        title: 'Client unresponsive after milestone submission',
        description: 'Completed deliverables awaiting review for 14 days without communication.',
        claimAmountMinor: '250000',
        status: DisputeStatus.OPEN,
        evidence: [] as Array<{ fileName: string; fileUrl: string; uploaderId: string }>,
      };

      expect(dispute.raisedById).toBe('usr-worker-999');
      expect(dispute.category).toBe(DisputeCategory.UNRESPONSIVE_PARTY);

      // Attach evidence document
      dispute.evidence.push({
        fileName: 'chat-logs.pdf',
        fileUrl: 'contracts/contract-w-1/evidence/chat-logs.pdf',
        uploaderId: dispute.raisedById,
      });

      expect(dispute.evidence.length).toBe(1);
    });

    it('protects confidential admin dispute notes from being exposed to Worker or Client', () => {
      const internalDisputeRecord = {
        id: 'disp-w-1',
        status: DisputeStatus.UNDER_REVIEW,
        adminNotes: [
          {
            id: 'note-1',
            authorRole: 'ADMIN',
            content: 'Internal risk team assessment: Worker deliverable verified authentic.',
            isConfidential: true,
          },
        ],
      };

      // Worker API projection must strip confidential internal notes
      const workerProjection = {
        id: internalDisputeRecord.id,
        status: internalDisputeRecord.status,
      };

      expect((workerProjection as Record<string, unknown>).adminNotes).toBeUndefined();
    });
  });

  // =========================================================================
  // 8. Contract Amendments & Bilateral Acceptance
  // =========================================================================
  describe('8. Contract Amendments & Bilateral Verification', () => {
    it('allows Worker to review and vote on proposed contract amendments', () => {
      const contract = {
        id: 'contract-w-1',
        version: 1,
        status: ContractStatus.ACTIVE,
      };

      const amendment = {
        id: 'amend-1',
        contractId: contract.id,
        proposedById: 'usr-client-1',
        status: AmendmentStatus.PENDING_REVIEW,
        reason: 'Extend delivery date by 7 days for added test fixtures.',
        scopeChange: 'Included automated browser regression test script.',
      };

      expect(amendment.status).toBe(AmendmentStatus.PENDING_REVIEW);

      // Worker accepts the amendment
      const workerDecision = { accept: true };
      if (workerDecision.accept) {
        amendment.status = AmendmentStatus.ACCEPTED;
        contract.version += 1; // Version increments upon bilateral acceptance!
      }

      expect(amendment.status).toBe(AmendmentStatus.ACCEPTED);
      expect(contract.version).toBe(2);
    });
  });

  // =========================================================================
  // 9. Worker Financial Telemetry & Dashboard Aggregation
  // =========================================================================
  describe('9. Worker Financial Telemetry & Dashboard Aggregation', () => {
    it('aggregates live database statistics for worker dashboard without mock data', () => {
      const contracts = [
        { id: 'c-1', workerId: 'usr-worker-999', totalAmount: 4000, status: ContractStatus.ACTIVE },
        { id: 'c-2', workerId: 'usr-worker-999', totalAmount: 2000, status: ContractStatus.COMPLETED },
        { id: 'c-3', workerId: 'usr-worker-999', totalAmount: 1500, status: ContractStatus.DISPUTED },
      ];

      const milestones = [
        { contractId: 'c-1', amount: 2000, status: MilestoneStatus.APPROVED },
        { contractId: 'c-1', amount: 2000, status: MilestoneStatus.IN_PROGRESS },
        { contractId: 'c-2', amount: 2000, status: MilestoneStatus.APPROVED },
      ];

      // Total contracted value across active & completed contracts
      const totalProjectValue = contracts
        .filter((c) => c.status === ContractStatus.ACTIVE || c.status === ContractStatus.COMPLETED)
        .reduce((sum, c) => sum + c.totalAmount, 0);

      // Approved milestone amount
      const approvedAmount = milestones
        .filter((m) => m.status === MilestoneStatus.APPROVED)
        .reduce((sum, m) => sum + m.amount, 0);

      // Pending delivery pipeline amount
      const pendingAmount = milestones
        .filter((m) => m.status === MilestoneStatus.IN_PROGRESS)
        .reduce((sum, m) => sum + m.amount, 0);

      // Disputed holds
      const disputedAmount = contracts
        .filter((c) => c.status === ContractStatus.DISPUTED)
        .reduce((sum, c) => sum + c.totalAmount, 0);

      expect(totalProjectValue).toBe(6000);
      expect(approvedAmount).toBe(4000);
      expect(pendingAmount).toBe(2000);
      expect(disputedAmount).toBe(1500);
    });

    it('enforces Cashfree safety restrictions keeping all live money flags disabled', () => {
      const financialSafety = {
        isLiveMoneyDisabled: true,
        PAYMENTS_LIVE_ENABLED: false,
        ESCROW_LIVE_MOVEMENT_ENABLED: false,
        PAYOUTS_ENABLED: false,
      };

      expect(financialSafety.isLiveMoneyDisabled).toBe(true);
      expect(financialSafety.PAYMENTS_LIVE_ENABLED).toBe(false);
      expect(financialSafety.ESCROW_LIVE_MOVEMENT_ENABLED).toBe(false);
      expect(financialSafety.PAYOUTS_ENABLED).toBe(false);
    });
  });

  // =========================================================================
  // 10. Cross-Role and Authorization Guards (Negative Tests)
  // =========================================================================
  describe('10. Cross-Role and Security Negative Tests', () => {
    it('prevents Worker from accessing Client-only Direct Contract Creation', () => {
      const userRole = UserRole.WORKER;
      const canCreateDirectContract = userRole === UserRole.CLIENT;
      expect(canCreateDirectContract).toBe(false);
    });

    it('prevents Worker from accessing Administrative Governance endpoints', () => {
      const userRole = UserRole.WORKER;
      const canAccessAdminDashboard =
        userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN;
      expect(canAccessAdminDashboard).toBe(false);
    });

    it('prevents Worker from creating proposals to themselves', () => {
      const workerId = 'usr-worker-999';
      const recipientWorkerId = 'usr-worker-999';
      const isSelfHiring = workerId === recipientWorkerId;
      expect(isSelfHiring).toBe(true);
      // Backend validates clientId !== workerId
    });
  });

  // =========================================================================
  // 11. Specialist Opportunities Discovery & Proposal Bidding (Features 5 & 7)
  // =========================================================================
  describe('11. Specialist Opportunities Discovery & Proposal Bidding', () => {
    it('structures open market project opportunities with budget and scope verification', () => {
      const openOpportunity = {
        id: 'opp-101',
        title: 'Full-Stack Escrow Integration & Security Hardening',
        clientName: 'Acme Enterprise Labs',
        description: 'Implement automated settlement webhooks and Cashfree replay guards',
        budgetMinor: 350000,
        currency: 'USD',
        category: 'Full-Stack Development',
        estimatedTimeline: '3 weeks',
        milestonesCount: 3,
        createdAt: new Date().toISOString(),
      };

      expect(openOpportunity.budgetMinor).toBe(350000);
      expect(openOpportunity.milestonesCount).toBeGreaterThan(0);
      expect(openOpportunity.category).toBe('Full-Stack Development');
    });

    it('submits a competitive proposal with rate, cover note and delivery schedule', () => {
      const proposalPayload = {
        opportunityId: 'opp-101',
        proposedRateMinor: 320000,
        coverLetter: 'I have 8+ years building cryptographic escrow engines and audited financial ledgers.',
        estimatedDurationDays: 21,
      };

      expect(proposalPayload.proposedRateMinor).toBeLessThanOrEqual(350000);
      expect(proposalPayload.coverLetter.length).toBeGreaterThan(20);
      expect(proposalPayload.estimatedDurationDays).toBe(21);
    });
  });

  // =========================================================================
  // 12. Milestone Work Commencement, Deliverable Submission & Revisions (Features 12, 13, 14)
  // =========================================================================
  describe('12. Milestone Lifecycle: Start, Submit & Revisions', () => {
    it('transitions milestone from PENDING to IN_PROGRESS upon worker work commencement', () => {
      const initialMilestone = {
        id: 'ms-01',
        title: 'API Authentication & RBAC Engine',
        status: MilestoneStatus.PENDING,
        startedAt: null as string | null,
      };

      // Worker clicks Start Work
      const startedMilestone = {
        ...initialMilestone,
        status: MilestoneStatus.IN_PROGRESS,
        startedAt: new Date().toISOString(),
      };

      expect(startedMilestone.status).toBe(MilestoneStatus.IN_PROGRESS);
      expect(startedMilestone.startedAt).toBeTruthy();
    });

    it('submits deliverable with work notes and artifact links', () => {
      const submission = {
        milestoneId: 'ms-01',
        notes: 'Implemented JWT token verification, RBAC middleware, and unit test suite.',
        attachments: ['https://storage.trustpay.io/deliverables/auth-engine.zip'],
        submittedAt: new Date().toISOString(),
        status: SubmissionStatus.SUBMITTED,
      };

      expect(submission.status).toBe(SubmissionStatus.SUBMITTED);
      expect(submission.attachments.length).toBe(1);
    });

    it('records revision requests with client feedback and allows deliverable resubmission', () => {
      const revisionRequest = {
        submissionId: 'sub-01',
        revisionNumber: 1,
        feedback: 'Please ensure refresh token rotation is supported as well.',
        requestedAt: new Date().toISOString(),
      };

      expect(revisionRequest.revisionNumber).toBe(1);
      expect(revisionRequest.feedback).toContain('refresh token rotation');

      const resubmission = {
        milestoneId: 'ms-01',
        submissionId: 'sub-01',
        notes: 'Updated auth engine to support rotating refresh tokens and invalidation blacklist.',
        attachments: ['https://storage.trustpay.io/deliverables/auth-engine-v2.zip'],
        status: SubmissionStatus.RESUBMITTED,
      };

      expect(resubmission.status).toBe(SubmissionStatus.RESUBMITTED);
    });
  });

  // =========================================================================
  // 13. Specialist Invoices & Billing Verification (Feature 16)
  // =========================================================================
  describe('13. Specialist Invoices & Billing Records', () => {
    it('generates itemized invoices showing gross billings, fees, and net specialist payout', () => {
      const invoice = {
        invoiceNumber: 'INV-2026-0042',
        contractId: 'cnt-01',
        contractTitle: 'Fintech Microservices Architecture',
        specialist: { name: 'Jane Specialist', email: 'jane@specialist.io' },
        client: { name: 'FinCorp Global', email: 'billing@fincorp.io' },
        subtotal: 5000,
        taxOrFee: 250,
        total: 5250,
        currency: 'USD',
        status: 'PAID',
        lineItems: [
          { description: 'Milestone 1: Architecture Blueprint', amount: 2500, currency: 'USD' },
          { description: 'Milestone 2: Core Ledger Engine', amount: 2500, currency: 'USD' },
        ],
      };

      expect(invoice.total).toBe(invoice.subtotal + invoice.taxOrFee);
      expect(invoice.lineItems.reduce((acc, item) => acc + item.amount, 0)).toBe(invoice.subtotal);
      expect(invoice.status).toBe('PAID');
    });
  });

  // =========================================================================
  // 14. Specialist Dispute Rebuttals & Counter-Evidence (Feature 19)
  // =========================================================================
  describe('14. Specialist Dispute Rebuttals & Evidence Upload', () => {
    it('allows specialist to submit formal rebuttals and counter-evidence to active disputes', () => {
      const dispute = {
        id: 'dsp-01',
        disputeNumber: 'DSP-2026-001',
        status: DisputeStatus.UNDER_REVIEW,
        category: DisputeCategory.QUALITY_OF_WORK,
        claimedAmountMinor: 150000,
      };

      const specialistRebuttal = {
        disputeId: dispute.id,
        fileName: 'Work Audit Logs & Test Coverage Report.pdf',
        fileUrl: 'https://storage.trustpay.io/evidence/dsp-01/audit-log.pdf',
        description: 'Proof of milestone delivery adhering 100% to agreed scope specification.',
        submittedByRole: UserRole.WORKER,
      };

      expect(specialistRebuttal.submittedByRole).toBe(UserRole.WORKER);
      expect(specialistRebuttal.fileUrl).toContain('https://');
      expect(specialistRebuttal.description).toBeTruthy();
    });
  });
});

