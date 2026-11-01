import axios from 'axios';
import {
  ApiResponse,
  SystemHealthStatus,
  DatabaseHealthStatus,
  FinancialOverviewDto,
  EscrowRecordDto,
  PaymentTransactionDto,
  DisputeDto,
  DisputeDetailDto,
  DisputeMetricsDto,
  ProposeDisputeResolutionRequest,
  EscrowActivityDto,
  ContractDto,
  ContractAmendmentDto,
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
      // pass through
    }
  }
  return config;
});

export const apiService = {
  checkHealth: async (): Promise<ApiResponse<SystemHealthStatus>> => {
    const res = await apiClient.get<ApiResponse<SystemHealthStatus>>('/health');
    return res.data;
  },

  checkDatabase: async (): Promise<ApiResponse<DatabaseHealthStatus>> => {
    const res = await apiClient.get<ApiResponse<DatabaseHealthStatus>>('/health/database');
    return res.data;
  },

  getCurrentUser: async (): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.get<ApiResponse<unknown>>('/auth/me');
    return res.data;
  },

  getDashboardMetrics: async (): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.get<ApiResponse<unknown>>('/admin/dashboard');
    return res.data;
  },

  listUsers: async (params?: Record<string, unknown>): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.get<ApiResponse<unknown>>('/users', { params });
    return res.data;
  },

  updateUserStatus: async (id: string, status: string, reason: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.patch<ApiResponse<unknown>>(`/users/${id}/status`, { status, reason });
    return res.data;
  },

  listActivities: async (params?: Record<string, unknown>): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.get<ApiResponse<unknown>>('/admin/activities', { params });
    return res.data;
  },

  listAuditLogs: async (params?: Record<string, unknown>): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.get<ApiResponse<unknown>>('/audit-logs', { params });
    return res.data;
  },

  // Financial Oversight (Phase 4.1)
  getFinancialOverview: async (): Promise<ApiResponse<FinancialOverviewDto>> => {
    const res = await apiClient.get<ApiResponse<FinancialOverviewDto>>('/ledger/overview');
    return res.data;
  },

  listEscrowRecords: async (params?: Record<string, unknown>): Promise<ApiResponse<{ items: EscrowRecordDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: EscrowRecordDto[]; total: number }>>('/escrow', { params });
    return res.data;
  },

  listPaymentTransactions: async (params?: Record<string, unknown>): Promise<ApiResponse<{ items: PaymentTransactionDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: PaymentTransactionDto[]; total: number }>>('/payments/transactions', { params });
    return res.data;
  },

  setDisputeHold: async (contractId: string, disputeHold: boolean, reason: string): Promise<ApiResponse<EscrowRecordDto>> => {
    const res = await apiClient.patch<ApiResponse<EscrowRecordDto>>(`/escrow/contracts/${contractId}/dispute-hold`, {
      disputeHold,
      reason,
    });
    return res.data;
  },

  // Dispute Management Workspace (Phase 6)
  listDisputes: async (params?: Record<string, unknown>): Promise<ApiResponse<{ items: DisputeDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: DisputeDto[]; total: number }>>('/disputes', { params });
    return res.data;
  },

  getDisputeById: async (id: string): Promise<ApiResponse<DisputeDetailDto>> => {
    const res = await apiClient.get<ApiResponse<DisputeDetailDto>>(`/disputes/${id}`);
    return res.data;
  },

  getDisputeMetrics: async (): Promise<ApiResponse<DisputeMetricsDto>> => {
    const res = await apiClient.get<ApiResponse<DisputeMetricsDto>>('/disputes/metrics');
    return res.data;
  },

  proposeDisputeResolution: async (disputeId: string, data: ProposeDisputeResolutionRequest): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(`/disputes/${disputeId}/resolutions`, data);
    return res.data;
  },

  adminEnforceResolution: async (
    disputeId: string,
    data: { resolutionType: string; clientAmountMinor: string | number; workerAmountMinor: string | number; rationale: string },
  ): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(`/disputes/${disputeId}/resolutions/enforce`, data);
    return res.data;
  },

  addDisputeNote: async (disputeId: string, note: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(`/disputes/${disputeId}/notes`, { note });
    return res.data;
  },

  listEscrowActivities: async (contractId: string): Promise<ApiResponse<EscrowActivityDto[]>> => {
    const res = await apiClient.get<ApiResponse<EscrowActivityDto[]>>(`/escrow/contracts/${contractId}/activities`);
    return res.data;
  },

  listContracts: async (): Promise<ApiResponse<ContractDto[]>> => {
    const res = await apiClient.get<ApiResponse<ContractDto[]>>('/contracts');
    return res.data;
  },

  getContractById: async (contractId: string): Promise<ApiResponse<ContractDto>> => {
    const res = await apiClient.get<ApiResponse<ContractDto>>(`/contracts/${contractId}`);
    return res.data;
  },

  listContractAmendments: async (contractId: string): Promise<ApiResponse<ContractAmendmentDto[]>> => {
    const res = await apiClient.get<ApiResponse<ContractAmendmentDto[]>>(`/contracts/${contractId}/amendments`);
    return res.data;
  },
};
