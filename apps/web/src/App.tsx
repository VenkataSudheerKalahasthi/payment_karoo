import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Server,
  Database,
  RefreshCw,
  Users,
  Briefcase,
  PlusCircle,
  Activity,
  LogIn,
  UserPlus,
  Bookmark,
  Send,
  User,
  LayoutDashboard,
} from 'lucide-react';
import {
  useAuth,
  useUser,
  UserButton,
  SignInButton,
  SignUpButton,
} from '@clerk/clerk-react';
import { RootState, AppDispatch } from './store';
import {
  setChecking,
  setSystemHealth,
  setApiFailed,
  setDatabaseHealth,
  setDatabaseFailed,
} from './store/slices/systemSlice';
import {
  setAuthUser,
  clearAuthUser,
  setAuthLoading,
} from './store/slices/authSlice';
import { apiService, setAuthTokenGetter } from './services/api';
import { ThreeEscrowVisual } from './components/ThreeEscrowVisual';
import { ContractList } from './components/ContractList';
import { CreateContractModal } from './components/CreateContractModal';
import { WorkerMarketplace } from './components/WorkerMarketplace';
import { CreateHiringRequestModal } from './components/CreateHiringRequestModal';
import { HiringRequestsList } from './components/HiringRequestsList';
import { ShortlistPage } from './components/ShortlistPage';
import { DashboardOverview } from './components/DashboardOverview';
import { ProfileManagement } from './components/ProfileManagement';
import { NotificationDropdown } from './components/NotificationDropdown';
import { UserRole, ContractDto, WorkerProfileDto } from '@trustpay/shared';
import { useLocation } from 'react-router-dom';
import { PaymentCallbackPage } from './pages/PaymentCallbackPage';

type AppTab = 'dashboard' | 'marketplace' | 'contracts' | 'hiring' | 'shortlist' | 'profile' | 'system';

