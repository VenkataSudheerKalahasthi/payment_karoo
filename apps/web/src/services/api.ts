import axios from 'axios';
import {
  ApiResponse,
  SystemHealthStatus,
  DatabaseHealthStatus,
  UserDto,
  ContractDto,
  ContractVersionDto,
  ContractIntegrityReportDto,
  ContractActivityHistoryDto,
  WorkerProfileDto,
  NotificationDto,
  HiringRequestDto,
  WorkerShortlistDto,
  DashboardMetricsDto,
  SkillDto,
  CreateContractRequest,
  UpdateUserProfileRequest,
  UpdateWorkerProfileRequest,
  CreateMilestoneSubmissionRequest,
  CreateRevisionRequest,
  CreateHiringRequestRequest,
  RespondHiringRequestRequest,
  CounterofferHiringRequestRequest,
  CreateShortlistRequest,
  AddWorkerSkillRequest,
  CreatePortfolioItemRequest,
  AcceptContractRequest,
  AmendContractRequest,
  EscrowRecordDto,
  GenerateUploadUrlRequest,
  GenerateUploadUrlResponse,
  GenerateDownloadUrlResponse,
  DisputeDto,
  DisputeDetailDto,
  ClientWalletDto,
  SpecialistWalletDto,
  SettleMilestoneResultDto,
  ProcessRefundResultDto,
  PaymentTransactionDto,
  CreateDisputeRequest,
  ProposeDisputeResolutionRequest,
  ContractAmendmentDto,
  ProposeAmendmentRequest,
  RespondToAmendmentRequest,
  ContractTerminationRequestDto,
  ProposeTerminationRequest,
  RespondToTerminationRequest,
  EscrowActivityDto,
  ProjectDto,
  MilestoneActivityDto,
  ProjectProgressSummaryDto,
  CreateProjectRequest,
  InvoiceDto,
  ProjectOpportunityDto,
  SubmitOpportunityProposalRequest,
  ClientStampDto,
  ClientStampPreviewDto,
  ApplyClientStampRequest,
} from '@trustpay/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

let tokenGetter: (() => Promise<string | null>) | null = null;

export const setAuthTokenGetter = (getter: () => Promise<string | null>) => {
  tokenGetter = getter;
};

