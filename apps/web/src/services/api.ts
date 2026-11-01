import axios from 'axios';
import {
  ApiResponse,
  SystemHealthStatus,
  DatabaseHealthStatus,
  UserDto,
  ContractDto,
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
  CreateShortlistRequest,
  AddWorkerSkillRequest,
  CreatePortfolioItemRequest,
  AcceptContractRequest,
  AmendContractRequest,
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
  if (tokenGetter) {
    try {
      const token = await tokenGetter();
      if (token) {
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
  syncUser: async (role?: 'CLIENT' | 'WORKER'): Promise<ApiResponse<UserDto>> => {
    const res = await apiClient.post<ApiResponse<UserDto>>('/auth/sync', { role });
    return res.data;
  },

  getCurrentUser: async (): Promise<ApiResponse<UserDto>> => {
    const res = await apiClient.get<ApiResponse<UserDto>>('/auth/me');
    return res.data;
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

  // Conversations
  listConversations: async (): Promise<ApiResponse<unknown[]>> => {
    const res = await apiClient.get<ApiResponse<unknown[]>>('/conversations');
    return res.data;
  },

  getConversationMessages: async (conversationId: string): Promise<ApiResponse<{ items: unknown[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: unknown[]; total: number }>>(`/conversations/${conversationId}/messages`);
    return res.data;
  },

  sendMessage: async (conversationId: string, content: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(`/conversations/${conversationId}/messages`, { content });
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
};
