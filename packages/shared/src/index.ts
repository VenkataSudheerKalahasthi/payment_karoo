/**
 * TrustPay Enterprise v2.0 - Shared Types, Constants & Contracts
 */

export const APP_NAME = 'TrustPay Enterprise' as const;
export const API_VERSION = 'v1' as const;

// ==============================================================================
// 1. ENUMS & CONSTANTS
// ==============================================================================

export const UserRole = {
  CLIENT: 'CLIENT',
  WORKER: 'WORKER',
  ADMIN: 'ADMIN',
  SUPERADMIN: 'SUPERADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DEACTIVATED: 'DEACTIVATED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const WorkerAvailability = {
  AVAILABLE: 'AVAILABLE',
  BUSY: 'BUSY',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type WorkerAvailability = (typeof WorkerAvailability)[keyof typeof WorkerAvailability];

export const ContractStatus = {
  DRAFT: 'DRAFT',
  PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DISPUTED: 'DISPUTED',
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

export const MilestoneStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  IN_REVISION: 'IN_REVISION',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
} as const;
export type MilestoneStatus = (typeof MilestoneStatus)[keyof typeof MilestoneStatus];

export const SubmissionStatus = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export const RevisionStatus = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED',
} as const;
export type RevisionStatus = (typeof RevisionStatus)[keyof typeof RevisionStatus];

export const NotificationType = {
  CONTRACT_UPDATE: 'CONTRACT_UPDATE',
  MILESTONE_SUBMITTED: 'MILESTONE_SUBMITTED',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  SYSTEM_ALERT: 'SYSTEM_ALERT',
  HIRING_REQUEST_RECEIVED: 'HIRING_REQUEST_RECEIVED',
  HIRING_REQUEST_ACCEPTED: 'HIRING_REQUEST_ACCEPTED',
  HIRING_REQUEST_DECLINED: 'HIRING_REQUEST_DECLINED',
  HIRING_REQUEST_NEGOTIATION: 'HIRING_REQUEST_NEGOTIATION',
  CONTRACT_ACCEPTED: 'CONTRACT_ACCEPTED',
  DISPUTE_RAISED: 'DISPUTE_RAISED',
  DISPUTE_RESPONSE_SUBMITTED: 'DISPUTE_RESPONSE_SUBMITTED',
  DISPUTE_EVIDENCE_UPLOADED: 'DISPUTE_EVIDENCE_UPLOADED',
  DISPUTE_RESOLUTION_PROPOSED: 'DISPUTE_RESOLUTION_PROPOSED',
  DISPUTE_RESOLVED: 'DISPUTE_RESOLVED',
  AMENDMENT_PROPOSED: 'AMENDMENT_PROPOSED',
  AMENDMENT_ACCEPTED: 'AMENDMENT_ACCEPTED',
  AMENDMENT_REJECTED: 'AMENDMENT_REJECTED',
  TERMINATION_REQUESTED: 'TERMINATION_REQUESTED',
  TERMINATION_ACCEPTED: 'TERMINATION_ACCEPTED',
  TERMINATION_REJECTED: 'TERMINATION_REJECTED',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const DisputeCategory = {
  QUALITY_OF_WORK: 'QUALITY_OF_WORK',
  MISSED_DEADLINE: 'MISSED_DEADLINE',
  SCOPE_DISPUTE: 'SCOPE_DISPUTE',
  UNRESPONSIVE_PARTY: 'UNRESPONSIVE_PARTY',
  UNAUTHORIZED_MODIFICATION: 'UNAUTHORIZED_MODIFICATION',
  PAYMENT_ISSUE: 'PAYMENT_ISSUE',
  BREACH_OF_TERMS: 'BREACH_OF_TERMS',
  OTHER: 'OTHER',
} as const;
export type DisputeCategory = (typeof DisputeCategory)[keyof typeof DisputeCategory];

export const DisputeStatus = {
  OPEN: 'OPEN',
  EVIDENCE_REQUESTED: 'EVIDENCE_REQUESTED',
  EVIDENCE_SUBMITTED: 'EVIDENCE_SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESPONSE_REQUIRED: 'RESPONSE_REQUIRED',
  MEDIATION: 'MEDIATION',
  RESOLUTION_PROPOSED: 'RESOLUTION_PROPOSED',
  RESOLUTION_ACCEPTED: 'RESOLUTION_ACCEPTED',
  RESOLUTION_REJECTED: 'RESOLUTION_REJECTED',
  ESCALATED: 'ESCALATED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

export const DisputeResolutionType = {
  FULL_REFUND_TO_CLIENT: 'FULL_REFUND_TO_CLIENT',
  FULL_RELEASE_TO_WORKER: 'FULL_RELEASE_TO_WORKER',
  SPLIT_SETTLEMENT: 'SPLIT_SETTLEMENT',
  CANCEL_CONTRACT: 'CANCEL_CONTRACT',
  DISMISS_DISPUTE: 'DISMISS_DISPUTE',
} as const;
export type DisputeResolutionType = (typeof DisputeResolutionType)[keyof typeof DisputeResolutionType];

export const DisputeResolutionStatus = {
  PROPOSED: 'PROPOSED',
  ACCEPTED_BY_PARTIES: 'ACCEPTED_BY_PARTIES',
  REJECTED_BY_PARTY: 'REJECTED_BY_PARTY',
  ENFORCED_BY_ADMIN: 'ENFORCED_BY_ADMIN',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type DisputeResolutionStatus = (typeof DisputeResolutionStatus)[keyof typeof DisputeResolutionStatus];

export const AmendmentStatus = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type AmendmentStatus = (typeof AmendmentStatus)[keyof typeof AmendmentStatus];

export const TerminationStatus = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  RESOLVED: 'RESOLVED',
} as const;
export type TerminationStatus = (typeof TerminationStatus)[keyof typeof TerminationStatus];

export const EscrowOperationalState = {
  PAYMENT_VERIFIED_SANDBOX: 'PAYMENT_VERIFIED_SANDBOX',
  ALLOCATED: 'ALLOCATED',
  WORK_IN_PROGRESS: 'WORK_IN_PROGRESS',
  MILESTONE_SUBMITTED: 'MILESTONE_SUBMITTED',
  MILESTONE_UNDER_REVIEW: 'MILESTONE_UNDER_REVIEW',
  MILESTONE_APPROVED: 'MILESTONE_APPROVED',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  DISPUTED: 'DISPUTED',
  ON_HOLD: 'ON_HOLD',
  RELEASE_ELIGIBLE: 'RELEASE_ELIGIBLE',
  COMPLETED: 'COMPLETED',
  TERMINATED: 'TERMINATED',
} as const;
export type EscrowOperationalState = (typeof EscrowOperationalState)[keyof typeof EscrowOperationalState];

export const HiringRequestStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  WITHDRAWN: 'WITHDRAWN',
  NEGOTIATION: 'NEGOTIATION',
} as const;
export type HiringRequestStatus = (typeof HiringRequestStatus)[keyof typeof HiringRequestStatus];

export const LedgerAccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;
export type LedgerAccountType = (typeof LedgerAccountType)[keyof typeof LedgerAccountType];

export const LedgerAccountStatus = {
  ACTIVE: 'ACTIVE',
  FROZEN: 'FROZEN',
  CLOSED: 'CLOSED',
} as const;
export type LedgerAccountStatus = (typeof LedgerAccountStatus)[keyof typeof LedgerAccountStatus];

export const LedgerTransactionType = {
  ESCROW_DEPOSIT: 'ESCROW_DEPOSIT',
  ESCROW_RELEASE: 'ESCROW_RELEASE',
  ESCROW_REFUND: 'ESCROW_REFUND',
  PLATFORM_FEE: 'PLATFORM_FEE',
  ADJUSTMENT: 'ADJUSTMENT',
  REVERSAL: 'REVERSAL',
} as const;
export type LedgerTransactionType = (typeof LedgerTransactionType)[keyof typeof LedgerTransactionType];

export const LedgerTransactionStatus = {
  PENDING: 'PENDING',
  POSTED: 'POSTED',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
} as const;
export type LedgerTransactionStatus = (typeof LedgerTransactionStatus)[keyof typeof LedgerTransactionStatus];

export const LedgerEntryType = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType];

export const EscrowStatus = {
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  PENDING_FUNDING: 'PENDING_FUNDING',
  FUNDING_PROCESSING: 'FUNDING_PROCESSING',
  FUNDED: 'FUNDED',
  PARTIALLY_ALLOCATED: 'PARTIALLY_ALLOCATED',
  RELEASE_PENDING: 'RELEASE_PENDING',
  PARTIALLY_RELEASED: 'PARTIALLY_RELEASED',
  RELEASED: 'RELEASED',
  REFUND_PENDING: 'REFUND_PENDING',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUNDED: 'REFUNDED',
  DISPUTED: 'DISPUTED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type EscrowStatus = (typeof EscrowStatus)[keyof typeof EscrowStatus];

export const PaymentTransactionType = {
  ESCROW_FUNDING: 'ESCROW_FUNDING',
  MILESTONE_RELEASE: 'MILESTONE_RELEASE',
  REFUND: 'REFUND',
  PLATFORM_FEE: 'PLATFORM_FEE',
} as const;
export type PaymentTransactionType = (typeof PaymentTransactionType)[keyof typeof PaymentTransactionType];

export const PaymentTransactionStatus = {
  INITIATED: 'INITIATED',
  REQUIRES_ACTION: 'REQUIRES_ACTION',
  PROCESSING: 'PROCESSING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type PaymentTransactionStatus = (typeof PaymentTransactionStatus)[keyof typeof PaymentTransactionStatus];

// ==============================================================================
// 2. STANDARD API RESPONSE CONTRACT
// ==============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==============================================================================
// 3. SYSTEM & HEALTH CONTRACTS
// ==============================================================================

export interface SystemHealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
}

export interface DatabaseHealthStatus {
  status: 'connected' | 'disconnected' | 'error';
  database: string;
  latencyMs?: number;
  timestamp: string;
  error?: string;
}

export interface PlatformConfigInfo {
  name: string;
  version: string;
  apiVersion: string;
  environment: string;
}

// ==============================================================================
// 4. ENTITY DTO CONTRACTS
// ==============================================================================

export interface RoleDto {
  id: string;
  name: UserRole;
  description: string;
  permissions: string[];
}

export interface UserProfileDto {
  id: string;
  userId: string;
  bio?: string | null;
  phoneNumber?: string | null;
  companyName?: string | null;
  timezone?: string | null;
  avatarUrl?: string | null;
  address?: string | null;
  country?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillDto {
  id: string;
  name: string;
  category?: string | null;
}

export interface WorkerSkillDto {
  id: string;
  skillId: string;
  skillName: string;
  category?: string | null;
  yearsOfExperience: number;
}

export interface PortfolioItemDto {
  id: string;
  title: string;
  description: string;
  projectUrl?: string | null;
  attachmentUrl?: string | null;
  createdAt: string;
}

export interface WorkerProfileDto {
  id: string;
  userId: string;
  headline?: string | null;
  hourlyRate?: number | null;
  availability: WorkerAvailability;
  totalCompletedContracts: number;
  rating: number;
  skills: WorkerSkillDto[];
  portfolioItems: PortfolioItemDto[];
  user?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserDto {
  id: string;
  clerkId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  role: RoleDto;
  status: UserStatus;
  profile?: UserProfileDto | null;
  workerProfile?: WorkerProfileDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractMilestoneDto {
  id: string;
  contractId: string;
  title: string;
  description: string;
  amount: number;
  order: number;
  status: MilestoneStatus;
  dueDate?: string | null;
  submissionsCount?: number;
  submissions?: { id: string }[];
  createdAt: string;
}

export interface ContractAcceptanceDto {
  id: string;
  contractId: string;
  userId: string;
  version: number;
  role: UserRole;
  acceptanceMethod: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  documentHash?: string | null;
  acceptedAt: string;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
}

export interface ContractDto {
  id: string;
  contractNumber: string;
  title: string;
  description: string;
  clientId: string;
  workerId: string;
  client?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  worker?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  status: ContractStatus;
  version: number;
  totalAmount: number;
  currency: string;
  scopeOfWork?: string | null;
  termsAndConditions?: string | null;
  cancellationTerms?: string | null;
  revisionTerms?: string | null;
  documentHash?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  milestones?: ContractMilestoneDto[];
  acceptances?: ContractAcceptanceDto[];
  createdAt: string;
  updatedAt: string;
}

export interface HiringRequestDto {
  id: string;
  clientId: string;
  workerId: string;
  title: string;
  description: string;
  proposedBudget: number;
  currency: string;
  requiredSkills: string[];
  proposedStartDate?: string | null;
  expectedCompletionDate?: string | null;
  status: HiringRequestStatus;
  clientMessage?: string | null;
  workerResponse?: string | null;
  contractId?: string | null;
  respondedAt?: string | null;
  client?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    avatarUrl?: string | null;
  };
  worker?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    avatarUrl?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WorkerShortlistDto {
  id: string;
  clientId: string;
  workerProfileId: string;
  notes?: string | null;
  workerProfile?: WorkerProfileDto;
  createdAt: string;
}

export interface DashboardMetricsDto {
  role: UserRole;
  totalContracts: number;
  activeContracts: number;
  pendingHiringRequests: number;
  contractsAwaitingAcceptance: number;
  completedContracts: number;
  pendingMilestones: number;
  unreadNotifications: number;
  openDisputes?: number;
  revisionRequests?: number;
  recentActivities: {
    id: string;
    title: string;
    description: string;
    timestamp: string;
    type: string;
  }[];
}

export interface MilestoneSubmissionDto {
  id: string;
  milestoneId: string;
  workerId: string;
  notes: string;
  attachmentUrls: string[];
  status: SubmissionStatus;
  submittedAt: string;
  worker?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  revisionsCount?: number;
}

export interface RevisionRequestDto {
  id: string;
  submissionId: string;
  requestedById: string;
  reason: string;
  status: RevisionStatus;
  requestedBy?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
}

// ==============================================================================
// 5. REQUEST CONTRACTS
// ==============================================================================

export interface AuthSyncRequest {
  role?: 'CLIENT' | 'WORKER'; // Public self-registration only permits CLIENT or WORKER
}

export interface UpdateUserProfileRequest {
  bio?: string;
  phoneNumber?: string;
  companyName?: string;
  timezone?: string;
  country?: string;
  address?: string;
}

export interface UpdateWorkerProfileRequest {
  headline?: string;
  hourlyRate?: number;
  availability?: WorkerAvailability;
}

export interface CreateContractRequest {
  workerId: string;
  title: string;
  description: string;
  currency?: string;
  scopeOfWork?: string;
  termsAndConditions?: string;
  cancellationTerms?: string;
  revisionTerms?: string;
  startDate?: string;
  endDate?: string;
  milestones: {
    title: string;
    description: string;
    amount: number;
    order?: number;
    dueDate?: string;
  }[];
}

export interface AcceptContractRequest {
  acceptanceMethod?: string;
  expectedVersion?: number;
}

export interface AmendContractRequest {
  expectedVersion: number;
  title?: string;
  description?: string;
  scopeOfWork?: string;
  termsAndConditions?: string;
  cancellationTerms?: string;
  revisionTerms?: string;
  milestones?: {
    title: string;
    description: string;
    amount: number;
    order?: number;
    dueDate?: string;
  }[];
}

export interface CreateHiringRequestRequest {
  workerId: string;
  title: string;
  description: string;
  proposedBudget: number;
  currency?: string;
  requiredSkills?: string[];
  proposedStartDate?: string;
  expectedCompletionDate?: string;
  clientMessage?: string;
}

export interface RespondHiringRequestRequest {
  status: 'ACCEPTED' | 'DECLINED' | 'NEGOTIATION';
  workerResponse?: string;
}

export interface CreateShortlistRequest {
  workerProfileId: string;
  notes?: string;
}

export interface AddWorkerSkillRequest {
  skillId: string;
  yearsOfExperience: number;
}

export interface CreatePortfolioItemRequest {
  title: string;
  description: string;
  projectUrl?: string;
  attachmentUrl?: string;
}

export interface UpdatePortfolioItemRequest {
  title?: string;
  description?: string;
  projectUrl?: string;
  attachmentUrl?: string;
}

export interface CreateMilestoneSubmissionRequest {
  notes: string;
  attachmentUrls?: string[];
}

export interface CreateRevisionRequest {
  submissionId: string;
  reason: string;
}

// ==============================================================================
// 5.5 FINANCIAL & ESCROW FOUNDATION DTOs (Phase 4)
// ==============================================================================

export interface EscrowMilestoneAllocationDto {
  id: string;
  escrowRecordId: string;
  milestoneId: string;
  allocatedAmountMinor: number | string;
  releasedAmountMinor: number | string;
  refundedAmountMinor: number | string;
  isReleased: boolean;
  releasedAt?: string | null;
  milestoneTitle?: string;
  milestoneOrder?: number;
}

export interface EscrowRecordDto {
  id: string;
  contractId: string;
  status: EscrowStatus;
  operationalState?: EscrowOperationalState;
  currency: string;
  contractualAmountMinor: number | string;
  expectedFundedAmountMinor: number | string;
  fundedAmountMinor: number | string;
  allocatedAmountMinor: number | string;
  releasedAmountMinor: number | string;
  refundedAmountMinor: number | string;
  remainingBalanceMinor: number | string;
  disputeHold: boolean;
  contractNumber?: string;
  contractTitle?: string;
  milestoneAllocations?: EscrowMilestoneAllocationDto[];
  createdAt: string;
  updatedAt: string;
}

export interface LedgerAccountDto {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: LedgerAccountType;
  currency: string;
  status: LedgerAccountStatus;
  ownerUserId?: string | null;
  ownerName?: string;
  currentBalanceMinor: number | string;
  createdAt: string;
}

export interface LedgerEntryDto {
  id: string;
  ledgerTransactionId: string;
  ledgerAccountId: string;
  accountCode?: string;
  accountName?: string;
  entryType: LedgerEntryType;
  amountMinor: number | string;
  currency: string;
  createdAt: string;
}

export interface LedgerTransactionDto {
  id: string;
  transactionReference: string;
  transactionType: LedgerTransactionType;
  status: LedgerTransactionStatus;
  currency: string;
  description: string;
  sourceType: string;
  sourceId?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown> | null;
  postedAt?: string | null;
  entries?: LedgerEntryDto[];
  createdAt: string;
}

export interface TrialBalanceReportDto {
  currency: string;
  generatedAt: string;
  isBalanced: boolean;
  totalDebitsMinor: number | string;
  totalCreditsMinor: number | string;
  items: Array<{
    accountCode: string;
    accountName: string;
    accountType: LedgerAccountType;
    debitTotalMinor: number | string;
    creditTotalMinor: number | string;
    netBalanceMinor: number | string;
  }>;
}

export interface PaymentTransactionDto {
  id: string;
  transactionReference: string;
  escrowRecordId?: string | null;
  contractId: string;
  payerId: string;
  payeeId?: string | null;
  type: PaymentTransactionType;
  status: PaymentTransactionStatus;
  amountMinor: number | string;
  currency: string;
  provider?: string | null;
  providerTransactionId?: string | null;
  failureReason?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown> | null;
  payerName?: string;
  payeeName?: string;
  contractNumber?: string;
  createdAt: string;
}

export interface PlatformFinancialConfigDto {
  id: string;
  platformFeePercentage: number;
  fixedFeeMinor: number | string;
  supportedCurrencies: string[];
  activeProvider: string;
  isLiveMoneyDisabled: boolean;
  updatedAt: string;
}

export interface FinancialOverviewDto {
  isLiveMoneyDisabled: boolean;
  activeProvider: string;
  totalContractsCount: number;
  fundedEscrowsCount: number;
  pendingEscrowsCount: number;
  disputedEscrowsCount: number;
  totalContractualAgreedMinor: number | string;
  totalFundedInEscrowMinor: number | string;
  totalReleasedToWorkersMinor: number | string;
  totalRefundedToClientsMinor: number | string;
  systemTrialBalanceBalanced: boolean;
}

// ==============================================================================
// 6. STORAGE & DOCUMENT ACCESS DTOs
// ==============================================================================

export type StorageBucket = 'evidence' | 'agreement-attachments' | 'invoices';

export interface GenerateUploadUrlRequest {
  bucket: StorageBucket;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  contractId: string;
  milestoneId?: string;
}

export interface GenerateUploadUrlResponse {
  uploadToken: string;
  objectPath: string;
  bucket: StorageBucket;
  expiresIn: number;
  maxBytes: number;
}

export interface GenerateDownloadUrlResponse {
  downloadUrl: string;
  expiresIn: number;
  fileName: string;
}

// ==============================================================================
// 7. FINANCIAL UNIT CONVERSION UTILITIES
// ==============================================================================

/**
 * Converts a major currency unit (e.g. 100.50 USD) into an integer minor unit (10050 cents).
 */
export function majorToMinor(amount: number, currency = 'USD'): bigint {
  const cleanCurr = currency.toUpperCase();
  if (['JPY', 'KRW', 'VND', 'CLP'].includes(cleanCurr)) {
    return BigInt(Math.round(amount));
  }
  if (['BHD', 'KWD', 'OMR', 'JOD'].includes(cleanCurr)) {
    return BigInt(Math.round(amount * 1000));
  }
  return BigInt(Math.round(amount * 100));
}

/**
 * Converts integer minor unit (e.g. 10050 cents) into a major currency unit (100.50 USD).
 */
export function minorToMajor(amountMinor: bigint | number | string, currency = 'USD'): number {
  const num = typeof amountMinor === 'bigint' ? Number(amountMinor) : Number(amountMinor || 0);
  const cleanCurr = currency.toUpperCase();
  if (['JPY', 'KRW', 'VND', 'CLP'].includes(cleanCurr)) {
    return num;
  }
  if (['BHD', 'KWD', 'OMR', 'JOD'].includes(cleanCurr)) {
    return num / 1000;
  }
  return num / 100;
}

/**
 * Formats minor currency units into a locale-aware display string (e.g. "$100.50").
 */
export function formatCurrencyMinor(amountMinor: bigint | number | string, currency = 'USD'): string {
  const major = minorToMajor(amountMinor, currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}

// ==============================================================================
// 8. ADVANCED ESCROW, DISPUTES & CONTRACT LIFECYCLE DTOs (Phase 6)
// ==============================================================================

export interface DisputeEvidenceDto {
  id: string;
  disputeId: string;
  uploadedById: string;
  uploaderName?: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | string | null;
  description?: string | null;
  downloadUrl?: string;
  createdAt: string;
}

export interface DisputeResponseDto {
  id: string;
  disputeId: string;
  authorId: string;
  authorName?: string;
  authorRole?: string;
  content: string;
  createdAt: string;
}

export interface DisputeResolutionDto {
  id: string;
  disputeId: string;
  proposedById: string;
  proposerName?: string;
  resolutionType: DisputeResolutionType;
  status: DisputeResolutionStatus;
  clientAmountMinor: number | string;
  workerAmountMinor: number | string;
  rationale: string;
  clientAgreed?: boolean | null;
  clientAgreedAt?: string | null;
  workerAgreed?: boolean | null;
  workerAgreedAt?: string | null;
  enforcedByAdminId?: string | null;
  enforcedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeInternalNoteDto {
  id: string;
  disputeId: string;
  authorId: string;
  authorName?: string;
  note: string;
  createdAt: string;
}

export interface DisputeDto {
  id: string;
  disputeNumber: string;
  contractId: string;
  contractNumber?: string;
  contractTitle?: string;
  milestoneId?: string | null;
  milestoneTitle?: string | null;
  initiatorId: string;
  initiatorName?: string;
  initiatorEmail?: string;
  initiatorRole?: string;
  respondentId: string;
  respondentName?: string;
  respondentEmail?: string;
  respondentRole?: string;
  category: DisputeCategory;
  status: DisputeStatus;
  title: string;
  description: string;
  claimedAmountMinor?: number | string | null;
  disputeHoldActive: boolean;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  responsesCount?: number;
  evidenceCount?: number;
  resolutionsCount?: number;
}

export interface DisputeDetailDto extends DisputeDto {
  responses: DisputeResponseDto[];
  evidence: DisputeEvidenceDto[];
  resolutions: DisputeResolutionDto[];
  internalNotes?: DisputeInternalNoteDto[];
}

export interface CreateDisputeRequest {
  contractId: string;
  milestoneId?: string;
  category: DisputeCategory;
  title: string;
  description: string;
  claimedAmountMinor?: number | string;
  evidence?: Array<{
    fileName: string;
    fileKey: string;
    fileUrl: string;
    mimeType?: string;
    fileSize?: number;
    description?: string;
  }>;
}

export interface SubmitDisputeResponseRequest {
  content: string;
}

export interface ProposeDisputeResolutionRequest {
  resolutionType: DisputeResolutionType;
  clientAmountMinor: number | string;
  workerAmountMinor: number | string;
  rationale: string;
}

export interface RespondToResolutionRequest {
  agree: boolean;
}

export interface AddDisputeNoteRequest {
  note: string;
}

export interface DisputeMetricsDto {
  totalDisputes: number;
  openDisputes: number;
  underReviewDisputes: number;
  escalatedDisputes: number;
  resolvedDisputes: number;
  closedDisputes: number;
  resolutionRatePercentage: number;
  totalClaimedMinor: number | string;
  activeDisputeHoldCount: number;
}

export interface ContractAmendmentDto {
  id: string;
  amendmentNumber: string;
  contractId: string;
  contractNumber?: string;
  proposedById: string;
  proposerName?: string;
  status: AmendmentStatus;
  proposedVersion: number;
  titleChange?: string | null;
  descriptionChange?: string | null;
  scopeChange?: string | null;
  amountChangeMinor?: number | string | null;
  termsChange?: string | null;
  milestonesSnapshot?: unknown | null;
  reason: string;
  clientAcceptedAt?: string | null;
  workerAcceptedAt?: string | null;
  previousDocumentHash?: string | null;
  updatedDocumentHash?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposeAmendmentRequest {
  titleChange?: string;
  descriptionChange?: string;
  scopeChange?: string;
  amountChangeMinor?: number | string;
  termsChange?: string;
  milestonesSnapshot?: unknown;
  reason: string;
}

export interface RespondToAmendmentRequest {
  accept: boolean;
  reason?: string;
}

export interface ContractTerminationRequestDto {
  id: string;
  contractId: string;
  contractNumber?: string;
  initiatedById: string;
  initiatorName?: string;
  initiatorRole?: string;
  status: TerminationStatus;
  reason: string;
  proposedSettlementMinor?: number | string | null;
  settlementTerms?: string | null;
  respondedById?: string | null;
  responseReason?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposeTerminationRequest {
  reason: string;
  proposedSettlementMinor?: number | string;
  settlementTerms?: string;
}

export interface RespondToTerminationRequest {
  accept: boolean;
  responseReason?: string;
}

export interface EscrowActivityDto {
  id: string;
  escrowRecordId: string;
  contractId?: string;
  milestoneId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  operationalState: EscrowOperationalState;
  previousState?: EscrowOperationalState | null;
  eventType: string;
  description: string;
  metadata?: Record<string, unknown> | null;
  isLiveFinancialMovement: boolean;
  createdAt: string;
}