apiClient.interceptors.request.use(async (config) => {
  if (config.headers?.Authorization) {
    return config;
  }
  if (tokenGetter) {
    try {
      const token = await tokenGetter();
      if (token) {
        if (typeof config.headers?.set === 'function') {
          config.headers.set('Authorization', `Bearer ${token}`);
        }
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Pass through without token if unavailable
    }
  }
  return config;
});

export const apiService = {
  // System Health
  checkHealth: async (): Promise<ApiResponse<SystemHealthStatus>> => {
    const res = await apiClient.get<ApiResponse<SystemHealthStatus>>('/health');
    return res.data;
  },

  checkDatabase: async (): Promise<ApiResponse<DatabaseHealthStatus>> => {
    try {
      const res = await apiClient.get<ApiResponse<DatabaseHealthStatus>>('/health/database');
      return res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        return err.response.data as ApiResponse<DatabaseHealthStatus>;
      }
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Failed to connect to API',
        },
        timestamp: new Date().toISOString(),
      };
    }
  },

  // Authentication & Synchronization
  syncUser: async (
    data: {
      role?: 'CLIENT' | 'WORKER';
      email?: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
    },
    token?: string,
  ): Promise<ApiResponse<UserDto>> => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await apiClient.post<ApiResponse<UserDto>>('/auth/sync', data, { headers });
      return res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        return err.response.data as ApiResponse<UserDto>;
      }
      return {
        success: false,
        error: {
          code: 'SYNC_ERROR',
          message: err instanceof Error ? err.message : 'Failed to synchronize account credentials',
        },
        timestamp: new Date().toISOString(),
      };
    }
  },

  syncUserWithRole: async (role: 'CLIENT' | 'WORKER', token?: string): Promise<ApiResponse<UserDto>> => {
    return apiService.syncUser({ role }, token);
  },

  getCurrentUser: async (token?: string): Promise<ApiResponse<UserDto>> => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await apiClient.get<ApiResponse<UserDto>>('/auth/me', { headers });
      return res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        return err.response.data as ApiResponse<UserDto>;
      }
      return {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: err instanceof Error ? err.message : 'User session verification failed',
        },
        timestamp: new Date().toISOString(),
      };
    }
  },

  logout: async (): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.post<ApiResponse<{ message: string }>>('/auth/logout');
    return res.data;
  },

  // Dashboard Live Metrics
  getDashboardMetrics: async (): Promise<ApiResponse<DashboardMetricsDto>> => {
    const res = await apiClient.get<ApiResponse<DashboardMetricsDto>>('/dashboard/metrics');
    return res.data;
  },

  // Profile Management
  updateProfile: async (data: UpdateUserProfileRequest): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.put<ApiResponse<unknown>>('/profiles/me', data);
    return res.data;
  },

  getPublicProfile: async (userId: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.get<ApiResponse<unknown>>(`/profiles/${userId}`);
    return res.data;
  },

  // Worker Management & Marketplace
  listWorkers: async (params?: Record<string, unknown>): Promise<ApiResponse<{ items: WorkerProfileDto[]; total: number; totalPages: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: WorkerProfileDto[]; total: number; totalPages: number }>>('/workers', { params });
    return res.data;
  },

  getWorker: async (id: string): Promise<ApiResponse<WorkerProfileDto>> => {
    const res = await apiClient.get<ApiResponse<WorkerProfileDto>>(`/workers/${id}`);
    return res.data;
  },

  getWorkerProfileMe: async (): Promise<ApiResponse<WorkerProfileDto>> => {
    const res = await apiClient.get<ApiResponse<WorkerProfileDto>>('/workers/me');
    return res.data;
  },

  updateWorkerProfile: async (data: UpdateWorkerProfileRequest): Promise<ApiResponse<WorkerProfileDto>> => {
    const res = await apiClient.put<ApiResponse<WorkerProfileDto>>('/workers/me/profile', data);
    return res.data;
  },

  updateWorkerProfileMe: async (data: UpdateWorkerProfileRequest): Promise<ApiResponse<WorkerProfileDto>> => {
    const res = await apiClient.put<ApiResponse<WorkerProfileDto>>('/workers/me/profile', data);
    return res.data;
  },

  addWorkerSkill: async (data: AddWorkerSkillRequest): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>('/workers/me/skills', data);
    return res.data;
  },

  removeWorkerSkill: async (skillId: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.delete<ApiResponse<unknown>>(`/workers/me/skills/${skillId}`);
    return res.data;
  },

  createPortfolioItem: async (data: CreatePortfolioItemRequest): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>('/workers/me/portfolio', data);
    return res.data;
  },

  updatePortfolioItem: async (id: string, data: Partial<CreatePortfolioItemRequest>): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.put<ApiResponse<unknown>>(`/workers/me/portfolio/${id}`, data);
    return res.data;
  },

  deletePortfolioItem: async (id: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.delete<ApiResponse<unknown>>(`/workers/me/portfolio/${id}`);
    return res.data;
  },

  // Skills Taxonomy
  listSkills: async (): Promise<ApiResponse<SkillDto[]>> => {
    const res = await apiClient.get<ApiResponse<SkillDto[]>>('/skills');
    return res.data;
  },

  // Shortlists
  listShortlists: async (): Promise<ApiResponse<WorkerShortlistDto[]>> => {
    const res = await apiClient.get<ApiResponse<WorkerShortlistDto[]>>('/shortlists');
    return res.data;
  },

  addToShortlist: async (data: CreateShortlistRequest): Promise<ApiResponse<WorkerShortlistDto>> => {
    const res = await apiClient.post<ApiResponse<WorkerShortlistDto>>('/shortlists', data);
    return res.data;
  },

  removeFromShortlist: async (workerProfileId: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.delete<ApiResponse<unknown>>(`/shortlists/${workerProfileId}`);
    return res.data;
  },

  // Hiring Requests
  createHiringRequest: async (data: CreateHiringRequestRequest): Promise<ApiResponse<HiringRequestDto>> => {
    const res = await apiClient.post<ApiResponse<HiringRequestDto>>('/hiring-requests', data);
    return res.data;
  },

  listHiringRequests: async (params?: Record<string, unknown>): Promise<ApiResponse<{ items: HiringRequestDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: HiringRequestDto[]; total: number }>>('/hiring-requests', { params });
    return res.data;
  },

  getHiringRequest: async (id: string): Promise<ApiResponse<HiringRequestDto>> => {
    const res = await apiClient.get<ApiResponse<HiringRequestDto>>(`/hiring-requests/${id}`);
    return res.data;
  },

  respondHiringRequest: async (id: string, data: RespondHiringRequestRequest): Promise<ApiResponse<HiringRequestDto>> => {
    const res = await apiClient.patch<ApiResponse<HiringRequestDto>>(`/hiring-requests/${id}/respond`, data);
    return res.data;
  },

  withdrawHiringRequest: async (id: string): Promise<ApiResponse<HiringRequestDto>> => {
    const res = await apiClient.patch<ApiResponse<HiringRequestDto>>(`/hiring-requests/${id}/withdraw`);
    return res.data;
  },

  counterofferHiringRequest: async (
    id: string,
    data: CounterofferHiringRequestRequest,
  ): Promise<ApiResponse<HiringRequestDto>> => {
    const res = await apiClient.patch<ApiResponse<HiringRequestDto>>(
      `/hiring-requests/${id}/counteroffer`,
      data,
    );
    return res.data;
  },

  convertHiringRequestToContract: async (id: string): Promise<ApiResponse<ContractDto>> => {
    const res = await apiClient.post<ApiResponse<ContractDto>>(`/hiring-requests/${id}/convert-to-contract`);
    return res.data;
  },

  // Contract Management
  createContract: async (data: CreateContractRequest): Promise<ApiResponse<ContractDto>> => {
    const res = await apiClient.post<ApiResponse<ContractDto>>('/contracts', data);
    return res.data;
  },

  listContracts: async (): Promise<ApiResponse<ContractDto[]>> => {
    const res = await apiClient.get<ApiResponse<ContractDto[]>>('/contracts');
    return res.data;
  },

  getContract: async (id: string): Promise<ApiResponse<ContractDto>> => {
    const res = await apiClient.get<ApiResponse<ContractDto>>(`/contracts/${id}`);
    return res.data;
  },

  getContractVersions: async (id: string): Promise<ApiResponse<ContractVersionDto[]>> => {
    const res = await apiClient.get<ApiResponse<ContractVersionDto[]>>(`/contracts/${id}/versions`);
    return res.data;
  },

  verifyContractIntegrity: async (id: string): Promise<ApiResponse<ContractIntegrityReportDto>> => {
    const res = await apiClient.get<ApiResponse<ContractIntegrityReportDto>>(`/contracts/${id}/integrity`);
    return res.data;
  },

  getContractActivityHistory: async (id: string): Promise<ApiResponse<ContractActivityHistoryDto[]>> => {
    const res = await apiClient.get<ApiResponse<ContractActivityHistoryDto[]>>(`/contracts/${id}/activity-history`);
    return res.data;
  },

  acceptContract: async (id: string, data: AcceptContractRequest): Promise<ApiResponse<{ contract: ContractDto; fullyActivated: boolean }>> => {
    const res = await apiClient.post<ApiResponse<{ contract: ContractDto; fullyActivated: boolean }>>(`/contracts/${id}/accept`, data);
    return res.data;
  },

  amendContract: async (id: string, data: AmendContractRequest): Promise<ApiResponse<ContractDto>> => {
    const res = await apiClient.post<ApiResponse<ContractDto>>(`/contracts/${id}/amend`, data);
    return res.data;
  },

  updateContractStatus: async (id: string, status: string, reason?: string): Promise<ApiResponse<ContractDto>> => {
    const res = await apiClient.patch<ApiResponse<ContractDto>>(`/contracts/${id}/status`, { status, reason });
    return res.data;
  },

  startMilestone: async (contractId: string, milestoneId: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.patch<ApiResponse<unknown>>(
      `/contracts/${contractId}/milestones/${milestoneId}/start`,
    );
    return res.data;
  },

  submitMilestone: async (
    contractId: string,
    milestoneId: string,
    data: CreateMilestoneSubmissionRequest,
  ): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(
      `/contracts/${contractId}/milestones/${milestoneId}/submissions`,
      data,
    );
    return res.data;
  },

  approveMilestone: async (contractId: string, milestoneId: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(
      `/contracts/${contractId}/milestones/${milestoneId}/approve`,
    );
    return res.data;
  },

  requestRevision: async (
    contractId: string,
    milestoneId: string,
    data: CreateRevisionRequest,
  ): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(
      `/contracts/${contractId}/milestones/${milestoneId}/revisions`,
      data,
    );
    return res.data;
  },

  downloadContractPdf: async (contractId: string): Promise<Blob> => {
    const res = await apiClient.get(`/contracts/${contractId}/pdf`, {
      responseType: 'blob',
    });
    return res.data;
  },

  // Invoices (Phase 7 Client Portal)
  listInvoices: async (): Promise<ApiResponse<{ items: InvoiceDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: InvoiceDto[]; total: number }>>('/contracts/invoices/all');
    return res.data;
  },

  listContractInvoices: async (contractId: string): Promise<ApiResponse<InvoiceDto[]>> => {
    const res = await apiClient.get<ApiResponse<InvoiceDto[]>>(`/contracts/${contractId}/invoices`);
    return res.data;
  },

  downloadInvoicePdf: async (contractId: string, invoiceId: string): Promise<Blob> => {
    const res = await apiClient.get(`/contracts/${contractId}/invoices/${invoiceId}/pdf`, {
      responseType: 'blob',
    });
    return res.data;
  },

  // Conversations
  listConversations: async (): Promise<ApiResponse<any[]>> => {
    const res = await apiClient.get<ApiResponse<any[]>>('/conversations');
    return res.data;
  },

  getOrCreateConversation: async (data: { contractId?: string; recipientId?: string }): Promise<ApiResponse<any>> => {
    const res = await apiClient.post<ApiResponse<any>>('/conversations', data);
    return res.data;
  },

  getConversationMessages: async (conversationId: string): Promise<ApiResponse<{ items: any[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: any[]; total: number }>>(`/conversations/${conversationId}/messages`);
    return res.data;
  },

  sendMessage: async (conversationId: string, content: string): Promise<ApiResponse<any>> => {
    const res = await apiClient.post<ApiResponse<any>>(`/conversations/${conversationId}/messages`, { content });
    return res.data;
  },

  // Opportunities & Open Project Discovery (Phase 6 Specialist Portal)
  listOpportunities: async (params?: {
    search?: string;
    category?: string;
    minBudget?: number;
    maxBudget?: number;
  }): Promise<ApiResponse<{ items: ProjectOpportunityDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: ProjectOpportunityDto[]; total: number }>>('/projects/opportunities', {
      params,
    });
    return res.data;
  },

  submitOpportunityProposal: async (data: SubmitOpportunityProposalRequest): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>('/projects/opportunities/proposals', data);
    return res.data;
  },

  // Notifications
  listNotifications: async (): Promise<ApiResponse<{ items: NotificationDto[]; unreadCount: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: NotificationDto[]; unreadCount: number }>>('/notifications');
    return res.data;
  },

  markNotificationRead: async (id: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.patch<ApiResponse<unknown>>(`/notifications/${id}/read`);
    return res.data;
  },

  markAllNotificationsRead: async (): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.patch<ApiResponse<unknown>>('/notifications/mark-all-read');
    return res.data;
  },

  // Escrow & Private Storage (Phase 4.1)
  getContractEscrow: async (contractId: string): Promise<ApiResponse<EscrowRecordDto>> => {
    const res = await apiClient.get<ApiResponse<EscrowRecordDto>>(`/escrow/contracts/${contractId}`);
    return res.data;
  },

  authorizeUpload: async (data: GenerateUploadUrlRequest): Promise<ApiResponse<GenerateUploadUrlResponse>> => {
    const res = await apiClient.post<ApiResponse<GenerateUploadUrlResponse>>('/storage/authorize-upload', data);
    return res.data;
  },

  authorizeDownload: async (contractId: string, objectPath: string): Promise<ApiResponse<GenerateDownloadUrlResponse>> => {
    const res = await apiClient.post<ApiResponse<GenerateDownloadUrlResponse>>('/storage/authorize-download', {
      contractId,
      objectPath,
    });
    return res.data;
  },

  // Payments & Cashfree Sandbox Integration (Phase 5)
  createPaymentOrder: async (
    contractId: string,
    idempotencyKey?: string,
  ): Promise<
    ApiResponse<{
      orderId: string;
      paymentSessionId: string;
      amount: number;
      amountMinor: string;
      currency: string;
      environment: string;
      status: string;
    }>
  > => {
    const res = await apiClient.post('/payments/orders', { contractId, idempotencyKey });
    return res.data;
  },

  verifyPaymentStatus: async (
    orderId: string,
  ): Promise<
    ApiResponse<{
      id: string;
      orderId: string;
      cfOrderId: string;
      status: string;
      cashfreeOrderStatus: string;
      amount: number;
      currency: string;
      environment: string;
      isLiveMoneyDisabled: boolean;
      failureReason?: string;
    }>
  > => {
    const res = await apiClient.get(`/payments/orders/${orderId}/verify`);
    return res.data;
  },

  getPaymentConfig: async (): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.get('/payments/config');
    return res.data;
  },

  listPaymentTransactions: async (params?: {
    contractId?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ items: PaymentTransactionDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: PaymentTransactionDto[]; total: number }>>('/payments/transactions', { params });
    return res.data;
  },

  getWalletOverview: async (): Promise<ApiResponse<ClientWalletDto | SpecialistWalletDto>> => {
    const res = await apiClient.get<ApiResponse<ClientWalletDto | SpecialistWalletDto>>('/payments/wallet');
    return res.data;
  },

  settleMilestone: async (milestoneId: string, reason?: string): Promise<ApiResponse<SettleMilestoneResultDto>> => {
    const res = await apiClient.post<ApiResponse<SettleMilestoneResultDto>>(`/payments/settlements/${milestoneId}`, { reason });
    return res.data;
  },

  processRefund: async (data: { contractId: string; reason: string; amountMinor?: string | number }): Promise<ApiResponse<ProcessRefundResultDto>> => {
    const res = await apiClient.post<ApiResponse<ProcessRefundResultDto>>('/payments/refunds', data);
    return res.data;
  },

  // Escrow Activities (Phase 6)
  getEscrowActivities: async (contractId: string): Promise<ApiResponse<EscrowActivityDto[]>> => {
    const res = await apiClient.get<ApiResponse<EscrowActivityDto[]>>(`/escrow/contracts/${contractId}/activities`);
    return res.data;
  },

  // Disputes (Phase 6)
  createDispute: async (data: CreateDisputeRequest): Promise<ApiResponse<DisputeDetailDto>> => {
    const res = await apiClient.post<ApiResponse<DisputeDetailDto>>('/disputes', data);
    return res.data;
  },

  getDisputeById: async (id: string): Promise<ApiResponse<DisputeDetailDto>> => {
    const res = await apiClient.get<ApiResponse<DisputeDetailDto>>(`/disputes/${id}`);
    return res.data;
  },

  listDisputes: async (params?: { contractId?: string; status?: string; page?: number; limit?: number }): Promise<ApiResponse<{ items: DisputeDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: DisputeDto[]; total: number }>>('/disputes', { params });
    return res.data;
  },

  submitDisputeResponse: async (disputeId: string, content: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(`/disputes/${disputeId}/responses`, { content });
    return res.data;
  },

  uploadDisputeEvidence: async (disputeId: string, data: { fileName: string; fileKey: string; fileUrl: string; mimeType?: string; fileSize?: number; description?: string }): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(`/disputes/${disputeId}/evidence`, data);
    return res.data;
  },

  proposeDisputeResolution: async (disputeId: string, data: ProposeDisputeResolutionRequest): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(`/disputes/${disputeId}/resolutions`, data);
    return res.data;
  },

  respondToDisputeResolution: async (disputeId: string, resolutionId: string, agree: boolean): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(`/disputes/${disputeId}/resolutions/${resolutionId}/respond`, { agree });
    return res.data;
  },

  // Amendments (Phase 6)
  proposeAmendment: async (contractId: string, data: ProposeAmendmentRequest): Promise<ApiResponse<ContractAmendmentDto>> => {
    const res = await apiClient.post<ApiResponse<ContractAmendmentDto>>(`/contracts/${contractId}/amendments`, data);
    return res.data;
  },

  listAmendments: async (contractId: string): Promise<ApiResponse<ContractAmendmentDto[]>> => {
    const res = await apiClient.get<ApiResponse<ContractAmendmentDto[]>>(`/contracts/${contractId}/amendments`);
    return res.data;
  },

  respondToAmendment: async (contractId: string, amendmentId: string, data: RespondToAmendmentRequest): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(`/contracts/${contractId}/amendments/${amendmentId}/respond`, data);
    return res.data;
  },

  // Terminations (Phase 6)
  proposeTermination: async (contractId: string, data: ProposeTerminationRequest): Promise<ApiResponse<ContractTerminationRequestDto>> => {
    const res = await apiClient.post<ApiResponse<ContractTerminationRequestDto>>(`/contracts/${contractId}/termination-requests`, data);
    return res.data;
  },

  listTerminationRequests: async (contractId: string): Promise<ApiResponse<ContractTerminationRequestDto[]>> => {
    const res = await apiClient.get<ApiResponse<ContractTerminationRequestDto[]>>(`/contracts/${contractId}/termination-requests`);
    return res.data;
  },

  respondToTermination: async (contractId: string, requestId: string, data: RespondToTerminationRequest): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(`/contracts/${contractId}/termination-requests/${requestId}/respond`, data);
    return res.data;
  },

  // Projects & Milestones (Phase 9)
  listProjects: async (filters?: { status?: string; page?: number; limit?: number }): Promise<ApiResponse<{ items: ProjectDto[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>> => {
    const res = await apiClient.get<ApiResponse<{ items: ProjectDto[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>>('/projects', { params: filters });
    return res.data;
  },

  getProject: async (projectId: string): Promise<ApiResponse<ProjectDto>> => {
    const res = await apiClient.get<ApiResponse<ProjectDto>>(`/projects/${projectId}`);
    return res.data;
  },

  getProjectByContract: async (contractId: string): Promise<ApiResponse<ProjectDto>> => {
    const res = await apiClient.get<ApiResponse<ProjectDto>>(`/projects/contract/${contractId}`);
    return res.data;
  },

  createProject: async (contractId: string, data?: CreateProjectRequest): Promise<ApiResponse<ProjectDto>> => {
    const res = await apiClient.post<ApiResponse<ProjectDto>>(`/projects/contract/${contractId}`, data || {});
    return res.data;
  },

  getProjectSummary: async (projectId: string): Promise<ApiResponse<ProjectProgressSummaryDto>> => {
    const res = await apiClient.get<ApiResponse<ProjectProgressSummaryDto>>(`/projects/${projectId}/summary`);
    return res.data;
  },

  getMilestoneActivities: async (projectId: string, milestoneId?: string): Promise<ApiResponse<MilestoneActivityDto[]>> => {
    const res = await apiClient.get<ApiResponse<MilestoneActivityDto[]>>(`/projects/${projectId}/activities`, {
      params: milestoneId ? { milestoneId } : undefined,
    });
    return res.data;
  },

  // Client Digital Office Stamp (Client only)
  getClientStampPreview: async (): Promise<ApiResponse<ClientStampPreviewDto>> => {
    const res = await apiClient.get<ApiResponse<ClientStampPreviewDto>>('/contracts/stamp/preview');
    return res.data;
  },

  applyClientStamp: async (contractId: string, data?: ApplyClientStampRequest): Promise<ApiResponse<ClientStampDto>> => {
    const res = await apiClient.post<ApiResponse<ClientStampDto>>(`/contracts/${contractId}/stamp/apply`, data || {});
    return res.data;
  },

  getContractStamp: async (contractId: string): Promise<ApiResponse<ClientStampDto | null>> => {
    const res = await apiClient.get<ApiResponse<ClientStampDto | null>>(`/contracts/${contractId}/stamp`);
    return res.data;
  },

  listClientStampHistory: async (): Promise<ApiResponse<{ items: ClientStampDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: ClientStampDto[]; total: number }>>('/contracts/stamps/history');
    return res.data;
  },
};
