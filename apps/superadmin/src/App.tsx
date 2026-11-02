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
    tier: 'ADMIN / SUPERADMIN',
  },
  {
    code: 'CONTRACT_INSPECTION_AUDIT',
    name: 'Contract Oversight & Cryptographic Audit',
    description: 'Inspect cross-tenant digital contracts, verify SHA-256 integrity hashes, review milestone submissions.',
    tier: 'ADMIN / SUPERADMIN',
  },
  {
    code: 'DISPUTE_INVESTIGATION_ARBITRATION',
    name: 'Dispute Investigation & Resolution Enforcement',
    description: 'Review claims, inspect signed private evidence, record internal notes, enforce binding determinations.',
    tier: 'ADMIN / SUPERADMIN',
  },
  {
    code: 'ESCROW_DISPUTE_HOLD_CONTROL',
    name: 'Escrow Protective Hold Management',
    description: 'Place or lift protective dispute holds on contract escrow state records with mandatory justification.',
    tier: 'ADMIN / SUPERADMIN',
  },
  {
    code: 'LEDGER_AUDIT_INSPECTION',
    name: 'Double-Entry Ledger & Trial Balance Audit',
    description: 'Read-only inspection of balanced double-entry ledger transactions and system trial balance verification.',
    tier: 'ADMIN / SUPERADMIN',
  },
  {
    code: 'ROLE_PROVISIONING_SUPERADMIN_ONLY',
    name: 'Privileged Role Provisioning',
    description: 'Assign or revoke ADMIN and SUPERADMIN roles for registered users. Restricted exclusively to Root Superadmin.',
    tier: 'SUPERADMIN ONLY',
  },
  {
    code: 'TRANSACTION_REVERSAL_SUPERADMIN_ONLY',
    name: 'Ledger Offsetting Reversals',
    description: 'Execute immutable offsetting ledger transactions to correct verified accounting anomalies with legal justification.',
    tier: 'SUPERADMIN ONLY',
  },
  {
    code: 'SYSTEM_CONFIGURATION_SUPERADMIN_ONLY',
    name: 'Platform Governance & Safety Policies',
    description: 'Inspect and govern platform operational thresholds, registration modes, and financial safety configurations.',
    tier: 'SUPERADMIN ONLY',
  },
];

