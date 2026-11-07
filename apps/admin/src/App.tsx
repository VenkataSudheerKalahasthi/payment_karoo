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
import { ThemeToggle } from './components/ThemeToggle';

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
  const [escrowRecords, setEscrowRecords] = useState<EscrowRecordDto[]>([]);
  const [paymentsList, setPaymentsList] = useState<PaymentTransactionDto[]>([]);
  const [escrowSearch, setEscrowSearch] = useState('');
  const [isLoadingFinancial, setIsLoadingFinancial] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);

  const loadAdminData = useCallback(async () => {
    if (!isSignedIn) return;

    try {
      const [meRes, metricsRes, usersRes, actRes] = await Promise.allSettled([
        apiService.getMe(),
        apiService.getDashboardMetrics(),
        apiService.listAllUsers(),
        apiService.listAdminActivities(),
      ]);

      if (meRes.status === 'fulfilled' && meRes.value.success && meRes.value.data) {
        setCurrentUser(meRes.value.data as unknown as AdminUserRecord);
      }
      if (metricsRes.status === 'fulfilled' && metricsRes.value.success && metricsRes.value.data) {
        setMetrics(metricsRes.value.data as AdminDashboardMetrics);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.success && usersRes.value.data) {
        setUsersList(usersRes.value.data as unknown as AdminUserRecord[]);
      }
      if (actRes.status === 'fulfilled' && actRes.value.success && actRes.value.data) {
        setAdminActivities(actRes.value.data as unknown as AdminActivityRecord[]);
      }
    } catch {
      // Handled silently
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn) {
      loadAdminData();
      initAdminSocket();
    } else {
      disconnectAdminSocket();
    }
    return () => {
      disconnectAdminSocket();
    };
  }, [isSignedIn, loadAdminData]);

  const loadFinancialData = useCallback(async () => {
    if (!isSignedIn) return;
    setIsLoadingFinancial(true);
    try {
      const [overviewRes, escrowsRes, paymentsRes] = await Promise.allSettled([
        apiService.getFinancialOverview(),
        apiService.listEscrows(),
        apiService.listPayments(),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.success && overviewRes.value.data) {
        setFinancialOverview(overviewRes.value.data);
      }
      if (escrowsRes.status === 'fulfilled' && escrowsRes.value.success && escrowsRes.value.data) {
        setEscrowRecords(escrowsRes.value.data);
      }
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value.success && paymentsRes.value.data) {
        setPaymentsList(paymentsRes.value.data);
      }
    } finally {
      setIsLoadingFinancial(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (activeTab === 'financial') {
      loadFinancialData();
    }
  }, [activeTab, loadFinancialData]);

  const handleToggleDisputeHold = async (contractId: string, currentHold: boolean) => {
    const reason = window.prompt(
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

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      !userSearch ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.id.toLowerCase().includes(userSearch.toLowerCase()) ||
      `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'ALL' || u.role?.name === userRoleFilter;
    const matchesStatus = userStatusFilter === 'ALL' || u.status === userStatusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredActivities = adminActivities.filter((a) => {
    const matchesSearch =
      !activitySearch ||
      a.action.toLowerCase().includes(activitySearch.toLowerCase()) ||
      (a.targetUserId && a.targetUserId.toLowerCase().includes(activitySearch.toLowerCase())) ||
      (a.admin?.email && a.admin.email.toLowerCase().includes(activitySearch.toLowerCase()));
    const matchesAction = activityActionFilter === 'ALL' || a.action === activityActionFilter;
    return matchesSearch && matchesAction;
  });

  const filteredEscrows = escrowRecords.filter((e) => {
    return (
      !escrowSearch ||
      e.contractNumber?.toLowerCase().includes(escrowSearch.toLowerCase()) ||
      e.contractTitle?.toLowerCase().includes(escrowSearch.toLowerCase()) ||
      e.status.toLowerCase().includes(escrowSearch.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen dark:bg-[#0B0D14] bg-[#F5F7FA] font-sans antialiased flex flex-col dark:text-[#E8ECF5] text-[#242424] transition-colors duration-200">
      {/* Top Administrative Header */}
      <header className="sticky top-0 z-40 dark:bg-[#0B0D14]/90 bg-white/90 backdrop-blur-md border-b dark:border-[#272B38] border-[#E2E8F0] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight dark:text-[#E8ECF5] text-[#242424]">
                  TrustPay Admin
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-mono bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20 font-semibold">
                  Enterprise Governance
                </span>
              </div>
              <span className="text-[11px] dark:text-[#9AA4B8] text-[#64748B]">
                Administrative Oversight &amp; Audit Console
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {currentUser && (
              <div className="hidden sm:flex items-center space-x-2 text-xs">
                <span className="dark:text-[#9AA4B8] text-[#64748B]">Signed in:</span>
                <span className="font-semibold dark:text-[#E8ECF5] text-[#242424]">
                  {currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}` : currentUser.email}
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    currentUser.role.name === UserRole.SUPERADMIN
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      : 'bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20'
                  }`}
                >
                  {currentUser.role.name}
                </span>
              </div>
            )}

            <button
              onClick={fetchStatus}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl dark:bg-[#191B25] bg-[#F1F5F9] hover:dark:bg-[#191D2A] hover:bg-[#E2E8F0] text-xs font-semibold dark:text-[#E8ECF5] text-[#242424] transition border dark:border-[#272B38] border-[#E2E8F0] shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#2563EB]' : ''}`} />
              <span>Verify Cluster</span>
            </button>

            {/* Global Theme Toggle */}
            <ThemeToggle />

            {isLoaded && (
              <>
                {isSignedIn ? (
                  <div className="flex items-center space-x-2">
                    <NotificationDropdown />
                    <UserButton afterSignOutUrl="/" />
                  </div>
                ) : (
                  <SignInButton mode="modal">
                    <button className="px-3.5 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white transition flex items-center space-x-1 shadow-sm">
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
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionMessage}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!isSignedIn ? (
          <div className="p-12 text-center dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl max-w-lg mx-auto space-y-4 shadow-sm">
            <Lock className="w-12 h-12 text-[#2563EB] mx-auto" />
            <h3 className="text-xl font-bold dark:text-[#E8ECF5] text-[#242424]">Administrative Authentication Required</h3>
            <p className="text-xs dark:text-[#9AA4B8] text-[#64748B] leading-relaxed">
              Only authorized administrators with verified Clerk identities and assigned ADMIN or SUPERADMIN
              roles may access this governance console.
            </p>
            <SignInButton mode="modal">
              <button className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white transition shadow-sm">
                Sign In with Administrative Credentials
              </button>
            </SignInButton>
          </div>
        ) : !isPrivileged && currentUser ? (
          <div className="p-8 bg-rose-500/10 border border-rose-500/20 rounded-2xl max-w-lg mx-auto text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <h3 className="text-lg font-bold text-rose-500">Insufficient Clearance</h3>
            <p className="text-xs dark:text-[#E8ECF5] text-[#242424]">
              Your verified identity has role <span className="font-bold">{currentUser.role?.name}</span>.
              Administrative access is strictly restricted to ADMIN and SUPERADMIN accounts.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Admin Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b dark:border-[#272B38] border-[#E2E8F0] pb-3">
              <button
                onClick={() => setActiveTab('metrics')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'metrics'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'dark:bg-[#191B25] bg-white dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Platform Overview</span>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'users'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'dark:bg-[#191B25] bg-white dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>User Directory ({usersList.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('contracts')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'contracts'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'dark:bg-[#191B25] bg-white dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Contracts Oversight</span>
              </button>
              <button
                onClick={() => setActiveTab('activities')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'activities'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'dark:bg-[#191B25] bg-white dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Activity History</span>
              </button>
              <button
                onClick={() => setActiveTab('financial')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'financial'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'dark:bg-[#191B25] bg-white dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Financial Oversight &amp; Escrow</span>
              </button>
              <button
                onClick={() => setActiveTab('disputes')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'disputes'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'dark:bg-[#191B25] bg-white dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Dispute Arbitration</span>
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'system'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'dark:bg-[#191B25] bg-white dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Telemetry &amp; Health</span>
              </button>
            </div>

            {/* Metrics Overview Bento */}
            {activeTab === 'metrics' && metrics && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-2">
                    <span className="text-xs font-medium dark:text-[#9AA4B8] text-[#64748B]">Total Registered Users</span>
                    <div className="text-3xl font-bold font-mono dark:text-[#E8ECF5] text-[#242424]">{metrics.users?.total || 0}</div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] flex items-center space-x-2 pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                      <span className="text-[#2563EB] font-mono">{metrics.users?.clients || 0} Clients</span>
                      <span>•</span>
                      <span className="text-emerald-500 font-mono">{metrics.users?.workers || 0} Workers</span>
                      <span>•</span>
                      <span className="font-mono">{metrics.users?.admins || 0} Admins</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-2">
                    <span className="text-xs font-medium dark:text-[#9AA4B8] text-[#64748B]">Active Digital Contracts</span>
                    <div className="text-3xl font-bold font-mono text-emerald-500">{metrics.contracts?.active || 0}</div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] flex items-center space-x-2 pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                      <span className="font-mono">{metrics.contracts?.total || 0} Total Formulated</span>
                      <span>•</span>
                      <span className="text-[#2563EB] font-mono">{metrics.contracts?.completed || 0} Completed</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-2">
                    <span className="text-xs font-medium dark:text-[#9AA4B8] text-[#64748B]">Contractual Disputes</span>
                    <div className="text-3xl font-bold font-mono text-rose-500">{metrics.contracts?.disputed || 0}</div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] flex items-center space-x-2 pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                      <span className="text-amber-500 font-mono">{metrics.disputes?.pending || 0} Pending Arbitration</span>
                      <span>•</span>
                      <span className="font-mono">{metrics.disputes?.total || 0} Total Ingested</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-2">
                    <span className="text-xs font-medium dark:text-[#9AA4B8] text-[#64748B]">Total Verified Milestones</span>
                    <div className="text-3xl font-bold font-mono text-[#2563EB]">{metrics.milestones?.total || 0}</div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                      Cryptographically tracked milestone lifecycle
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-2">
                    <span className="text-xs font-medium dark:text-[#9AA4B8] text-[#64748B]">Hiring Requests</span>
                    <div className="text-3xl font-bold font-mono dark:text-[#E8ECF5] text-[#242424]">{metrics.hiringRequests?.total || 0}</div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                      <span className="text-amber-500 font-mono">{metrics.hiringRequests?.pending || 0} Pending Review</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-2">
                    <span className="text-xs font-medium dark:text-[#9AA4B8] text-[#64748B]">Active Escrow Protective Holds</span>
                    <div className="text-3xl font-bold font-mono text-amber-500">{metrics.escrow?.activeHolds || 0}</div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
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
                <div className="p-4 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex flex-1 items-center space-x-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 dark:text-[#9AA4B8] text-[#94A3B8]" />
                      <input
                        type="text"
                        placeholder="Search users by name, email, or ID..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-9 pr-3 py-1.5 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] placeholder-slate-400 w-full focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-1.5 text-xs">
                      <Filter className="w-3.5 h-3.5 dark:text-[#9AA4B8] text-[#64748B]" />
                      <select
                        value={userRoleFilter}
                        onChange={(e) => setUserRoleFilter(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] focus:outline-none focus:border-[#2563EB]"
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
                        className="px-2.5 py-1.5 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] focus:outline-none focus:border-[#2563EB]"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="DEACTIVATED">Deactivated</option>
                      </select>
                    </div>

                    <span className="text-xs font-mono dark:text-[#9AA4B8] text-[#64748B] px-2.5 py-1 rounded-lg dark:bg-[#191D2A] bg-[#F1F5F9] border dark:border-[#272B38] border-[#E2E8F0]">
                      Showing {filteredUsers.length} of {usersList.length}
                    </span>
                  </div>
                </div>

                {/* Users Table */}
                <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
                  <div className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
                    {filteredUsers.length === 0 ? (
                      <div className="p-8 text-center dark:text-[#9AA4B8] text-[#64748B] text-xs">
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
                          <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:dark:bg-[#191D2A]/40 hover:bg-[#F8FAFC] transition">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold dark:text-[#E8ECF5] text-[#242424]">
                                  {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}
                                </span>
                                <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                  u.role?.name === UserRole.SUPERADMIN
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    : u.role?.name === UserRole.ADMIN
                                      ? 'bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20'
                                      : u.role?.name === UserRole.WORKER
                                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                        : 'dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#E8ECF5] text-[#475569] border dark:border-[#272B38] border-[#E2E8F0]'
                                }`}>
                                  {u.role?.name}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded font-medium text-[10px] ${
                                    u.status === 'ACTIVE'
                                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                      : u.status === 'SUSPENDED'
                                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                        : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  }`}
                                >
                                  {u.status}
                                </span>
                                {isSelf && (
                                  <span className="px-2 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20 text-[10px] font-bold font-mono">
                                    Current Session
                                  </span>
                                )}
                              </div>
                              <div className="dark:text-[#9AA4B8] text-[#64748B] font-mono text-[11px]">
                                {u.email} | ID: {u.id}
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setInspectUser(u)}
                                className="px-3 py-1 rounded-lg dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] dark:text-[#E8ECF5] text-[#242424] text-xs transition flex items-center space-x-1 border dark:border-[#272B38] border-[#E2E8F0] shadow-sm"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#2563EB]" />
                                <span>Inspect</span>
                              </button>

                              {canModify ? (
                                u.status === 'ACTIVE' ? (
                                  <button
                                    onClick={() => openStatusModal(u, 'SUSPENDED')}
                                    className="px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 text-xs transition font-semibold"
                                  >
                                    Suspend
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => openStatusModal(u, 'ACTIVE')}
                                    className="px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 text-xs transition font-semibold"
                                  >
                                    Reactivate
                                  </button>
                                )
                              ) : (
                                <span className="text-[11px] dark:text-[#9AA4B8] text-[#94A3B8] italic">Protected</span>
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
                <div className="p-4 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex flex-1 items-center space-x-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 dark:text-[#9AA4B8] text-[#94A3B8]" />
                      <input
                        type="text"
                        placeholder="Search logs by action, admin, or target ID..."
                        value={activitySearch}
                        onChange={(e) => setActivitySearch(e.target.value)}
                        className="pl-9 pr-3 py-1.5 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] placeholder-slate-400 w-full focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 text-xs">
                    <Filter className="w-3.5 h-3.5 dark:text-[#9AA4B8] text-[#64748B]" />
                    <select
                      value={activityActionFilter}
                      onChange={(e) => setActivityActionFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] focus:outline-none focus:border-[#2563EB]"
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

                <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
                  <div className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
                    {filteredActivities.length === 0 ? (
                      <div className="p-8 text-center dark:text-[#9AA4B8] text-[#64748B] text-xs">
                        No administrative activity records match the criteria.
                      </div>
                    ) : (
                      filteredActivities.map((act) => (
                        <div key={act.id} className="p-4 space-y-1 text-xs hover:dark:bg-[#191D2A]/40 hover:bg-[#F8FAFC] transition">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-[#2563EB]">{act.action}</span>
                              <span className="dark:text-[#9AA4B8] text-[#64748B]">by</span>
                              <span className="font-semibold dark:text-[#E8ECF5] text-[#242424]">
                                {act.admin?.firstName ? `${act.admin.firstName} (${act.admin.email})` : act.admin?.email || 'System'}
                              </span>
                            </div>
                            <span className="dark:text-[#9AA4B8] text-[#64748B] font-mono text-[11px]">
                              {new Date(act.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <div className="dark:text-[#9AA4B8] text-[#64748B] font-mono text-[11px] flex items-center space-x-2">
                            <span>Target ID: {act.targetUserId || 'N/A'}</span>
                            {act.details && (
                              <>
                                <span>•</span>
                                <span className="dark:text-[#9AA4B8] text-[#94A3B8]">
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
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start space-x-3 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-amber-500 uppercase tracking-wide">
                      LIVE MONEY CUSTODY DISABLED (ENTERPRISE DEFENSIVE MODE)
                    </div>
                    <p className="text-xs text-amber-500/80 leading-relaxed">
                      Provider live execution is strictly disabled. Live payment processing flags (PAYMENTS_LIVE_ENABLED,
                      ESCROW_LIVE_MOVEMENT_ENABLED, PAYOUTS_ENABLED) remain false. Contractual totals represent agreed
                      commitments. Escrow records and double-entry ledgers operate under verified mathematical invariants.
                    </p>
                  </div>
                </div>

                {/* Financial KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-1">
                    <span className="text-xs dark:text-[#9AA4B8] text-[#64748B]">Total Contractual Agreed</span>
                    <div className="text-2xl font-bold font-mono dark:text-[#E8ECF5] text-[#242424]">
                      {financialOverview ? formatCurrencyMinor(financialOverview.totalContractualAgreedMinor, 'USD') : '$0.00'}
                    </div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B]">Agreed commitments across all contracts</div>
                  </div>

                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-1">
                    <span className="text-xs dark:text-[#9AA4B8] text-[#64748B]">Custodial Escrow Held</span>
                    <div className="text-2xl font-bold font-mono text-emerald-500">
                      {financialOverview ? formatCurrencyMinor(financialOverview.totalFundedInEscrowMinor, 'USD') : '$0.00'}
                    </div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B]">Locked in escrow ledger</div>
                  </div>

                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-1">
                    <span className="text-xs dark:text-[#9AA4B8] text-[#64748B]">Released to Workers</span>
                    <div className="text-2xl font-bold font-mono text-[#2563EB]">
                      {financialOverview ? formatCurrencyMinor(financialOverview.totalReleasedToWorkersMinor, 'USD') : '$0.00'}
                    </div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B]">Verified milestone disbursements</div>
                  </div>

                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-1">
                    <span className="text-xs dark:text-[#9AA4B8] text-[#64748B]">System Double-Entry Status</span>
                    <div className="text-2xl font-bold flex items-center space-x-1.5 text-emerald-500">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span>{financialOverview?.systemTrialBalanceBalanced ? 'Balanced' : 'Unbalanced'}</span>
                    </div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B]">Debits strictly equal credits</div>
                  </div>
                </div>

                {/* Escrow Records Table */}
                <div className="rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] overflow-hidden shadow-sm">
                  <div className="p-4 border-b dark:border-[#272B38] border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 dark:bg-[#191D2A] bg-[#F1F5F9]">
                    <div>
                      <h4 className="text-sm font-semibold dark:text-[#E8ECF5] text-[#242424]">Digital Contract Escrow Records</h4>
                      <p className="text-xs dark:text-[#9AA4B8] text-[#64748B]">Lifecycle state machine and dispute hold governance</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 dark:text-[#9AA4B8] text-[#94A3B8]" />
                        <input
                          type="text"
                          placeholder="Filter escrow records..."
                          value={escrowSearch}
                          onChange={(e) => setEscrowSearch(e.target.value)}
                          className="pl-8 pr-3 py-1.5 rounded-xl dark:bg-[#0B0D14] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] placeholder-slate-400 w-48 sm:w-56 focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>
                      <span className="text-xs font-mono px-2.5 py-1 rounded-lg dark:bg-[#0B0D14] bg-white dark:text-[#E8ECF5] text-[#242424] border dark:border-[#272B38] border-[#E2E8F0]">
                        {filteredEscrows.length} Escrows
                      </span>
                    </div>
                  </div>

                  {isLoadingFinancial ? (
                    <div className="p-8 text-center dark:text-[#9AA4B8] text-[#64748B] text-xs">Loading escrow records...</div>
                  ) : filteredEscrows.length === 0 ? (
                    <div className="p-8 text-center dark:text-[#9AA4B8] text-[#64748B] text-xs">
                      No escrow records found.
                    </div>
                  ) : (
                    <div className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
                      {filteredEscrows.map((esc) => (
                        <div key={esc.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs hover:dark:bg-[#191D2A]/40 hover:bg-[#F8FAFC] transition">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold dark:text-[#E8ECF5] text-[#242424]">{esc.contractNumber || 'Contract'}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                esc.status === 'FUNDED'
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  : esc.status === 'DISPUTED'
                                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              }`}>
                                {esc.status}
                              </span>
                              {esc.disputeHold && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                  PROTECTIVE HOLD ACTIVE
                                </span>
                              )}
                            </div>
                            <div className="dark:text-[#9AA4B8] text-[#64748B]">{esc.contractTitle}</div>
                            <div className="dark:text-[#9AA4B8] text-[#64748B] text-[11px] font-mono">
                              Contractual: {formatCurrencyMinor(esc.contractualAmountMinor, esc.currency)} |
                              Funded: {formatCurrencyMinor(esc.fundedAmountMinor, esc.currency)} |
                              Released: {formatCurrencyMinor(esc.releasedAmountMinor, esc.currency)}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleToggleDisputeHold(esc.contractId, esc.disputeHold)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm ${
                                esc.disputeHold
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : 'bg-rose-600 hover:bg-rose-500 text-white'
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
                <div className="rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] overflow-hidden shadow-sm">
                  <div className="p-4 border-b dark:border-[#272B38] border-[#E2E8F0] flex items-center justify-between dark:bg-[#191D2A] bg-[#F1F5F9]">
                    <div>
                      <h4 className="text-sm font-semibold dark:text-[#E8ECF5] text-[#242424]">Payment Transactions Audit</h4>
                      <p className="text-xs dark:text-[#9AA4B8] text-[#64748B]">Provider transactions and settlement status</p>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded-lg dark:bg-[#0B0D14] bg-white dark:text-[#E8ECF5] text-[#242424] border dark:border-[#272B38] border-[#E2E8F0]">
                      {paymentsList.length} Transactions
                    </span>
                  </div>

                  {paymentsList.length === 0 ? (
                    <div className="p-8 text-center dark:text-[#9AA4B8] text-[#64748B] text-xs">
                      No payment transactions recorded.
                    </div>
                  ) : (
                    <div className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
                      {paymentsList.map((tx) => (
                        <div key={tx.id} className="p-4 flex items-center justify-between text-xs font-mono hover:dark:bg-[#191D2A]/40 hover:bg-[#F8FAFC] transition">
                          <div>
                            <span className="dark:text-[#E8ECF5] text-[#242424] font-bold">{tx.transactionReference}</span>
                            <div className="dark:text-[#9AA4B8] text-[#64748B] text-[11px] font-sans">
                              Payer: {tx.payerName || tx.payerId} | Type: {tx.type} | Provider: {tx.provider || 'PENDING'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="dark:text-[#E8ECF5] text-[#242424] font-bold">{formatCurrencyMinor(tx.amountMinor, tx.currency)}</div>
                            <span className="text-amber-500 text-[11px] font-medium font-sans">{tx.status}</span>
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
                <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-3">
                  <div className="flex items-center space-x-2 text-sm font-semibold dark:text-[#E8ECF5] text-[#242424]">
                    <Server className="w-4 h-4 text-[#2563EB]" />
                    <span>Express API Service</span>
                  </div>
                  {apiHealth ? (
                    <div className="text-xs dark:text-[#9AA4B8] text-[#64748B] space-y-1.5 font-mono">
                      <div>Status: <span className="text-emerald-500 font-bold">{apiHealth.status}</span></div>
                      <div>Service: {apiHealth.service}</div>
                      <div>Version: {apiHealth.version}</div>
                      <div>Uptime: {apiHealth.uptimeSeconds}s</div>
                    </div>
                  ) : (
                    <div className="text-xs dark:text-[#9AA4B8] text-[#64748B]">Checking API health...</div>
                  )}
                </div>

                <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-3">
                  <div className="flex items-center space-x-2 text-sm font-semibold dark:text-[#E8ECF5] text-[#242424]">
                    <Database className="w-4 h-4 text-emerald-500" />
                    <span>Supabase PostgreSQL DB</span>
                  </div>
                  {dbHealth ? (
                    <div className="text-xs dark:text-[#9AA4B8] text-[#64748B] space-y-1.5 font-mono">
                      <div>Status: <span className="text-emerald-500 font-bold">{dbHealth.status}</span></div>
                      <div>Database: {dbHealth.database}</div>
                      {dbHealth.latencyMs && <div>Latency: <span className="text-[#2563EB] font-bold">{dbHealth.latencyMs}ms</span></div>}
                    </div>
                  ) : (
                    <div className="text-xs dark:text-[#9AA4B8] text-[#64748B]">Checking DB health...</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Inspect User Modal */}
      {inspectUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b dark:border-[#272B38] border-[#E2E8F0] pb-3">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-bold dark:text-[#E8ECF5] text-[#242424] text-base">Account Inspection</h3>
              </div>
              <button onClick={() => setInspectUser(null)} className="dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0]">
                <div>
                  <span className="dark:text-[#9AA4B8] text-[#64748B]">Full Name</span>
                  <div className="font-semibold dark:text-[#E8ECF5] text-[#242424] mt-0.5">
                    {inspectUser.firstName ? `${inspectUser.firstName} ${inspectUser.lastName || ''}` : 'Not Provided'}
                  </div>
                </div>
                <div>
                  <span className="dark:text-[#9AA4B8] text-[#64748B]">Role</span>
                  <div className="font-semibold text-[#2563EB] mt-0.5">{inspectUser.role?.name}</div>
                </div>
                <div>
                  <span className="dark:text-[#9AA4B8] text-[#64748B]">Account Status</span>
                  <div className="font-semibold text-emerald-500 mt-0.5">{inspectUser.status}</div>
                </div>
                <div>
                  <span className="dark:text-[#9AA4B8] text-[#64748B]">Registered</span>
                  <div className="font-mono dark:text-[#9AA4B8] text-[#475569] mt-0.5">
                    {inspectUser.createdAt ? new Date(inspectUser.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="dark:text-[#9AA4B8] text-[#64748B]">Email Address</span>
                <div className="font-mono dark:text-[#E8ECF5] text-[#242424] p-2.5 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0]">
                  {inspectUser.email}
                </div>
              </div>

              <div className="space-y-1">
                <span className="dark:text-[#9AA4B8] text-[#64748B]">Internal User ID</span>
                <div className="font-mono text-[11px] dark:text-[#9AA4B8] text-[#64748B] p-2.5 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] select-all">
                  {inspectUser.id}
                </div>
              </div>

              {inspectUser.profile && (
                <div className="space-y-1">
                  <span className="dark:text-[#9AA4B8] text-[#64748B]">Profile Details</span>
                  <div className="dark:text-[#E8ECF5] text-[#242424] p-3 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] space-y-1">
                    {inspectUser.profile.phone && <div>Phone: {inspectUser.profile.phone}</div>}
                    {inspectUser.profile.country && <div>Country: {inspectUser.profile.country}</div>}
                    {inspectUser.profile.bio && <div className="italic dark:text-[#9AA4B8] text-[#64748B]">"{inspectUser.profile.bio}"</div>}
                  </div>
                </div>
              )}

              {inspectUser.workerProfile && (
                <div className="space-y-1">
                  <span className="dark:text-[#9AA4B8] text-[#64748B]">Worker Profile</span>
                  <div className="dark:text-[#E8ECF5] text-[#242424] p-3 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] space-y-1">
                    <div>Title: {inspectUser.workerProfile.title || 'Not specified'}</div>
                    {inspectUser.workerProfile.hourlyRate && (
                      <div className="font-mono">Hourly Rate: ${(inspectUser.workerProfile.hourlyRate / 100).toFixed(2)}/hr</div>
                    )}
                    <div>Availability: {inspectUser.workerProfile.availability || 'AVAILABLE'}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t dark:border-[#272B38] border-[#E2E8F0]">
              <button
                onClick={() => setInspectUser(null)}
                className="px-4 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] text-xs font-semibold dark:text-[#E8ECF5] text-[#242424] transition shadow-sm"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Status Change Confirmation Modal */}
      {statusModalUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-amber-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold dark:text-[#E8ECF5] text-[#242424] text-base">Confirm Account Status Modification</h3>
            </div>

            <p className="text-xs dark:text-[#9AA4B8] text-[#64748B] leading-relaxed">
              You are modifying the status of{' '}
              <span className="font-bold dark:text-[#E8ECF5] text-[#242424]">{statusModalUser.email}</span> from{' '}
              <span className="font-semibold">{statusModalUser.status}</span> to{' '}
              <span className="font-bold text-amber-500">{statusModalTargetStatus}</span>.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold dark:text-[#E8ECF5] text-[#242424]">
                Administrative Rationale (Required for Audit Compliance)
              </label>
              <textarea
                rows={3}
                placeholder="Enter detailed reason for account suspension or status change (min 5 characters)..."
                value={statusModalReason}
                onChange={(e) => setStatusModalReason(e.target.value)}
                className="w-full p-2.5 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] placeholder-slate-400 focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setStatusModalUser(null)}
                disabled={isSubmittingStatus}
                className="px-4 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] text-xs font-semibold dark:text-[#E8ECF5] text-[#475569] transition shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={isSubmittingStatus || statusModalReason.trim().length < 5}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white disabled:opacity-50 transition shadow-sm"
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
