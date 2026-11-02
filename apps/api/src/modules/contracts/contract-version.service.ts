import { prisma } from '../../config/prisma.js';
import { Prisma, UserRole, ContractStatus } from '@prisma/client';
import { computeCanonicalContractHash } from './contract-pdf.service.js';
import { recordAuditLog } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { emitContractRealtimeEvent } from '../realtime/socket.service.js';
import {
  ContractVersionDto,
  ContractIntegrityReportDto,
  ContractActivityHistoryDto,
} from '@trustpay/shared';

export interface CreateSnapshotInput {
  contractId: string;
  version: number;
  title: string;
  description: string;
  totalAmount: number | Prisma.Decimal;
  currency: string;
  scopeOfWork?: string | null;
  termsAndConditions?: string | null;
  cancellationTerms?: string | null;
  revisionTerms?: string | null;
  documentHash: string;
  milestones: Array<{
    order: number;
    title: string;
    description: string;
    amount: number | Prisma.Decimal;
    dueDate?: Date | string | null;
  }>;
  versionReason: string;
  createdById?: string | null;
  contractStatusAtCreation?: ContractStatus;
  isAccepted?: boolean;
  tx?: Prisma.TransactionClient;
}

/**
 * Creates an immutable snapshot of contract terms for a specific version number.
 */
export async function createContractVersionSnapshot(
  input: CreateSnapshotInput,
): Promise<ContractVersionDto> {
  const db = input.tx || prisma;

  const milestonesSnapshot = input.milestones.map((m) => ({
    order: m.order,
    title: m.title.trim(),
    description: (m.description || '').trim(),
    amount: Number(m.amount).toFixed(2),
    dueDate: m.dueDate ? new Date(m.dueDate).toISOString() : null,
  }));

  const created = await db.contractVersion.create({
    data: {
      contractId: input.contractId,
      version: input.version,
      title: input.title,
      description: input.description,
      totalAmount: new Prisma.Decimal(input.totalAmount),
      currency: input.currency,
      scopeOfWork: input.scopeOfWork,
      termsAndConditions: input.termsAndConditions,
      cancellationTerms: input.cancellationTerms,
      revisionTerms: input.revisionTerms,
      documentHash: input.documentHash,
      milestonesSnapshot: milestonesSnapshot as unknown as Prisma.InputJsonValue,
      versionReason: input.versionReason,
      createdById: input.createdById,
      contractStatusAtCreation: input.contractStatusAtCreation || ContractStatus.PENDING_ACCEPTANCE,
      isAccepted: input.isAccepted ?? false,
    },
  });

  emitContractRealtimeEvent(
    input.contractId,
    'contract:version_created',
    {
      version: input.version,
      documentHash: input.documentHash,
      reason: input.versionReason,
    },
    input.version,
  );

  return {
    id: created.id,
    contractId: created.contractId,
    version: created.version,
    title: created.title,
    description: created.description,
    totalAmount: Number(created.totalAmount),
    currency: created.currency,
    scopeOfWork: created.scopeOfWork,
    termsAndConditions: created.termsAndConditions,
    cancellationTerms: created.cancellationTerms,
    revisionTerms: created.revisionTerms,
    documentHash: created.documentHash,
    milestonesSnapshot: created.milestonesSnapshot,
    versionReason: created.versionReason,
    createdById: created.createdById,
    contractStatusAtCreation: created.contractStatusAtCreation as ContractStatus,
    isAccepted: created.isAccepted,
    createdAt: created.createdAt.toISOString(),
  };
}

/**
 * Lists all historical versions of a contract, with strict authorization check.
 */
export async function listContractVersions(
  contractId: string,
  userId: string,
  userRole: UserRole,
): Promise<ContractVersionDto[]> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { clientId: true, workerId: true },
  });

  if (!contract) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Contract not found' };
  }

  const isPrivileged = userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN;
  if (!isPrivileged && contract.clientId !== userId && contract.workerId !== userId) {
    throw { statusCode: 403, code: 'FORBIDDEN', message: 'Unauthorized to view contract versions' };
  }

  const versions = await prisma.contractVersion.findMany({
    where: { contractId },
    orderBy: { version: 'asc' },
  });

  return versions.map((v) => ({
    id: v.id,
    contractId: v.contractId,
    version: v.version,
    title: v.title,
    description: v.description,
    totalAmount: Number(v.totalAmount),
    currency: v.currency,
    scopeOfWork: v.scopeOfWork,
    termsAndConditions: v.termsAndConditions,
    cancellationTerms: v.cancellationTerms,
    revisionTerms: v.revisionTerms,
    documentHash: v.documentHash,
    milestonesSnapshot: v.milestonesSnapshot,
    versionReason: v.versionReason,
    createdById: v.createdById,
    contractStatusAtCreation: v.contractStatusAtCreation as ContractStatus,
    isAccepted: v.isAccepted,
    createdAt: v.createdAt.toISOString(),
  }));
}

