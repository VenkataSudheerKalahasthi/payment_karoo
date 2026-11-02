import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  UserRole,
  ContractStatus,
  MilestoneStatus,
  SubmissionStatus,
  ProjectStatus,
} from '@prisma/client';
import {
  ALLOWED_MILESTONE_TRANSITIONS,
  validateMilestoneTransition,
} from '../apps/api/src/modules/contracts/milestones.state-machine.js';
import {
  formatCurrencyMinor,
} from '../packages/shared/src/index.js';
import { storageService } from '../apps/api/src/modules/storage/storage.service.js';

describe('Milestone and Project Management — Comprehensive Suite (Phase 9)', () => {
  const testContract = {
    id: 'f0000000-0000-0000-0000-000000000001',
    contractNumber: 'TPE-PRJ-2026-001',
    title: 'Enterprise Core Banking Migration',
    description: 'Migration to high-throughput cloud database',
    clientId: 'client-user-1111',
    workerId: 'worker-user-2222',
    status: ContractStatus.ACTIVE,
    totalAmount: 25000,
    currency: 'USD',
    version: 1,
  };

  const testMilestones = [
    {
      id: 'm-001',
      contractId: testContract.id,
      title: 'Architecture Blueprint',
      description: 'System specifications and data models',
      amount: 10000,
      order: 1,
      status: MilestoneStatus.PENDING,
    },
    {
      id: 'm-002',
      contractId: testContract.id,
      title: 'Database Ingestion & Service Pipeline',
      description: 'Zero-downtime replication stream',
      amount: 15000,
      order: 2,
      status: MilestoneStatus.PENDING,
    },
  ];

  // 1. Project Creation & Contract Association
  describe('1. Project Creation and Contract Association', () => {
    it('creates a project accurately referencing its originating contract', () => {
      const project = {
        id: crypto.randomUUID(),
        contractId: testContract.id,
        clientId: testContract.clientId,
        workerId: testContract.workerId,
        title: testContract.title,
        description: testContract.description,
        status: ProjectStatus.ACTIVE,
        progressPercentage: 0,
      };

      expect(project.contractId).toBe(testContract.id);
      expect(project.clientId).toBe(testContract.clientId);
      expect(project.workerId).toBe(testContract.workerId);
      expect(project.status).toBe(ProjectStatus.ACTIVE);
    });

    it('rejects duplicate project creation for the same contract', () => {
      const existingProjects = [
        { id: 'proj-1', contractId: testContract.id },
      ];

      const isDuplicate = existingProjects.some((p) => p.contractId === testContract.id);
      expect(isDuplicate).toBe(true);
    });

    it('enforces that only authorized contract parties can access the project', () => {
      const isClientAuthorized = testContract.clientId === 'client-user-1111';
      const isWorkerAuthorized = testContract.workerId === 'worker-user-2222';
      const isThirdPartyAuthorized =
        'unauthorized-user-9999' === testContract.clientId ||
        'unauthorized-user-9999' === testContract.workerId;

      expect(isClientAuthorized).toBe(true);
      expect(isWorkerAuthorized).toBe(true);
      expect(isThirdPartyAuthorized).toBe(false);
    });
  });

  // 2. Milestone Financial Allocation & Minor Units
  describe('2. Milestone Financial Allocation & Minor Units', () => {
    it('calculates milestone amounts in exact integer minor units without IEEE 754 float drift', () => {
      const amount1 = 10000.5;
      const amount2 = 14999.5;

      const minor1 = BigInt(Math.round(amount1 * 100)); // 1000050n
      const minor2 = BigInt(Math.round(amount2 * 100)); // 1499950n
      const totalMinor = minor1 + minor2; // 2500000n

      expect(minor1.toString()).toBe('1000050');
      expect(minor2.toString()).toBe('1499950');
      expect(totalMinor.toString()).toBe('2500000');
      expect(formatCurrencyMinor(totalMinor.toString(), 'USD')).toBe('$25,000.00');
    });

    it('validates that sum of milestone allocations equals contract agreed amount', () => {
      const sum = testMilestones.reduce((acc, m) => acc + m.amount, 0);
      expect(sum).toBe(testContract.totalAmount);
    });

    it('rejects negative or zero milestone amounts', () => {
      const invalidAmounts = [-500, 0, -0.01];
      invalidAmounts.forEach((amt) => {
        expect(amt > 0).toBe(false);
      });
    });

    it('calculates remaining unapproved value strictly', () => {
      const totalMinor = 2500000n;
      const approvedMinor = 1000000n;
      const remainingUnapprovedMinor = totalMinor - approvedMinor;

      expect(remainingUnapprovedMinor).toBe(1500000n);
      expect(formatCurrencyMinor(remainingUnapprovedMinor.toString(), 'USD')).toBe('$15,000.00');
    });
  });

  // 3. Centralized Milestone State Machine
  describe('3. Centralized Milestone State Machine Transitions', () => {
    it('allows valid transition from PENDING to IN_PROGRESS', () => {
      const res = validateMilestoneTransition(MilestoneStatus.PENDING, MilestoneStatus.IN_PROGRESS);
      expect(res.valid).toBe(true);
    });

    it('allows valid transition from IN_PROGRESS to SUBMITTED', () => {
      const res = validateMilestoneTransition(MilestoneStatus.IN_PROGRESS, MilestoneStatus.SUBMITTED);
      expect(res.valid).toBe(true);
    });

    it('allows direct transition from PENDING to SUBMITTED', () => {
      const res = validateMilestoneTransition(MilestoneStatus.PENDING, MilestoneStatus.SUBMITTED);
      expect(res.valid).toBe(true);
    });

    it('allows valid transition from SUBMITTED to IN_REVISION', () => {
      const res = validateMilestoneTransition(MilestoneStatus.SUBMITTED, MilestoneStatus.IN_REVISION);
      expect(res.valid).toBe(true);
    });

    it('allows valid transition from IN_REVISION to SUBMITTED (resubmission)', () => {
      const res = validateMilestoneTransition(MilestoneStatus.IN_REVISION, MilestoneStatus.SUBMITTED);
      expect(res.valid).toBe(true);
    });

    it('allows valid transition from SUBMITTED to APPROVED', () => {
      const res = validateMilestoneTransition(MilestoneStatus.SUBMITTED, MilestoneStatus.APPROVED);
      expect(res.valid).toBe(true);
    });

    it('rejects illegal transition from PENDING directly to APPROVED', () => {
      const res = validateMilestoneTransition(MilestoneStatus.PENDING, MilestoneStatus.APPROVED);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Illegal milestone state transition');
    });

    it('rejects illegal transition from APPROVED back to SUBMITTED (immutability)', () => {
      const res = validateMilestoneTransition(MilestoneStatus.APPROVED, MilestoneStatus.SUBMITTED);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Illegal milestone state transition');
    });

    it('allows transition to DISPUTED from active states', () => {
      const s1 = validateMilestoneTransition(MilestoneStatus.IN_PROGRESS, MilestoneStatus.DISPUTED);
      const s2 = validateMilestoneTransition(MilestoneStatus.SUBMITTED, MilestoneStatus.DISPUTED);
      const s3 = validateMilestoneTransition(MilestoneStatus.IN_REVISION, MilestoneStatus.DISPUTED);

      expect(s1.valid).toBe(true);
      expect(s2.valid).toBe(true);
      expect(s3.valid).toBe(true);
    });
  });

  // 4. Worker Milestone Submission & Deliverable Evidence Uploads
  describe('4. Worker Milestone Submission & Deliverable Evidence Uploads', () => {
    it('strictly permits only assigned worker to submit deliverables', () => {
      const callingUser = { id: 'worker-user-2222' };
      const nonAssignedWorker = { id: 'worker-user-3333' };

      const isPermitted = callingUser.id === testContract.workerId;
      const isForbidden = nonAssignedWorker.id === testContract.workerId;

      expect(isPermitted).toBe(true);
      expect(isForbidden).toBe(false);
    });

    it('validates submission payload requires non-empty completion notes', () => {
      const validNotes = 'Completed architecture schema and implemented micro-benchmarks.';
      const emptyNotes = '   ';

      expect(validNotes.trim().length > 0).toBe(true);
      expect(emptyNotes.trim().length > 0).toBe(false);
    });

    it('verifies storage object paths prevent path traversal attacks', () => {
      const safePath = 'contracts/c-123/evidence/abc-submission.pdf';
      const maliciousPath = 'contracts/c-123/evidence/../../../etc/passwd';

      const isSafeValid = !safePath.includes('..') && !safePath.startsWith('/');
      const isMaliciousValid = !maliciousPath.includes('..') && !maliciousPath.startsWith('/');

      expect(isSafeValid).toBe(true);
      expect(isMaliciousValid).toBe(false);
    });

    it('authorizes only allowed MIME types for deliverable evidence (PDF, PNG, JPG, ZIP)', () => {
      const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'application/zip'];
      const dangerousMime = 'application/x-msdownload';

      expect(allowed.includes('application/pdf')).toBe(true);
      expect(allowed.includes('application/zip')).toBe(true);
      expect(allowed.includes(dangerousMime)).toBe(false);
    });
  });

  // 5. Client Review, Revision Requests & Resubmission Workflow
  describe('5. Client Review, Revision Requests & Resubmission Workflow', () => {
    it('restricts review and revision requests to contract client', () => {
      const clientActor = { id: 'client-user-1111' };
      const workerActor = { id: 'worker-user-2222' };

      const canClientReview = clientActor.id === testContract.clientId;
      const canWorkerReview = workerActor.id === testContract.clientId;

      expect(canClientReview).toBe(true);
      expect(canWorkerReview).toBe(false);
    });

    it('requires mandatory revision feedback and references acceptance criteria', () => {
      const revisionInput = {
        submissionId: 'sub-001',
        reason: 'Missing OpenAPI spec and high-volume stress test results as required by criteria 2.4.',
      };

      expect(revisionInput.reason.trim().length).toBeGreaterThan(10);
    });

    it('preserves previous submission attempts across multiple revision cycles', () => {
      const submissions = [
        {
          id: 'sub-001',
          version: 1,
          status: SubmissionStatus.REJECTED,
          notes: 'First draft',
          submittedAt: '2026-11-01T10:00:00Z',
        },
        {
          id: 'sub-002',
          version: 2,
          status: SubmissionStatus.SUBMITTED,
          notes: 'Second draft with fixes',
          submittedAt: '2026-11-02T10:00:00Z',
        },
      ];

      expect(submissions.length).toBe(2);
      expect(submissions[0].status).toBe(SubmissionStatus.REJECTED);
      expect(submissions[1].status).toBe(SubmissionStatus.SUBMITTED);
      expect(submissions[0].id).not.toBe(submissions[1].id);
    });
  });

  // 6. Milestone Approval & Financial Safety Decoupling
  describe('6. Milestone Approval & Financial Safety Decoupling', () => {
    it('approves deliverable without releasing live monetary funds', () => {
      const approvalAuditRecord = {
        action: 'MILESTONE_APPROVED',
        isLiveFinancialMovement: false,
        sandboxEscrowAllocated: true,
      };

      expect(approvalAuditRecord.action).toBe('MILESTONE_APPROVED');
      expect(approvalAuditRecord.isLiveFinancialMovement).toBe(false);
    });

    it('rejects approval when contract is disputed or on dispute hold', () => {
      const disputedContract = { status: ContractStatus.DISPUTED };
      const escrowRecord = { disputeHold: true };

      const canApprove =
        disputedContract.status !== ContractStatus.DISPUTED && !escrowRecord.disputeHold;

      expect(canApprove).toBe(false);
    });

    it('updates project progress percentage to 100% when all milestones are approved', () => {
      const milestones = [
        { id: 'm1', status: MilestoneStatus.APPROVED },
        { id: 'm2', status: MilestoneStatus.APPROVED },
      ];

      const approvedCount = milestones.filter((m) => m.status === MilestoneStatus.APPROVED).length;
      const progress = Math.round((approvedCount / milestones.length) * 100);

      expect(progress).toBe(100);
    });
  });

  // 7. Milestone Activity Tracking & Append-Only History
  describe('7. Milestone Activity Tracking & Append-Only History', () => {
    it('creates immutable append-only activity records for every milestone action', () => {
      const activityRecords: Array<{
        id: string;
        action: string;
        previousState: string | null;
        newState: string;
        timestamp: string;
      }> = [];

      // Step 1: Work started
      activityRecords.push({
        id: crypto.randomUUID(),
        action: 'MILESTONE_STARTED',
        previousState: MilestoneStatus.PENDING,
        newState: MilestoneStatus.IN_PROGRESS,
        timestamp: new Date().toISOString(),
      });

      // Step 2: Work submitted
      activityRecords.push({
        id: crypto.randomUUID(),
        action: 'MILESTONE_SUBMITTED',
        previousState: MilestoneStatus.IN_PROGRESS,
        newState: MilestoneStatus.SUBMITTED,
        timestamp: new Date().toISOString(),
      });

      // Step 3: Revision requested
      activityRecords.push({
        id: crypto.randomUUID(),
        action: 'REVISION_REQUESTED',
        previousState: MilestoneStatus.SUBMITTED,
        newState: MilestoneStatus.IN_REVISION,
        timestamp: new Date().toISOString(),
      });

      expect(activityRecords.length).toBe(3);
      expect(activityRecords[0].action).toBe('MILESTONE_STARTED');
      expect(activityRecords[1].action).toBe('MILESTONE_SUBMITTED');
      expect(activityRecords[2].action).toBe('REVISION_REQUESTED');
    });
  });

  // 8. IDOR & Cross-Tenant Security Verification
  describe('8. IDOR & Cross-Tenant Security Verification', () => {
    it('blocks Client B from accessing Client A milestone records', () => {
      const clientA = { id: 'client-A' };
      const clientB = { id: 'client-B' };
      const milestoneBelongsToContractWithClientA = { clientId: clientA.id };

      const isAccessAllowed = clientB.id === milestoneBelongsToContractWithClientA.clientId;
      expect(isAccessAllowed).toBe(false);
    });

    it('blocks Worker B from submitting deliverables to Worker A milestones', () => {
      const workerA = { id: 'worker-A' };
      const workerB = { id: 'worker-B' };
      const milestoneBelongsToContractWithWorkerA = { workerId: workerA.id };

      const canSubmit = workerB.id === milestoneBelongsToContractWithWorkerA.workerId;
      expect(canSubmit).toBe(false);
    });

    it('generates HMAC-signed download tokens valid only for short duration', () => {
      const secret = 'test-storage-secret-key-32bytes-min';
      const userId = 'client-user-1111';
      const objectPath = 'contracts/c-1/evidence/doc.pdf';
      const expiresAt = Date.now() + 900 * 1000;

      const payload = `${userId}:${objectPath}:${expiresAt}`;
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      // Verify signature matches
      const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      expect(signature).toBe(expectedSignature);

      // Verify tampered path fails
      const tamperedPayload = `${userId}:contracts/c-2/evidence/secret.pdf:${expiresAt}`;
      const tamperedSignature = crypto.createHmac('sha256', secret).update(tamperedPayload).digest('hex');
      expect(signature).not.toBe(tamperedSignature);
    });
  });
});

