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
  FolderKanban,
  Wallet,
  Home,
  MessageSquare,
  HelpCircle,
  Menu,
  X,
  ChevronRight,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  CreditCard,
  Receipt,
  Folder,
  Scale,
  FileCheck,
  Compass,
  Stamp,
} from 'lucide-react';
import {
  useAuth,
  useUser,
  UserButton,
  SignInButton,
  SignUpButton,
  SignOutButton,
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
import { ProjectsWorkspace } from './components/ProjectsWorkspace';
import { ClientWallet } from './components/ClientWallet';
import { SpecialistWallet } from './components/SpecialistWallet';
import { ThemeToggle } from './components/ThemeToggle';
import { TrustPayLogo } from './components/TrustPayLogo';
import { PublicLandingPage } from './components/PublicLandingPage';
import { ContactSupportModal } from './components/ContactSupportModal';
import { MilestoneManagement } from './components/MilestoneManagement';
import { PaymentHistory } from './components/PaymentHistory';
import { ClientInvoices } from './components/ClientInvoices';
import { DocumentsVault } from './components/DocumentsVault';
import { ClientMessages } from './components/ClientMessages';
import { ClientDisputes } from './components/ClientDisputes';
import { SpecialistOpportunities } from './components/SpecialistOpportunities';
import { ClientStampConsole } from './components/ClientStampConsole';
import { ClientJobsManagement } from './components/ClientJobsManagement';
import { SpecialistTeamConsole } from './components/SpecialistTeamConsole';
import { RoleSelectionModal } from './components/RoleSelectionModal';
import { UserRole, ContractDto, WorkerProfileDto } from '@trustpay/shared';
import { useLocation } from 'react-router-dom';
import { PaymentCallbackPage } from './pages/PaymentCallbackPage';

type AppTab =
  | 'dashboard'
  | 'stamp'
  | 'job-postings'
  | 'teams'
  | 'opportunities'
  | 'marketplace'
  | 'contracts'
  | 'projects'
  | 'milestones'
  | 'payments'
  | 'invoices'
  | 'documents'
  | 'messages'
  | 'disputes'
  | 'hiring'
  | 'shortlist'
  | 'profile'
  | 'system'
  | 'wallet';


export const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const system = useSelector((state: RootState) => state.system);
  const auth = useSelector((state: RootState) => state.auth);

  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();

  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [viewMode, setViewMode] = useState<'app' | 'landing'>('app');
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWorkerForContract, setSelectedWorkerForContract] = useState<string | undefined>();
  const [hiringTargetWorker, setHiringTargetWorker] = useState<WorkerProfileDto | null>(null);
  const [contracts, setContracts] = useState<ContractDto[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [roleSelectionRequired, setRoleSelectionRequired] = useState(false);
  const [showRoleSwitchModal, setShowRoleSwitchModal] = useState(false);
  const [isSyncingRole, setIsSyncingRole] = useState(false);
  const [selectedRoleInProgress, setSelectedRoleInProgress] = useState<'CLIENT' | 'WORKER' | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasCheckedExistingProfile, setHasCheckedExistingProfile] = useState(false);
  const [chatTargetUserId, setChatTargetUserId] = useState<string | null>(null);

  const handleStartChat = (userId: string) => {
    setChatTargetUserId(userId);
    setActiveTab('messages');
  };

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

  // User explicitly selects or switches their intended role
  const handleSelectRole = useCallback(async (chosenRole: 'CLIENT' | 'WORKER') => {
    if (!isSignedIn) return;

    setIsSyncingRole(true);
    setSelectedRoleInProgress(chosenRole);
    setSyncError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token expired. Please refresh the page.');
      }

      const syncRes = await apiService.syncUserWithRole(chosenRole, token);
      if (syncRes.success && syncRes.data) {
        dispatch(setAuthUser(syncRes.data));
        setRoleSelectionRequired(false);
        setHasCheckedExistingProfile(true);
        // Clean up any pending role intent from storage
        try {
          localStorage.removeItem('trustpay_selected_role');
        } catch {
          // ignore storage error
        }
      } else {
        setSyncError(syncRes.error?.message || 'Account role configuration failed. Try again.');
      }
    } catch (err: unknown) {
      console.error('Role synchronization error:', err);
      setSyncError(err instanceof Error ? err.message : 'Failed to finalize profile setup.');
    } finally {
      setIsSyncingRole(false);
      setSelectedRoleInProgress(null);
    }
  }, [isSignedIn, getToken, dispatch]);

  // Initial authentication check: verify if profile already exists in DB
  const checkInitialProfile = useCallback(async () => {
    if (!isSignedIn) return;
    dispatch(setAuthLoading(true));
    try {
      const token = await getToken();
      if (!token) {
        return;
      }
      const meRes = await apiService.getCurrentUser(token);
      if (meRes.success && meRes.data) {
        dispatch(setAuthUser(meRes.data));
        setRoleSelectionRequired(false);
        setSyncError(null);
      } else if (meRes.error?.code === 'USER_NOT_REGISTERED') {
        // Check if user pre-selected their role intent during landing page registration/login
        const savedIntent = (() => {
          try {
            return localStorage.getItem('trustpay_selected_role') as 'CLIENT' | 'WORKER' | null;
          } catch {
            return null;
          }
        })();

        if (savedIntent === 'CLIENT' || savedIntent === 'WORKER') {
          await handleSelectRole(savedIntent);
        } else {
          setRoleSelectionRequired(true);
        }
      } else {
        console.warn('Profile fetch response:', meRes.error);
        if (!auth.isSynchronized) {
          setSyncError(meRes.error?.message || 'Could not verify database profile. Ensure backend is reachable.');
        }
      }
    } catch (err: unknown) {
      console.error('Initial profile check error:', err);
      setSyncError(err instanceof Error ? err.message : 'Session verification failed.');
    } finally {
      dispatch(setAuthLoading(false));
      setHasCheckedExistingProfile(true);
    }
  }, [isSignedIn, getToken, dispatch, auth.isSynchronized, handleSelectRole]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      dispatch(clearAuthUser());
      setHasCheckedExistingProfile(false);
      setRoleSelectionRequired(false);
      return;
    }

    if (auth.isSynchronized || hasCheckedExistingProfile) {
      return;
    }

    checkInitialProfile();
  }, [isLoaded, isSignedIn, auth.isSynchronized, hasCheckedExistingProfile, checkInitialProfile]);

  const refreshUserProfile = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const meRes = await apiService.getCurrentUser(token);
      if (meRes.success && meRes.data) {
        dispatch(setAuthUser(meRes.data));
      }
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  const loadContracts = useCallback(async () => {
    if (!isSignedIn) return;
    setIsLoadingContracts(true);
    try {
      const res = await apiService.listContracts();
      if (res.success && res.data) {
        setContracts(Array.isArray(res.data) ? res.data : ((res.data as unknown as { items: ContractDto[] }).items || []));
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingContracts(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  // Health check on system
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

  const isClient = (auth.role || (new URLSearchParams(window.location.search).get('preview') ? UserRole.CLIENT : undefined)) === UserRole.CLIENT;
  const isWorker = auth.role === UserRole.WORKER;
  const location = useLocation();

  if (location.pathname === '/payments/callback') {
    return <PaymentCallbackPage />;
  }

  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'dashboard';

  // When unauthenticated, or when explicitly toggled to view the landing page
  if ((!isSignedIn && !isPreview) || viewMode === 'landing') {
    return (
      <PublicLandingPage
        apiHealth={system.systemDetails}
        dbHealth={system.databaseDetails}
        isSignedIn={isSignedIn || isPreview}
        onGoToDashboard={() => setViewMode('app')}
      />
    );
  }

  // Calculate live total contracted balance
  const totalAgreedBalance = contracts.reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0);

  return (
    <div className="min-h-screen flex dark:bg-[#080808] bg-[#F5F7FA] dark:text-[#E8EAE6] text-[#242424] dark:selection:bg-[#8BFF24] selection:bg-[#5046E5] selection:text-white dark:selection:text-[#050605] font-sans transition-colors duration-200">
      {/* 1. DESKTOP PERMANENT LEFT SIDEBAR (Matching Image 2 Reference) */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 border-r dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] dark:bg-[#0B0D0B] bg-white sticky top-0 h-screen overflow-y-auto shrink-0 select-none transition-colors z-40 justify-between">
        <div>
          {/* Top Brand & Home Quick-Return Button */}
          <div className="p-4 sm:p-5 border-b dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] flex items-center justify-between">
            <div className="cursor-pointer flex items-center gap-2.5" onClick={() => setActiveTab('dashboard')}>
              <TrustPayLogo size="sm" iconOnly={true} className="scale-110" />
            </div>
            <button
              onClick={() => setViewMode('landing')}
              title="Return to Home Landing Page"
              className="p-1.5 rounded-lg dark:bg-[#151715] bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] border dark:border-[rgba(255,255,255,0.10)] border-[#C7D2FE] hover:scale-105 transition cursor-pointer"
            >
              <Home className="w-4 h-4" />
            </button>
          </div>

          {/* Account Balance Snapshot (Matching Image 2 Reference) */}
          <div className="mx-4 my-3 p-3.5 rounded-2xl dark:bg-[#151715] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-[11px] dark:text-[#A5AAA2] text-[#64748B]">
              <span className="font-mono">Acc. Bal. (Escrow)</span>
              <span className="w-2 h-2 rounded-full dark:bg-[#8BFF24] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            </div>
            <div
              className="text-sm font-extrabold font-mono dark:text-[#E8EAE6] text-[#111827] tabular-nums truncate"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {totalAgreedBalance === 0
                ? '$0.00 USD'
                : `$${totalAgreedBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}
            </div>
            <div className="text-[10px] dark:text-[#8BFF24] text-emerald-600 font-mono flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" />
              <span>100% Cryptographic Custody</span>
            </div>
          </div>

          {/* Features Navigation List (Matching Image 2 Reference) */}
          <nav className="px-3 space-y-1 pt-2">
            {/* Dashboard Link */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            {/* Section: Operations / Portfolio */}
            <div className="pt-3 pb-1 px-3">
              <span className="text-[10px] font-bold font-mono dark:text-[#A5AAA2] text-[#64748B] uppercase tracking-wider">
                Operations &amp; Deals
              </span>
            </div>

            {/* Quick Create Deal / Direct Contract Button */}
            {isClient && (
              <button
                onClick={() => {
                  setSelectedWorkerForContract(undefined);
                  setIsCreateModalOpen(true);
                }}
                className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold dark:bg-[#151715] bg-[#EEF2FF] text-[#5046E5] dark:text-[#8BFF24] border dark:border-[rgba(139,255,36,0.3)] border-[#C7D2FE] hover:bg-[#E0E7FF] transition cursor-pointer shadow-sm mb-1"
              >
                <PlusCircle className="w-4 h-4 dark:text-[#8BFF24] text-[#5046E5]" />
                <span>+ Create Deal</span>
              </button>
            )}

            {/* Client Digital Office Stamp Feature (Client only) */}
            {isClient && (
              <button
                onClick={() => setActiveTab('stamp')}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer mb-1 ${
                  activeTab === 'stamp'
                    ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                    : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
                }`}
              >
                <Stamp className="w-4 h-4 dark:text-[#8BFF24] text-[#5046E5]" />
                <span>My Stamp</span>
              </button>
            )}

            {/* Client Job Postings Feature (Client only) */}
            {isClient && (
              <button
                onClick={() => setActiveTab('job-postings')}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer mb-1 ${
                  activeTab === 'job-postings'
                    ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                    : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
                }`}
              >
                <Briefcase className="w-4 h-4 dark:text-[#8BFF24] text-[#5046E5]" />
                <span>Job Postings</span>
              </button>
            )}

            {isWorker && (
              <button
                onClick={() => setActiveTab('opportunities')}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer mb-1 ${
                  activeTab === 'opportunities'
                    ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                    : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Browse Opportunities</span>
              </button>
            )}

            {isWorker && (
              <button
                onClick={() => setActiveTab('teams')}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer mb-1 ${
                  activeTab === 'teams'
                    ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                    : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>My Teams</span>
              </button>
            )}

            {isClient && (
              <button
                onClick={() => setActiveTab('marketplace')}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'marketplace'
                    ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                    : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Marketplace</span>
              </button>
            )}

            {isClient && (
              <button
                onClick={() => setActiveTab('shortlist')}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'shortlist'
                    ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                    : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
                }`}
              >
                <Bookmark className="w-4 h-4" />
                <span>Shortlist</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('hiring')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'hiring'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>{isClient ? 'Hiring Proposals' : 'Incoming Proposals'}</span>
            </button>

            <button
              onClick={() => setActiveTab('contracts')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'contracts'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Briefcase className="w-4 h-4" />
                <span>My Agreements</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full dark:bg-[#202220] bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] font-mono font-bold">
                {contracts.length}
              </span>
            </button>

            {/* Milestones & Deliverable Review (Feature 1 & 2) */}
            <button
              onClick={() => setActiveTab('milestones')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'milestones'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Milestones &amp; Review</span>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'projects'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              <span>Projects Workspace</span>
            </button>

            {/* Invoices (Feature 4) */}
            <button
              onClick={() => setActiveTab('invoices')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'invoices'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Invoices &amp; Billing</span>
            </button>

            {/* Payment History (Feature 3) */}
            <button
              onClick={() => setActiveTab('payments')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'payments'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Payment History</span>
            </button>

            {/* Documents Vault (Feature 5) */}
            <button
              onClick={() => setActiveTab('documents')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'documents'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span>Document Vault</span>
            </button>

            {/* Messages (Feature 6) */}
            <button
              onClick={() => setActiveTab('messages')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'messages'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Direct Messages</span>
            </button>

            {/* Disputes (Feature 7) */}
            <button
              onClick={() => setActiveTab('disputes')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'disputes'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>Dispute Center</span>
            </button>

            <button
              onClick={() => setActiveTab('wallet')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'wallet'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Transactions &amp; Wallet</span>
            </button>


            {/* Section: Account & Diagnostics */}
            <div className="pt-3 pb-1 px-3">
              <span className="text-[10px] font-bold font-mono dark:text-[#A5AAA2] text-[#64748B] uppercase tracking-wider">
                Preferences
              </span>
            </div>

            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'profile'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{isWorker ? 'Specialist Profile' : 'Account Profile'}</span>
            </button>

            <button
              onClick={() => setActiveTab('system')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'system'
                  ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white shadow-md shadow-[#5046E5]/25 font-bold'
                  : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Platform Diagnostics</span>
            </button>
          </nav>
        </div>

        {/* Bottom Help Center Box (Matching Image 2 Reference) */}
        <div className="p-4 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] space-y-3">
          <div className="p-3.5 rounded-xl dark:bg-[#151715] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] space-y-2 shadow-sm">
            <div>
              <h5 className="text-xs font-bold dark:text-[#E8EAE6] text-[#111827]">Help Center</h5>
              <p className="text-[11px] dark:text-[#A5AAA2] text-[#64748B]">How can we help?</p>
            </div>
            <button
              onClick={() => setIsContactModalOpen(true)}
              className="w-full py-1.5 px-3 rounded-lg dark:bg-[#8BFF24] dark:hover:bg-[#A3FF50] dark:text-[#050605] bg-[#5046E5] hover:bg-[#4338CA] text-white text-[11px] font-bold transition flex items-center justify-center space-x-1.5 shadow-md shadow-[#5046E5]/25 cursor-pointer active:scale-95"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Get Support</span>
            </button>
          </div>
          <div className="text-[10px] text-center dark:text-[#A5AAA2] text-[#64748B] font-mono">
            TrustPay Enterprise • v2.0
          </div>
        </div>
      </aside>

      {/* 2. MOBILE SLIDE-OVER SIDEBAR DRAWER */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative w-72 max-w-[80%] dark:bg-[#0B0D0B] bg-white h-full z-10 flex flex-col justify-between p-4 overflow-y-auto border-r dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0]">
            <div>
              <div className="flex items-center justify-between pb-4 border-b dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0]">
                <TrustPayLogo size="sm" iconOnly={true} className="scale-110" />
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1 rounded-lg dark:bg-[#151715] bg-[#F1F5F9] dark:text-[#E8EAE6] text-[#111827]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Role Switcher Pill */}
              <div className="pt-3 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    setShowRoleSwitchModal(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold dark:bg-[#151715] bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] border dark:border-[rgba(139,255,36,0.25)] border-[#C7D2FE] cursor-pointer"
                >
                  <span className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full dark:bg-[#8BFF24] bg-[#5046E5]" />
                    <span>{isClient ? 'Client Portal' : isWorker ? 'Specialist Workspace' : 'Select Role'}</span>
                  </span>
                  <span className="text-[10px] underline opacity-80">Switch</span>
                </button>
              </div>

              <nav className="space-y-1.5 pt-4">
                <button
                  onClick={() => { setActiveTab('dashboard'); setMobileSidebarOpen(false); }}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold dark:text-[#CDCBCA] text-[#475569]"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>
                {isWorker && (
                  <button
                    onClick={() => { setActiveTab('opportunities'); setMobileSidebarOpen(false); }}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold dark:text-[#CDCBCA] text-[#475569]"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Browse Opportunities</span>
                  </button>
                )}
                {isWorker && (
                  <button
                    onClick={() => { setActiveTab('teams'); setMobileSidebarOpen(false); }}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold dark:text-[#CDCBCA] text-[#475569]"
                  >
                    <Users className="w-4 h-4" />
                    <span>My Teams</span>
                  </button>
                )}
                {isClient && (
                  <button
                    onClick={() => { setActiveTab('stamp'); setMobileSidebarOpen(false); }}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold dark:text-[#CDCBCA] text-[#475569]"
                  >
                    <Stamp className="w-4 h-4 dark:text-[#8BFF24] text-[#5046E5]" />
                    <span>My Stamp</span>
                  </button>
                )}
                {isClient && (
                  <button
                    onClick={() => { setActiveTab('job-postings'); setMobileSidebarOpen(false); }}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold dark:text-[#CDCBCA] text-[#475569]"
                  >
                    <Briefcase className="w-4 h-4 dark:text-[#8BFF24] text-[#5046E5]" />
                    <span>Job Postings</span>
                  </button>
                )}
                {isClient && (
                  <button
                    onClick={() => { setActiveTab('marketplace'); setMobileSidebarOpen(false); }}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold dark:text-[#CDCBCA] text-[#475569]"
                  >
                    <Users className="w-4 h-4" />
                    <span>Marketplace</span>
                  </button>
                )}
                <button
                  onClick={() => { setActiveTab('contracts'); setMobileSidebarOpen(false); }}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold dark:text-[#CDCBCA] text-[#475569]"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>My Agreements ({contracts.length})</span>
                </button>
                <button
                  onClick={() => { setActiveTab('projects'); setMobileSidebarOpen(false); }}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold dark:text-[#CDCBCA] text-[#475569]"
                >
                  <FolderKanban className="w-4 h-4" />
                  <span>Projects &amp; Milestones</span>
                </button>
                <button
                  onClick={() => { setActiveTab('wallet'); setMobileSidebarOpen(false); }}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold dark:text-[#CDCBCA] text-[#475569]"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Transactions &amp; Wallet</span>
                </button>
              </nav>
            </div>

            <div className="pt-4 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0]">
              <button
                onClick={() => { setViewMode('landing'); setMobileSidebarOpen(false); }}
                className="w-full py-2 rounded-xl dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white text-xs font-bold flex items-center justify-center space-x-1 shadow-md shadow-[#5046E5]/25"
              >
                <Home className="w-4 h-4" />
                <span>Return to Home Page</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN APPLICATION AREA (Header + Content) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar (With Home, Profile, Contact, Brand Symbol, and Theme Toggle) */}
        <header className="border-b dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] dark:bg-[#080808]/90 bg-white/90 backdrop-blur-md sticky top-0 z-30 transition-colors">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Left: Mobile Menu Toggle & Breadcrumbs */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg dark:bg-[#151715] bg-[#F1F5F9] dark:text-[#E8EAE6] text-[#111827] border dark:border-[rgba(255,255,255,0.10)] border-[#CBD5E1]"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold dark:text-[#E8EAE6] text-[#111827]">
                  TrustPay
                </span>
                <span className="dark:text-[#A5AAA2] text-[#94A3B8]">/</span>
                <button
                  type="button"
                  onClick={() => setShowRoleSwitchModal(true)}
                  title="Switch between Client and Specialist roles"
                  className="group flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-full dark:bg-[#151715] bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] border dark:border-[rgba(139,255,36,0.25)] border-[#C7D2FE] hover:dark:border-[#8BFF24] hover:border-[#5046E5] transition-all cursor-pointer font-mono font-medium active:scale-95 shadow-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full dark:bg-[#8BFF24] bg-[#5046E5] shadow-[0_0_6px_rgba(79,70,229,0.8)]" />
                  <span>{isClient ? 'Client Portal' : isWorker ? 'Specialist Workspace' : 'Select Role'}</span>
                  <span className="text-[10px] opacity-75 group-hover:opacity-100 font-sans underline ml-0.5">
                    Switch
                  </span>
                </button>
              </div>
            </div>

            {/* Right: Profile Link + Theme Toggle + Refresh + User */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Profile Link */}
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'profile'
                    ? 'dark:bg-[#8BFF24]/10 dark:text-[#8BFF24] bg-[#EEF2FF] text-[#5046E5]'
                    : 'dark:text-[#CDCBCA] text-[#475569] hover:dark:bg-[#151715] hover:bg-[#EEF2FF] hover:text-[#5046E5]'
                }`}
              >
                <User className="w-3.5 h-3.5 dark:text-[#8BFF24] text-[#5046E5]" />
                <span>Profile</span>
              </button>

              {/* Global Theme Toggle (Symbols Only) */}
              <ThemeToggle />

              {/* Telemetry Trigger */}
              <button
                onClick={runHealthCheck}
                disabled={isRefreshing}
                title="Verify API &amp; Database Connectivity"
                className="p-2 rounded-xl dark:bg-[#151715] bg-white hover:bg-[#EEF2FF] text-xs font-medium dark:text-[#CDCBCA] text-[#475569] transition border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] shadow-sm cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin dark:text-[#8BFF24] text-[#5046E5]' : 'dark:text-[#8BFF24] text-[#5046E5]'}`} />
              </button>

              {/* Notifications & Clerk User Button */}
              {isLoaded && isSignedIn && (
                <div className="flex items-center space-x-2">
                  <NotificationDropdown />
                  <UserButton afterSignOutUrl="/" />
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <div key={activeTab} className="feature-enter space-y-6">
          {/* Tab 1: Dashboard Overview View */}
          {activeTab === 'dashboard' && (
            <DashboardOverview
              userRole={auth.role || UserRole.CLIENT}
              onNavigate={(tab) => setActiveTab(tab as AppTab)}
            />
          )}

          {/* Tab: Client Digital Office Stamp (Client only) */}
          {activeTab === 'stamp' && isClient && (
            <ClientStampConsole
              onNavigateToContract={(contractId) => {
                setActiveTab('contracts');
              }}
            />
          )}

          {/* Tab: Client Job Postings & Applications Management */}
          {activeTab === 'job-postings' && isClient && (
            <ClientJobsManagement onStartChat={handleStartChat} />
          )}

          {/* Tab: Specialist Teams & Consortiums */}
          {activeTab === 'teams' && isWorker && (
            <SpecialistTeamConsole />
          )}

          {/* Tab 2: Specialist Marketplace View (Client only) */}
          {activeTab === 'marketplace' && isClient && (
            <WorkerMarketplace
              onSelectWorkerForContract={(workerId) => {
                setSelectedWorkerForContract(workerId);
                setIsCreateModalOpen(true);
              }}
              onOpenHiringModal={(worker) => setHiringTargetWorker(worker)}
              onStartChat={handleStartChat}
              isClient={isClient}
            />
          )}

          {/* Tab: Browse Opportunities (Specialist Project Marketplace) */}
          {activeTab === 'opportunities' && isWorker && (
            <SpecialistOpportunities
              onProposalSubmitted={() => setActiveTab('hiring')}
            />
          )}

          {/* Tab 3: Shortlist View (Client only) */}
          {activeTab === 'shortlist' && isClient && (
            <ShortlistPage
              onSelectWorkerForContract={(workerId) => {
                setSelectedWorkerForContract(workerId);
                setIsCreateModalOpen(true);
              }}
              onOpenHiringModal={(worker) => setHiringTargetWorker(worker)}
              onStartChat={handleStartChat}
            />
          )}

          {/* Tab 4: Hiring Proposals List */}
          {activeTab === 'hiring' && (
            <HiringRequestsList
              userRole={auth.role || UserRole.CLIENT}
              onContractCreated={() => {
                loadContracts();
                setActiveTab('contracts');
              }}
            />
          )}

          {/* Tab 5: Contracts View */}
          {activeTab === 'contracts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#242424] dark:text-[#CDCBCA]">
                    {isWorker ? 'Assigned Digital Agreements' : 'Digital Contracts & Escrow Agreements'}
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-[#A5A5A5] mt-1">
                    All contracts enforce cryptographic milestone tracking, SHA-256 integrity, and non-custodial escrow allocations.
                  </p>
                </div>
              </div>

              {isLoadingContracts ? (
                <div className="p-12 text-center text-[#64748B] dark:text-[#A5A5A5] text-sm animate-pulse">
                  Loading verified contracts...
                </div>
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

          {/* Tab: Projects & Milestones Workspace */}
          {activeTab === 'projects' && (
            <ProjectsWorkspace
              currentUserRole={auth.role || UserRole.CLIENT}
              currentUserId={auth.user?.id || ''}
            />
          )}

          {/* Tab: Milestones & Deliverable Review (Features 1 & 2) */}
          {activeTab === 'milestones' && (
            <MilestoneManagement
              userRole={auth.role || UserRole.CLIENT}
              onNavigateToContract={(contractId) => {
                setActiveTab('contracts');
              }}
            />
          )}

          {/* Tab: Invoices & Billing (Feature 4) */}
          {activeTab === 'invoices' && (
            <ClientInvoices userRole={auth.role || UserRole.CLIENT} />
          )}

          {/* Tab: Payment History (Feature 3) */}
          {activeTab === 'payments' && (
            <PaymentHistory />
          )}

          {/* Tab: Document Vault (Feature 5) */}
          {activeTab === 'documents' && (
            <DocumentsVault />
          )}

          {/* Tab: Direct Messages (Feature 6) */}
          {activeTab === 'messages' && (
            <ClientMessages
              currentUserId={auth.user?.id}
              targetRecipientId={chatTargetUserId}
              onClearTargetRecipient={() => setChatTargetUserId(null)}
            />
          )}

          {/* Tab: Dispute Resolution Center (Feature 7) */}
          {activeTab === 'disputes' && (
            <ClientDisputes userRole={auth.role || UserRole.CLIENT} />
          )}


          {/* Tab 6: Profile & Skills Management */}
          {activeTab === 'profile' && auth.user && (
            <ProfileManagement
              currentUser={auth.user}
              onProfileUpdated={refreshUserProfile}
            />
          )}

          {/* Tab: Virtual Escrow & Financial Wallet (Client & Specialist) */}
          {activeTab === 'wallet' && isClient && (
            <ClientWallet
              onNavigateToContract={() => {
                setActiveTab('contracts');
              }}
            />
          )}

          {activeTab === 'wallet' && isWorker && (
            <SpecialistWallet
              onNavigateToProjects={() => setActiveTab('projects')}
              onNavigateToContract={() => {
                setActiveTab('contracts');
              }}
            />
          )}

          {/* Tab 7: System Health Diagnostics */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2 text-sm font-semibold dark:text-[#E8EAE6] text-slate-900">
                <Activity className="w-4 h-4 dark:text-[#8BFF24] text-[#5046E5]" />
                <span>Backend &amp; Database Real-Time Telemetry</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Express API Card */}
                <div className="p-6 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-slate-200 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg dark:bg-[#202220] bg-[#EEF2FF] border dark:border-[rgba(139,255,36,0.25)] border-[#C7D2FE] flex items-center justify-center dark:text-[#8BFF24] text-[#5046E5]">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold dark:text-[#E8EAE6] text-slate-900">Central Express API</h4>
                        <span className="text-xs dark:text-[#A5AAA2] text-slate-500 font-mono">http://localhost:5000/api/v1</span>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium ${
                        system.apiStatus === 'healthy'
                          ? 'dark:bg-[#8BFF24]/10 bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] dark:border-[rgba(139,255,36,0.25)] border-[#C7D2FE]'
                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      }`}
                    >
                      {system.apiStatus.toUpperCase()}
                    </span>
                  </div>

                  {system.systemDetails && (
                    <div className="text-xs dark:text-[#A5AAA2] text-slate-600 space-y-1 dark:bg-[#202220] bg-slate-50 p-3 rounded-lg border dark:border-[rgba(255,255,255,0.08)] border-slate-200 font-mono">
                      <div>Service: {system.systemDetails.service}</div>
                      <div>Version: {system.systemDetails.version}</div>
                      <div>Uptime: {system.systemDetails.uptimeSeconds}s</div>
                      <div>Environment: {system.systemDetails.environment}</div>
                    </div>
                  )}
                </div>

                {/* Supabase PostgreSQL Card */}
                <div className="p-6 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-slate-200 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg dark:bg-[#202220] bg-[#EEF2FF] border dark:border-[rgba(139,255,36,0.25)] border-[#C7D2FE] flex items-center justify-center dark:text-[#8BFF24] text-[#5046E5]">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold dark:text-[#E8EAE6] text-slate-900">Supabase PostgreSQL</h4>
                        <span className="text-xs dark:text-[#A5AAA2] text-slate-500 font-mono">Prisma Driver Adapter</span>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium ${
                        system.dbStatus === 'connected'
                          ? 'dark:bg-[#8BFF24]/10 bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] dark:border-[rgba(139,255,36,0.25)] border-[#C7D2FE]'
                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      }`}
                    >
                      {system.dbStatus.toUpperCase()}
                    </span>
                  </div>

                  {system.databaseDetails && (
                    <div className="text-xs dark:text-[#A5AAA2] text-[#64748B] space-y-1 dark:bg-[#202220] bg-[#F8FAFC] p-3 rounded-lg border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] font-mono">
                      <div>Database: {system.databaseDetails.database}</div>
                      {system.databaseDetails.latencyMs && (
                        <div>Latency: {system.databaseDetails.latencyMs}ms</div>
                      )}
                      <div>Status: {system.databaseDetails.status}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
        </main>
      </div>

      {/* Contact & Support Modal */}
      <ContactSupportModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        userEmail={clerkUser?.primaryEmailAddress?.emailAddress}
        userName={clerkUser?.fullName || clerkUser?.firstName || 'User'}
      />

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

      {/* Role Selection Onboarding Modal (Required for unregistered/new users) */}
      {isSignedIn && roleSelectionRequired && (
        <RoleSelectionModal
          isOpen={true}
          onSelectRole={handleSelectRole}
          isSubmitting={isSyncingRole}
          errorMessage={syncError}
          actionType="sync"
          title="Choose Your TrustPay Account Role"
          subtitle="Select whether you are joining to hire specialists as a Client, or offering services as a Specialist."
        />
      )}

      {/* Role Switcher Modal (On-demand workspace switcher for active users) */}
      {isSignedIn && showRoleSwitchModal && (
        <RoleSelectionModal
          isOpen={showRoleSwitchModal}
          onSelectRole={async (chosenRole) => {
            await handleSelectRole(chosenRole);
            setShowRoleSwitchModal(false);
          }}
          onCancel={() => setShowRoleSwitchModal(false)}
          isSubmitting={isSyncingRole}
          errorMessage={syncError}
          actionType="switch"
          title="Switch Active Portal Role"
          subtitle={`Currently operating as ${isClient ? 'Client' : 'Specialist'}. Select a role below to switch your active workspace.`}
        />
      )}
    </div>
  );
};