export const App: React.FC = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [currentUser, setCurrentUser] = useState<SuperadminUserRecord | null>(null);
  const [metrics, setMetrics] = useState<SuperadminDashboardMetrics | null>(null);
  const [usersList, setUsersList] = useState<SuperadminUserRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [apiHealth, setApiHealth] = useState<SystemHealthStatus | null>(null);
  const [dbHealth, setDbHealth] = useState<DatabaseHealthStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'admins' | 'users' | 'contracts' | 'disputes' | 'financial' | 'audit' | 'config' | 'system'
  >('overview');

  // Contract Oversight state
  const [globalContracts, setGlobalContracts] = useState<ContractDto[]>([]);
  const [contractSearch, setContractSearch] = useState('');
  const [contractStatusFilter, setContractStatusFilter] = useState('ALL');
  const [selectedAuditContract, setSelectedAuditContract] = useState<string | null>(null);
  const [integrityAuditResult, setIntegrityAuditResult] = useState<ContractIntegrityReportDto | null>(null);
  const [isAuditingContract, setIsAuditingContract] = useState(false);

  // User Management state
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');
  const [inspectUser, setInspectUser] = useState<SuperadminUserRecord | null>(null);

  // Status Change Modal State
  const [statusModalUser, setStatusModalUser] = useState<SuperadminUserRecord | null>(null);
  const [statusModalTargetStatus, setStatusModalTargetStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'>('SUSPENDED');
  const [statusModalReason, setStatusModalReason] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Provisioning form state
  const [targetUserId, setTargetUserId] = useState('');
  const [provisionRole, setProvisionRole] = useState<UserRole>(UserRole.ADMIN);
  const [provisionReason, setProvisionReason] = useState('');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Financial Governance state
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReportDto | null>(null);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccountDto[]>([]);
  const [ledgerTransactions, setLedgerTransactions] = useState<LedgerTransactionDto[]>([]);
  const [financialConfig, setFinancialConfig] = useState<PlatformFinancialConfigDto | null>(null);
  const [financialOverview, setFinancialOverview] = useState<FinancialOverviewDto | null>(null);
  const [escrowsList, setEscrowsList] = useState<EscrowRecordDto[]>([]);
  const [isLoadingFinancial, setIsLoadingFinancial] = useState(false);
  const [escrowSearch, setEscrowSearch] = useState('');

  // Audit Log Filter state
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');

  // Platform Configuration State (Simulated operational state based on backend configuration)
  const [platformConfigState, setPlatformConfigState] = useState({
    registrationMode: 'OPEN',
    disputeEscalationWindowDays: 7,
    milestoneReviewWindowDays: 14,
    maintenanceMode: 'DISABLED',
  });
  const [configSuccessMessage, setConfigSuccessMessage] = useState<string | null>(null);

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

  const loadFinancialData = useCallback(async () => {
    setIsLoadingFinancial(true);
    try {
      const [tbRes, accRes, txRes, cfgRes, ovRes, escRes] = await Promise.allSettled([
        apiService.getTrialBalance('USD'),
        apiService.listAccounts({ limit: 50 }),
        apiService.listTransactions({ limit: 50 }),
        apiService.getFinancialConfig(),
        apiService.getFinancialOverview(),
        apiService.listEscrowRecords({ limit: 100 }),
      ]);

      if (tbRes.status === 'fulfilled' && tbRes.value.success && tbRes.value.data) {
        setTrialBalance(tbRes.value.data);
      }
      if (accRes.status === 'fulfilled' && accRes.value.success && accRes.value.data) {
        setLedgerAccounts(accRes.value.data.items || []);
      }
      if (txRes.status === 'fulfilled' && txRes.value.success && txRes.value.data) {
        setLedgerTransactions(txRes.value.data.items || []);
      }
      if (cfgRes.status === 'fulfilled' && cfgRes.value.success && cfgRes.value.data) {
        setFinancialConfig(cfgRes.value.data);
      }
      if (ovRes.status === 'fulfilled' && ovRes.value.success && ovRes.value.data) {
        setFinancialOverview(ovRes.value.data);
      }
      if (escRes.status === 'fulfilled' && escRes.value.success && escRes.value.data) {
        setEscrowsList(escRes.value.data.items || []);
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

  // Real-time WebSocket connection
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

  const handleProvisionRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId || !provisionReason.trim()) return;

    if (targetUserId === currentUser?.id && provisionRole !== UserRole.SUPERADMIN) {
      setActionError('Security Policy: Superadmins are prohibited from demoting their own root account.');
      return;
    }

    setIsSubmittingRole(true);
    setActionMessage(null);
    setActionError(null);

    try {
      const res = await apiService.provisionUserRole(targetUserId, provisionRole, provisionReason.trim());
      if (res.success) {
        setActionMessage(`Successfully provisioned role ${provisionRole} for target user. Audit logged.`);
        setProvisionReason('');
        await loadSuperadminData();
      } else {
        setActionError(res.error?.message || 'Failed to provision role');
      }
    } catch {
      setActionError('Role provisioning request failed');
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

  // Filtered Admin Accounts
  const adminAccountsList = usersList.filter(
    (u) => u.role?.name === UserRole.ADMIN || u.role?.name === UserRole.SUPERADMIN,
  );

  // Filtered Users List
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

  // Filtered Global Contracts
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

  // Filtered Audit Logs
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
      {/* Superadmin Header */}
      <header className="border-b border-purple-900/40 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
                  TrustPay Superadmin
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                  Root Governance
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Enterprise Core System Console</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {currentUser && (
              <div className="hidden sm:flex items-center space-x-2 text-xs">
                <span className="text-slate-400">Root Identity:</span>
                <span className="font-semibold text-slate-200">
                  {currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}` : currentUser.email}
                </span>
                <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  SUPERADMIN
                </span>
              </div>
            )}

            <button
              onClick={fetchStatus}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
              <span>Audit Cluster</span>
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
                    <button className="px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-xs font-medium text-white transition flex items-center space-x-1">
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

        {actionError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-rose-400/70 hover:text-rose-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!isSignedIn ? (
          <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl max-w-lg mx-auto space-y-4">
            <KeyRound className="w-12 h-12 text-purple-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">Superadmin Clearance Required</h3>
            <p className="text-xs text-slate-400">
              This governance environment allows provisioning administrative roles and inspecting platform
              audit events. Access is restricted to designated SUPERADMIN accounts.
            </p>
            <SignInButton mode="modal">
              <button className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition">
                Sign In with Superadmin Clearance
              </button>
            </SignInButton>
          </div>
        ) : !isSuperadmin && currentUser ? (
          <div className="p-8 bg-rose-500/10 border border-rose-500/20 rounded-2xl max-w-lg mx-auto text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-lg font-bold text-rose-300">Root Governance Restricted</h3>
            <p className="text-xs text-slate-300">
              Your account possesses role <span className="font-bold">{currentUser.role?.name}</span>. Only
              SUPERADMIN accounts are authorized to provision privileged roles.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Superadmin Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'overview'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Global Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab('admins')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'admins'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCog className="w-3.5 h-3.5" />
                <span>Admin Management ({adminAccountsList.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'users'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>User Oversight ({usersList.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('contracts')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'contracts'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Contract Oversight</span>
              </button>
              <button
                onClick={() => setActiveTab('disputes')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'disputes'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Escalated Disputes</span>
              </button>
              <button
                onClick={() => setActiveTab('financial')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'financial'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Financial &amp; Ledger</span>
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'audit'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Audit &amp; Security ({auditLogs.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'config'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Platform Governance</span>
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === 'system'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
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
                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-medium text-slate-400">Total Registered Users</span>
                    <div className="text-3xl font-bold text-white">{metrics.users?.total || 0}</div>
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
                      <span className="text-blue-400">{metrics.users?.clients || 0} Clients</span>
                      <span>•</span>
                      <span className="text-emerald-400">{metrics.users?.workers || 0} Workers</span>
                      <span>•</span>
                      <span className="text-purple-400">{metrics.users?.admins || 0} Admins</span>
                      <span>•</span>
                      <span className="text-purple-300 font-bold">{metrics.users?.superadmins || 0} Superadmins</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-medium text-slate-400">Digital Contracts</span>
                    <div className="text-3xl font-bold text-emerald-400">{metrics.contracts?.active || 0}</div>
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
                      <span>{metrics.contracts?.total || 0} Total</span>
                      <span>•</span>
                      <span className="text-blue-400">{metrics.contracts?.completed || 0} Completed</span>
                      <span>•</span>
                      <span className="text-rose-400">{metrics.contracts?.disputed || 0} Disputed</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-medium text-slate-400">Escrow Protective Holds</span>
                    <div className="text-3xl font-bold text-amber-400">{metrics.escrow?.activeHolds || 0}</div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                      Across {metrics.escrow?.total || 0} initialized escrow contracts
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-medium text-slate-400">Dispute Escalations</span>
                    <div className="text-3xl font-bold text-rose-400">{metrics.disputes?.escalated || 0}</div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                      <span>{metrics.disputes?.pending || 0} Pending</span>
                      <span> • </span>
                      <span>{metrics.disputes?.total || 0} Total in Lifecycle</span>
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
                    <span className="text-xs font-medium text-slate-400">Double-Entry Ledger Transactions</span>
                    <div className="text-3xl font-bold text-white">{metrics.ledger?.totalTransactions || 0}</div>
                    <div className="text-[11px] text-emerald-400 pt-1 border-t border-slate-800/80 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Balanced Double-Entry Journal</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-medium text-slate-400">Audit &amp; Security Logs</span>
                    <div className="text-3xl font-bold text-purple-400">{metrics.security?.totalAuditLogs || 0}</div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
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
                  <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center space-x-2">
                      <UserCog className="w-5 h-5 text-purple-400" />
                      <h4 className="text-base font-bold text-white">Privileged Role Allocation</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      Assign administrative or operational roles to verified platform identities with audit justification.
                    </p>

                    <form onSubmit={handleProvisionRole} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Target Account</label>
                        <select
                          value={targetUserId}
                          onChange={(e) => setTargetUserId(e.target.value)}
                          required
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
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
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Assign Role</label>
                        <select
                          value={provisionRole}
                          onChange={(e) => setProvisionRole(e.target.value as UserRole)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                        >
                          <option value={UserRole.ADMIN}>ADMIN (Portal Oversight &amp; Status Management)</option>
                          <option value={UserRole.SUPERADMIN}>SUPERADMIN (Full Governance Clearance)</option>
                          <option value={UserRole.WORKER}>WORKER (Specialist Account)</option>
                          <option value={UserRole.CLIENT}>CLIENT (Standard Escrow Client)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          Audit Justification / Authorization Note (Min 5 chars)
                        </label>
                        <textarea
                          value={provisionReason}
                          onChange={(e) => setProvisionReason(e.target.value)}
                          placeholder="Provide governance documentation reference or rationale..."
                          required
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingRole || provisionReason.trim().length < 5}
                        className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition disabled:opacity-50"
                      >
                        {isSubmittingRole ? 'Recording Provisioning...' : 'Provision Role & Log Audit Event'}
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center space-x-2">
                      <KeyRound className="w-5 h-5 text-purple-400" />
                      <h4 className="text-base font-bold text-white">Central Administrative Permission Matrix</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      Standardized explicit permissions governing administrative roles in TrustPay Enterprise.
                    </p>

                    <div className="divide-y divide-slate-800/80 max-h-[400px] overflow-y-auto pr-1">
                      {ADMIN_PERMISSION_CATALOG.map((p) => (
                        <div key={p.code} className="py-3 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{p.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                p.tier.includes('SUPERADMIN ONLY')
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              {p.tier}
                            </span>
                          </div>
                          <div className="text-slate-400">{p.description}</div>
                          <div className="text-[11px] font-mono text-purple-400/80">{p.code}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section B: Administrator Roster & Status Management */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Platform Administrator Accounts</h4>
                      <p className="text-xs text-slate-400">Governing administrative personnel and status</p>
                    </div>
                    <span className="text-xs font-mono px-2 py-1 rounded bg-slate-800 text-slate-300">
                      {adminAccountsList.length} Administrators
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {adminAccountsList.map((u) => {
                      const isSelf = u.id === currentUser?.id;
                      return (
                        <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-white">
                                {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                  u.role?.name === UserRole.SUPERADMIN
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}
                              >
                                {u.role?.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded font-medium ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {u.status}
                              </span>
                              {isSelf && (
                                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
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

                            {!isSelf ? (
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
                              <span className="text-[11px] text-slate-500 italic">Protected Self</span>
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
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-1 items-center space-x-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search all accounts by name, email, or ID..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 w-full focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-1.5 text-xs">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={userRoleFilter}
                        onChange={(e) => setUserRoleFilter(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
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
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
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

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="divide-y divide-slate-800/80">
                    {filteredUsers.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No registered users match the applied search and filter criteria.
                      </div>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSelf = u.id === currentUser?.id;
                        return (
                          <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-white">
                                  {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                    u.role?.name === UserRole.SUPERADMIN
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                      : u.role?.name === UserRole.ADMIN
                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                        : u.role?.name === UserRole.WORKER
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                                  }`}
                                >
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
                                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
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

                              {!isSelf ? (
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
                                <span className="text-[11px] text-slate-500 italic">Self Account</span>
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
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-1 items-center space-x-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search contracts or parties..."
                        value={contractSearch}
                        onChange={(e) => setContractSearch(e.target.value)}
                        className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 w-full focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={contractStatusFilter}
                      onChange={(e) => setContractStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
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

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px]">
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
                      <tbody className="divide-y divide-slate-800">
                        {filteredContracts.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                              No contracts found matching criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredContracts.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-800/30">
                              <td className="p-3 font-mono font-bold text-purple-300">{c.contractNumber}</td>
                              <td className="p-3 font-semibold text-white">{c.title}</td>
                              <td className="p-3 text-slate-400">{c.client?.email || c.clientId}</td>
                              <td className="p-3 text-slate-400">{c.worker?.email || c.workerId}</td>
                              <td className="p-3 font-mono">v{c.version}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  c.status === 'ACTIVE'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : c.status === 'DISPUTED'
                                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                      : 'bg-slate-800 text-slate-300'
                                }`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="p-3 font-mono font-bold text-white">
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
                                  className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[10px]"
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
                    <div className="p-4 m-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-3 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-sans font-bold text-white text-sm">
                          Cryptographic Forensic Audit: {integrityAuditResult.contractNumber} (v{integrityAuditResult.currentVersion})
                        </span>
                        {integrityAuditResult.isTamperFree ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">
                            ✓ PASS: INTEGRITY VERIFIED &amp; TAMPER-FREE
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-[10px]">
                            ⚠ VIOLATION: HASH DIVERGENCE DETECTED
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-[11px]">
                        <div className="text-slate-400">Stored Document Hash:</div>
                        <div className="p-2 rounded bg-slate-900 border border-slate-800 break-all text-slate-300">
                          {integrityAuditResult.storedDocumentHash || 'Hash pending mutual agreement'}
                        </div>
                        <div className="text-slate-400 mt-1">Recalculated Canonical SHA-256:</div>
                        <div className="p-2 rounded bg-slate-900 border border-slate-800 break-all text-emerald-400">
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
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-purple-300">
                      SUPERADMIN FINANCIAL GOVERNANCE CONSOLE (DEFENSIVE POSTURE)
                    </div>
                    <p className="text-xs text-purple-200/80 leading-relaxed">
                      Provider live execution is strictly disabled (isLiveMoneyDisabled = true). Supported Currencies: {financialConfig?.supportedCurrencies?.join(', ') || 'USD, EUR, GBP'}. Double-entry ledger entries are immutable. Only explicit reversals via offsetting transactions are permitted. Total Agreed Commitment: <span className="font-mono font-bold text-white">{financialOverview ? formatCurrencyMinor(financialOverview.totalContractualAgreedMinor, 'USD') : '$0.00'}</span>.
                    </p>
                  </div>
                </div>

                {/* Trial Balance Report */}
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Scale className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-semibold text-white">System Trial Balance Report ({trialBalance?.currency || 'USD'})</h4>
                      {isLoadingFinancial && <span className="text-[10px] text-purple-400">Syncing...</span>}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      trialBalance?.isBalanced
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {trialBalance?.isBalanced ? 'BALANCED' : 'DISCREPANCY DETECTED'}
                    </span>
                  </div>

                  <div className="p-4 border-b border-slate-800/60 grid grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
                      <span className="text-slate-400">Total System Debits:</span>
                      <div className="text-lg font-bold text-white mt-1">
                        {trialBalance ? formatCurrencyMinor(trialBalance.totalDebitsMinor, trialBalance.currency) : '$0.00'}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
                      <span className="text-slate-400">Total System Credits:</span>
                      <div className="text-lg font-bold text-white mt-1">
                        {trialBalance ? formatCurrencyMinor(trialBalance.totalCreditsMinor, trialBalance.currency) : '$0.00'}
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {trialBalance?.items.map((item) => (
                      <div key={item.accountCode} className="p-3 flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="font-bold text-slate-200">{item.accountCode}</span>
                          <span className="text-slate-500 ml-2">({item.accountName})</span>
                          <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">{item.accountType}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-slate-400">Dr: {formatCurrencyMinor(item.debitTotalMinor, trialBalance.currency)}</span>
                          <span className="text-slate-400">Cr: {formatCurrencyMinor(item.creditTotalMinor, trialBalance.currency)}</span>
                          <span className="font-bold text-white">Net: {formatCurrencyMinor(item.netBalanceMinor, trialBalance.currency)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chart of Accounts */}
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-4 h-4 text-blue-400" />
                      <h4 className="text-sm font-semibold text-white">Chart of Accounts Registry</h4>
                    </div>
                    <span className="text-xs font-mono text-slate-400">{ledgerAccounts.length} Accounts</span>
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {ledgerAccounts.map((acc) => (
                      <div key={acc.id} className="p-3 flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="font-bold text-white">{acc.accountCode}</span>
                          <span className="text-slate-300 ml-2">{acc.accountName}</span>
                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">{acc.accountType}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {acc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ledger Transactions Inspection & Reversals */}
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-purple-400" />
                      <h4 className="text-sm font-semibold text-white">Double-Entry Ledger Transactions</h4>
                    </div>
                    <span className="text-xs font-mono text-slate-400">{ledgerTransactions.length} Transactions</span>
                  </div>

                  {ledgerTransactions.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      No transactions posted yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {ledgerTransactions.map((tx) => (
                        <div key={tx.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white">{tx.transactionReference}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{tx.transactionType}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                tx.status === 'POSTED' ? 'text-emerald-400' : tx.status === 'REVERSED' ? 'text-amber-400' : 'text-slate-400'
                              }`}>{tx.status}</span>
                            </div>
                            <div className="text-slate-400">{tx.description}</div>
                            <div className="text-slate-500 text-[11px]">
                              Entries: {tx.entries?.length || 0} legs | Posted: {tx.postedAt ? new Date(tx.postedAt).toLocaleString() : 'N/A'}
                            </div>
                          </div>

                          {tx.status === 'POSTED' && tx.transactionType !== 'REVERSAL' && (
                            <button
                              onClick={() => handleReverseTransaction(tx.transactionReference)}
                              className="px-3 py-1.5 rounded bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-medium transition"
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
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Digital Contract Escrow Records</h4>
                      <p className="text-xs text-slate-400">Protective dispute hold toggles with mandatory audit log</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Filter escrow records..."
                          value={escrowSearch}
                          onChange={(e) => setEscrowSearch(e.target.value)}
                          className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 w-48 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <span className="text-xs font-mono px-2 py-1 rounded bg-slate-800 text-slate-300">
                        {filteredEscrows.length} Escrows
                      </span>
                    </div>
                  </div>

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
                </div>
              </div>
            )}

            {/* TAB 7: AUDIT & SECURITY MONITORING */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-1 items-center space-x-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search audit trail by actor, action, or resource..."
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 w-full focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={auditActionFilter}
                      onChange={(e) => setAuditActionFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
                    >
                      <option value="ALL">All Actions</option>
                      <option value="ROLE_PROVISIONED">ROLE_PROVISIONED</option>
                      <option value="ADMIN_USER_STATUS_CHANGE">ADMIN_USER_STATUS_CHANGE</option>
                      <option value="DISPUTE_ARBITRATED">DISPUTE_ARBITRATED</option>
                      <option value="TRANSACTION_REVERSED">TRANSACTION_REVERSED</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="divide-y divide-slate-800/80">
                    {filteredAuditLogs.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">No audit events match criteria.</div>
                    ) : (
                      filteredAuditLogs.map((log) => (
                        <div key={log.id} className="p-4 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-semibold text-purple-300">{log.action}</span>
                              <span className="text-slate-400">on</span>
                              <span className="font-semibold text-white">{log.resource}</span>
                              {log.resourceId && (
                                <span className="font-mono text-[11px] text-slate-500">({log.resourceId})</span>
                              )}
                            </div>
                            <span className="text-slate-500 font-mono text-[11px]">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <div className="text-slate-500 font-mono text-[11px] flex flex-wrap items-center gap-2">
                            <span>Actor: {log.actor?.email || log.actorId || 'System'}</span>
                            <span>•</span>
                            <span>IP: {log.ipAddress || 'Internal'}</span>
                            {log.details && (
                              <>
                                <span>•</span>
                                <span className="text-slate-400">{JSON.stringify(log.details)}</span>
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

            {/* TAB 8: PLATFORM GOVERNANCE & SETTINGS */}
            {activeTab === 'config' && (
              <div className="space-y-6">
                {configSuccessMessage && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{configSuccessMessage}</span>
                    </div>
                    <button onClick={() => setConfigSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Operational Settings Card */}
                  <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                    <div className="flex items-center space-x-2">
                      <Settings className="w-5 h-5 text-purple-400" />
                      <h4 className="text-base font-bold text-white">Platform Operational Policies</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      Configure high-level operational thresholds and onboarding safeguards.
                    </p>

                    <div className="space-y-4 text-xs">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">User Onboarding Policy</label>
                        <select
                          value={platformConfigState.registrationMode}
                          onChange={(e) => {
                            setPlatformConfigState({ ...platformConfigState, registrationMode: e.target.value });
                            setConfigSuccessMessage('Onboarding policy updated to ' + e.target.value);
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                        >
                          <option value="OPEN">Open (Standard Identity Verification)</option>
                          <option value="INVITATION_ONLY">Invitation Only (Enterprise Pre-Approval)</option>
                          <option value="RESTRICTED">Restricted (System Administrator Review Required)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Dispute Auto-Escalation Window</label>
                        <select
                          value={platformConfigState.disputeEscalationWindowDays}
                          onChange={(e) => {
                            setPlatformConfigState({ ...platformConfigState, disputeEscalationWindowDays: Number(e.target.value) });
                            setConfigSuccessMessage('Dispute window set to ' + e.target.value + ' business days');
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                        >
                          <option value={5}>5 Business Days</option>
                          <option value={7}>7 Business Days (Standard)</option>
                          <option value={14}>14 Business Days</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Milestone Submission Review Window</label>
                        <select
                          value={platformConfigState.milestoneReviewWindowDays}
                          onChange={(e) => {
                            setPlatformConfigState({ ...platformConfigState, milestoneReviewWindowDays: Number(e.target.value) });
                            setConfigSuccessMessage('Milestone review window set to ' + e.target.value + ' days');
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                        >
                          <option value={7}>7 Calendar Days</option>
                          <option value={14}>14 Calendar Days (Standard)</option>
                          <option value={30}>30 Calendar Days</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Platform Maintenance Status</label>
                        <select
                          value={platformConfigState.maintenanceMode}
                          onChange={(e) => {
                            setPlatformConfigState({ ...platformConfigState, maintenanceMode: e.target.value });
                            setConfigSuccessMessage('Maintenance status changed to ' + e.target.value);
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                        >
                          <option value="DISABLED">Disabled (Normal Operations)</option>
                          <option value="ENABLED">Enabled (Read-Only Maintenance Posture)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Financial Safety Guard Invariants */}
                  <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                    <div className="flex items-center space-x-2">
                      <Lock className="w-5 h-5 text-amber-400" />
                      <h4 className="text-base font-bold text-white">Financial Defensive Invariants (Locked)</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      In accordance with Phase 9 security protocols, live financial movement flags cannot be altered via UI controls.
                    </p>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">isLiveMoneyDisabled</span>
                        <span className="text-emerald-400 font-bold">TRUE (ACTIVE)</span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">PAYMENTS_LIVE_ENABLED</span>
                        <span className="text-rose-400 font-bold">FALSE (LOCKED)</span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">ESCROW_LIVE_MOVEMENT_ENABLED</span>
                        <span className="text-rose-400 font-bold">FALSE (LOCKED)</span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">PAYOUTS_ENABLED</span>
                        <span className="text-rose-400 font-bold">FALSE (LOCKED)</span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400">Cashfree Sandbox Live Execution</span>
                        <span className="text-amber-400 font-bold">DEFERRED</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 9: CLUSTER STATUS & TELEMETRY */}
            {activeTab === 'system' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                    <Server className="w-4 h-4 text-purple-400" />
                    <span>API Gateway Service</span>
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
                    <span>Supabase PostgreSQL Cluster</span>
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
                <Users className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-base">Account Deep Inspection</h3>
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
                  <div className="font-semibold text-purple-400 mt-0.5">{inspectUser.role?.name}</div>
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
              <h3 className="font-bold text-white text-base">Superadmin Status Modification</h3>
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
                placeholder="Enter detailed reason for status change (minimum 5 characters)..."
                value={statusModalReason}
                onChange={(e) => setStatusModalReason(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
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
