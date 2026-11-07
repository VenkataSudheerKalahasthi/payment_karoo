import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  Server,
  Database,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  UserCog,
  LogIn,
  BookOpen,
  Scale,
  FileText,
  Users,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  X,
  Activity,
  Settings,
  DollarSign,
  Lock,
} from 'lucide-react';
import { useAuth, UserButton, SignInButton } from '@clerk/clerk-react';
import { apiService, setAuthTokenGetter } from './services/api';
import { initSuperadminSocket, disconnectSuperadminSocket } from './services/socket';
import {
  SystemHealthStatus,
  DatabaseHealthStatus,
  UserRole,
  FinancialOverviewDto,
  TrialBalanceReportDto,
  LedgerAccountDto,
  LedgerTransactionDto,
  PlatformFinancialConfigDto,
  EscrowRecordDto,
  formatCurrencyMinor,
  ContractDto,
  ContractIntegrityReportDto,
} from '@trustpay/shared';
import { SuperadminDisputesGovernance } from './components/SuperadminDisputesGovernance';
import { NotificationDropdown } from './components/NotificationDropdown';
import { ThemeToggle } from './components/ThemeToggle';

interface SuperadminDashboardMetrics {
  users?: {
    total: number;
    clients: number;
    workers: number;
    admins: number;
    superadmins: number;
    active: number;
    suspended: number;
  };
  contracts?: {
    total: number;
    active: number;
    completed: number;
    disputed: number;
    terminated?: number;
  };
  milestones?: { total: number };
  hiringRequests?: { total: number; pending: number };
  disputes?: { total: number; pending: number; escalated: number };
  escrow?: { total: number; activeHolds: number };
  ledger?: { totalTransactions: number };
  security?: { totalAuditLogs: number };
}

interface SuperadminUserRecord {
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

interface AuditLogRecord {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  actorId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
  actor?: { email?: string | null };
}

const ADMIN_PERMISSION_CATALOG = [
  {
    code: 'PLATFORM_USER_MANAGEMENT',
    name: 'User Directory & Status Management',
    description: 'Inspect platform accounts, review activity history, and suspend/reactivate non-administrative users.',
    tier: 'ADMIN & SUPERADMIN',
  },
  {
    code: 'CONTRACT_MONITORING',
    name: 'Digital Contract Oversight & Inspection',
    description: 'Real-time observation of all formulated digital contracts, milestone progressions, and amendments.',
    tier: 'ADMIN & SUPERADMIN',
  },
  {
    code: 'DISPUTE_ARBITRATION',
    name: 'Tier-1 Dispute Mediation & Evidence Review',
    description: 'Review dispute claims, examine uploaded PDF evidence, add staff investigation notes, and enforce resolution splits.',
    tier: 'ADMIN & SUPERADMIN',
  },
  {
    code: 'FINANCIAL_OVERSIGHT',
    name: 'Financial Ledger & Escrow Auditing',
    description: 'Review custodial balance projections, monitor transaction rails, and verify double-entry invariant health.',
    tier: 'ADMIN & SUPERADMIN',
  },
  {
    code: 'DISPUTE_PROTECTIVE_HOLD',
    name: 'Escrow Protective Hold Governance',
    description: 'Lock and unlock automated milestone escrow disbursements on disputed contracts with mandatory audit rationale.',
    tier: 'ADMIN & SUPERADMIN',
  },
  {
    code: 'ADMIN_ROLE_PROVISIONING',
    name: 'Administrative Role Provisioning',
    description: 'Grant, elevate, or reassign ADMIN and SUPERADMIN credentials across the platform identity directory.',
    tier: 'SUPERADMIN ONLY',
  },
  {
    code: 'LEDGER_TRANSACTION_REVERSAL',
    name: 'Double-Entry Transaction Reversal Execution',
    description: 'Post compensating offsetting general ledger entries for disputed or errant journal vouchers.',
    tier: 'SUPERADMIN ONLY',
  },
  {
    code: 'PLATFORM_PARAMETER_CONFIG',
    name: 'Systemic Platform Policy Configuration',
    description: 'Configure commission fees, dispute escalation windows, registration policy, and platform maintenance mode.',
    tier: 'SUPERADMIN ONLY',
  },
];

export const App: React.FC = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [currentUser, setCurrentUser] = useState<SuperadminUserRecord | null>(null);
  const [metrics, setMetrics] = useState<SuperadminDashboardMetrics | null>(null);
  const [usersList, setUsersList] = useState<SuperadminUserRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [globalContracts, setGlobalContracts] = useState<ContractDto[]>([]);
  const [apiHealth, setApiHealth] = useState<SystemHealthStatus | null>(null);
  const [dbHealth, setDbHealth] = useState<DatabaseHealthStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'admins' | 'users' | 'contracts' | 'disputes' | 'financial' | 'audit' | 'config' | 'system'>('overview');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Financial & General Ledger State
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReportDto | null>(null);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccountDto[]>([]);
  const [ledgerTransactions, setLedgerTransactions] = useState<LedgerTransactionDto[]>([]);
  const [financialConfig, setFinancialConfig] = useState<PlatformFinancialConfigDto | null>(null);
  const [financialOverview, setFinancialOverview] = useState<FinancialOverviewDto | null>(null);
  const [escrowsList, setEscrowsList] = useState<EscrowRecordDto[]>([]);
  const [isLoadingFinancial, setIsLoadingFinancial] = useState(false);

  // User Management State
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');
  const [inspectUser, setInspectUser] = useState<SuperadminUserRecord | null>(null);

