import axios from 'axios';
import { ApiResponse, SystemHealthStatus, DatabaseHealthStatus } from '@trustpay/shared';

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
};
