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
} from 'lucide-react';
import { useAuth, UserButton, SignInButton } from '@clerk/clerk-react';
import { apiService, setAuthTokenGetter } from './services/api';
import {
  SystemHealthStatus,
  DatabaseHealthStatus,
  UserRole,
  FinancialOverviewDto,
  TrialBalanceReportDto,
  LedgerAccountDto,
  LedgerTransactionDto,
  PlatformFinancialConfigDto,
  formatCurrencyMinor,
} from '@trustpay/shared';
import { SuperadminDisputesGovernance } from './components/SuperadminDisputesGovernance';

interface SuperadminDashboardMetrics {
  users?: { total: number; clients: number; workers: number; admins: number };
  contracts?: { total: number; active: number; completed: number; disputed: number };
  milestones?: { total: number };
}

interface SuperadminUserRecord {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: { name: UserRole };
}

interface AuditLogRecord {
  id: string;
  action: string;
  resource: string;
  ipAddress?: string | null;
  actorId?: string | null;
  createdAt: string;
  actor?: { email?: string | null };
}

export const App: React.FC = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [currentUser, setCurrentUser] = useState<SuperadminUserRecord | null>(null);
  const [metrics, setMetrics] = useState<SuperadminDashboardMetrics | null>(null);
  const [usersList, setUsersList] = useState<SuperadminUserRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [apiHealth, setApiHealth] = useState<SystemHealthStatus | null>(null);
  const [dbHealth, setDbHealth] = useState<DatabaseHealthStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'provisioning' | 'audit' | 'metrics' | 'financial' | 'disputes' | 'system'>('provisioning');

  // Provisioning form state
  const [targetUserId, setTargetUserId] = useState('');
  const [provisionRole, setProvisionRole] = useState<UserRole>(UserRole.ADMIN);
  const [provisionReason, setProvisionReason] = useState('');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Financial Governance state (Phase 4.1)
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReportDto | null>(null);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccountDto[]>([]);
  const [ledgerTransactions, setLedgerTransactions] = useState<LedgerTransactionDto[]>([]);
  const [financialConfig, setFinancialConfig] = useState<PlatformFinancialConfigDto | null>(null);
  const [financialOverview, setFinancialOverview] = useState<FinancialOverviewDto | null>(null);
  const [isLoadingFinancial, setIsLoadingFinancial] = useState(false);

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
      const [tbRes, accRes, txRes, cfgRes, ovRes] = await Promise.allSettled([
        apiService.getTrialBalance('USD'),
        apiService.listAccounts({ limit: 50 }),
        apiService.listTransactions({ limit: 50 }),
        apiService.getFinancialConfig(),
        apiService.getFinancialOverview(),
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
    } finally {
      setIsLoadingFinancial(false);
    }
  }, []);

  const loadSuperadminData = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const userRes = await apiService.getCurrentUser();
      if (userRes.success && userRes.data) {
        setCurrentUser(userRes.data as SuperadminUserRecord);
      }

      const [metricsRes, usersRes, logsRes] = await Promise.allSettled([
        apiService.getDashboardMetrics(),
        apiService.listUsers({ limit: 50 }),
        apiService.listAuditLogs({ limit: 30 }),
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
    } catch {
      // Handled
    }
  }, [isSignedIn]);

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

  const handleReverseTransaction = async (reference: string) => {
    const reason = prompt(`Enter authorized justification for reversing ledger transaction "${reference}":`);
    if (!reason || reason.trim().length < 5) {
      alert('Justification must be at least 5 characters.');
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

    setIsSubmittingRole(true);
    setActionMessage(null);
    setActionError(null);

    try {
      const res = await apiService.provisionUserRole(targetUserId, provisionRole, provisionReason);
      if (res.success) {
        setActionMessage(`Successfully provisioned role ${provisionRole} for user.`);
        setProvisionReason('');
        loadSuperadminData();
      } else {
        setActionError(res.error?.message || 'Failed to provision role');
      }
    } catch {
      setActionError('Role provisioning request failed');
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const isSuperadmin = currentUser?.role?.name === UserRole.SUPERADMIN;

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
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
                TrustPay Superadmin
              </span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                Root Governance
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
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
                  <UserButton afterSignOutUrl="/" />
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
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        {actionMessage && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
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
            {/* Tabs */}
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-4">
              <button
                onClick={() => setActiveTab('provisioning')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'provisioning'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Role Provisioning &amp; Privilege Allocation
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'audit'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Platform Audit Logs ({auditLogs.length})
              </button>
              <button
                onClick={() => setActiveTab('metrics')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'metrics'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Governance Metrics
              </button>
              <button
                onClick={() => setActiveTab('financial')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'financial'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ledger &amp; Financial Governance
              </button>
              <button
                onClick={() => setActiveTab('disputes')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'disputes'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Dispute Arbitration &amp; Holds
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'system'
                    ? 'bg-purple-900/40 text-purple-200 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Cluster Status
              </button>
            </div>

            {/* Tab 1: Role Provisioning Form */}
            {activeTab === 'provisioning' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center space-x-2">
                    <UserCog className="w-5 h-5 text-purple-400" />
                    <h4 className="text-base font-bold text-white">Privileged Role Provisioning</h4>
                  </div>
                  <p className="text-xs text-slate-400">
                    Assign authorized administrative or operational roles to verified user accounts with audit justification.
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
                        Audit Justification / Authorization Note
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
                      disabled={isSubmittingRole}
                      className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition disabled:opacity-50"
                    >
                      Provision Role &amp; Log Audit Event
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h4 className="text-sm font-semibold text-white">Current User Roster</h4>
                  <div className="divide-y divide-slate-800/80 max-h-[460px] overflow-y-auto">
                    {usersList.map((u) => (
                      <div key={u.id} className="py-3 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-white">
                            {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}
                          </span>
                          <div className="text-slate-500 font-mono text-[11px]">{u.email}</div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-purple-300">
                            {u.role?.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Audit Logs View */}
            {activeTab === 'audit' && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">Tamper-Evident System Audit Trail</h4>
                  <span className="text-xs text-slate-500">Persisted in Supabase PostgreSQL</span>
                </div>

                <div className="divide-y divide-slate-800/80">
                  {auditLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">No audit events recorded yet.</div>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="p-4 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-semibold text-purple-300">{log.action}</span>
                            <span className="text-slate-400">on {log.resource}</span>
                          </div>
                          <div className="text-slate-500">
                            Actor: {log.actor?.email || log.actorId || 'System'} | IP: {log.ipAddress || 'Internal'}
                          </div>
                        </div>
                        <span className="text-slate-500 font-mono">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Metrics */}
            {activeTab === 'metrics' && metrics && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">Total Registered Users</span>
                  <div className="text-2xl font-bold text-white">{metrics.users?.total || 0}</div>
                  <span className="text-[11px] text-slate-500">
                    {metrics.users?.clients} Clients | {metrics.users?.workers} Workers | {metrics.users?.admins} Admins
                  </span>
                </div>

                <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">Digital Contracts</span>
                  <div className="text-2xl font-bold text-emerald-400">{metrics.contracts?.total || 0}</div>
                  <span className="text-[11px] text-slate-500">
                    {metrics.contracts?.active} Active | {metrics.contracts?.completed} Completed
                  </span>
                </div>

                <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">Milestone Deliverables</span>
                  <div className="text-2xl font-bold text-blue-400">{metrics.milestones?.total || 0}</div>
                  <span className="text-[11px] text-slate-500">Tracking progress</span>
                </div>
              </div>
            )}

            {/* Financial Governance Tab */}
            {activeTab === 'financial' && (
              <div className="space-y-6">
                {/* Safeguard Alert */}
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-purple-300">
                      SUPERADMIN FINANCIAL GOVERNANCE CONSOLE
                    </div>
                    <p className="text-xs text-purple-200/80 leading-relaxed">
                      Provider: <span className="font-mono font-bold">{financialConfig?.activeProvider || 'PENDING_SELECTION'}</span> | Live Money Custody: <span className="font-bold text-amber-300">{financialConfig?.isLiveMoneyDisabled ? 'DISABLED' : 'ENABLED'}</span> | Supported Currencies: {financialConfig?.supportedCurrencies?.join(', ') || 'USD, EUR, GBP'} | Platform Fee: {financialConfig?.platformFeePercentage ?? 5.0}%. Double-entry ledger entries are immutable. Only explicit reversals via offsetting transactions are permitted. Total Agreed Commitment: <span className="font-mono font-bold text-white">{financialOverview ? formatCurrencyMinor(financialOverview.totalContractualAgreedMinor, 'USD') : '$0.00'}</span>.
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
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        trialBalance?.isBalanced
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {trialBalance?.isBalanced ? 'BALANCED' : 'DISCREPANCY DETECTED'}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {trialBalance ? new Date(trialBalance.generatedAt).toLocaleTimeString() : ''}
                      </span>
                    </div>
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
                        <div className="flex items-center space-x-3">
                          <span className="text-slate-400">{acc.currency}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {acc.status}
                          </span>
                        </div>
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
                      No transactions posted yet. Double-entry postings are created upon verified financial movements.
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
              </div>
            )}

            {/* Tab: Dispute Arbitration & Governance (Phase 6) */}
            {activeTab === 'disputes' && <SuperadminDisputesGovernance />}

            {/* Tab 4: Cluster Status */}
            {activeTab === 'system' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                    <Server className="w-4 h-4 text-purple-400" />
                    <span>API Gateway Service</span>
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
                    <span>Database Cluster</span>
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