export const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const system = useSelector((state: RootState) => state.system);
  const auth = useSelector((state: RootState) => state.auth);

  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();

  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWorkerForContract, setSelectedWorkerForContract] = useState<string | undefined>();
  const [hiringTargetWorker, setHiringTargetWorker] = useState<WorkerProfileDto | null>(null);
  const [contracts, setContracts] = useState<ContractDto[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [roleSelectionRequired, setRoleSelectionRequired] = useState(false);

  // Configure token getter for Axios
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

  // Synchronize authenticated Clerk user with database
  const syncWithDatabase = useCallback(async (chosenRole?: 'CLIENT' | 'WORKER') => {
    if (!isSignedIn) return;

    dispatch(setAuthLoading(true));
    try {
      const meRes = await apiService.getCurrentUser();
      if (meRes.success && meRes.data) {
        dispatch(setAuthUser(meRes.data));
        setRoleSelectionRequired(false);
        return;
      }

      const syncRes = await apiService.syncUser(chosenRole || 'CLIENT');
      if (syncRes.success && syncRes.data) {
        dispatch(setAuthUser(syncRes.data));
        setRoleSelectionRequired(false);
      } else if (syncRes.error?.code === 'USER_NOT_REGISTERED' || !chosenRole) {
        setRoleSelectionRequired(true);
      }
    } catch {
      setRoleSelectionRequired(true);
    } finally {
      dispatch(setAuthLoading(false));
    }
  }, [isSignedIn, dispatch]);

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        syncWithDatabase();
      } else {
        dispatch(clearAuthUser());
      }
    }
  }, [isLoaded, isSignedIn, syncWithDatabase, dispatch]);

  // Fetch contracts when authenticated
  const loadContracts = useCallback(async () => {
    if (!isSignedIn) return;
    setIsLoadingContracts(true);
    try {
      const res = await apiService.listContracts();
      if (res.success && res.data) {
        setContracts(res.data);
      }
    } finally {
      setIsLoadingContracts(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (auth.isSynchronized) {
      loadContracts();
    }
  }, [auth.isSynchronized, loadContracts]);

  // Health check verification
  const runHealthCheck = async () => {
    setIsRefreshing(true);
    dispatch(setChecking());
    try {
      const apiRes = await apiService.checkHealth();
      if (apiRes.success && apiRes.data) {
        dispatch(setSystemHealth(apiRes.data));
      } else {
        dispatch(setApiFailed());
      }
    } catch {
      dispatch(setApiFailed());
    }

    try {
      const dbRes = await apiService.checkDatabase();
      if (dbRes.success && dbRes.data) {
        dispatch(setDatabaseHealth(dbRes.data));
      } else {
        dispatch(setDatabaseFailed());
      }
    } catch {
      dispatch(setDatabaseFailed());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const isClient = auth.role === UserRole.CLIENT;
  const isWorker = auth.role === UserRole.WORKER;
  const location = useLocation();

  if (location.pathname === '/payments/callback') {
    return <PaymentCallbackPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                TrustPay Enterprise
              </span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                {isClient ? 'Client Portal' : isWorker ? 'Specialist Workspace' : 'Portal'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {isSignedIn && auth.user && (
              <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-300">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 font-semibold">
                  {auth.role}
                </span>
                <span>{clerkUser?.primaryEmailAddress?.emailAddress}</span>
              </div>
            )}

            <button
              onClick={runHealthCheck}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Verify Connectivity</span>
            </button>

            {/* Clerk Authentication Controls & Notifications */}
            {isLoaded && (
              <>
                {isSignedIn ? (
                  <div className="flex items-center space-x-3">
                    <NotificationDropdown />
                    <UserButton afterSignOutUrl="/" />
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <SignInButton mode="modal">
                      <button className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition flex items-center space-x-1">
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sign In</span>
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition flex items-center space-x-1">
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Register</span>
                      </button>
                    </SignUpButton>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Role Selection Dialog for First-Time Sync */}
      {roleSelectionRequired && isSignedIn && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Choose Your Account Role</h3>
              <p className="text-xs text-slate-400 mt-1">
                Select your intended capacity on TrustPay Enterprise to synchronize your profile.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                onClick={() => syncWithDatabase('CLIENT')}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500 transition text-left space-y-2"
              >
                <Briefcase className="w-6 h-6 text-emerald-400" />
                <h4 className="text-sm font-semibold text-white">I am a Client</h4>
                <p className="text-[11px] text-slate-400">Propose contracts and manage milestone escrow agreements.</p>
              </button>

              <button
                onClick={() => syncWithDatabase('WORKER')}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 transition text-left space-y-2"
              >
                <Users className="w-6 h-6 text-blue-400" />
                <h4 className="text-sm font-semibold text-white">I am a Specialist</h4>
                <p className="text-[11px] text-slate-400">Offer technical skills and submit milestone deliverables.</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        {/* Navigation Tabs when Signed In */}
        {isSignedIn && (
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  activeTab === 'dashboard'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dashboard</span>
              </button>

              {isClient && (
                <button
                  onClick={() => setActiveTab('marketplace')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                    activeTab === 'marketplace'
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>Discover Specialists</span>
                </button>
              )}

              {isClient && (
                <button
                  onClick={() => setActiveTab('shortlist')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                    activeTab === 'shortlist'
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                  <span>Shortlist</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('hiring')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  activeTab === 'hiring'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Send className="w-3.5 h-3.5 text-purple-400" />
                <span>{isClient ? 'Hiring Proposals' : 'Incoming Proposals'}</span>
              </button>

              <button
                onClick={() => setActiveTab('contracts')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  activeTab === 'contracts'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                <span>My Agreements ({contracts.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  activeTab === 'profile'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5 text-slate-300" />
                <span>{isWorker ? 'Specialist Profile & Skills' : 'Account Profile'}</span>
              </button>

              <button
                onClick={() => setActiveTab('system')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'system'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Platform Diagnostics
              </button>
            </div>

            {isClient && (
              <button
                onClick={() => {
                  setSelectedWorkerForContract(undefined);
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition shadow-lg shadow-emerald-900/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Direct Contract</span>
              </button>
            )}
          </div>
        )}

        {/* Tab 1: Dashboard Overview View */}
        {isSignedIn && activeTab === 'dashboard' && (
          <DashboardOverview
            userRole={auth.role || UserRole.CLIENT}
            onNavigate={(tab) => setActiveTab(tab as AppTab)}
          />
        )}

        {/* Tab 2: Specialist Marketplace View (Client only) */}
        {isSignedIn && activeTab === 'marketplace' && isClient && (
          <WorkerMarketplace
            onSelectWorkerForContract={(workerId) => {
              setSelectedWorkerForContract(workerId);
              setIsCreateModalOpen(true);
            }}
            onOpenHiringModal={(worker) => setHiringTargetWorker(worker)}
            isClient={isClient}
          />
        )}

        {/* Tab 3: Shortlist View (Client only) */}
        {isSignedIn && activeTab === 'shortlist' && isClient && (
          <ShortlistPage
            onSelectWorkerForContract={(workerId) => {
              setSelectedWorkerForContract(workerId);
              setIsCreateModalOpen(true);
            }}
            onOpenHiringModal={(worker) => setHiringTargetWorker(worker)}
          />
        )}

        {/* Tab 4: Hiring Proposals List */}
        {isSignedIn && activeTab === 'hiring' && (
          <HiringRequestsList
            userRole={auth.role || UserRole.CLIENT}
            onContractCreated={() => {
              loadContracts();
              setActiveTab('contracts');
            }}
          />
        )}

        {/* Tab 5: Contracts View */}
        {isSignedIn && activeTab === 'contracts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {isWorker ? 'Assigned Digital Agreements' : 'Digital Contracts & Escrow Agreements'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  All contracts enforce cryptographic milestone tracking and role-based permissions.
                </p>
              </div>
            </div>

            {isLoadingContracts ? (
              <div className="p-12 text-center text-slate-500 text-sm">Loading verified contracts...</div>
            ) : (
              <ContractList
                contracts={contracts}
                userRole={auth.role || UserRole.CLIENT}
                currentUserId={auth.user?.id}
                onRefresh={loadContracts}
              />
            )}
          </div>
        )}

        {/* Tab 6: Profile & Skills Management */}
        {isSignedIn && activeTab === 'profile' && auth.user && (
          <ProfileManagement
            currentUser={auth.user}
            onProfileUpdated={() => {
              syncWithDatabase();
            }}
          />
        )}

        {/* Tab 7: System Health Diagnostics & Hero View */}
        {(!isSignedIn || activeTab === 'system') && (
          <div className="space-y-10">
            {/* Hero Section with 3D Escrow Visual */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-gradient-to-b from-slate-900/80 to-slate-900/20 rounded-2xl border border-slate-800/80 p-8 shadow-2xl">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="lg:col-span-7 space-y-5"
              >
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>TrustPay Enterprise v2.0 Active</span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  Secure Digital Contract &amp; Specialist Escrow Management
                </h1>
                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                  TrustPay Enterprise provides verified milestone-based escrow custody, digital
                  contract signing, and tamper-evident work agreements connecting Clients and
                  specialized Workers worldwide.
                </p>

                {!isSignedIn && (
                  <div className="pt-2 flex items-center space-x-3">
                    <SignUpButton mode="modal">
                      <button className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white transition shadow-lg shadow-emerald-900/30">
                        Get Started as Client or Specialist
                      </button>
                    </SignUpButton>
                    <SignInButton mode="modal">
                      <button className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200 border border-slate-700 transition">
                        Sign In
                      </button>
                    </SignInButton>
                  </div>
                )}
              </motion.div>

              <div className="lg:col-span-5 h-[340px] w-full rounded-xl overflow-hidden bg-slate-950/60 border border-slate-800/60 flex items-center justify-center relative">
                <ThreeEscrowVisual />
              </div>
            </section>

            {/* Architecture Diagnostics Section */}
            <section className="space-y-4">
              <div className="flex items-center space-x-2 text-sm font-semibold text-slate-300">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Backend &amp; Database Real-Time Telemetry</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Express API Card */}
                <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">Central Express API</h4>
                        <span className="text-xs text-slate-500">http://localhost:5000/api/v1</span>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        system.apiStatus === 'healthy'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {system.apiStatus.toUpperCase()}
                    </span>
                  </div>

                  {system.systemDetails && (
                    <div className="text-xs text-slate-400 space-y-1 bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                      <div>Service: {system.systemDetails.service}</div>
                      <div>Version: {system.systemDetails.version}</div>
                      <div>Uptime: {system.systemDetails.uptimeSeconds}s</div>
                      <div>Environment: {system.systemDetails.environment}</div>
                    </div>
                  )}
                </div>

                {/* Supabase PostgreSQL Card */}
                <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">Supabase PostgreSQL</h4>
                        <span className="text-xs text-slate-500">Prisma 7.10.1 Driver Adapter</span>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        system.dbStatus === 'connected'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {system.dbStatus.toUpperCase()}
                    </span>
                  </div>

                  {system.databaseDetails && (
                    <div className="text-xs text-slate-400 space-y-1 bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                      <div>Database: {system.databaseDetails.database}</div>
                      {system.databaseDetails.latencyMs && (
                        <div>Latency: {system.databaseDetails.latencyMs}ms</div>
                      )}
                      <div>Status: {system.databaseDetails.status}</div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Direct Contract Creation Modal */}
      <CreateContractModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          loadContracts();
          setActiveTab('contracts');
        }}
        initialWorkerId={selectedWorkerForContract}
      />

      {/* Send Hiring Proposal Modal */}
      {hiringTargetWorker && (
        <CreateHiringRequestModal
          worker={hiringTargetWorker}
          isOpen={!!hiringTargetWorker}
          onClose={() => setHiringTargetWorker(null)}
          onSuccess={() => {
            setActiveTab('hiring');
          }}
        />
      )}
    </div>
  );
};
