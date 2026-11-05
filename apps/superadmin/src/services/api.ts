import axios from 'axios';
import {
  ApiResponse,
  SystemHealthStatus,
  DatabaseHealthStatus,
  FinancialOverviewDto,
  TrialBalanceReportDto,
  LedgerAccountDto,
  LedgerTransactionDto,
  PlatformFinancialConfigDto,
  DisputeDto,
  DisputeDetailDto,
  DisputeMetricsDto,
  EscrowActivityDto,
  EscrowRecordDto,
  PaymentTransactionDto,
  ContractDto,
  ContractVersionDto,
  ContractIntegrityReportDto,
  ContractActivityHistoryDto,
  NotificationDto,
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

  getCurrentUser: async (token?: string): Promise<ApiResponse<unknown>> => {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const res = await apiClient.get<ApiResponse<unknown>>('/auth/me', { headers });
    return res.data;
  },

  getUserById: async (id: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.get<ApiResponse<unknown>>(`/users/${id}`);
    return res.data;
  },

  updateUserStatus: async (id: string, status: string, reason: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.patch<ApiResponse<unknown>>(`/users/${id}/status`, { status, reason });
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

  provisionUserRole: async (userId: string, role: string, reason: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>('/admin/provision-role', {
      userId,
      role,
      reason,
    });
    return res.data;
  },

  provisionRole: async (userId: string, role: string, reason: string): Promise<ApiResponse<unknown>> => {
    return apiService.provisionUserRole(userId, role, reason);
  },

  listActivities: async (params?: Record<string, unknown>): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.get<ApiResponse<unknown>>('/admin/activities', { params });
    return res.data;
  },

  listAuditLogs: async (params?: Record<string, unknown>): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.get<ApiResponse<unknown>>('/audit-logs', { params });
    return res.data;
  },

  listEscrowRecords: async (params?: Record<string, unknown>): Promise<ApiResponse<{ items: EscrowRecordDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: EscrowRecordDto[]; total: number }>>('/escrow', { params });
    return res.data;
  },

  listEscrows: async (params?: Record<string, unknown>): Promise<ApiResponse<EscrowRecordDto[]>> => {
    const res = await apiService.listEscrowRecords(params);
    return { ...res, data: res.data?.items || [] };
  },

  setDisputeHold: async (contractId: string, disputeHold: boolean, reason: string): Promise<ApiResponse<EscrowRecordDto>> => {
    const res = await apiClient.patch<ApiResponse<EscrowRecordDto>>(`/escrow/contracts/${contractId}/dispute-hold`, {
      disputeHold,
      reason,
    });
    return res.data;
  },

  listPaymentTransactions: async (params?: Record<string, unknown>): Promise<ApiResponse<{ items: PaymentTransactionDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: PaymentTransactionDto[]; total: number }>>('/payments/transactions', { params });
    return res.data;
  },

  // Financial Governance (Phase 4.1)
  getFinancialOverview: async (): Promise<ApiResponse<FinancialOverviewDto>> => {
    const res = await apiClient.get<ApiResponse<FinancialOverviewDto>>('/ledger/overview');
    return res.data;
  },

  getTrialBalance: async (currency = 'USD'): Promise<ApiResponse<TrialBalanceReportDto>> => {
    const res = await apiClient.get<ApiResponse<TrialBalanceReportDto>>('/ledger/trial-balance', {
      params: { currency },
    });
    return res.data;
  },

  listAccounts: async (params?: Record<string, unknown>): Promise<ApiResponse<{ items: LedgerAccountDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: LedgerAccountDto[]; total: number }>>('/ledger/accounts', { params });
    return res.data;
  },

  listLedgerAccounts: async (params?: Record<string, unknown>): Promise<ApiResponse<LedgerAccountDto[]>> => {
    const res = await apiService.listAccounts(params);
    return { ...res, data: res.data?.items || [] };
  },

  listTransactions: async (params?: Record<string, unknown>): Promise<ApiResponse<{ items: LedgerTransactionDto[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ items: LedgerTransactionDto[]; total: number }>>('/ledger/transactions', { params });
    return res.data;
  },

  listLedgerTransactions: async (params?: Record<string, unknown>): Promise<ApiResponse<LedgerTransactionDto[]>> => {
    const res = await apiService.listTransactions(params);
    return { ...res, data: res.data?.items || [] };
  },

  reverseTransaction: async (reference: string, reason: string): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>(`/ledger/transactions/${reference}/reverse`, { reason });
    return res.data;
  },

  getFinancialConfig: async (): Promise<ApiResponse<PlatformFinancialConfigDto>> => {
    const res = await apiClient.get<ApiResponse<PlatformFinancialConfigDto>>('/payments/config');
    return res.data;
  },

  // Global Dispute Governance (Phase 6)
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

  getContractVersions: async (contractId: string): Promise<ApiResponse<ContractVersionDto[]>> => {
    const res = await apiClient.get<ApiResponse<ContractVersionDto[]>>(`/contracts/${contractId}/versions`);
    return res.data;
  },

  verifyContractIntegrity: async (contractId: string): Promise<ApiResponse<ContractIntegrityReportDto>> => {
    const res = await apiClient.get<ApiResponse<ContractIntegrityReportDto>>(`/contracts/${contractId}/integrity`);
    return res.data;
  },

  getContractActivityHistory: async (contractId: string): Promise<ApiResponse<ContractActivityHistoryDto[]>> => {
    const res = await apiClient.get<ApiResponse<ContractActivityHistoryDto[]>>(`/contracts/${contractId}/activity-history`);
    return res.data;
  },

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

  processRefund: async (data: { contractId: string; reason: string; amountMinor?: string | number }): Promise<ApiResponse<unknown>> => {
    const res = await apiClient.post<ApiResponse<unknown>>('/payments/refunds', data);
    return res.data;
  },
};
