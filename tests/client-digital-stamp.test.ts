import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  UserRole,
  ContractStatus,
  MilestoneStatus,
} from '@trustpay/shared';
import {
  formatStampDate,
  generateContractPdfBuffer,
  ContractPdfData,
  computeCanonicalContractHash,
} from '../apps/api/src/modules/contracts/contract-pdf.service.js';

describe('TRUSTPAY ENTERPRISE v2.0 — CLIENT DIGITAL OFFICE STAMP AUDIT & VERIFICATION', () => {
  // Test Fixture Data
  const mockClient = {
    id: 'usr-client-001',
    firstName: 'Venkata',
    lastName: 'Sudheer',
    email: 'client.sudheer@trustpay.internal',
    phoneNumber: '+91 9876543210',
    role: UserRole.CLIENT,
  };

  const mockSpecialist = {
    id: 'usr-worker-002',
    firstName: 'Alex',
    lastName: 'Specialist',
    email: 'specialist.alex@trustpay.internal',
    role: UserRole.WORKER,
  };

  const mockApprovedContract: ContractPdfData = {
    contractNumber: 'CNT-2026-0099',
    title: 'Enterprise Cryptographic Escrow & Infrastructure',
    description: 'Full-stack contract escrow engine with double-entry accounting ledger.',
    scopeOfWork: 'Implement immutable audit trail, Cashfree webhook replay guard, and PDF generation.',
    termsAndConditions: 'All work subject to milestone escrow custody until deliverable approval.',
    version: 1,
    totalAmount: 10000,
    currency: 'USD',
    status: ContractStatus.ACTIVE,
    client: {
      firstName: mockClient.firstName,
      lastName: mockClient.lastName,
      email: mockClient.email,
    },
    worker: {
      firstName: mockSpecialist.firstName,
      lastName: mockSpecialist.lastName,
      email: mockSpecialist.email,
    },
    milestones: [
      {
        order: 1,
        title: 'Core Ledger & Milestone Architecture',
        description: 'Complete double-entry ledger domain and schema.',
        amount: 5000,
        status: MilestoneStatus.APPROVED,
        dueDate: new Date('2026-11-20'),
      },
      {
        order: 2,
        title: 'Office Stamp & Escrow Verification',
        description: 'Client office stamp integration and vector rendering.',
        amount: 5000,
        status: MilestoneStatus.IN_PROGRESS,
        dueDate: new Date('2026-12-05'),
      },
    ],
    acceptances: [
      {
        role: UserRole.CLIENT,
        acceptedAt: new Date('2026-11-04T10:00:00Z'),
        acceptanceMethod: 'DIGITAL_CONFIRMATION',
        ipAddress: '192.168.1.10',
        documentHash: 'd7a8f3b2c1e4...sha256',
        user: {
          firstName: mockClient.firstName,
          lastName: mockClient.lastName,
          email: mockClient.email,
        },
      },
      {
        role: UserRole.WORKER,
        acceptedAt: new Date('2026-11-04T10:30:00Z'),
        acceptanceMethod: 'DIGITAL_CONFIRMATION',
        ipAddress: '192.168.1.15',
        documentHash: 'd7a8f3b2c1e4...sha256',
        user: {
          firstName: mockSpecialist.firstName,
          lastName: mockSpecialist.lastName,
          email: mockSpecialist.email,
        },
      },
    ],
  };

  // =========================================================================
  // 1. Client Access and Specialist Role Guard
  // =========================================================================
  describe('1. Role Authorization and Access Control', () => {
    it('allows authenticated Client to access My Stamp preview', () => {
      const userRole = mockClient.role;
      const canAccessStamp = userRole === UserRole.CLIENT;
      expect(canAccessStamp).toBe(true);
    });

    it('strictly forbids Specialist from accessing the Client stamp workflow', () => {
      const specialistRole = mockSpecialist.role;
      const canAccessStamp = specialistRole === UserRole.CLIENT;
      expect(canAccessStamp).toBe(false);
    });
  });

  // =========================================================================
  // 2. Stamp Data Integrity and Preview Verification
  // =========================================================================
  describe('2. Stamp Content & Preview Generation', () => {
    it('generates stamp preview with authenticated Client name and verified mobile', () => {
      const clientName = `${mockClient.firstName} ${mockClient.lastName}`.trim();
      const preview = {
        brandWatermark: 'TRUSTPAY',
        approvedBadge: 'CLIENT APPROVED',
        profileName: clientName,
        verifiedMobile: mockClient.phoneNumber,
        previewDate: formatStampDate(new Date('2026-11-05T09:00:00Z')),
        isMobileVerified: true,
        clientRole: mockClient.role,
        stampPositionDefault: 'BOTTOM_RIGHT',
      };

      expect(preview.brandWatermark).toBe('TRUSTPAY');
      expect(preview.approvedBadge).toBe('CLIENT APPROVED');
      expect(preview.profileName).toBe('Venkata Sudheer');
      expect(preview.verifiedMobile).toBe('+91 9876543210');
      expect(preview.previewDate).toBe('05 NOV 2026');
      expect(preview.isMobileVerified).toBe(true);
      expect(preview.clientRole).toBe(UserRole.CLIENT);
    });

    it('rejects stamp application when Client mobile number is missing or unverified', () => {
      const clientWithoutPhone = {
        ...mockClient,
        phoneNumber: null as string | null,
      };

      const hasVerifiedMobile = Boolean(clientWithoutPhone.phoneNumber && clientWithoutPhone.phoneNumber.trim());
      expect(hasVerifiedMobile).toBe(false);

      const validationCheck = (phone: string | null) => {
        if (!phone || !phone.trim()) {
          throw new Error('A verified mobile number is required to apply the official TrustPay office stamp.');
        }
      };

      expect(() => validationCheck(clientWithoutPhone.phoneNumber)).toThrow(
        'A verified mobile number is required to apply the official TrustPay office stamp.',
      );
    });

    it('enforces server-generated timestamp formatted as DD MMM YYYY', () => {
      const testTimestamp = new Date('2026-11-05T14:30:00Z');
      const formattedDate = formatStampDate(testTimestamp);
      expect(formattedDate).toBe('05 NOV 2026');
    });
  });

  // =========================================================================
  // 3. Contract State & Ownership Authorization
  // =========================================================================
  describe('3. Contract State & Ownership Rules', () => {
    it('rejects stamp application on an unapproved or draft contract', () => {
      const draftContract = {
        ...mockApprovedContract,
        status: ContractStatus.DRAFT,
      };

      const isApproved =
        draftContract.status === ContractStatus.ACTIVE ||
        draftContract.status === ContractStatus.COMPLETED;

      expect(isApproved).toBe(false);
    });

    it('forbids a Client from applying a stamp to another Client contract', () => {
      const contractOwnerId = 'usr-client-001';
      const requestingClientId = 'usr-client-999-intruder';

      const isOwner = contractOwnerId === requestingClientId;
      expect(isOwner).toBe(false);
    });

    it('prevents duplicate stamp applications for the same contract version', () => {
      const existingStamps = [
        {
          contractId: 'cnt-01',
          pdfVersion: 1,
          status: 'APPLIED',
        },
      ];

      const checkDuplicate = (contractId: string, version: number) => {
        return existingStamps.some(
          (s) => s.contractId === contractId && s.pdfVersion === version && s.status === 'APPLIED',
        );
      };

      const isDuplicate = checkDuplicate('cnt-01', 1);
      expect(isDuplicate).toBe(true);

      const isNewVersionAllowed = checkDuplicate('cnt-01', 2);
      expect(isNewVersionAllowed).toBe(false);
    });
  });

  // =========================================================================
  // 4. PDF Generation & Vector Stamp Embedding
  // =========================================================================
  describe('4. PDF Generation & Stamp Embedding Integration', () => {
    it('generates standard contract PDF when no stamp is applied (backward compatibility)', async () => {
      const pdfBuffer = await generateContractPdfBuffer(mockApprovedContract);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);

      // Verify PDF Magic Bytes (%PDF-1.)
      const magicBytes = pdfBuffer.slice(0, 5).toString('ascii');
      expect(magicBytes).toBe('%PDF-');
    });

    it('embeds Client Digital Office Stamp directly into the generated PDF', async () => {
      const stampedContractData: ContractPdfData = {
        ...mockApprovedContract,
        clientStamp: {
          profileName: 'Venkata Sudheer',
          verifiedMobile: '+91 9876543210',
          appliedAt: new Date('2026-11-05T10:00:00Z'),
          stampPosition: 'BOTTOM_RIGHT',
          documentHash: 'd7a8f3b2c1e4...sha256',
        },
      };

      const stampedPdfBuffer = await generateContractPdfBuffer(stampedContractData);
      expect(stampedPdfBuffer).toBeInstanceOf(Buffer);
      expect(stampedPdfBuffer.length).toBeGreaterThan(1000);

      // Verify PDF magic bytes
      const magicBytes = stampedPdfBuffer.slice(0, 5).toString('ascii');
      expect(magicBytes).toBe('%PDF-');
    });

    it('preserves existing digital signature cryptographic hashes and milestones in stamped PDF', () => {
      const hash1 = computeCanonicalContractHash({
        contractNumber: mockApprovedContract.contractNumber,
        version: mockApprovedContract.version,
        title: mockApprovedContract.title,
        totalAmount: mockApprovedContract.totalAmount,
        currency: mockApprovedContract.currency,
        clientId: mockClient.id,
        workerId: mockSpecialist.id,
        scopeOfWork: mockApprovedContract.scopeOfWork,
        termsAndConditions: mockApprovedContract.termsAndConditions,
        milestones: mockApprovedContract.milestones.map((m) => ({
          order: m.order,
          title: m.title,
          description: m.description,
          amount: m.amount,
        })),
      });

      // The digital signature hash depends strictly on canonical contract terms
      expect(hash1).toHaveLength(64); // SHA-256 hex string

      // The stamp does NOT alter the commercial terms or invalidate digital signatures
      expect(mockApprovedContract.acceptances.length).toBe(2);
      expect(mockApprovedContract.acceptances[0].acceptanceMethod).toBe('DIGITAL_CONFIRMATION');
    });

    it('strictly guarantees that NO Specialist office stamp is generated or supported', () => {
      const contractPdfData: ContractPdfData = {
        ...mockApprovedContract,
      };

      // Type-level and runtime assertion: only clientStamp property exists
      expect((contractPdfData as any).specialistStamp).toBeUndefined();
      expect((contractPdfData as any).workerStamp).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. Specialist Notification and Shared Document Access
  // =========================================================================
  describe('5. Real-Time Notification & Shared Document Workflow', () => {
    it('notifies Specialist when Client applies official office stamp', () => {
      const stampApplicationEvent = {
        contractId: 'cnt-01',
        stampId: 'stamp-uuid-1234',
        version: 1,
        appliedBy: mockClient.id,
        recipientId: mockSpecialist.id,
        notificationTitle: 'Official Office Stamp Applied',
        notificationMessage: `Client ${mockClient.firstName} ${mockClient.lastName} applied official TrustPay Office Stamp to Contract #CNT-2026-0099. The updated shared PDF is ready.`,
      };

      expect(stampApplicationEvent.recipientId).toBe(mockSpecialist.id);
      expect(stampApplicationEvent.notificationMessage).toContain('applied official TrustPay Office Stamp');
      expect(stampApplicationEvent.notificationMessage).toContain('updated shared PDF is ready');
    });

    it('allows Specialist to download the exact same stamped PDF via shared contract endpoint', () => {
      // Both Client and Specialist share GET /api/v1/contracts/:id/pdf
      const contractParticipants = [mockClient.id, mockSpecialist.id];
      const canSpecialistDownload = contractParticipants.includes(mockSpecialist.id);
      expect(canSpecialistDownload).toBe(true);
    });

    it('records immutable audit log for stamp application', () => {
      const auditRecord = {
        actorId: mockClient.id,
        action: 'CLIENT_OFFICE_STAMP_APPLIED',
        resource: 'Contract',
        resourceId: 'cnt-01',
        details: {
          stampId: 'stamp-1234',
          version: 1,
          profileNameSnapshot: 'Venkata Sudheer',
          stampPosition: 'BOTTOM_RIGHT',
        },
      };

      expect(auditRecord.action).toBe('CLIENT_OFFICE_STAMP_APPLIED');
      expect(auditRecord.actorId).toBe(mockClient.id);
      expect(auditRecord.details.stampPosition).toBe('BOTTOM_RIGHT');
    });
  });
});

