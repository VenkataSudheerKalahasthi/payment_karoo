import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  Server,
  Database,
  Lock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  LogIn,
} from 'lucide-react';
import { useAuth, UserButton, SignInButton } from '@clerk/clerk-react';
import { apiService, setAuthTokenGetter } from './services/api';
import { SystemHealthStatus, DatabaseHealthStatus, UserRole } from '@trustpay/shared';

interface AdminDashboardMetrics {
  users?: { total: number; clients: number; workers: number; admins: number };
  contracts?: { total: number; active: number; completed: number; disputed: number };
  milestones?: { total: number };
  hiringRequests?: { total: number; pending: number };
}

interface AdminUserRecord {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
  role: { name: UserRole };
}

interface AdminActivityRecord {
  id: string;
  action: string;
  targetUserId?: string | null;
  createdAt: string;
  admin?: { firstName?: string | null; email?: string | null };
}

export const App: React.FC = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [currentUser, setCurrentUser] = useState<AdminUserRecord | null>(null);
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [usersList, setUsersList] = useState<AdminUserRecord[]>([]);
  const [adminActivities, setAdminActivities] = useState<AdminActivityRecord[]>([]);
  const [apiHealth, setApiHealth] = useState<SystemHealthStatus | null>(null);
  const [dbHealth, setDbHealth] = useState<DatabaseHealthStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'users' | 'activities' | 'system'>('metrics');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(async () => {
        try {
          return await getToken();
        } catch {
          return null;
        }
      });
    }
  }, [isSignedIn, getToken]);

  const loadAdminData = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const userRes = await apiService.getCurrentUser();
      if (userRes.success && userRes.data) {
        setCurrentUser(userRes.data as AdminUserRecord);
      }

      const [metricsRes, usersRes, actRes] = await Promise.allSettled([
        apiService.getDashboardMetrics(),
        apiService.listUsers({ limit: 50 }),
        apiService.listActivities({ limit: 20 }),
      ]);

      if (metricsRes.status === 'fulfilled' && metricsRes.value.success) {
        setMetrics(metricsRes.value.data as AdminDashboardMetrics);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.success) {
        setUsersList((usersRes.value.data as { items?: AdminUserRecord[] })?.items || []);
      }
      if (actRes.status === 'fulfilled' && actRes.value.success) {
        setAdminActivities((actRes.value.data as { items?: AdminActivityRecord[] })?.items || []);
      }
    } catch {
      // Handled via state
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn) {
      loadAdminData();
    }
  }, [isSignedIn, loadAdminData]);

  const fetchStatus = async () => {
    setIsRefreshing(true);
    try {
      const [apiRes, dbRes] = await Promise.allSettled([
        apiService.checkHealth(),
        apiService.checkDatabase(),
      ]);

      if (apiRes.status === 'fulfilled' && apiRes.value.success && apiRes.value.data) {
        setApiHealth(apiRes.value.data);
      }
      if (dbRes.status === 'fulfilled' && dbRes.value.success && dbRes.value.data) {
        setDbHealth(dbRes.value.data);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    const reason = prompt(`Enter reason for updating user status to ${newStatus}:`);
    if (!reason) return;

    try {
      const res = await apiService.updateUserStatus(userId, newStatus, reason);
      if (res.success) {
        setActionMessage(`User status updated to ${newStatus}.`);
        loadAdminData();
      }
    } catch {
      setActionMessage('Failed to update user status.');
    }
  };

  const isPrivileged =
    currentUser?.role?.name === UserRole.ADMIN || currentUser?.role?.name === UserRole.SUPERADMIN;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Admin Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                TrustPay Admin
              </span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                Governance &amp; Oversight Portal
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={fetchStatus}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
              <span>Verify Cluster</span>
            </button>

            {isLoaded && (
              <>
                {isSignedIn ? (
                  <UserButton afterSignOutUrl="/" />
                ) : (
                  <SignInButton mode="modal">
                    <button className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition flex items-center space-x-1">
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Admin Sign In</span>
                    </button>
                  </SignInButton>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        {actionMessage && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {!isSignedIn ? (
          <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl max-w-lg mx-auto space-y-4">
            <Lock className="w-12 h-12 text-blue-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">Administrative Authentication Required</h3>
            <p className="text-xs text-slate-400">
              Only authorized administrators with verified Clerk identities and assigned ADMIN or SUPERADMIN
              roles may access this governance console.
            </p>
            <SignInButton mode="modal">
              <button className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition">
                Sign In with Administrative Credentials
              </button>
            </SignInButton>
          </div>
        ) : !isPrivileged && currentUser ? (
          <div className="p-8 bg-rose-500/10 border border-rose-500/20 rounded-2xl max-w-lg mx-auto text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-lg font-bold text-rose-300">Insufficient Clearance</h3>
            <p className="text-xs text-slate-300">
              Your verified identity has role <span className="font-bold">{currentUser.role?.name}</span>.
              Administrative access is strictly restricted to ADMIN and SUPERADMIN accounts.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Admin Tabs */}
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-4">
              <button
                onClick={() => setActiveTab('metrics')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'metrics'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Platform Overview
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'users'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                User Directory &amp; Status ({usersList.length})
              </button>
              <button
                onClick={() => setActiveTab('activities')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'activities'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Admin Activity History
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'system'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Telemetry &amp; Health
              </button>
            </div>

            {/* Metrics Overview */}
            {activeTab === 'metrics' && metrics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">Total Registered Users</span>
                  <div className="text-2xl font-bold text-white">{metrics.users?.total || 0}</div>
                  <span className="text-[11px] text-slate-500">
                    {metrics.users?.clients} Clients | {metrics.users?.workers} Workers
                  </span>
                </div>

                <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">Active Digital Contracts</span>
                  <div className="text-2xl font-bold text-emerald-400">{metrics.contracts?.active || 0}</div>
                  <span className="text-[11px] text-slate-500">
                    {metrics.contracts?.total} Total Proposed
                  </span>
                </div>

                <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">Completed Contracts</span>
                  <div className="text-2xl font-bold text-blue-400">{metrics.contracts?.completed || 0}</div>
                  <span className="text-[11px] text-slate-500">
                    Fully audited milestones
                  </span>
                </div>

                <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">Disputed Contracts</span>
                  <div className="text-2xl font-bold text-amber-400">{metrics.contracts?.disputed || 0}</div>
                  <span className="text-[11px] text-slate-500">Requires arbitration</span>
                </div>
              </div>
            )}

            {/* User Directory & Status Management */}
            {activeTab === 'users' && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">Registered Platform Accounts</h4>
                  <span className="text-xs text-slate-400">Enforcing Server-Side Role Constraints</span>
                </div>

                <div className="divide-y divide-slate-800/80">
                  {usersList.map((u) => (
                    <div key={u.id} className="p-4 flex items-center justify-between text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white">
                            {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-slate-300">
                            {u.role?.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-medium ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {u.status}
                          </span>
                        </div>
                        <div className="text-slate-500 font-mono">
                          {u.email} | ID: {u.id}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {u.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleUpdateStatus(u.id, 'SUSPENDED')}
                            className="px-2.5 py-1 rounded bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-400 text-xs transition"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(u.id, 'ACTIVE')}
                            className="px-2.5 py-1 rounded bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs transition"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Activity History */}
            {activeTab === 'activities' && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h4 className="text-sm font-semibold text-white">Administrative Audit Trail</h4>
                </div>
                <div className="divide-y divide-slate-800/80">
                  {adminActivities.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">No admin actions recorded yet.</div>
                  ) : (
                    adminActivities.map((act) => (
                      <div key={act.id} className="p-4 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-slate-200">{act.action}</span>
                          <div className="text-slate-500 mt-0.5">
                            Admin: {act.admin?.firstName || act.admin?.email} | Target: {act.targetUserId || 'System'}
                          </div>
                        </div>
                        <span className="text-slate-500 font-mono">
                          {new Date(act.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Telemetry Tab */}
            {activeTab === 'system' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                    <Server className="w-4 h-4 text-blue-400" />
                    <span>Express API Service</span>
                  </div>
                  {apiHealth && (
                    <div className="text-xs text-slate-400 space-y-1 font-mono">
                      <div>Status: {apiHealth.status}</div>
                      <div>Service: {apiHealth.service}</div>
                      <div>Version: {apiHealth.version}</div>
                      <div>Uptime: {apiHealth.uptimeSeconds}s</div>
                    </div>
                  )}
                </div>

                <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>Supabase PostgreSQL DB</span>
                  </div>
                  {dbHealth && (
                    <div className="text-xs text-slate-400 space-y-1 font-mono">
                      <div>Status: {dbHealth.status}</div>
                      <div>Database: {dbHealth.database}</div>
                      {dbHealth.latencyMs && <div>Latency: {dbHealth.latencyMs}ms</div>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
