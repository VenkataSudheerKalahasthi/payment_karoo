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
  Search,
  Filter,
  UserCheck,
  Eye,
  X,
  FileText,
  Activity,
  DollarSign,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { useAuth, UserButton, SignInButton } from '@clerk/clerk-react';
import { apiService, setAuthTokenGetter } from './services/api';
import { initAdminSocket, disconnectAdminSocket } from './services/socket';
import {
  SystemHealthStatus,
  DatabaseHealthStatus,
  UserRole,
  FinancialOverviewDto,
  EscrowRecordDto,
  PaymentTransactionDto,
  formatCurrencyMinor,
} from '@trustpay/shared';
import { DisputesWorkspace } from './components/DisputesWorkspace';
import { AdminContractsOversight } from './components/AdminContractsOversight';
import { NotificationDropdown } from './components/NotificationDropdown';

interface AdminDashboardMetrics {
  users?: { total: number; clients: number; workers: number; admins: number };
  contracts?: { total: number; active: number; completed: number; disputed: number };
  milestones?: { total: number };
  hiringRequests?: { total: number; pending: number };
  disputes?: { total: number; pending: number };
  escrow?: { activeHolds: number };
}

interface AdminUserRecord {
  id: string;
  clerkId?: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
  role: { name: UserRole };
  createdAt?: string;
  profile?: { bio?: string | null; phone?: string | null; country?: string | null } | null;
  workerProfile?: { title?: string | null; hourlyRate?: number | null; availability?: string | null } | null;
}

interface AdminActivityRecord {
  id: string;
  action: string;
  targetUserId?: string | null;
  createdAt: string;
  details?: Record<string, unknown> | null;
  admin?: { id?: string; firstName?: string | null; lastName?: string | null; email?: string | null };
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
  const [activeTab, setActiveTab] = useState<'metrics' | 'users' | 'contracts' | 'activities' | 'financial' | 'disputes' | 'system'>('metrics');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // User Directory Search & Filter state
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');
  const [inspectUser, setInspectUser] = useState<AdminUserRecord | null>(null);

