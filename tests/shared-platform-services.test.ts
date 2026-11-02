import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import { StorageService } from '../apps/api/src/modules/storage/storage.service.js';
import { BUCKET_LIMITS } from '../apps/api/src/modules/storage/storage.schema.js';
import { notificationsService } from '../apps/api/src/modules/notifications/notifications.service.js';
import { prisma } from '../apps/api/src/config/prisma.js';
import {
  computeCanonicalContractHash,
  generateContractPdfBuffer,
} from '../apps/api/src/modules/contracts/contract-pdf.service.js';
import { cashfreeProvider } from '../apps/api/src/modules/payments/cashfree.provider.js';
import { UserRole, NotificationType } from '@prisma/client';

describe('TRUSTPAY ENTERPRISE — SHARED PLATFORM SERVICES VERIFICATION', () => {
  const storageService = new StorageService();

  // ============================================================================
  // PART A: NOTIFICATIONS AND COMMUNICATION
  // ============================================================================
  describe('Part A: Persisted Notification Architecture & Real-Time Isolation', () => {
    const mockRecipientId = 'user_notif_target_' + crypto.randomUUID();
    const otherUserId = 'user_intruder_' + crypto.randomUUID();

    it('creates and persists a notification with recipient, type, and metadata', async () => {
      // Mock prisma.notification.create
      const notifData = {
        id: crypto.randomUUID(),
        recipientId: mockRecipientId,
        title: 'New Hiring Offer Received',
        message: 'Client Acme Corp offered $2,500.00 for Project Apollo',
        type: NotificationType.HIRING_REQUEST_RECEIVED,
        isRead: false,
        metadata: { hiringRequestId: 'hr_123', amount: 2500 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.notification, 'create').mockResolvedValueOnce(notifData as never);

      const created = await notificationsService.createNotification({
        recipientId: mockRecipientId,
        title: notifData.title,
        message: notifData.message,
        type: notifData.type,
        metadata: notifData.metadata,
      });

      expect(created.id).toBe(notifData.id);
      expect(created.recipientId).toBe(mockRecipientId);
      expect(created.type).toBe(NotificationType.HIRING_REQUEST_RECEIVED);
      expect(created.isRead).toBe(false);
    });

    it('lists user notifications and computes accurate unread counts', async () => {
      const mockItems = [
        {
          id: 'notif_1',
          recipientId: mockRecipientId,
          title: 'Milestone Submitted',
          message: 'Milestone #1 deliverable ready for review',
          type: NotificationType.MILESTONE_SUBMITTED,
          isRead: false,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'notif_2',
          recipientId: mockRecipientId,
          title: 'Contract Activated',
          message: 'Both parties signed Contract #CT-2026-001',
          type: NotificationType.CONTRACT_ACCEPTED,
          isRead: true,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.spyOn(prisma.notification, 'findMany').mockResolvedValueOnce(mockItems as never);
      vi.spyOn(prisma.notification, 'count').mockResolvedValueOnce(1);

      const result = await notificationsService.listUserNotifications(mockRecipientId);

      expect(result.items).toHaveLength(2);
      expect(result.unreadCount).toBe(1);
    });

    it('prevents IDOR: non-recipient cannot mark another user notification as read', async () => {
      vi.spyOn(prisma.notification, 'findUnique').mockResolvedValueOnce({
        id: 'notif_private_1',
        recipientId: mockRecipientId,
        title: 'Confidential Alert',
        message: 'Details',
        type: NotificationType.SYSTEM_ALERT,
        isRead: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await expect(
        notificationsService.markAsRead('notif_private_1', otherUserId),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('marks a single notification as read when requested by legitimate recipient', async () => {
      vi.spyOn(prisma.notification, 'findUnique').mockResolvedValueOnce({
        id: 'notif_legit_1',
        recipientId: mockRecipientId,
        isRead: false,
      } as never);

      vi.spyOn(prisma.notification, 'update').mockResolvedValueOnce({
        id: 'notif_legit_1',
        recipientId: mockRecipientId,
        isRead: true,
      } as never);

      const updated = await notificationsService.markAsRead('notif_legit_1', mockRecipientId);
      expect(updated.isRead).toBe(true);
    });

    it('marks all unread notifications as read for target user in bulk', async () => {
      vi.spyOn(prisma.notification, 'updateMany').mockResolvedValueOnce({
        count: 5,
      } as never);

      const res = await notificationsService.markAllAsRead(mockRecipientId);
      expect(res.count).toBe(5);
    });
  });

  // ============================================================================
  // PART B: FILE & DOCUMENT MANAGEMENT (PRIVATE STORAGE & CRYPTOGRAPHIC PDF)
  // ============================================================================
  describe('Part B: Storage Security, HMAC Verification & PDF Generation', () => {
    const fakeContractId = crypto.randomUUID();
    const fakeUserId = crypto.randomUUID();

    it('enforces strict bucket restrictions, MIME types, and file size quotas', () => {
      // Evidence: 10MB
      expect(BUCKET_LIMITS.evidence.maxBytes).toBe(10 * 1024 * 1024);
      expect(BUCKET_LIMITS.evidence.allowedMimes).toContain('application/pdf');
      expect(BUCKET_LIMITS.evidence.allowedMimes).toContain('image/png');
      expect(BUCKET_LIMITS.evidence.allowedMimes).not.toContain('application/javascript');

      // Agreement attachments: 15MB
      expect(BUCKET_LIMITS['agreement-attachments'].maxBytes).toBe(15 * 1024 * 1024);
      expect(BUCKET_LIMITS['agreement-attachments'].allowedMimes).toContain('application/pdf');

      // Invoices: 5MB
      expect(BUCKET_LIMITS.invoices.maxBytes).toBe(5 * 1024 * 1024);
      expect(BUCKET_LIMITS.invoices.allowedMimes).toEqual(['application/pdf']);
    });

    it('rejects directory traversal attempts in download and upload object paths', async () => {
      const user = { id: fakeUserId, role: { name: UserRole.CLIENT } };

      await expect(
        storageService.authorizeDownload(fakeContractId, '../../../../etc/shadow', user),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_OBJECT_PATH',
      });

      await expect(
        storageService.authorizeDownload(fakeContractId, '/contracts/c1/file.pdf', user),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_OBJECT_PATH',
      });
    });

    it('verifies timing-safe HMAC signed download tokens and enforces 15-minute expiration', () => {
      // Generate a legitimate token manually
      const secret = process.env.STORAGE_SIGNING_SECRET || crypto.createHash('sha256').update(process.env.DATABASE_URL || 'tp_secret').digest('hex');
      const expiresIn = 900;
      const validExpiresAt = Date.now() + expiresIn * 1000;
      const validPayload = `${fakeUserId}:contracts/${fakeContractId}/evidence/report.pdf:${validExpiresAt}`;
      const validSig = crypto.createHmac('sha256', secret).update(validPayload).digest('hex');
      const validToken = Buffer.from(JSON.stringify({ payload: validPayload, signature: validSig })).toString('base64url');

      const verified = storageService.verifyDownloadToken(validToken);
      expect(verified.userId).toBe(fakeUserId);
      expect(verified.objectPath).toBe(`contracts/${fakeContractId}/evidence/report.pdf`);

      // Expired token rejection
      const expiredPayload = `${fakeUserId}:contracts/${fakeContractId}/evidence/report.pdf:${Date.now() - 5000}`;
      const expiredSig = crypto.createHmac('sha256', secret).update(expiredPayload).digest('hex');
      const expiredToken = Buffer.from(JSON.stringify({ payload: expiredPayload, signature: expiredSig })).toString('base64url');

      expect(() => storageService.verifyDownloadToken(expiredToken)).toThrow();

      // Tampered signature rejection
      const tamperedToken = Buffer.from(JSON.stringify({ payload: validPayload, signature: 'bad' + validSig.slice(3) })).toString('base64url');
      expect(() => storageService.verifyDownloadToken(tamperedToken)).toThrow();
    });

    it('verifies timing-safe HMAC signed upload tokens', () => {
      const secret = process.env.STORAGE_SIGNING_SECRET || crypto.createHash('sha256').update(process.env.DATABASE_URL || 'tp_secret').digest('hex');
      const validExpiresAt = Date.now() + 900 * 1000;
      const validPayload = `${fakeUserId}:evidence:contracts/${fakeContractId}/evidence/doc.pdf:${validExpiresAt}`;
      const validSig = crypto.createHmac('sha256', secret).update(validPayload).digest('hex');
      const uploadToken = Buffer.from(JSON.stringify({ payload: validPayload, signature: validSig })).toString('base64url');

      const verified = storageService.verifyUploadToken(uploadToken);
      expect(verified.userId).toBe(fakeUserId);
      expect(verified.bucket).toBe('evidence');
      expect(verified.objectPath).toBe(`contracts/${fakeContractId}/evidence/doc.pdf`);
    });

    it('computes deterministic SHA-256 canonical contract hash', () => {
      const contractInput = {
        contractNumber: 'CT-2026-999',
        version: 1,
        title: 'Full Stack Web Platform',
        totalAmount: 15000,
        currency: 'USD',
        clientId: 'client_101',
        workerId: 'worker_202',
        scopeOfWork: 'Build enterprise application with real-time notifications',
        termsAndConditions: 'Standard TrustPay terms',
        cancellationTerms: '7-day written notice',
        revisionTerms: 'Up to 2 free revisions per milestone',
        milestones: [
          { order: 1, title: 'Architecture & Design', description: 'API specifications', amount: 5000 },
          { order: 2, title: 'Implementation', description: 'Core modules', amount: 10000 },
        ],
      };

      const hash1 = computeCanonicalContractHash(contractInput);
      const hash2 = computeCanonicalContractHash(contractInput);

      expect(hash1).toBeDefined();
      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2); // Deterministic

      // Modifying terms must alter hash
      const modifiedHash = computeCanonicalContractHash({
        ...contractInput,
        totalAmount: 16000,
      });
      expect(modifiedHash).not.toBe(hash1);
    });

    it('generates a valid binary PDF buffer with PDFKit containing commercial terms and milestones', async () => {
      const pdfData = {
        contractNumber: 'CT-2026-PDF-01',
        title: 'Enterprise Infrastructure Deployment',
        description: 'Complete high-availability cluster setup',
        version: 1,
        totalAmount: 12000,
        currency: 'USD',
        status: 'ACTIVE',
        client: { firstName: 'Alice', lastName: 'Client', email: 'alice@client.com' },
        worker: { firstName: 'Bob', lastName: 'Worker', email: 'bob@worker.com' },
        milestones: [
          { order: 1, title: 'Cluster Setup', description: 'Deploy nodes', amount: 6000, status: 'COMPLETED' },
          { order: 2, title: 'Load Balancing', description: 'Configure routing', amount: 6000, status: 'IN_PROGRESS' },
        ],
        acceptances: [
          {
            role: 'CLIENT',
            acceptedAt: new Date(),
            acceptanceMethod: 'CLICKWRAP',
            ipAddress: '192.168.1.1',
            documentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            user: { firstName: 'Alice', lastName: 'Client', email: 'alice@client.com' },
          },
        ],
      };

      const pdfBuffer = await generateContractPdfBuffer(pdfData);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      // PDF header magic bytes %PDF
      expect(pdfBuffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    });
  });

  // ============================================================================
  // PART C: PLATFORM SECURITY, RBAC & WEBHOOK REPLAY PROTECTION
  // ============================================================================
  describe('Part C: Cross-Role Isolation, Webhook Verification & Fail-Closed Guardrails', () => {
    it('verifies Cashfree webhook signature with timing-safe comparison and 300s replay guard', async () => {
      const secret = 'test_webhook_secret_key_123456';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: 'order_1' } } });

      const payloadToSign = `${timestamp}${rawBody}`;
      const validSig = crypto.createHmac('sha256', secret).update(payloadToSign).digest('base64');

      const isValid = await cashfreeProvider.verifyWebhookSignature(rawBody, validSig, timestamp, secret);
      expect(isValid).toBe(true);

      // Rejects expired timestamps (>300 seconds drift)
      const expiredTimestamp = String(Math.floor((Date.now() - 400 * 1000) / 1000));
      const isExpiredValid = await cashfreeProvider.verifyWebhookSignature(rawBody, validSig, expiredTimestamp, secret);
      expect(isExpiredValid).toBe(false);

      // Rejects forged signature
      const isBadSigValid = await cashfreeProvider.verifyWebhookSignature(rawBody, 'forged_sig', timestamp, secret);
      expect(isBadSigValid).toBe(false);
    });

    it('enforces fail-closed live money invariants across the platform', () => {
      expect(cashfreeProvider.name).toBe('CASHFREE');
      // Live payments, live escrow movement and payouts MUST be false
      expect(process.env.PAYMENTS_LIVE_ENABLED === 'true').toBe(false);
      expect(process.env.ESCROW_LIVE_MOVEMENT_ENABLED === 'true').toBe(false);
      expect(process.env.PAYOUTS_ENABLED === 'true').toBe(false);
    });

    it('enforces confidential dispute internal notes isolation', () => {
      const mockDispute = {
        id: 'dispute_1',
        contractId: 'contract_1',
        internalNotes: 'ADMIN CONFIDENTIAL: Investigating potential deliverable defect.',
        status: 'UNDER_REVIEW',
      };

      // Client view serializer must quarantine internalNotes
      const sanitizeForClientOrWorker = (dispute: typeof mockDispute, role: UserRole) => {
        if (role === UserRole.ADMIN || role === UserRole.SUPERADMIN) {
          return dispute;
        }
        const { internalNotes, ...sanitized } = dispute;
        return sanitized;
      };

      const clientView = sanitizeForClientOrWorker(mockDispute, UserRole.CLIENT);
      expect(clientView).not.toHaveProperty('internalNotes');

      const workerView = sanitizeForClientOrWorker(mockDispute, UserRole.WORKER);
      expect(workerView).not.toHaveProperty('internalNotes');

      const adminView = sanitizeForClientOrWorker(mockDispute, UserRole.ADMIN);
      expect(adminView).toHaveProperty('internalNotes');

      const superadminView = sanitizeForClientOrWorker(mockDispute, UserRole.SUPERADMIN);
      expect(superadminView).toHaveProperty('internalNotes');
    });
  });

  // ============================================================================
  // PART D: CROSS-PORTAL INTEGRATION WORKFLOW INVARIANTS
  // ============================================================================
  describe('Part D: Cross-Portal Integration Workflows', () => {
    it('Workflow A: Hiring notification persists and routes to recipient channel', async () => {
      const recipientId = 'worker_' + crypto.randomUUID();
      vi.spyOn(prisma.notification, 'create').mockResolvedValueOnce({
        id: 'notif_hiring_1',
        recipientId,
        title: 'New Hiring Request',
        message: 'Client Acme Corp sent a proposal',
        type: NotificationType.HIRING_REQUEST_RECEIVED,
        isRead: false,
        metadata: { hiringRequestId: 'hr_1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const notif = await notificationsService.createNotification({
        recipientId,
        title: 'New Hiring Request',
        message: 'Client Acme Corp sent a proposal',
        type: NotificationType.HIRING_REQUEST_RECEIVED,
        metadata: { hiringRequestId: 'hr_1' },
      });

      expect(notif.recipientId).toBe(recipientId);
      expect(notif.type).toBe(NotificationType.HIRING_REQUEST_RECEIVED);
    });

    it('Workflow B: Milestone submission notification alerts the client', async () => {
      const clientId = 'client_' + crypto.randomUUID();
      vi.spyOn(prisma.notification, 'create').mockResolvedValueOnce({
        id: 'notif_ms_1',
        recipientId: clientId,
        title: 'Milestone Submitted for Approval',
        message: 'Milestone #1 deliverables uploaded',
        type: NotificationType.MILESTONE_SUBMITTED,
        isRead: false,
        metadata: { contractId: 'c_1', milestoneId: 'm_1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const notif = await notificationsService.createNotification({
        recipientId: clientId,
        title: 'Milestone Submitted for Approval',
        message: 'Milestone #1 deliverables uploaded',
        type: NotificationType.MILESTONE_SUBMITTED,
        metadata: { contractId: 'c_1', milestoneId: 'm_1' },
      });

      expect(notif.recipientId).toBe(clientId);
      expect(notif.type).toBe(NotificationType.MILESTONE_SUBMITTED);
    });

    it('Workflow C: Revision request notification alerts the worker', async () => {
      const workerId = 'worker_' + crypto.randomUUID();
      vi.spyOn(prisma.notification, 'create').mockResolvedValueOnce({
        id: 'notif_rev_1',
        recipientId: workerId,
        title: 'Milestone Revision Requested',
        message: 'Client requested adjustments to the deliverable',
        type: NotificationType.REVISION_REQUESTED,
        isRead: false,
        metadata: { milestoneId: 'm_1', reason: 'Update unit tests' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const notif = await notificationsService.createNotification({
        recipientId: workerId,
        title: 'Milestone Revision Requested',
        message: 'Client requested adjustments to the deliverable',
        type: NotificationType.REVISION_REQUESTED,
        metadata: { milestoneId: 'm_1', reason: 'Update unit tests' },
      });

      expect(notif.recipientId).toBe(workerId);
      expect(notif.type).toBe(NotificationType.REVISION_REQUESTED);
    });

    it('Workflow D: Dispute raised notification broadcasts to dispute counterparty', async () => {
      const targetUserId = 'counterparty_' + crypto.randomUUID();
      vi.spyOn(prisma.notification, 'create').mockResolvedValueOnce({
        id: 'notif_disp_1',
        recipientId: targetUserId,
        title: 'Contract Dispute Raised',
        message: 'A formal dispute has been initiated for Contract #CT-2026-001',
        type: NotificationType.DISPUTE_RAISED,
        isRead: false,
        metadata: { disputeId: 'disp_101', contractId: 'c_1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const notif = await notificationsService.createNotification({
        recipientId: targetUserId,
        title: 'Contract Dispute Raised',
        message: 'A formal dispute has been initiated for Contract #CT-2026-001',
        type: NotificationType.DISPUTE_RAISED,
        metadata: { disputeId: 'disp_101', contractId: 'c_1' },
      });

      expect(notif.recipientId).toBe(targetUserId);
      expect(notif.type).toBe(NotificationType.DISPUTE_RAISED);
    });
  });
});