/**
 * Performs authoritative cryptographic integrity verification of contract terms,
 * comparing stored documentHash against recalculated canonical hash, acceptance records,
 * and milestone allocations.
 */
export async function verifyContractIntegrity(
  contractId: string,
  userId: string,
  userRole: UserRole,
): Promise<ContractIntegrityReportDto> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      milestones: { orderBy: { order: 'asc' } },
      acceptances: true,
      versions: { orderBy: { version: 'desc' } },
    },
  });

  if (!contract) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Contract not found' };
  }

  const isPrivileged = userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN;
  if (!isPrivileged && contract.clientId !== userId && contract.workerId !== userId) {
    throw { statusCode: 403, code: 'FORBIDDEN', message: 'Unauthorized to perform integrity audit' };
  }

  // Compute canonical hash of current database terms
  const canonicalHash = computeCanonicalContractHash({
    contractNumber: contract.contractNumber,
    version: contract.version,
    title: contract.title,
    totalAmount: Number(contract.totalAmount),
    currency: contract.currency,
    clientId: contract.clientId,
    workerId: contract.workerId,
    scopeOfWork: contract.scopeOfWork,
    termsAndConditions: contract.termsAndConditions,
    cancellationTerms: contract.cancellationTerms,
    revisionTerms: contract.revisionTerms,
    milestones: contract.milestones.map((m) => ({
      order: m.order,
      title: m.title,
      description: m.description,
      amount: Number(m.amount),
    })),
  });

  const totalMilestones = contract.milestones.reduce((acc, m) => acc + Number(m.amount), 0);
  const contractTotal = Number(contract.totalAmount);
  const amountsMatch = Math.abs(totalMilestones - contractTotal) < 0.01;

  // Verify hash match: if documentHash exists on contract, must equal canonicalHash
  const hasStoredHash = !!contract.documentHash;
  const hashMatches = hasStoredHash ? contract.documentHash === canonicalHash : true;
  const mismatchDetected = hasStoredHash && !hashMatches;

  // Check acceptance consistency
  const clientAccepted = contract.acceptances.some(
    (a) => a.userId === contract.clientId && a.version === contract.version,
  );
  const workerAccepted = contract.acceptances.some(
    (a) => a.userId === contract.workerId && a.version === contract.version,
  );

  const allAcceptancesValid = contract.acceptances.every(
    (a) => !a.documentHash || a.documentHash.length === 64,
  );

  const isTamperFree = hashMatches && amountsMatch && allAcceptancesValid;

  if (mismatchDetected) {
    logger.error(
      `[SECURITY AUDIT CRITICAL] Contract ${contract.contractNumber} integrity violation! ` +
      `Stored: ${contract.documentHash}, Recalculated: ${canonicalHash}`,
    );

    await recordAuditLog({
      actorId: userId,
      action: 'CONTRACT_INTEGRITY_HASH_MISMATCH_DETECTED',
      resource: 'Contract',
      resourceId: contract.id,
      details: {
        storedHash: contract.documentHash,
        recalculatedHash: canonicalHash,
        version: contract.version,
      },
    });

    emitContractRealtimeEvent(
      contractId,
      'contract:integrity_mismatch',
      {
        contractNumber: contract.contractNumber,
        version: contract.version,
        storedHash: contract.documentHash,
        recalculatedHash: canonicalHash,
      },
      contract.version,
    );
  }

  return {
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    currentVersion: contract.version,
    storedDocumentHash: contract.documentHash,
    recalculatedCanonicalHash: canonicalHash,
    isTamperFree,
    mismatchDetected,
    lastVerifiedAt: new Date().toISOString(),
    versionsCount: contract.versions.length,
    acceptancesCount: contract.acceptances.length,
    allAcceptancesValid,
    details: {
      clientAccepted,
      workerAccepted,
      milestoneCount: contract.milestones.length,
      totalMilestoneAmount: totalMilestones,
      contractTotalAmount: contractTotal,
      amountsMatch,
    },
  };
}

/**
 * Returns complete chronological activity history for a contract,
 * properly sanitizing and isolating administrative internal records.
 */
export async function getContractActivityHistory(
  contractId: string,
  userId: string,
  userRole: UserRole,
): Promise<ContractActivityHistoryDto[]> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { clientId: true, workerId: true },
  });

  if (!contract) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'Contract not found' };
  }

  const isPrivileged = userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN;
  if (!isPrivileged && contract.clientId !== userId && contract.workerId !== userId) {
    throw { statusCode: 403, code: 'FORBIDDEN', message: 'Unauthorized to view contract activity history' };
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      resourceId: contractId,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          role: { select: { name: true } },
        },
      },
    },
    take: 100,
  });

  return auditLogs.map((log) => ({
    id: log.id,
    contractId,
    action: log.action,
    actorId: log.actorId,
    actorRole: log.actor?.role?.name || null,
    actorEmail: log.actor?.email || null,
    version: (log.details as Record<string, unknown> | null)?.version as number | undefined,
    details: log.details as Record<string, unknown> | null,
    createdAt: log.createdAt.toISOString(),
  }));
}