  // Status Change Modal State
  const [statusModalUser, setStatusModalUser] = useState<AdminUserRecord | null>(null);
  const [statusModalTargetStatus, setStatusModalTargetStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'>('SUSPENDED');
  const [statusModalReason, setStatusModalReason] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Activity History Filter state
  const [activitySearch, setActivitySearch] = useState('');
  const [activityActionFilter, setActivityActionFilter] = useState<string>('ALL');

  // Financial Oversight state
  const [financialOverview, setFinancialOverview] = useState<FinancialOverviewDto | null>(null);
  const [escrowsList, setEscrowsList] = useState<EscrowRecordDto[]>([]);
  const [paymentsList, setPaymentsList] = useState<PaymentTransactionDto[]>([]);
  const [isLoadingFinancial, setIsLoadingFinancial] = useState(false);
  const [escrowSearch, setEscrowSearch] = useState('');

  // Setup Auth Token Getter
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

  // Load Financial Data
  const loadFinancialData = useCallback(async () => {
    setIsLoadingFinancial(true);
    try {
      const [overviewRes, escrowsRes, paymentsRes] = await Promise.allSettled([
        apiService.getFinancialOverview(),
        apiService.listEscrowRecords({ limit: 100 }),
        apiService.listPaymentTransactions({ limit: 100 }),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.success && overviewRes.value.data) {
        setFinancialOverview(overviewRes.value.data);
      }
      if (escrowsRes.status === 'fulfilled' && escrowsRes.value.success && escrowsRes.value.data) {
        setEscrowsList(escrowsRes.value.data.items || []);
      }
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value.success && paymentsRes.value.data) {
        setPaymentsList(paymentsRes.value.data.items || []);
      }
    } finally {
      setIsLoadingFinancial(false);
    }
  }, []);

  // Load Admin Data (Metrics, Users, Activities)
  const loadAdminData = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = await getToken();
      const userRes = await apiService.getCurrentUser(token || undefined);
      if (userRes.success && userRes.data) {
        setCurrentUser(userRes.data as AdminUserRecord);
      }

      const [metricsRes, usersRes, actRes] = await Promise.allSettled([
        apiService.getDashboardMetrics(),
        apiService.listUsers({ limit: 100 }),
        apiService.listActivities({ limit: 50 }),
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
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (isSignedIn) {
      loadAdminData();
    }
  }, [isSignedIn, loadAdminData]);

  useEffect(() => {
    if (isSignedIn && activeTab === 'financial') {
      loadFinancialData();
    }
  }, [isSignedIn, activeTab, loadFinancialData]);

  // Socket.IO Real-time updates
  useEffect(() => {
    if (!isSignedIn) return;

    let active = true;
    getToken().then((token) => {
      if (!active || !token) return;
      const sock = initAdminSocket(token);

      const handleRefresh = () => {
        loadAdminData();
        if (activeTab === 'financial') loadFinancialData();
      };

      sock.on('contract:event', handleRefresh);
      sock.on('milestone:event', handleRefresh);
      sock.on('dispute:event', handleRefresh);
      sock.on('user:status_changed', handleRefresh);

      return () => {
        sock.off('contract:event', handleRefresh);
        sock.off('milestone:event', handleRefresh);
        sock.off('dispute:event', handleRefresh);
        sock.off('user:status_changed', handleRefresh);
      };
    });

    return () => {
      active = false;
      disconnectAdminSocket();
    };
  }, [isSignedIn, getToken, loadAdminData, loadFinancialData, activeTab]);

  const handleToggleDisputeHold = async (contractId: string, currentHold: boolean) => {
    const reason = prompt(
      currentHold
        ? 'Enter rationale for lifting escrow protective hold:'
        : 'Enter rationale for placing escrow under protective dispute hold:',
    );
    if (!reason || reason.trim().length < 5) {
      alert('A valid rationale (min 5 characters) is required for audit compliance.');
      return;
    }

    try {
      const res = await apiService.setDisputeHold(contractId, !currentHold, reason.trim());
      if (res.success) {
        setActionMessage(`Dispute protective hold successfully ${!currentHold ? 'activated' : 'released'}.`);
        loadFinancialData();
      } else {
        alert(res.error?.message || 'Failed to update dispute hold');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating dispute hold');
    }
  };

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

  const openStatusModal = (user: AdminUserRecord, targetStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED') => {
    if (user.id === currentUser?.id && targetStatus !== 'ACTIVE') {
      alert('Security Protection: You cannot suspend or deactivate your own administrative account.');
      return;
    }
    if (
      (user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN) &&
      currentUser?.role.name !== UserRole.SUPERADMIN
    ) {
      alert('Security Protection: Only Superadmins can modify the status of an Administrator account.');
      return;
    }
    setStatusModalUser(user);
    setStatusModalTargetStatus(targetStatus);
    setStatusModalReason('');
  };

  const confirmStatusChange = async () => {
    if (!statusModalUser || statusModalReason.trim().length < 5) {
      setErrorMessage('A detailed rationale (minimum 5 characters) is required for immutable audit logging.');
      return;
    }

    setIsSubmittingStatus(true);
    setErrorMessage(null);
    try {
      const res = await apiService.updateUserStatus(
        statusModalUser.id,
        statusModalTargetStatus,
        statusModalReason.trim(),
      );
      if (res.success) {
        setActionMessage(
          `User ${statusModalUser.email} status transitioned to ${statusModalTargetStatus}. Audit entry recorded.`,
        );
        setStatusModalUser(null);
        setStatusModalReason('');
        await loadAdminData();
      } else {
        setErrorMessage(res.error?.message || 'Failed to update user status');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update user status.');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const isPrivileged =
    currentUser?.role?.name === UserRole.ADMIN || currentUser?.role?.name === UserRole.SUPERADMIN;

  // Filtered Users
  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      !userSearch ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.id.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.firstName && u.firstName.toLowerCase().includes(userSearch.toLowerCase())) ||
      (u.lastName && u.lastName.toLowerCase().includes(userSearch.toLowerCase()));

    const matchesRole = userRoleFilter === 'ALL' || u.role?.name === userRoleFilter;
    const matchesStatus = userStatusFilter === 'ALL' || u.status === userStatusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Filtered Activities
  const filteredActivities = adminActivities.filter((act) => {
    const matchesSearch =
      !activitySearch ||
      act.action.toLowerCase().includes(activitySearch.toLowerCase()) ||
      (act.targetUserId && act.targetUserId.toLowerCase().includes(activitySearch.toLowerCase())) ||
      (act.admin?.email && act.admin.email.toLowerCase().includes(activitySearch.toLowerCase()));

    const matchesAction = activityActionFilter === 'ALL' || act.action === activityActionFilter;
    return matchesSearch && matchesAction;
  });

  // Filtered Escrows
  const filteredEscrows = escrowsList.filter((esc) => {
    if (!escrowSearch) return true;
    const q = escrowSearch.toLowerCase();
    return (
      (esc.contractNumber && esc.contractNumber.toLowerCase().includes(q)) ||
      (esc.contractTitle && esc.contractTitle.toLowerCase().includes(q)) ||
      esc.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Admin Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  TrustPay Admin
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                  Enterprise Governance
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Administrative Oversight &amp; Audit Console
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {currentUser && (
              <div className="hidden sm:flex items-center space-x-2 text-xs">
                <span className="text-slate-400">Signed in as:</span>
                <span className="font-semibold text-slate-200">
                  {currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}` : currentUser.email}
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    currentUser.role.name === UserRole.SUPERADMIN
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {currentUser.role.name}
                </span>
              </div>
            )}

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
                  <div className="flex items-center space-x-3">
                    <NotificationDropdown />
                    <UserButton afterSignOutUrl="/" />
                  </div>
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
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
        {actionMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionMessage}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-emerald-400/70 hover:text-emerald-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400/70 hover:text-rose-300">
              <X className="w-4 h-4" />
            </button>
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
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
              <button
                onClick={() => setActiveTab('metrics')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'metrics'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Platform Overview</span>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'users'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>User Directory ({usersList.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('contracts')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'contracts'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Contracts Oversight</span>
              </button>
              <button
                onClick={() => setActiveTab('activities')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'activities'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Activity History</span>
              </button>
              <button
                onClick={() => setActiveTab('financial')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'financial'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Financial Oversight &amp; Escrow</span>
              </button>
              <button
                onClick={() => setActiveTab('disputes')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'disputes'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Dispute Arbitration</span>
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'system'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Telemetry &amp; Health</span>
              </button>
            </div>

            {/* Metrics Overview */}
            {activeTab === 'metrics' && metrics && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-medium text-slate-400">Total Registered Users</span>
                    <div className="text-3xl font-bold text-white">{metrics.users?.total || 0}</div>
                    <div className="text-[11px] text-slate-400 flex items-center space-x-2 pt-1 border-t border-slate-800/80">
                      <span className="text-blue-400">{metrics.users?.clients || 0} Clients</span>
                      <span>•</span>
                      <span className="text-emerald-400">{metrics.users?.workers || 0} Workers</span>
                      <span>•</span>
                      <span className="text-purple-400">{metrics.users?.admins || 0} Admins</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-medium text-slate-400">Active Digital Contracts</span>
                    <div className="text-3xl font-bold text-emerald-400">{metrics.contracts?.active || 0}</div>
                    <div className="text-[11px] text-slate-400 flex items-center space-x-2 pt-1 border-t border-slate-800/80">
                      <span>{metrics.contracts?.total || 0} Total Formulated</span>
                      <span>•</span>
                      <span className="text-blue-400">{metrics.contracts?.completed || 0} Completed</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-medium text-slate-400">Contractual Disputes</span>
                    <div className="text-3xl font-bold text-rose-400">{metrics.contracts?.disputed || 0}</div>
                    <div className="text-[11px] text-slate-400 flex items-center space-x-2 pt-1 border-t border-slate-800/80">
                      <span className="text-amber-400">{metrics.disputes?.pending || 0} Pending Arbitration</span>
                      <span>•</span>
                      <span>{metrics.disputes?.total || 0} Total Ingested</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-medium text-slate-400">Total Verified Milestones</span>
                    <div className="text-3xl font-bold text-blue-400">{metrics.milestones?.total || 0}</div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                      Cryptographically tracked milestone lifecycle
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-medium text-slate-400">Hiring Requests</span>
                    <div className="text-3xl font-bold text-white">{metrics.hiringRequests?.total || 0}</div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                      <span className="text-amber-400">{metrics.hiringRequests?.pending || 0} Pending Review</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-medium text-slate-400">Active Escrow Protective Holds</span>
                    <div className="text-3xl font-bold text-amber-400">{metrics.escrow?.activeHolds || 0}</div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                      Dispute hold preventing unauthorized release
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* User Directory & Status Management */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-1 items-center space-x-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search users by name, email, or ID..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 w-full focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-1.5 text-xs">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={userRoleFilter}
                        onChange={(e) => setUserRoleFilter(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                      >
                        <option value="ALL">All Roles</option>
                        <option value={UserRole.CLIENT}>Clients</option>
                        <option value={UserRole.WORKER}>Workers</option>
                        <option value={UserRole.ADMIN}>Admins</option>
                        <option value={UserRole.SUPERADMIN}>Superadmins</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-1.5 text-xs">
                      <select
                        value={userStatusFilter}
                        onChange={(e) => setUserStatusFilter(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="DEACTIVATED">Deactivated</option>
                      </select>
                    </div>

                    <span className="text-xs font-mono text-slate-400 px-2 py-1 rounded bg-slate-800/80">
                      Showing {filteredUsers.length} of {usersList.length}
                    </span>
                  </div>
                </div>

                {/* Users Table */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="divide-y divide-slate-800/80">
                    {filteredUsers.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No registered users match the applied search and filter criteria.
                      </div>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSelf = u.id === currentUser?.id;
                        const isTargetSuper = u.role?.name === UserRole.SUPERADMIN;
                        const isTargetAdmin = u.role?.name === UserRole.ADMIN;
                        const canModify =
                          !isSelf &&
                          (currentUser?.role.name === UserRole.SUPERADMIN || (!isTargetSuper && !isTargetAdmin));

                        return (
                          <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-white">
                                  {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}
                                </span>
                                <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                  u.role?.name === UserRole.SUPERADMIN
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : u.role?.name === UserRole.ADMIN
                                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                      : u.role?.name === UserRole.WORKER
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}>
                                  {u.role?.name}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded font-medium ${
                                    u.status === 'ACTIVE'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : u.status === 'SUSPENDED'
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}
                                >
                                  {u.status}
                                </span>
                                {isSelf && (
                                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                                    Current Session
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-500 font-mono text-[11px]">
                                {u.email} | ID: {u.id}
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setInspectUser(u)}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition flex items-center space-x-1 border border-slate-700"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect</span>
                              </button>

                              {canModify ? (
                                u.status === 'ACTIVE' ? (
                                  <button
                                    onClick={() => openStatusModal(u, 'SUSPENDED')}
                                    className="px-2.5 py-1 rounded bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/30 text-amber-400 text-xs transition"
                                  >
                                    Suspend
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => openStatusModal(u, 'ACTIVE')}
                                    className="px-2.5 py-1 rounded bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs transition"
                                  >
                                    Reactivate
                                  </button>
                                )
                              ) : (
                                <span className="text-[11px] text-slate-600 italic">Protected</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Contract Oversight */}
            {activeTab === 'contracts' && (
              <AdminContractsOversight onNavigateToDisputes={() => setActiveTab('disputes')} />
            )}

            {/* Admin Activity History */}
            {activeTab === 'activities' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-1 items-center space-x-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search logs by action, admin, or target ID..."
                        value={activitySearch}
                        onChange={(e) => setActivitySearch(e.target.value)}
                        className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 w-full focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 text-xs">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={activityActionFilter}
                      onChange={(e) => setActivityActionFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Actions</option>
                      <option value="UPDATE_USER_STATUS">UPDATE_USER_STATUS</option>
                      <option value="PROVISION_ROLE">PROVISION_ROLE</option>
                      <option value="ARBITRATE_DISPUTE">ARBITRATE_DISPUTE</option>
                      <option value="SET_DISPUTE_HOLD">SET_DISPUTE_HOLD</option>
                      <option value="ADD_DISPUTE_NOTE">ADD_DISPUTE_NOTE</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="divide-y divide-slate-800/80">
                    {filteredActivities.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No administrative activity records match the criteria.
                      </div>
                    ) : (
                      filteredActivities.map((act) => (
                        <div key={act.id} className="p-4 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-blue-400">{act.action}</span>
                              <span className="text-slate-400">by</span>
                              <span className="font-semibold text-white">
                                {act.admin?.firstName ? `${act.admin.firstName} (${act.admin.email})` : act.admin?.email || 'System'}
                              </span>
                            </div>
                            <span className="text-slate-500 font-mono text-[11px]">
                              {new Date(act.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <div className="text-slate-400 font-mono text-[11px] flex items-center space-x-2">
                            <span>Target ID: {act.targetUserId || 'N/A'}</span>
                            {act.details && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500">
                                  {JSON.stringify(act.details)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Financial Oversight Tab */}
            {activeTab === 'financial' && (
              <div className="space-y-6">
                {/* Governance Status Notice */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-amber-300">
                      LIVE MONEY CUSTODY DISABLED (ENTERPRISE DEFENSIVE MODE)
                    </div>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      Provider live execution is strictly disabled. Live payment processing flags (PAYMENTS_LIVE_ENABLED,
                      ESCROW_LIVE_MOVEMENT_ENABLED, PAYOUTS_ENABLED) remain false. Contractual totals represent agreed
                      commitments. Escrow records and double-entry ledgers operate under verified mathematical invariants.
                    </p>
                  </div>
                </div>

                {/* Financial KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">Total Contractual Agreed</span>
                    <div className="text-2xl font-bold text-white">
                      {financialOverview ? formatCurrencyMinor(financialOverview.totalContractualAgreedMinor, 'USD') : '$0.00'}
                    </div>
                    <div className="text-[11px] text-slate-500">Agreed commitments across all contracts</div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">Custodial Escrow Held</span>
                    <div className="text-2xl font-bold text-emerald-400">
                      {financialOverview ? formatCurrencyMinor(financialOverview.totalFundedInEscrowMinor, 'USD') : '$0.00'}
                    </div>
                    <div className="text-[11px] text-slate-500">Locked in escrow ledger</div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">Released to Workers</span>
                    <div className="text-2xl font-bold text-blue-400">
                      {financialOverview ? formatCurrencyMinor(financialOverview.totalReleasedToWorkersMinor, 'USD') : '$0.00'}
                    </div>
                    <div className="text-[11px] text-slate-500">Verified milestone disbursements</div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">System Double-Entry Status</span>
                    <div className="text-2xl font-bold flex items-center space-x-1.5 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>{financialOverview?.systemTrialBalanceBalanced ? 'Balanced' : 'Unbalanced'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">Debits strictly equal credits</div>
                  </div>
                </div>

                {/* Escrow Records Table */}
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Digital Contract Escrow Records</h4>
                      <p className="text-xs text-slate-400">Lifecycle state machine and dispute hold governance</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Filter escrow records..."
                          value={escrowSearch}
                          onChange={(e) => setEscrowSearch(e.target.value)}
                          className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 w-48 sm:w-56 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <span className="text-xs font-mono px-2 py-1 rounded bg-slate-800 text-slate-300">
                        {filteredEscrows.length} Escrows
                      </span>
                    </div>
                  </div>

                  {isLoadingFinancial ? (
                    <div className="p-8 text-center text-slate-400 text-xs">Loading escrow records...</div>
                  ) : filteredEscrows.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      No escrow records found.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {filteredEscrows.map((esc) => (
                        <div key={esc.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-white">{esc.contractNumber || 'Contract'}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                esc.status === 'FUNDED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : esc.status === 'DISPUTED'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {esc.status}
                              </span>
                              {esc.disputeHold && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  PROTECTIVE HOLD ACTIVE
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400">{esc.contractTitle}</div>
                            <div className="text-slate-500 text-[11px] font-mono">
                              Contractual: {formatCurrencyMinor(esc.contractualAmountMinor, esc.currency)} |
                              Funded: {formatCurrencyMinor(esc.fundedAmountMinor, esc.currency)} |
                              Released: {formatCurrencyMinor(esc.releasedAmountMinor, esc.currency)}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleToggleDisputeHold(esc.contractId, esc.disputeHold)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                esc.disputeHold
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : 'bg-rose-600/80 hover:bg-rose-600 text-white'
                              }`}
                            >
                              {esc.disputeHold ? 'Lift Dispute Hold' : 'Place Dispute Hold'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment Transactions Audit */}
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Payment Transactions Audit</h4>
                      <p className="text-xs text-slate-400">Provider transactions and settlement status</p>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {paymentsList.length} Transactions
                    </span>
                  </div>

                  {paymentsList.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      No payment transactions recorded.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {paymentsList.map((tx) => (
                        <div key={tx.id} className="p-4 flex items-center justify-between text-xs font-mono">
                          <div>
                            <span className="text-slate-200 font-bold">{tx.transactionReference}</span>
                            <div className="text-slate-500 text-[11px]">
                              Payer: {tx.payerName || tx.payerId} | Type: {tx.type} | Provider: {tx.provider || 'PENDING'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-bold">{formatCurrencyMinor(tx.amountMinor, tx.currency)}</div>
                            <span className="text-amber-400 text-[11px]">{tx.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dispute Resolution Tab */}
            {activeTab === 'disputes' && <DisputesWorkspace />}

            {/* Telemetry Tab */}
            {activeTab === 'system' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                    <Server className="w-4 h-4 text-blue-400" />
                    <span>Express API Service</span>
                  </div>
                  {apiHealth ? (
                    <div className="text-xs text-slate-400 space-y-1.5 font-mono">
                      <div>Status: <span className="text-emerald-400 font-bold">{apiHealth.status}</span></div>
                      <div>Service: {apiHealth.service}</div>
                      <div>Version: {apiHealth.version}</div>
                      <div>Uptime: {apiHealth.uptimeSeconds}s</div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">Checking API health...</div>
                  )}
                </div>

                <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>Supabase PostgreSQL DB</span>
                  </div>
                  {dbHealth ? (
                    <div className="text-xs text-slate-400 space-y-1.5 font-mono">
                      <div>Status: <span className="text-emerald-400 font-bold">{dbHealth.status}</span></div>
                      <div>Database: {dbHealth.database}</div>
                      {dbHealth.latencyMs && <div>Latency: <span className="text-blue-400 font-bold">{dbHealth.latencyMs}ms</span></div>}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">Checking DB health...</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Inspect User Modal */}
      {inspectUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-base">Account Inspection</h3>
              </div>
              <button onClick={() => setInspectUser(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800/80">
                <div>
                  <span className="text-slate-500">Full Name</span>
                  <div className="font-semibold text-white mt-0.5">
                    {inspectUser.firstName ? `${inspectUser.firstName} ${inspectUser.lastName || ''}` : 'Not Provided'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Role</span>
                  <div className="font-semibold text-blue-400 mt-0.5">{inspectUser.role?.name}</div>
                </div>
                <div>
                  <span className="text-slate-500">Account Status</span>
                  <div className="font-semibold text-emerald-400 mt-0.5">{inspectUser.status}</div>
                </div>
                <div>
                  <span className="text-slate-500">Registered</span>
                  <div className="font-mono text-slate-300 mt-0.5">
                    {inspectUser.createdAt ? new Date(inspectUser.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500">Email Address</span>
                <div className="font-mono text-slate-300 p-2 rounded bg-slate-950 border border-slate-800">
                  {inspectUser.email}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500">Internal User ID</span>
                <div className="font-mono text-[11px] text-slate-400 p-2 rounded bg-slate-950 border border-slate-800 select-all">
                  {inspectUser.id}
                </div>
              </div>

              {inspectUser.profile && (
                <div className="space-y-1">
                  <span className="text-slate-500">Profile Details</span>
                  <div className="text-slate-300 p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
                    {inspectUser.profile.phone && <div>Phone: {inspectUser.profile.phone}</div>}
                    {inspectUser.profile.country && <div>Country: {inspectUser.profile.country}</div>}
                    {inspectUser.profile.bio && <div className="italic text-slate-400">"{inspectUser.profile.bio}"</div>}
                  </div>
                </div>
              )}

              {inspectUser.workerProfile && (
                <div className="space-y-1">
                  <span className="text-slate-500">Worker Profile</span>
                  <div className="text-slate-300 p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
                    <div>Title: {inspectUser.workerProfile.title || 'Not specified'}</div>
                    {inspectUser.workerProfile.hourlyRate && (
                      <div>Hourly Rate: ${(inspectUser.workerProfile.hourlyRate / 100).toFixed(2)}/hr</div>
                    )}
                    <div>Availability: {inspectUser.workerProfile.availability || 'AVAILABLE'}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setInspectUser(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Status Change Confirmation Modal */}
      {statusModalUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-white text-base">Confirm Account Status Modification</h3>
            </div>

            <p className="text-xs text-slate-300">
              You are modifying the status of{' '}
              <span className="font-bold text-white">{statusModalUser.email}</span> from{' '}
              <span className="font-semibold">{statusModalUser.status}</span> to{' '}
              <span className="font-bold text-amber-400">{statusModalTargetStatus}</span>.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Administrative Rationale (Required for Audit Compliance)
              </label>
              <textarea
                rows={3}
                placeholder="Enter detailed reason for account suspension or status change (min 5 characters)..."
                value={statusModalReason}
                onChange={(e) => setStatusModalReason(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setStatusModalUser(null)}
                disabled={isSubmittingStatus}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={isSubmittingStatus || statusModalReason.trim().length < 5}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white disabled:opacity-50 transition"
              >
                {isSubmittingStatus ? 'Recording...' : `Confirm ${statusModalTargetStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
