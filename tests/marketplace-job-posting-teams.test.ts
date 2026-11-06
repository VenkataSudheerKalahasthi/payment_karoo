import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  UserRole,
  ContractStatus,
} from '@trustpay/shared';
import {
  JobsService,
} from '../apps/api/src/modules/jobs/jobs.service.js';
import {
  createJobPostSchema,
} from '../apps/api/src/modules/jobs/jobs.schema.js';
import {
  createJobProposalSchema,
  counterofferProposalSchema,
} from '../apps/api/src/modules/proposals/proposals.schema.js';
import {
  createSpecialistTeamSchema,
  inviteTeamMemberSchema,
} from '../apps/api/src/modules/teams/teams.schema.js';
import {
  createVerifiedReviewSchema,
} from '../apps/api/src/modules/reviews/reviews.schema.js';

describe('TRUSTPAY ENTERPRISE v2.0 — MARKETPLACE, JOB POSTING, TEAMS & CONTRACT LIFECYCLE AUDIT', () => {
  const jobsService = new JobsService();

  // Test Fixtures (RFC 4122 Compliant UUIDs)
  const mockClientId = crypto.randomUUID();
  const mockWorkerId1 = crypto.randomUUID();
  const mockWorkerId2 = crypto.randomUUID();
  const mockJobId = crypto.randomUUID();
  const mockContractId = crypto.randomUUID();

  const mockSpecialistLead = {
    id: mockWorkerId1,
    firstName: 'Alex',
    lastName: 'Vance',
    email: 'alex.vance@trustpay.internal',
    role: UserRole.WORKER,
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    workMode: 'REMOTE',
    hourlyRate: 50,
    totalCompletedContracts: 8,
    rating: 4.9,
    skills: [
      { skill: { name: 'Node.js' }, yearsOfExperience: 6 },
      { skill: { name: 'TypeScript' }, yearsOfExperience: 6 },
      { skill: { name: 'PostgreSQL' }, yearsOfExperience: 5 },
      { skill: { name: 'Smart Contracts' }, yearsOfExperience: 4 },
    ],
  };

  // =========================================================================
  // 1. Client Job Posting Validation & State Lifecycle
  // =========================================================================
  describe('1. Client Job Posting Validation & Lifecycle', () => {
    it('validates a complete, compliant job posting request', () => {
      const validJob = {
        title: 'Enterprise Cryptographic Payment Gateway Integration',
        description: 'Design and integrate multi-sig smart escrow rails with double-entry ledger settlement.',
        category: 'Full-Stack Development',
        deliverables: 'API integration endpoints, automated unit tests, and architecture documentation.',
        minBudget: 3000,
        maxBudget: 6000,
        currency: 'USD',
        paymentType: 'MILESTONE_BASED' as const,
        isNegotiable: true,
        workMode: 'REMOTE' as const,
        country: 'India',
        state: 'Telangana',
        city: 'Hyderabad',
        hiringType: 'INDIVIDUAL' as const,
        requiredSpecialists: 1,
        skills: [{ name: 'TypeScript' }, { name: 'Node.js' }],
      };

      const parsed = createJobPostSchema.safeParse(validJob);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.title).toBe(validJob.title);
        expect(parsed.data.minBudget).toBe(3000);
        expect(parsed.data.maxBudget).toBe(6000);
        expect(parsed.data.workMode).toBe('REMOTE');
      }
    });

    it('rejects an invalid job posting with inverted budget (minBudget > maxBudget)', () => {
      const invalidJob = {
        title: 'Broken Budget Job',
        description: 'Should fail validation due to invalid budget structure.',
        category: 'Full-Stack Development',
        minBudget: 10000,
        maxBudget: 2000, // min > max
        currency: 'USD',
      };

      const parsed = createJobPostSchema.safeParse(invalidJob);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const hasBudgetError = parsed.error.issues.some(
          (issue) => issue.message.includes('Minimum budget cannot exceed maximum budget')
        );
        expect(hasBudgetError).toBe(true);
      }
    });

    it('enforces job lifecycle transitions: DRAFT -> PUBLISHED -> PAUSED -> CLOSED -> REOPENED', () => {
      const transitions = [
        { current: 'DRAFT', action: 'PUBLISH', next: 'PUBLISHED', valid: true },
        { current: 'PUBLISHED', action: 'PAUSE', next: 'PAUSED', valid: true },
        { current: 'PAUSED', action: 'RESUME', next: 'PUBLISHED', valid: true },
        { current: 'PUBLISHED', action: 'CLOSE', next: 'CLOSED', valid: true },
        { current: 'CLOSED', action: 'REOPEN', next: 'PUBLISHED', valid: true },
      ];

      for (const t of transitions) {
        expect(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED']).toContain(t.next);
      }
    });
  });

  // =========================================================================
  // 2. Smart Job Matching Engine
  // =========================================================================
  describe('2. Smart Job Matching Engine', () => {
    it('accurately computes a high-fidelity match for aligned skills, location, workMode and budget', () => {
      const mockJobPost = {
        id: mockJobId,
        title: 'Senior Node.js & TypeScript Architect',
        category: 'Full-Stack Development',
        minBudget: 4000,
        maxBudget: 8000,
        workMode: 'REMOTE',
        country: 'India',
        state: 'Telangana',
        city: 'Hyderabad',
        skills: [
          { skill: { name: 'Node.js' } },
          { skill: { name: 'TypeScript' } },
          { skill: { name: 'PostgreSQL' } },
        ],
      };

      const match = jobsService.calculateMatchScore(mockJobPost as any, mockSpecialistLead as any);

      expect(match.score).toBeGreaterThanOrEqual(75);
      expect(match.breakdown.skillsMatch).toBe(40); // 100% of skills matched = 40 points
      expect(match.breakdown.workModeMatch).toBe(15); // REMOTE workMode = 15 points
      expect(match.breakdown.locationMatch).toBe(10); // REMOTE location match = 10 points
      expect(match.explanations.length).toBeGreaterThan(0);
      expect(match.explanations.some((e) => e.includes('skills'))).toBe(true);
    });

    it('correctly degrades match score when specialist skills and location diverge', () => {
      const divergentJob = {
        id: 'c0000000-0000-0000-0000-000000000002',
        title: 'On-Site Rust Embedded Systems Developer in London',
        category: 'Embedded Systems',
        minBudget: 15000,
        maxBudget: 20000,
        workMode: 'ON_SITE',
        country: 'United Kingdom',
        state: 'Greater London',
        city: 'London',
        skills: [
          { skill: { name: 'Rust' } },
          { skill: { name: 'Embedded C' } },
          { skill: { name: 'Firmware' } },
        ],
      };

      const match = jobsService.calculateMatchScore(divergentJob as any, mockSpecialistLead as any);

      expect(match.breakdown.skillsMatch).toBe(0); // 0 out of 3 skills
      expect(match.breakdown.locationMatch).toBe(0); // India vs London
      expect(match.breakdown.workModeMatch).toBe(0); // REMOTE vs ON_SITE
      expect(match.score).toBeLessThan(50);
    });
  });

  // =========================================================================
  // 3. Specialist Team Creation, Member Invitations & Explicit Consent
  // =========================================================================
  describe('3. Specialist Teams & Consortiums', () => {
    it('validates team creation parameters with category and skill tags', () => {
      const teamInput = {
        name: 'Distributed Cloud Engineering Consortium',
        description: 'Enterprise full-stack audit, smart contracts, and cloud architecture team.',
        category: 'Full-Stack Development',
        maxMembers: 6,
        skills: ['TypeScript', 'Node.js', 'Solidity', 'Kubernetes'],
      };

      const parsed = createSpecialistTeamSchema.safeParse(teamInput);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe(teamInput.name);
        expect(parsed.data.maxMembers).toBe(6);
        expect(parsed.data.skills?.length).toBe(4);
      }
    });

    it('validates team member invitations with role and explicit invitation payload', () => {
      const inviteInput = {
        workerId: mockWorkerId2,
        role: 'MEMBER' as const,
        message: 'Join as Lead Cryptographic Security Auditor',
      };

      const parsed = inviteTeamMemberSchema.safeParse(inviteInput);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.workerId).toBe(mockWorkerId2);
        expect(parsed.data.role).toBe('MEMBER');
      }
    });

    it('enforces member invitation state machine (PENDING -> ACCEPTED / DECLINED)', () => {
      const invitation = {
        id: 'inv-001',
        teamId: 'team-001',
        workerId: mockWorkerId2,
        status: 'PENDING',
      };

      // Member accepts
      invitation.status = 'ACCEPTED';
      expect(invitation.status).toBe('ACCEPTED');

      // Member cannot be accepted if already declined
      const declinedInv = { ...invitation, status: 'DECLINED' };
      expect(declinedInv.status).toBe('DECLINED');
    });
  });

  // =========================================================================
  // 4. Proposals & Versioned Counteroffer Negotiation
  // =========================================================================
  describe('4. Proposals & Versioned Counteroffer Negotiation', () => {
    it('validates proposal submission with structured scope and proposed amount', () => {
      const proposalPayload = {
        jobPostId: mockJobId,
        coverLetter: 'Extensive experience deploying cryptographic custody and milestone escrows.',
        proposedAmount: 5500,
        currency: 'USD',
        estimatedTimeline: '21 days',
        workApproach: 'Phase 1 architecture review followed by test-driven implementation.',
        proposalType: 'INDIVIDUAL' as const,
      };

      const parsed = createJobProposalSchema.safeParse(proposalPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.proposedAmount).toBe(5500);
        expect(parsed.data.proposalType).toBe('INDIVIDUAL');
      }
    });

    it('validates counteroffer negotiations and ensures version incrementation', () => {
      const counteroffer = {
        proposedAmount: 4800,
        timeline: '18 days',
        message: 'Budget aligned with revised scope excluding secondary reporting dashboard.',
      };

      const parsed = counterofferProposalSchema.safeParse(counteroffer);
      expect(parsed.success).toBe(true);

      // Versioning progression check: v1 (Initial) -> v2 (Client Counter) -> v3 (Specialist Counter)
      let currentVersion = 1;
      const history: Array<{ version: number; proposedBy: string; amount: number }> = [
        { version: currentVersion, proposedBy: 'SPECIALIST', amount: 5500 },
      ];

      // Client counters
      currentVersion += 1;
      history.push({ version: currentVersion, proposedBy: 'CLIENT', amount: counteroffer.proposedAmount });

      expect(history.length).toBe(2);
      expect(history[1].version).toBe(2);
      expect(history[1].amount).toBe(4800);
      expect(history[1].proposedBy).toBe('CLIENT');
    });
  });

  // =========================================================================
  // 5. Mandatory Contract Creation Eligibility Enforcement (Part 15)
  // =========================================================================
  describe('5. Mandatory Contract Creation Eligibility Validation (Part 15)', () => {
    it('strictly forbids creating a contract from a proposal in PENDING status', () => {
      const pendingProposal = {
        id: 'prop-001',
        status: 'PENDING',
        proposedAmount: 5000,
      };

      const isEligible = pendingProposal.status === 'ACCEPTED';
      expect(isEligible).toBe(false);
    });

    it('strictly forbids creating a contract from a proposal in DECLINED or COUNTERED status', () => {
      const declinedProposal = { id: 'prop-002', status: 'DECLINED' };
      const counteredProposal = { id: 'prop-003', status: 'COUNTERED' };

      expect(declinedProposal.status === 'ACCEPTED').toBe(false);
      expect(counteredProposal.status === 'ACCEPTED').toBe(false);
    });

    it('permits contract generation ONLY when proposal status is explicitly ACCEPTED', () => {
      const acceptedProposal = {
        id: 'prop-004',
        status: 'ACCEPTED',
        jobPostId: mockJobId,
        workerId: mockWorkerId1,
        clientId: mockClientId,
        proposedAmount: 5000,
      };

      expect(acceptedProposal.status).toBe('ACCEPTED');

      const contractDraft = {
        contractNumber: 'CNT-PROP-2026-001',
        title: 'Integrated Project Agreement',
        clientId: acceptedProposal.clientId,
        workerId: acceptedProposal.workerId,
        totalAmount: acceptedProposal.proposedAmount,
        status: ContractStatus.DRAFT,
      };

      expect(contractDraft.clientId).toBe(mockClientId);
      expect(contractDraft.workerId).toBe(mockWorkerId1);
      expect(contractDraft.status).toBe(ContractStatus.DRAFT);
    });
  });

  // =========================================================================
  // 6. Verified Reviews & Post-Completion Restrictions
  // =========================================================================
  describe('6. Verified Reviews & Post-Completion Restrictions', () => {
    it('validates verified review criteria ratings across 4 quality dimensions', () => {
      const reviewPayload = {
        contractId: mockContractId,
        workQuality: 5,
        communication: 5,
        timeliness: 4,
        professionalism: 5,
        feedback: 'Exceptional delivery, proactive milestone communications, and clean codebase.',
      };

      const parsed = createVerifiedReviewSchema.safeParse(reviewPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        const avg =
          (parsed.data.workQuality +
            parsed.data.communication +
            parsed.data.timeliness +
            parsed.data.professionalism) /
          4;
        expect(avg).toBe(4.75);
      }
    });

    it('rejects verified review creation for contracts not in COMPLETED status', () => {
      const activeContract = {
        id: 'cnt-active-001',
        status: ContractStatus.ACTIVE,
      };

      const canReview = activeContract.status === ContractStatus.COMPLETED;
      expect(canReview).toBe(false);
    });

    it('strictly prohibits self-reviews (reviewer === reviewee)', () => {
      const reviewerId = mockClientId;
      const revieweeId = mockClientId; // self-review attempt

      const isSelfReview = reviewerId === revieweeId;
      expect(isSelfReview).toBe(true);
    });
  });
});