  // Status Change Modal State
  const [statusModalUser, setStatusModalUser] = useState<SuperadminUserRecord | null>(null);
  const [statusModalTargetStatus, setStatusModalTargetStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'>('SUSPENDED');
  const [statusModalReason, setStatusModalReason] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Role Provisioning Form State
  const [targetUserId, setTargetUserId] = useState('');
  const [provisionRole, setProvisionRole] = useState<UserRole>(UserRole.ADMIN);
  const [provisionReason, setProvisionReason] = useState('');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Global Contracts Search & Integrity State
  const [contractSearch, setContractSearch] = useState('');
  const [contractStatusFilter, setContractStatusFilter] = useState<string>('ALL');
  const [selectedAuditContract, setSelectedAuditContract] = useState<string | null>(null);
  const [integrityAuditResult, setIntegrityAuditResult] = useState<ContractIntegrityReportDto | null>(null);
  const [isAuditingContract, setIsAuditingContract] = useState(false);

  // Audit Logs Search State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');

  // Escrow Search State
  const [escrowSearch, setEscrowSearch] = useState('');

  // Platform Config State
  const [platformConfigState, setPlatformConfigState] = useState({
    registrationMode: 'OPEN',
    maintenanceMode: 'DISABLED',
    disputeEscalationWindowDays: 7,
    milestoneReviewWindowDays: 14,
  });
  const [configSuccessMessage, setConfigSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);

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

  const loadFinancialData = useCallback(async () => {
    setIsLoadingFinancial(true);
    try {
      const [tbRes, accRes, txRes, cfgRes, ovRes, escRes] = await Promise.allSettled([
        apiService.getTrialBalance('USD'),
        apiService.listLedgerAccounts(),
        apiService.listLedgerTransactions({ limit: 50 }),
        apiService.getFinancialConfig(),
        apiService.getFinancialOverview(),
        apiService.listEscrows(),
      ]);

      if (tbRes.status === 'fulfilled' && tbRes.value.success && tbRes.value.data) {
        setTrialBalance(tbRes.value.data);
      }
      if (accRes.status === 'fulfilled' && accRes.value.success && accRes.value.data) {
        setLedgerAccounts(Array.isArray(accRes.value.data) ? accRes.value.data : ((accRes.value.data as unknown as { items: LedgerAccountDto[] }).items || []));
      }
      if (txRes.status === 'fulfilled' && txRes.value.success && txRes.value.data) {
        setLedgerTransactions(Array.isArray(txRes.value.data) ? txRes.value.data : ((txRes.value.data as unknown as { items: LedgerTransactionDto[] }).items || []));
      }
      if (cfgRes.status === 'fulfilled' && cfgRes.value.success && cfgRes.value.data) {
        setFinancialConfig(cfgRes.value.data);
      }
      if (ovRes.status === 'fulfilled' && ovRes.value.success && ovRes.value.data) {
        setFinancialOverview(ovRes.value.data);
      }
      if (escRes.status === 'fulfilled' && escRes.value.success && escRes.value.data) {
        setEscrowsList(Array.isArray(escRes.value.data) ? escRes.value.data : ((escRes.value.data as unknown as { items: EscrowRecordDto[] }).items || []));
      }
    } finally {
      setIsLoadingFinancial(false);
    }
  }, []);

  const loadSuperadminData = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = await getToken();
      const userRes = await apiService.getCurrentUser(token || undefined);
      if (userRes.success && userRes.data) {
        setCurrentUser(userRes.data as SuperadminUserRecord);
      }

      const [metricsRes, usersRes, logsRes, contractsRes] = await Promise.allSettled([
        apiService.getDashboardMetrics(),
        apiService.listUsers({ limit: 100 }),
        apiService.listAuditLogs({ limit: 100 }),
        apiService.listContracts(),
      ]);

      if (metricsRes.status === 'fulfilled' && metricsRes.value.success) {
        setMetrics(metricsRes.value.data as SuperadminDashboardMetrics);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.success) {
        setUsersList((usersRes.value.data as { items?: SuperadminUserRecord[] })?.items || []);
      }
      if (logsRes.status === 'fulfilled' && logsRes.value.success) {
        setAuditLogs((logsRes.value.data as { items?: AuditLogRecord[] })?.items || []);
      }
      if (contractsRes.status === 'fulfilled' && contractsRes.value.success && contractsRes.value.data) {
        setGlobalContracts(contractsRes.value.data);
      }
    } catch {
      // Handled
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (isSignedIn) {
      loadSuperadminData();
    }
  }, [isSignedIn, loadSuperadminData]);

  useEffect(() => {
    if (isSignedIn && activeTab === 'financial') {
      loadFinancialData();
    }
  }, [isSignedIn, activeTab, loadFinancialData]);

  useEffect(() => {
    if (!isSignedIn) return;

    let active = true;
    getToken().then((token) => {
      if (!active || !token) return;
      const sock = initSuperadminSocket(token);

      const handleRefresh = () => {
        loadSuperadminData();
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
      disconnectSuperadminSocket();
    };
  }, [isSignedIn, getToken, loadSuperadminData, loadFinancialData, activeTab]);

  const handleReverseTransaction = async (reference: string) => {
    const reason = prompt(`Enter authorized justification for reversing ledger transaction "${reference}":`);
    if (!reason || reason.trim().length < 5) {
      alert('Justification must be at least 5 characters for compliance audit.');
      return;
    }

    try {
      const res = await apiService.reverseTransaction(reference, reason.trim());
      if (res.success) {
        setActionMessage(`Transaction ${reference} reversed with offsetting entry.`);
        loadFinancialData();
      } else {
        setActionError(res.error?.message || 'Failed to reverse transaction');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error reversing transaction');
    }
  };

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

  const handleProvisionRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId || provisionReason.trim().length < 5) {
      setActionError('Please specify a target user and an authorized rationale (minimum 5 characters).');
      return;
    }

    setIsSubmittingRole(true);
    setActionError(null);
    try {
      const res = await apiService.provisionRole(targetUserId, provisionRole, provisionReason.trim());
      if (res.success) {
        setActionMessage(`Role ${provisionRole} successfully assigned and logged in audit vault.`);
        setTargetUserId('');
        setProvisionReason('');
        await loadSuperadminData();
      } else {
        setActionError(res.error?.message || 'Role provisioning failed');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error provisioning role');
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const openStatusModal = (user: SuperadminUserRecord, targetStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED') => {
    if (user.id === currentUser?.id && targetStatus !== 'ACTIVE') {
      alert('Security Protection: You cannot suspend or deactivate your own Superadmin account.');
      return;
    }
    setStatusModalUser(user);
    setStatusModalTargetStatus(targetStatus);
    setStatusModalReason('');
  };

  const confirmStatusChange = async () => {
    if (!statusModalUser || statusModalReason.trim().length < 5) {
      setActionError('A detailed rationale (minimum 5 characters) is required for immutable audit logging.');
      return;
    }

    setIsSubmittingStatus(true);
    setActionError(null);
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
        await loadSuperadminData();
      } else {
        setActionError(res.error?.message || 'Failed to update user status');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update user status.');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const isSuperadmin = currentUser?.role?.name === UserRole.SUPERADMIN;

  const adminAccountsList = usersList.filter(
    (u) => u.role?.name === UserRole.ADMIN || u.role?.name === UserRole.SUPERADMIN,
  );

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

  const filteredContracts = globalContracts.filter((c) => {
    const matchesSearch =
      !contractSearch ||
      c.contractNumber.toLowerCase().includes(contractSearch.toLowerCase()) ||
      c.title.toLowerCase().includes(contractSearch.toLowerCase()) ||
      (c.client?.email && c.client.email.toLowerCase().includes(contractSearch.toLowerCase())) ||
      (c.worker?.email && c.worker.email.toLowerCase().includes(contractSearch.toLowerCase()));

    const matchesStatus = contractStatusFilter === 'ALL' || c.status === contractStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesSearch =
      !auditSearch ||
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.resource.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.actor?.email && log.actor.email.toLowerCase().includes(auditSearch.toLowerCase())) ||
      (log.resourceId && log.resourceId.toLowerCase().includes(auditSearch.toLowerCase()));

    const matchesAction = auditActionFilter === 'ALL' || log.action === auditActionFilter;
    return matchesSearch && matchesAction;
  });

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
    <div className="min-h-screen flex flex-col dark:bg-[#0B0D14] bg-[#F5F7FA] font-sans antialiased dark:text-[#E8ECF5] text-[#242424] transition-colors duration-200">
      {/* Superadmin Header */}
      <header className="sticky top-0 z-50 dark:bg-[#0B0D14]/90 bg-white/90 backdrop-blur-md border-b dark:border-[#272B38] border-[#E2E8F0] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight dark:text-[#E8ECF5] text-[#242424]">
                  TrustPay Superadmin
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-mono bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20 font-semibold">
                  Root Governance
                </span>
              </div>
              <span className="text-[11px] dark:text-[#9AA4B8] text-[#64748B]">Enterprise Core Treasury &amp; System Console</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {currentUser && (
              <div className="hidden sm:flex items-center space-x-2 text-xs">
                <span className="dark:text-[#9AA4B8] text-[#64748B]">Root Identity:</span>
                <span className="font-semibold dark:text-[#E8ECF5] text-[#242424]">
                  {currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}` : currentUser.email}
                </span>
                <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20">
                  SUPERADMIN
                </span>
              </div>
            )}

            <button
              onClick={fetchStatus}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl dark:bg-[#191B25] bg-[#F1F5F9] hover:dark:bg-[#191D2A] hover:bg-[#E2E8F0] text-xs font-semibold dark:text-[#E8ECF5] text-[#242424] transition border dark:border-[#272B38] border-[#E2E8F0] shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#2563EB]' : ''}`} />
              <span>Audit Cluster</span>
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
                      <span>Governance Sign In</span>
                    </button>
                  </SignInButton>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Governance Content */}
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

        {actionError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!isSignedIn ? (
          <div className="p-12 text-center dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl max-w-lg mx-auto space-y-4 shadow-sm">
            <KeyRound className="w-12 h-12 text-[#2563EB] mx-auto" />
            <h3 className="text-xl font-bold dark:text-[#E8ECF5] text-[#242424]">Superadmin Clearance Required</h3>
            <p className="text-xs dark:text-[#9AA4B8] text-[#64748B] leading-relaxed">
              This governance environment allows provisioning administrative roles and inspecting platform
              audit events. Access is restricted to designated SUPERADMIN accounts.
            </p>
            <SignInButton mode="modal">
              <button className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white transition shadow-sm">
                Sign In with Superadmin Clearance
              </button>
            </SignInButton>
          </div>
        ) : !isSuperadmin && currentUser ? (
          <div className="p-8 bg-rose-500/10 border border-rose-500/20 rounded-2xl max-w-lg mx-auto text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <h3 className="text-lg font-bold text-rose-500">Root Governance Restricted</h3>
            <p className="text-xs dark:text-[#E8ECF5] text-[#242424]">
              Your account possesses role <span className="font-bold">{currentUser.role?.name}</span>. Only
              SUPERADMIN accounts are authorized to provision privileged roles.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Superadmin Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b dark:border-[#272B38] border-[#E2E8F0] pb-3">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'overview'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'dark:bg-[#191B25] bg-white dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Global Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab('admins')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'admins'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'dark:bg-[#191B25] bg-white dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
                }`}
              >
                <UserCog className="w-3.5 h-3.5" />
                <span>Admin Management ({adminAccountsList.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'users'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'dark:bg-[#191B25] bg-white dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>User Oversight ({usersList.length})</span>
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
                <span>Contract Oversight</span>
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
                <span>Escalated Disputes</span>
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
                <span>Financial &amp; Ledger</span>
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'audit'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'dark:bg-[#191B25] bg-white dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Audit &amp; Security ({auditLogs.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'config'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'dark:bg-[#191B25] bg-white dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Platform Governance</span>
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
                <span>Cluster Health</span>
              </button>
            </div>

            {/* TAB 1: OVERVIEW DASHBOARD */}
            {activeTab === 'overview' && metrics && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-2">
                    <span className="text-xs font-medium dark:text-[#9AA4B8] text-[#64748B]">Total Registered Users</span>
                    <div className="text-3xl font-bold font-mono dark:text-[#E8ECF5] text-[#242424]">{metrics.users?.total || 0}</div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] flex flex-wrap items-center gap-1.5 pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                      <span className="text-[#2563EB] font-mono">{metrics.users?.clients || 0} Clients</span>
                      <span>•</span>
                      <span className="text-emerald-500 font-mono">{metrics.users?.workers || 0} Workers</span>
                      <span>•</span>
                      <span className="font-mono">{metrics.users?.admins || 0} Admins</span>
                      <span>•</span>
                      <span className="font-bold font-mono text-[#2563EB]">{metrics.users?.superadmins || 0} Superadmins</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-2">
                    <span className="text-xs font-medium dark:text-[#9AA4B8] text-[#64748B]">Digital Contracts</span>
                    <div className="text-3xl font-bold font-mono text-emerald-500">{metrics.contracts?.active || 0}</div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] flex flex-wrap items-center gap-1.5 pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                      <span className="font-mono">{metrics.contracts?.total || 0} Total</span>
                      <span>•</span>
                      <span className="text-[#2563EB] font-mono">{metrics.contracts?.completed || 0} Completed</span>
                      <span>•</span>
                      <span className="text-rose-500 font-mono">{metrics.contracts?.disputed || 0} Disputed</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-2">
                    <span className="text-xs font-medium dark:text-[#9AA4B8] text-[#64748B]">Escrow Protective Holds</span>
                    <div className="text-3xl font-bold font-mono text-amber-500">{metrics.escrow?.activeHolds || 0}</div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                      Across {metrics.escrow?.total || 0} initialized escrow contracts
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-2">
                    <span className="text-xs font-medium dark:text-[#9AA4B8] text-[#64748B]">Dispute Escalations</span>
                    <div className="text-3xl font-bold font-mono text-rose-500">{metrics.disputes?.escalated || 0}</div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                      <span>{metrics.disputes?.pending || 0} Pending</span>
                      <span> • </span>
                      <span>{metrics.disputes?.total || 0} Total in Lifecycle</span>
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
                    <span className="text-xs font-medium dark:text-[#9AA4B8] text-[#64748B]">Double-Entry Ledger Transactions</span>
                    <div className="text-3xl font-bold font-mono dark:text-[#E8ECF5] text-[#242424]">{metrics.ledger?.totalTransactions || 0}</div>
                    <div className="text-[11px] text-emerald-500 pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0] flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Balanced Double-Entry Journal</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-2">
                    <span className="text-xs font-medium dark:text-[#9AA4B8] text-[#64748B]">Audit &amp; Security Logs</span>
                    <div className="text-3xl font-bold font-mono text-[#2563EB]">{metrics.security?.totalAuditLogs || 0}</div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                      Tamper-evident audit trail entries
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ADMIN MANAGEMENT & PERMISSION GOVERNANCE */}
            {activeTab === 'admins' && (
              <div className="space-y-8">
                {/* Section A: Role Provisioning & Permission Matrix */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-5 dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center space-x-2">
                      <UserCog className="w-5 h-5 text-[#2563EB]" />
                      <h4 className="text-base font-bold dark:text-[#E8ECF5] text-[#242424]">Privileged Role Allocation</h4>
                    </div>
                    <p className="text-xs dark:text-[#9AA4B8] text-[#64748B]">
                      Assign administrative or operational roles to verified platform identities with audit justification.
                    </p>

                    <form onSubmit={handleProvisionRole} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold dark:text-[#9AA4B8] text-[#475569] mb-1">Target Account</label>
                        <select
                          value={targetUserId}
                          onChange={(e) => setTargetUserId(e.target.value)}
                          required
                          className="w-full px-3 py-2 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] focus:outline-none focus:border-[#2563EB]"
                        >
                          <option value="">Select a registered account...</option>
                          {usersList.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email} ({u.role?.name})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold dark:text-[#9AA4B8] text-[#475569] mb-1">Assign Role</label>
                        <select
                          value={provisionRole}
                          onChange={(e) => setProvisionRole(e.target.value as UserRole)}
                          className="w-full px-3 py-2 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] focus:outline-none focus:border-[#2563EB]"
                        >
                          <option value={UserRole.ADMIN}>ADMIN (Portal Oversight &amp; Status Management)</option>
                          <option value={UserRole.SUPERADMIN}>SUPERADMIN (Full Governance Clearance)</option>
                          <option value={UserRole.WORKER}>WORKER (Specialist Account)</option>
                          <option value={UserRole.CLIENT}>CLIENT (Standard Escrow Client)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold dark:text-[#9AA4B8] text-[#475569] mb-1">
                          Audit Justification / Authorization Note (Min 5 chars)
                        </label>
                        <textarea
                          value={provisionReason}
                          onChange={(e) => setProvisionReason(e.target.value)}
                          placeholder="Provide governance documentation reference or rationale..."
                          required
                          rows={3}
                          className="w-full px-3 py-2 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingRole || provisionReason.trim().length < 5}
                        className="w-full py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white transition disabled:opacity-50 shadow-sm"
                      >
                        {isSubmittingRole ? 'Recording Provisioning...' : 'Provision Role & Log Audit Event'}
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-7 dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center space-x-2">
                      <KeyRound className="w-5 h-5 text-[#2563EB]" />
                      <h4 className="text-base font-bold dark:text-[#E8ECF5] text-[#242424]">Central Administrative Permission Matrix</h4>
                    </div>
                    <p className="text-xs dark:text-[#9AA4B8] text-[#64748B]">
                      Standardized explicit permissions governing administrative roles in TrustPay Enterprise.
                    </p>

                    <div className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0] max-h-[400px] overflow-y-auto pr-1">
                      {ADMIN_PERMISSION_CATALOG.map((p) => (
                        <div key={p.code} className="py-3 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold dark:text-[#E8ECF5] text-[#242424]">{p.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                p.tier.includes('SUPERADMIN ONLY')
                                  ? 'bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20'
                                  : 'dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#9AA4B8] text-[#64748B] border dark:border-[#272B38] border-[#E2E8F0]'
                              }`}
                            >
                              {p.tier}
                            </span>
                          </div>
                          <div className="dark:text-[#9AA4B8] text-[#64748B]">{p.description}</div>
                          <div className="text-[11px] font-mono text-[#2563EB]">{p.code}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section B: Administrator Roster */}
                <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b dark:border-[#272B38] border-[#E2E8F0] flex items-center justify-between dark:bg-[#191D2A] bg-[#F1F5F9]">
                    <div>
                      <h4 className="text-sm font-semibold dark:text-[#E8ECF5] text-[#242424]">Platform Administrator Accounts</h4>
                      <p className="text-xs dark:text-[#9AA4B8] text-[#64748B]">Governing administrative personnel and status</p>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded-lg dark:bg-[#0B0D14] bg-white dark:text-[#E8ECF5] text-[#242424] border dark:border-[#272B38] border-[#E2E8F0]">
                      {adminAccountsList.length} Administrators
                    </span>
                  </div>

                  <div className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
                    {adminAccountsList.map((u) => {
                      const isSelf = u.id === currentUser?.id;
                      return (
                        <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:dark:bg-[#191D2A]/40 hover:bg-[#F8FAFC] transition">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold dark:text-[#E8ECF5] text-[#242424]">
                                {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                  u.role?.name === UserRole.SUPERADMIN
                                    ? 'bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20'
                                    : 'dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#E8ECF5] text-[#475569] border dark:border-[#272B38] border-[#E2E8F0]'
                                }`}
                              >
                                {u.role?.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded font-medium ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
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

                            {!isSelf ? (
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
                              <span className="text-[11px] dark:text-[#9AA4B8] text-[#94A3B8] italic">Protected Self</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: USER OVERSIGHT */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex flex-1 items-center space-x-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 dark:text-[#9AA4B8] text-[#94A3B8]" />
                      <input
                        type="text"
                        placeholder="Search all accounts by name, email, or ID..."
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

                <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
                  <div className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
                    {filteredUsers.length === 0 ? (
                      <div className="p-8 text-center dark:text-[#9AA4B8] text-[#64748B] text-xs">
                        No registered users match the applied search and filter criteria.
                      </div>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSelf = u.id === currentUser?.id;
                        return (
                          <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:dark:bg-[#191D2A]/40 hover:bg-[#F8FAFC] transition">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold dark:text-[#E8ECF5] text-[#242424]">
                                  {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                    u.role?.name === UserRole.SUPERADMIN
                                      ? 'bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20'
                                      : u.role?.name === UserRole.ADMIN
                                        ? 'bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20'
                                        : u.role?.name === UserRole.WORKER
                                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                          : 'dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#E8ECF5] text-[#475569] border dark:border-[#272B38] border-[#E2E8F0]'
                                  }`}
                                >
                                  {u.role?.name}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded font-medium ${
                                    u.status === 'ACTIVE'
                                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                      : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
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

                              {!isSelf ? (
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
                                <span className="text-[11px] dark:text-[#9AA4B8] text-[#94A3B8] italic">Self Account</span>
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

            {/* TAB 4: CONTRACT OVERSIGHT & CRYPTOGRAPHIC VERIFICATION */}
            {activeTab === 'contracts' && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex flex-1 items-center space-x-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 dark:text-[#9AA4B8] text-[#94A3B8]" />
                      <input
                        type="text"
                        placeholder="Search contracts or parties..."
                        value={contractSearch}
                        onChange={(e) => setContractSearch(e.target.value)}
                        className="pl-9 pr-3 py-1.5 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] placeholder-slate-400 w-full focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <Filter className="w-3.5 h-3.5 dark:text-[#9AA4B8] text-[#64748B]" />
                    <select
                      value={contractStatusFilter}
                      onChange={(e) => setContractStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="DISPUTED">DISPUTED</option>
                      <option value="TERMINATED">TERMINATED</option>
                      <option value="DRAFT">DRAFT</option>
                    </select>
                  </div>
                </div>

                <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#9AA4B8] text-[#64748B] uppercase font-mono text-[10px] border-b dark:border-[#272B38] border-[#E2E8F0]">
                        <tr>
                          <th className="p-3">Contract #</th>
                          <th className="p-3">Title</th>
                          <th className="p-3">Client</th>
                          <th className="p-3">Specialist</th>
                          <th className="p-3">Version</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Total Amount</th>
                          <th className="p-3 text-right">Integrity Audit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
                        {filteredContracts.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center dark:text-[#9AA4B8] text-[#64748B] italic">
                              No contracts found matching criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredContracts.map((c) => (
                            <tr key={c.id} className="hover:dark:bg-[#191D2A]/40 hover:bg-[#F8FAFC] transition">
                              <td className="p-3 font-mono font-bold text-[#2563EB]">{c.contractNumber}</td>
                              <td className="p-3 font-semibold dark:text-[#E8ECF5] text-[#242424]">{c.title}</td>
                              <td className="p-3 dark:text-[#9AA4B8] text-[#64748B]">{c.client?.email || c.clientId}</td>
                              <td className="p-3 dark:text-[#9AA4B8] text-[#64748B]">{c.worker?.email || c.workerId}</td>
                              <td className="p-3 font-mono">v{c.version}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  c.status === 'ACTIVE'
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                    : c.status === 'DISPUTED'
                                      ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                      : 'dark:bg-[#191D2A] bg-slate-200 dark:text-[#E8ECF5] text-[#475569]'
                                }`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="p-3 font-mono font-bold dark:text-[#E8ECF5] text-[#242424]">
                                ${Number(c.totalAmount).toLocaleString()}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={async () => {
                                    setSelectedAuditContract(c.id);
                                    setIsAuditingContract(true);
                                    try {
                                      const res = await apiService.verifyContractIntegrity(c.id);
                                      if (res.success && res.data) {
                                        setIntegrityAuditResult(res.data);
                                      }
                                    } finally {
                                      setIsAuditingContract(false);
                                    }
                                  }}
                                  className="px-3 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-[10px] transition shadow-sm"
                                >
                                  {isAuditingContract && selectedAuditContract === c.id ? 'Auditing...' : 'Verify Hash'}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {integrityAuditResult && (
                    <div className="p-4 m-4 rounded-2xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] space-y-3 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-sans font-bold dark:text-[#E8ECF5] text-[#242424] text-sm">
                          Cryptographic Forensic Audit: {integrityAuditResult.contractNumber} (v{integrityAuditResult.currentVersion})
                        </span>
                        {integrityAuditResult.isTamperFree ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold text-[10px]">
                            ✓ PASS: INTEGRITY VERIFIED &amp; TAMPER-FREE
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold text-[10px]">
                            ⚠ VIOLATION: HASH DIVERGENCE DETECTED
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-[11px]">
                        <div className="dark:text-[#9AA4B8] text-[#64748B]">Stored Document Hash:</div>
                        <div className="p-2 rounded-xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] break-all dark:text-[#E8ECF5] text-[#242424]">
                          {integrityAuditResult.storedDocumentHash || 'Hash pending mutual agreement'}
                        </div>
                        <div className="dark:text-[#9AA4B8] text-[#64748B] mt-1">Recalculated Canonical SHA-256:</div>
                        <div className="p-2 rounded-xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] break-all text-emerald-500 font-bold">
                          {integrityAuditResult.recalculatedCanonicalHash}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: ESCALATED DISPUTES */}
            {activeTab === 'disputes' && <SuperadminDisputesGovernance />}

            {/* TAB 6: FINANCIAL & LEDGER GOVERNANCE */}
            {activeTab === 'financial' && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start space-x-3 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-amber-500 uppercase tracking-wide">
                      SUPERADMIN FINANCIAL GOVERNANCE CONSOLE (DEFENSIVE POSTURE)
                    </div>
                    <p className="text-xs text-amber-500/80 leading-relaxed">
                      Provider live execution is strictly disabled (isLiveMoneyDisabled = true). Supported Currencies: {financialConfig?.supportedCurrencies?.join(', ') || 'USD, EUR, GBP'}. Double-entry ledger entries are immutable. Only explicit reversals via offsetting transactions are permitted. Total Agreed Commitment: <span className="font-mono font-bold dark:text-[#E8ECF5] text-[#242424]">{financialOverview ? formatCurrencyMinor(financialOverview.totalContractualAgreedMinor, 'USD') : '$0.00'}</span>.
                    </p>
                  </div>
                </div>

                {/* Trial Balance Report */}
                <div className="rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] overflow-hidden shadow-sm">
                  <div className="p-4 border-b dark:border-[#272B38] border-[#E2E8F0] flex items-center justify-between dark:bg-[#191D2A] bg-[#F1F5F9]">
                    <div className="flex items-center space-x-2">
                      <Scale className="w-4 h-4 text-[#2563EB]" />
                      <h4 className="text-sm font-semibold dark:text-[#E8ECF5] text-[#242424]">System Trial Balance Report ({trialBalance?.currency || 'USD'})</h4>
                      {isLoadingFinancial && <span className="text-[10px] text-[#2563EB] animate-pulse">Syncing...</span>}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      trialBalance?.isBalanced
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    }`}>
                      {trialBalance?.isBalanced ? 'BALANCED' : 'DISCREPANCY DETECTED'}
                    </span>
                  </div>

                  <div className="p-4 border-b dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0] grid grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-3.5 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0]">
                      <span className="dark:text-[#9AA4B8] text-[#64748B]">Total System Debits:</span>
                      <div className="text-lg font-bold dark:text-[#E8ECF5] text-[#242424] mt-1 tabular-nums">
                        {trialBalance ? formatCurrencyMinor(trialBalance.totalDebitsMinor, trialBalance.currency) : '$0.00'}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0]">
                      <span className="dark:text-[#9AA4B8] text-[#64748B]">Total System Credits:</span>
                      <div className="text-lg font-bold dark:text-[#E8ECF5] text-[#242424] mt-1 tabular-nums">
                        {trialBalance ? formatCurrencyMinor(trialBalance.totalCreditsMinor, trialBalance.currency) : '$0.00'}
                      </div>
                    </div>
                  </div>

                  <div className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
                    {trialBalance?.items.map((item) => (
                      <div key={item.accountCode} className="p-3.5 flex items-center justify-between text-xs font-mono hover:dark:bg-[#191D2A]/40 hover:bg-[#F8FAFC] transition">
                        <div>
                          <span className="font-bold dark:text-[#E8ECF5] text-[#242424]">{item.accountCode}</span>
                          <span className="dark:text-[#9AA4B8] text-[#64748B] ml-2 font-sans">({item.accountName})</span>
                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#9AA4B8] text-[#64748B] border dark:border-[#272B38] border-[#E2E8F0] font-sans">{item.accountType}</span>
                        </div>
                        <div className="flex items-center space-x-4 tabular-nums">
                          <span className="dark:text-[#9AA4B8] text-[#64748B]">Dr: {formatCurrencyMinor(item.debitTotalMinor, trialBalance.currency)}</span>
                          <span className="dark:text-[#9AA4B8] text-[#64748B]">Cr: {formatCurrencyMinor(item.creditTotalMinor, trialBalance.currency)}</span>
                          <span className="font-bold text-emerald-500">Net: {formatCurrencyMinor(item.netBalanceMinor, trialBalance.currency)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chart of Accounts */}
                <div className="rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] overflow-hidden shadow-sm">
                  <div className="p-4 border-b dark:border-[#272B38] border-[#E2E8F0] flex items-center justify-between dark:bg-[#191D2A] bg-[#F1F5F9]">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-4 h-4 text-[#2563EB]" />
                      <h4 className="text-sm font-semibold dark:text-[#E8ECF5] text-[#242424]">Chart of Accounts Registry</h4>
                    </div>
                    <span className="text-xs font-mono dark:text-[#9AA4B8] text-[#64748B]">{ledgerAccounts.length} Accounts</span>
                  </div>

                  <div className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
                    {ledgerAccounts.map((acc) => (
                      <div key={acc.id} className="p-3.5 flex items-center justify-between text-xs font-mono hover:dark:bg-[#191D2A]/40 hover:bg-[#F8FAFC] transition">
                        <div>
                          <span className="font-bold dark:text-[#E8ECF5] text-[#242424]">{acc.accountCode}</span>
                          <span className="dark:text-[#9AA4B8] text-[#475569] ml-2 font-sans">{acc.accountName}</span>
                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#9AA4B8] text-[#64748B] border dark:border-[#272B38] border-[#E2E8F0] font-sans">{acc.accountType}</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-sans">
                          {acc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ledger Transactions Inspection & Reversals */}
                <div className="rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] overflow-hidden shadow-sm">
                  <div className="p-4 border-b dark:border-[#272B38] border-[#E2E8F0] flex items-center justify-between dark:bg-[#191D2A] bg-[#F1F5F9]">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-[#2563EB]" />
                      <h4 className="text-sm font-semibold dark:text-[#E8ECF5] text-[#242424]">Double-Entry Ledger Transactions</h4>
                    </div>
                    <span className="text-xs font-mono dark:text-[#9AA4B8] text-[#64748B]">{ledgerTransactions.length} Transactions</span>
                  </div>

                  {ledgerTransactions.length === 0 ? (
                    <div className="p-8 text-center dark:text-[#9AA4B8] text-[#64748B] text-xs">
                      No transactions posted yet.
                    </div>
                  ) : (
                    <div className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
                      {ledgerTransactions.map((tx) => (
                        <div key={tx.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono hover:dark:bg-[#191D2A]/40 hover:bg-[#F8FAFC] transition">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold dark:text-[#E8ECF5] text-[#242424]">{tx.transactionReference}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#E8ECF5] text-[#475569] font-sans">{tx.transactionType}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                                tx.status === 'POSTED' ? 'text-emerald-500' : tx.status === 'REVERSED' ? 'text-amber-500' : 'dark:text-[#9AA4B8] text-[#64748B]'
                              }`}>{tx.status}</span>
                            </div>
                            <div className="dark:text-[#9AA4B8] text-[#64748B] font-sans">{tx.description}</div>
                            <div className="dark:text-[#9AA4B8] text-[#94A3B8] text-[11px]">
                              Entries: {tx.entries?.length || 0} legs | Posted: {tx.postedAt ? new Date(tx.postedAt).toLocaleString() : 'N/A'}
                            </div>
                          </div>

                          {tx.status === 'POSTED' && tx.transactionType !== 'REVERSAL' && (
                            <button
                              onClick={() => handleReverseTransaction(tx.transactionReference)}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-sm font-sans"
                            >
                              Reverse Transaction
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Digital Contract Escrows & Protective Hold Toggling */}
                <div className="rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] overflow-hidden shadow-sm">
                  <div className="p-4 border-b dark:border-[#272B38] border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 dark:bg-[#191D2A] bg-[#F1F5F9]">
                    <div>
                      <h4 className="text-sm font-semibold dark:text-[#E8ECF5] text-[#242424]">Digital Contract Escrow Records</h4>
                      <p className="text-xs dark:text-[#9AA4B8] text-[#64748B]">Protective dispute hold toggles with mandatory audit log</p>
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
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm ${
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
              </div>
            )}

            {/* TAB 7: AUDIT LOGS */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex flex-1 items-center space-x-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 dark:text-[#9AA4B8] text-[#94A3B8]" />
                      <input
                        type="text"
                        placeholder="Search audit trail by action, actor, resource..."
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        className="pl-9 pr-3 py-1.5 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] placeholder-slate-400 w-full focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 text-xs">
                    <Filter className="w-3.5 h-3.5 dark:text-[#9AA4B8] text-[#64748B]" />
                    <select
                      value={auditActionFilter}
                      onChange={(e) => setAuditActionFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#242424] focus:outline-none focus:border-[#2563EB]"
                    >
                      <option value="ALL">All Event Types</option>
                      <option value="USER_STATUS_CHANGE">USER_STATUS_CHANGE</option>
                      <option value="ROLE_ASSIGNMENT">ROLE_ASSIGNMENT</option>
                      <option value="SECURITY_ALERT">SECURITY_ALERT</option>
                      <option value="DISPUTE_ENFORCEMENT">DISPUTE_ENFORCEMENT</option>
                      <option value="FINANCIAL_ADJUSTMENT">FINANCIAL_ADJUSTMENT</option>
                    </select>
                  </div>
                </div>

                <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
                  <div className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
                    {filteredAuditLogs.length === 0 ? (
                      <div className="p-8 text-center dark:text-[#9AA4B8] text-[#64748B] text-xs">
                        No security audit logs match the query criteria.
                      </div>
                    ) : (
                      filteredAuditLogs.map((log) => (
                        <div key={log.id} className="p-4 space-y-1.5 text-xs hover:dark:bg-[#191D2A]/40 hover:bg-[#F8FAFC] transition">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-[#2563EB]">{log.action}</span>
                              <span className="dark:text-[#9AA4B8] text-[#64748B]">on</span>
                              <span className="font-semibold dark:text-[#E8ECF5] text-[#242424] font-mono">{log.resource}</span>
                              {log.resourceId && <span className="font-mono text-[10px] dark:text-[#9AA4B8] text-[#94A3B8]">({log.resourceId})</span>}
                            </div>
                            <span className="dark:text-[#9AA4B8] text-[#64748B] font-mono text-[11px]">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <div className="dark:text-[#9AA4B8] text-[#64748B] text-[11px] flex flex-wrap items-center gap-2">
                            <span>Actor: {log.actor?.email || log.actorId || 'System Process'}</span>
                            {log.ipAddress && <span>• IP: {log.ipAddress}</span>}
                            {log.details && (
                              <span className="font-mono text-[10px] dark:text-[#9AA4B8] text-[#94A3B8]">
                                Details: {JSON.stringify(log.details)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 8: PLATFORM GOVERNANCE & PARAMETERS */}
            {activeTab === 'config' && (
              <div className="space-y-6">
                {configSuccessMessage && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center justify-between">
                    <span>{configSuccessMessage}</span>
                    <button onClick={() => setConfigSuccessMessage(null)} className="dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Operational Settings Card */}
                  <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] space-y-4 shadow-sm">
                    <div className="flex items-center space-x-2">
                      <Settings className="w-5 h-5 text-[#2563EB]" />
                      <h4 className="text-base font-bold dark:text-[#E8ECF5] text-[#242424]">Platform Operational Policies</h4>
                    </div>
                    <p className="text-xs dark:text-[#9AA4B8] text-[#64748B]">
                      Configure high-level operational thresholds and onboarding safeguards.
                    </p>

                    <div className="space-y-4 text-xs">
                      <div>
                        <label className="block dark:text-[#9AA4B8] text-[#475569] font-semibold mb-1">User Onboarding Policy</label>
                        <select
                          value={platformConfigState.registrationMode}
                          onChange={(e) => {
                            setPlatformConfigState({ ...platformConfigState, registrationMode: e.target.value });
                            setConfigSuccessMessage('Onboarding policy updated to ' + e.target.value);
                          }}
                          className="w-full px-3 py-2 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] dark:text-[#E8ECF5] text-[#242424]"
                        >
                          <option value="OPEN">Open (Standard Identity Verification)</option>
                          <option value="INVITATION_ONLY">Invitation Only (Enterprise Pre-Approval)</option>
                          <option value="RESTRICTED">Restricted (System Administrator Review Required)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block dark:text-[#9AA4B8] text-[#475569] font-semibold mb-1">Dispute Auto-Escalation Window</label>
                        <select
                          value={platformConfigState.disputeEscalationWindowDays}
                          onChange={(e) => {
                            setPlatformConfigState({ ...platformConfigState, disputeEscalationWindowDays: Number(e.target.value) });
                            setConfigSuccessMessage('Dispute window set to ' + e.target.value + ' business days');
                          }}
                          className="w-full px-3 py-2 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] dark:text-[#E8ECF5] text-[#242424]"
                        >
                          <option value={5}>5 Business Days</option>
                          <option value={7}>7 Business Days (Standard)</option>
                          <option value={14}>14 Business Days</option>
                        </select>
                      </div>

                      <div>
                        <label className="block dark:text-[#9AA4B8] text-[#475569] font-semibold mb-1">Milestone Submission Review Window</label>
                        <select
                          value={platformConfigState.milestoneReviewWindowDays}
                          onChange={(e) => {
                            setPlatformConfigState({ ...platformConfigState, milestoneReviewWindowDays: Number(e.target.value) });
                            setConfigSuccessMessage('Milestone review window set to ' + e.target.value + ' days');
                          }}
                          className="w-full px-3 py-2 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] dark:text-[#E8ECF5] text-[#242424]"
                        >
                          <option value={7}>7 Calendar Days</option>
                          <option value={14}>14 Calendar Days (Standard)</option>
                          <option value={30}>30 Calendar Days</option>
                        </select>
                      </div>

                      <div>
                        <label className="block dark:text-[#9AA4B8] text-[#475569] font-semibold mb-1">Platform Maintenance Status</label>
                        <select
                          value={platformConfigState.maintenanceMode}
                          onChange={(e) => {
                            setPlatformConfigState({ ...platformConfigState, maintenanceMode: e.target.value });
                            setConfigSuccessMessage('Maintenance status changed to ' + e.target.value);
                          }}
                          className="w-full px-3 py-2 rounded-xl dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] dark:text-[#E8ECF5] text-[#242424]"
                        >
                          <option value="DISABLED">Disabled (Normal Operations)</option>
                          <option value="ENABLED">Enabled (Read-Only Maintenance Posture)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Financial Safety Guard Invariants */}
                  <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] space-y-4 shadow-sm">
                    <div className="flex items-center space-x-2">
                      <Lock className="w-5 h-5 text-amber-500" />
                      <h4 className="text-base font-bold dark:text-[#E8ECF5] text-[#242424]">Financial Defensive Invariants (Locked)</h4>
                    </div>
                    <p className="text-xs dark:text-[#9AA4B8] text-[#64748B]">
                      In accordance with Phase 9 security protocols, live financial movement flags cannot be altered via UI controls.
                    </p>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="p-3 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] flex items-center justify-between">
                        <span className="dark:text-[#9AA4B8] text-[#64748B]">isLiveMoneyDisabled</span>
                        <span className="text-emerald-500 font-bold">TRUE (ACTIVE)</span>
                      </div>
                      <div className="p-3 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] flex items-center justify-between">
                        <span className="dark:text-[#9AA4B8] text-[#64748B]">PAYMENTS_LIVE_ENABLED</span>
                        <span className="text-rose-500 font-bold">FALSE (LOCKED)</span>
                      </div>
                      <div className="p-3 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] flex items-center justify-between">
                        <span className="dark:text-[#9AA4B8] text-[#64748B]">ESCROW_LIVE_MOVEMENT_ENABLED</span>
                        <span className="text-rose-500 font-bold">FALSE (LOCKED)</span>
                      </div>
                      <div className="p-3 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] flex items-center justify-between">
                        <span className="dark:text-[#9AA4B8] text-[#64748B]">PAYOUTS_ENABLED</span>
                        <span className="text-rose-500 font-bold">FALSE (LOCKED)</span>
                      </div>
                      <div className="p-3 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] flex items-center justify-between">
                        <span className="dark:text-[#9AA4B8] text-[#64748B]">Cashfree Sandbox Live Execution</span>
                        <span className="text-amber-500 font-bold">DEFERRED</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 9: CLUSTER STATUS & TELEMETRY */}
            {activeTab === 'system' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-3">
                  <div className="flex items-center space-x-2 text-sm font-semibold dark:text-[#E8ECF5] text-[#242424]">
                    <Server className="w-4 h-4 text-[#2563EB]" />
                    <span>API Gateway Service</span>
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
                    <span>Supabase PostgreSQL Cluster</span>
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
                <Users className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-bold dark:text-[#E8ECF5] text-[#242424] text-base">Account Deep Inspection</h3>
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
              <h3 className="font-bold dark:text-[#E8ECF5] text-[#242424] text-base">Superadmin Status Modification</h3>
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
                placeholder="Enter detailed reason for status change (minimum 5 characters)..."
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
