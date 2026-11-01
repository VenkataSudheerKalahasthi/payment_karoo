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
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const HiringRequestStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  WITHDRAWN: 'WITHDRAWN',
  NEGOTIATION: 'NEGOTIATION',
} as const;
export type HiringRequestStatus = (typeof HiringRequestStatus)[keyof typeof HiringRequestStatus];

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
