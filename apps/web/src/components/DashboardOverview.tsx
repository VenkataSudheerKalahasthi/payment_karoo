import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { DashboardMetricsDto, UserRole } from '@trustpay/shared';
import {
  Briefcase,
  Users,
  Send,
  FileCheck2,
  TrendingUp,
  Clock,
  Activity,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  ShieldCheck,
  ArrowUpRight,
  ChevronRight,
  ShieldAlert,
  Wallet,
  Sparkles,
  Layers,
  ArrowDownRight,
  CheckCircle2,
} from 'lucide-react';

interface DashboardOverviewProps {
  userRole: UserRole;
  onNavigate: (tab: string) => void;
}

// Animated counting number component for currency amounts
function AnimatedAmount({
  value,
  prefix = '$',
  decimals = 2,
  duration = 1200,
}: {
  value: number;
  prefix?: string;
  decimals?: number;
  duration?: number;
}) {
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplayVal(0);
      return;
    }
    let startTime: number | null = null;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayVal(ease * value);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setDisplayVal(value);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [value, duration]);

  return (
    <span>
      {prefix}
      {displayVal.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}

// Animated integer counter component for counts (e.g. contracts)
function AnimatedInteger({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplayVal(0);
      return;
    }
    let startTime: number | null = null;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayVal(Math.round(ease * value));

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setDisplayVal(value);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [value, duration]);

  return <span>{displayVal}</span>;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  userRole,
  onNavigate,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetricsDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeContractFilter, setActiveContractFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING'>('ALL');

  useEffect(() => {
    let isMounted = true;
    apiService
      .getDashboardMetrics()
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setMetrics(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load dashboard metrics:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isClient = userRole === UserRole.CLIENT;
  const isWorker = userRole === UserRole.WORKER;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0]" />
          ))}
        </div>
      </div>
    );
  }

  const activeEscrowAmount = metrics?.totalProjectValue ?? (metrics as unknown as Record<string, number>)?.activeEscrowBalance ?? 0;
  const completedAmount = metrics?.approvedMilestoneAmount ?? (metrics as unknown as Record<string, number>)?.totalCompletedAmount ?? 0;
  const pendingAmount = metrics?.pendingMilestoneAmount ?? 0;
  const disputedAmount = metrics?.disputedMilestoneAmount ?? 0;
  const totalAgreedVolume = activeEscrowAmount + completedAmount + pendingAmount;

  // Filter recent contracts based on quick toggle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentContractsList: any[] = (metrics as any)?.recentContracts || [];

  const filteredContracts = recentContractsList.filter((c: any) => {
    if (activeContractFilter === 'ACTIVE') return c.status === 'ACTIVE';
    if (activeContractFilter === 'PENDING') return c.status === 'PENDING_ACCEPTANCE';
    return true;
  });

  // Simulated 7-day trend chart points based on escrow amounts
  const trendPoints = [
    { day: 'Mon', val: Math.round(activeEscrowAmount * 0.28) },
    { day: 'Tue', val: Math.round(activeEscrowAmount * 0.35) },
    { day: 'Wed', val: Math.round(activeEscrowAmount * 0.31) },
    { day: 'Thu', val: Math.round(activeEscrowAmount * 0.52) },
    { day: 'Fri', val: Math.round(activeEscrowAmount * 0.40) },
    { day: 'Sat', val: Math.round(activeEscrowAmount * 0.88) },
    { day: 'Sun', val: Math.round(activeEscrowAmount * 1.0) },
  ];
  const maxTrend = Math.max(...trendPoints.map((p) => p.val), 100);

  // SVG Area Line Calculation
  const width = 500;
  const height = 150;
  const padding = 20;
  const points = trendPoints.map((p, idx) => {
    const x = padding + (idx / (trendPoints.length - 1)) * (width - 2 * padding);
    const y = height - padding - (p.val / maxTrend) * (height - 2 * padding);
    return { x, y, day: p.day, val: p.val };
  });

  const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="space-y-6">
      {/* Bento Section 1: Executive Command Bar */}
      <div
        className="card-drop-in p-6 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 transition-colors"
        style={{ animationDelay: '40ms' }}
      >
        <div className="space-y-1.5">
          <div className="inline-flex items-center space-x-2">
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full dark:bg-[#202220] bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] border dark:border-[rgba(139,255,36,0.25)] border-[#C7D2FE] font-mono">
              {isClient ? 'CLIENT COMMAND HUB' : isWorker ? 'SPECIALIST WORKSPACE' : 'OPERATIONS HUB'}
            </span>
            <span className="inline-flex items-center space-x-1 text-[11px] dark:text-[#8BFF24] text-[#5046E5] font-mono font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>LEDGER SYNCHRONIZED</span>
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight dark:text-[#E8EAE6] text-[#111827]">
            {isClient
              ? 'Digital Contracts & Escrow Portfolio'
              : isWorker
                ? 'Specialist Milestone Workspace'
                : 'Platform Operations Oversight'}
          </h2>
          <p className="text-xs dark:text-[#A5AAA2] text-[#64748B]">
            Real-time digital agreement lifecycle, milestone deliverable reviews, and non-custodial financial custody.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          {isClient && (
            <>
              <button
                onClick={() => onNavigate('marketplace')}
                className="px-4 py-2 rounded-xl dark:bg-[#8BFF24] dark:hover:bg-[#A3FF50] dark:text-[#050605] bg-[#5046E5] hover:bg-[#4338CA] text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-[#5046E5]/25 transition active:scale-[0.99] cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Find Specialists</span>
              </button>
              <button
                onClick={() => onNavigate('hiring')}
                className="px-3.5 py-2 rounded-xl dark:bg-[#202220] bg-white hover:dark:bg-[#292C28] hover:bg-[#EEF2FF] text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] border dark:border-[rgba(255,255,255,0.10)] border-[#CBD5E1] hover:border-[#5046E5] flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4 dark:text-[#8BFF24] text-[#5046E5]" />
                <span>Proposals</span>
              </button>
            </>
          )}

          <button
            onClick={() => onNavigate('wallet')}
            className="px-3.5 py-2 rounded-xl dark:bg-[#202220] bg-white hover:dark:bg-[#292C28] hover:bg-[#EEF2FF] text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] border dark:border-[rgba(255,255,255,0.10)] border-[#CBD5E1] hover:border-[#5046E5] flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
          >
            <Wallet className="w-4 h-4 dark:text-[#8BFF24] text-[#5046E5]" />
            <span>Virtual Vault</span>
          </button>
        </div>
      </div>

      {/* Bento Section 2: 6 Financial & Escrow Metric Cards (Matching Reference) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Escrow in Custody */}
        <div
          className="interactive-card card-drop-in p-5 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-3 shadow-sm hover:dark:border-[rgba(139,255,36,0.3)] hover:border-[#5046E5]/40 transition group"
          style={{ animationDelay: '100ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold dark:text-[#A5AAA2] text-[#64748B]">
              Escrow in Custody - USD
            </span>
            <div className="w-8 h-8 rounded-lg dark:bg-[#202220] bg-[#EEF2FF] border dark:border-[rgba(139,255,36,0.25)] border-[#C7D2FE] flex items-center justify-center dark:text-[#8BFF24] text-[#5046E5]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-extrabold dark:text-[#8BFF24] text-[#111827] font-mono tabular-nums tracking-tight">
              <AnimatedAmount value={activeEscrowAmount} />
            </span>
            <span className="text-xs dark:text-[#A5AAA2] text-[#64748B] font-mono">USD</span>
          </div>

          {/* Smooth Wave Line Visual with Base Growth Animation */}
          <div className="h-6 w-full flex items-center overflow-hidden">
            <svg viewBox="0 0 200 40" className="w-full h-full chart-grow-base" preserveAspectRatio="none">
              <path
                d="M 0 30 Q 50 10 100 25 T 200 15"
                fill="none"
                className="dark:stroke-[#8BFF24] stroke-[#6366F1]"
                strokeWidth="2"
              />
              <path
                d="M 0 30 Q 50 10 100 25 T 200 15 L 200 40 L 0 40 Z"
                className="dark:fill-[#8BFF24]/10 fill-[#6366F1]/15"
              />
            </svg>
          </div>

          <div className="pt-2 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] flex items-center justify-between text-xs">
            <button
              onClick={() => onNavigate('contracts')}
              className="dark:text-[#8BFF24] text-[#5046E5] underline hover:no-underline font-semibold font-mono inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>Open Module</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] dark:text-[#8BFF24] text-[#5046E5] font-mono">100% Secure</span>
          </div>
        </div>

        {/* Card 2: Settled Deliverables */}
        <div
          className="interactive-card card-drop-in p-5 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-3 shadow-sm hover:dark:border-[rgba(139,255,36,0.3)] hover:border-[#5046E5]/40 transition group"
          style={{ animationDelay: '160ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold dark:text-[#A5AAA2] text-[#64748B]">
              Settled Deliverables - USD
            </span>
            <div className="w-8 h-8 rounded-lg dark:bg-[#202220] bg-[#EEF2FF] border dark:border-[rgba(139,255,36,0.25)] border-[#C7D2FE] flex items-center justify-center dark:text-[#8BFF24] text-[#5046E5]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-extrabold dark:text-[#8BFF24] text-[#111827] font-mono tabular-nums tracking-tight">
              <AnimatedAmount value={completedAmount} />
            </span>
            <span className="text-xs dark:text-[#A5AAA2] text-[#64748B] font-mono">USD</span>
          </div>

          {/* Stepped Mini Vertical Bars Visual with Growing Animation */}
          <div className="h-6 w-full flex items-end justify-end gap-1.5 px-1">
            {[20, 35, 55, 75, 100].map((h, i) => (
              <div
                key={i}
                className="w-2.5 rounded-t dark:bg-[#8BFF24] bg-[#5046E5] bar-grow"
                style={{ height: `${h}%`, opacity: 0.3 + (i * 0.175), animationDelay: `${200 + i * 70}ms` }}
              />
            ))}
          </div>

          <div className="pt-2 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] flex items-center justify-between text-xs">
            <button
              onClick={() => onNavigate('contracts')}
              className="dark:text-[#8BFF24] text-[#5046E5] underline hover:no-underline font-semibold font-mono inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>Open Module</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] dark:text-[#8BFF24] text-[#5046E5] font-mono">Verified Payouts</span>
          </div>
        </div>

        {/* Card 3: Pending Deliverables */}
        <div
          className="interactive-card card-drop-in p-5 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-3 shadow-sm hover:dark:border-[rgba(139,255,36,0.3)] hover:border-[#5046E5]/40 transition group"
          style={{ animationDelay: '220ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold dark:text-[#A5AAA2] text-[#64748B]">
              Pending Deliverables - USD
            </span>
            <div className="w-8 h-8 rounded-lg dark:bg-[#202220] bg-[#EEF2FF] border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-extrabold text-amber-500 font-mono tabular-nums tracking-tight">
              <AnimatedAmount value={pendingAmount} />
            </span>
            <span className="text-xs dark:text-[#A5AAA2] text-[#64748B] font-mono">USD</span>
          </div>

          {/* Stepped Mini Vertical Bars Visual with Growing Animation */}
          <div className="h-6 w-full flex items-end justify-end gap-1.5 px-1">
            {[30, 45, 60, 40, 80].map((h, i) => (
              <div
                key={i}
                className="w-2.5 rounded-t dark:bg-[#8BFF24] bg-[#5046E5] bar-grow"
                style={{ height: `${h}%`, opacity: 0.25 + (i * 0.15), animationDelay: `${250 + i * 70}ms` }}
              />
            ))}
          </div>

          <div className="pt-2 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] flex items-center justify-between text-xs">
            <button
              onClick={() => onNavigate('projects')}
              className="text-amber-500 underline hover:no-underline font-semibold font-mono inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>Open Module</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-amber-500 font-mono">In Review</span>
          </div>
        </div>

        {/* Card 4: Total Escrow Agreements */}
        <div
          className="interactive-card card-drop-in p-5 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-3 shadow-sm hover:dark:border-[rgba(139,255,36,0.3)] hover:border-[#5046E5]/40 transition group"
          style={{ animationDelay: '280ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold dark:text-[#A5AAA2] text-[#64748B]">
              Total Escrow Agreements
            </span>
            <div className="w-8 h-8 rounded-lg dark:bg-[#202220] bg-[#EEF2FF] border dark:border-[rgba(139,255,36,0.25)] border-[#C7D2FE] flex items-center justify-center dark:text-[#8BFF24] text-[#5046E5]">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold dark:text-[#E8EAE6] text-[#111827] font-mono tabular-nums tracking-tight">
              <AnimatedInteger value={metrics?.activeContracts ?? 0} />
            </span>
            <span className="text-xs font-medium dark:text-[#8BFF24] text-[#5046E5] font-mono">
              / {metrics?.totalContracts ?? 1} Completed
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#E2E8F0] dark:bg-[#202220] h-2 rounded-full overflow-hidden my-2">
            <div
              className="dark:bg-[#8BFF24] bg-[#5046E5] h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(100, Math.max(15, ((metrics?.activeContracts ?? 0) / (metrics?.totalContracts || 1)) * 100))}%`
              }}
            />
          </div>

          <div className="pt-2 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] flex items-center justify-between text-xs">
            <button
              onClick={() => onNavigate('contracts')}
              className="dark:text-[#8BFF24] text-[#5046E5] underline hover:no-underline font-semibold font-mono inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>Open Module</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] dark:text-[#A5AAA2] text-[#64748B] font-mono">Bilateral Bound</span>
          </div>
        </div>

        {/* Card 5: Virtual Vault Balance */}
        <div
          className="interactive-card card-drop-in p-5 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-3 shadow-sm hover:dark:border-[rgba(139,255,36,0.3)] hover:border-[#5046E5]/40 transition group"
          style={{ animationDelay: '340ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold dark:text-[#A5AAA2] text-[#64748B]">
              Virtual Vault Balance
            </span>
            <div className="w-8 h-8 rounded-lg dark:bg-[#202220] bg-[#EEF2FF] border dark:border-[rgba(139,255,36,0.25)] border-[#C7D2FE] flex items-center justify-center dark:text-[#8BFF24] text-[#5046E5]">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-extrabold dark:text-[#E8EAE6] text-[#111827] font-mono tabular-nums tracking-tight">
              <AnimatedAmount value={activeEscrowAmount + completedAmount} />
            </span>
            <span className="text-xs dark:text-[#A5AAA2] text-[#64748B] font-mono">USD</span>
          </div>

          {/* Smooth Wave Line Visual with Base Growth Animation */}
          <div className="h-6 w-full flex items-center overflow-hidden">
            <svg viewBox="0 0 200 40" className="w-full h-full chart-grow-base" preserveAspectRatio="none">
              <path
                d="M 0 25 Q 50 35 100 15 T 200 20"
                fill="none"
                className="dark:stroke-[#8BFF24] stroke-[#6366F1]"
                strokeWidth="2"
              />
              <path
                d="M 0 25 Q 50 35 100 15 T 200 20 L 200 40 L 0 40 Z"
                className="dark:fill-[#8BFF24]/10 fill-[#6366F1]/15"
              />
            </svg>
          </div>

          <div className="pt-2 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] flex items-center justify-between text-xs">
            <button
              onClick={() => onNavigate('wallet')}
              className="dark:text-[#8BFF24] text-[#5046E5] underline hover:no-underline font-semibold font-mono inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>Open Module</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] dark:text-[#8BFF24] text-[#5046E5] font-mono">Instant Rails</span>
          </div>
        </div>

        {/* Card 6: Protected Custody Holds */}
        <div
          className="interactive-card card-drop-in p-5 rounded-2xl dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] space-y-3 shadow-sm hover:dark:border-[rgba(139,255,36,0.3)] hover:border-[#5046E5]/40 transition group"
          style={{ animationDelay: '400ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold dark:text-[#A5AAA2] text-[#64748B]">
              Protected Custody Holds
            </span>
            <div className="w-8 h-8 rounded-lg dark:bg-[#202220] bg-[#EEF2FF] border border-rose-500/20 flex items-center justify-center text-rose-500">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-extrabold text-rose-500 font-mono tabular-nums tracking-tight">
              <AnimatedAmount value={disputedAmount} />
            </span>
            <span className="text-xs dark:text-[#A5AAA2] text-[#64748B] font-mono">USD</span>
          </div>

          {/* Stepped Mini Vertical Bars Visual with Growing Animation */}
          <div className="h-6 w-full flex items-end justify-end gap-1.5 px-1">
            {[40, 20, 60, 30, 70].map((h, i) => (
              <div
                key={i}
                className="w-2.5 rounded-t dark:bg-[#8BFF24] bg-[#5046E5] bar-grow"
                style={{ height: `${h}%`, opacity: 0.25 + (i * 0.15), animationDelay: `${300 + i * 70}ms` }}
              />
            ))}
          </div>

          <div className="pt-2 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] flex items-center justify-between text-xs">
            <button
              onClick={() => onNavigate('contracts')}
              className="text-rose-500 underline hover:no-underline font-semibold font-mono inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>Open Module</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] dark:text-[#A5AAA2] text-[#64748B] font-mono">Zero Disputed Losses</span>
          </div>
        </div>
      </div>

      {/* Bento Section 3: Visual Analytics (Escrow Overview 7D Trend + Wallet Activity matching Image 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (Span 7): Escrow Overview with 7 Day Trend Chart */}
        <div
          className="interactive-card card-drop-in lg:col-span-7 dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] rounded-2xl p-6 space-y-4 shadow-sm transition-colors"
          style={{ animationDelay: '460ms' }}
        >
          <div className="flex items-center justify-between border-b dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] pb-3">
            <div>
              <h3 className="text-sm font-bold dark:text-[#E8EAE6] text-[#111827]">Escrow Overview</h3>
              <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] mt-0.5">
                Total 7D Escrows: <strong className="dark:text-[#8BFF24] text-[#5046E5] font-mono"><AnimatedAmount value={activeEscrowAmount || 26} decimals={0} /></strong>
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold font-mono dark:bg-[#202220] bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] border dark:border-[rgba(139,255,36,0.3)] border-[#C7D2FE]">
              7 DAY TREND
            </span>
          </div>

          {/* SVG Trend Line / Spline Chart with Smooth Base Growth Animation */}
          <div className="relative w-full h-[180px] flex items-center justify-center">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="escrowTrendGradLight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="escrowTrendGradDark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8BFF24" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#8BFF24" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Horizontal Guidelines */}
              <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="currentColor" strokeOpacity="0.07" strokeDasharray="3 3" />
              <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="currentColor" strokeOpacity="0.07" strokeDasharray="3 3" />
              <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" strokeOpacity="0.15" />

              {/* Chart Content Growing from Base */}
              <g className="chart-grow-base">
                {/* Filled Area */}
                <path d={areaD} className="dark:fill-[url(#escrowTrendGradDark)] fill-[url(#escrowTrendGradLight)]" />

                {/* Foreground Spline Line */}
                <path d={pathD} fill="none" className="dark:stroke-[#8BFF24] stroke-[#6366F1]" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Interactive Data Points */}
                {points.map((pt, i) => (
                  <g key={i}>
                    <circle cx={pt.x} cy={pt.y} r="4" className="dark:fill-[#8BFF24] fill-[#5046E5] dark:drop-shadow-[0_0_8px_rgba(139,255,36,0.8)] drop-shadow-[0_0_6px_rgba(79,70,229,0.5)]" />
                    <text
                      x={pt.x}
                      y={height - 2}
                      textAnchor="middle"
                      className="text-[10px] font-mono fill-[#A5AAA2]"
                    >
                      {pt.day}
                    </text>
                  </g>
                ))}
              </g>
            </svg>
          </div>
        </div>

        {/* Right (Span 5): Wallet Activity Card */}
        <div
          className="interactive-card card-drop-in lg:col-span-5 dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] rounded-2xl p-6 space-y-4 shadow-sm transition-colors flex flex-col justify-between"
          style={{ animationDelay: '520ms' }}
        >
          <div>
            <div className="flex items-center justify-between border-b dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] pb-3">
              <h3 className="text-sm font-bold dark:text-[#E8EAE6] text-[#111827]">Wallet Activity</h3>
              <span className="text-[11px] font-mono dark:text-[#8BFF24] text-[#5046E5] font-bold">REAL-TIME FLOW</span>
            </div>

            <div className="pt-4 space-y-3">
              <div>
                <span className="text-xs dark:text-[#A5AAA2] text-[#64748B]">Net 7D Wallet Flow:</span>
                <div className="flex items-baseline space-x-1 mt-0.5">
                  <span className="text-2xl font-extrabold dark:text-[#8BFF24] text-[#5046E5] font-mono">
                    <AnimatedAmount value={completedAmount || 12500} prefix="+$" />
                  </span>
                  <span className="text-xs dark:text-[#A5AAA2] text-[#64748B] font-mono">USD</span>
                </div>
              </div>

              {/* Mini Activity Bars with Base Growing Animation */}
              <div className="pt-2 flex items-end justify-between h-20 gap-2">
                {[45, 60, 30, 80, 50, 95, 75].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div
                      style={{ height: `${val}%`, animationDelay: `${350 + idx * 70}ms` }}
                      className="w-full rounded-t-md dark:bg-[#8BFF24]/80 dark:hover:bg-[#8BFF24] bg-[#818CF8]/80 hover:bg-[#5046E5] bar-grow transition-all"
                    />
                    <span className="text-[9px] font-mono dark:text-[#A5AAA2] text-[#64748B]">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] flex items-center justify-between text-xs">
            <button
              onClick={() => onNavigate('wallet')}
              className="dark:text-[#8BFF24] text-[#5046E5] hover:underline font-semibold font-mono inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>Go to Virtual Vault</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('contracts')}
              className="dark:text-[#A5AAA2] text-[#64748B] hover:text-[#5046E5] font-medium font-mono inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>Agreements</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bento Section 4: Operational Contracts Board & Real-Time Telemetry Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (Span 7): Contracts Operations Board */}
        <div className="lg:col-span-7 dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] rounded-2xl p-6 space-y-4 shadow-sm transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] pb-3">
            <div className="flex items-center space-x-2">
              <Briefcase className="w-4 h-4 dark:text-[#8BFF24] text-[#5046E5]" />
              <h3 className="text-sm font-bold dark:text-[#E8EAE6] text-[#111827]">Agreement Operations Board</h3>
            </div>

            <div className="flex items-center space-x-1 p-0.5 rounded-lg dark:bg-[#202220] bg-[#F1F5F9] text-xs">
              {(['ALL', 'ACTIVE', 'PENDING'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveContractFilter(filter)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    activeContractFilter === filter
                      ? 'dark:bg-[#8BFF24] dark:text-[#050605] bg-[#5046E5] text-white font-bold shadow-md shadow-[#5046E5]/25'
                      : 'dark:text-[#A5AAA2] text-[#64748B] hover:dark:text-[#E8EAE6] hover:text-[#111827]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredContracts.length === 0 ? (
            <div className="py-12 text-center dark:text-[#A5AAA2] text-[#64748B] text-xs">
              No agreements matching filter criteria. Create a proposal to initiate milestone escrow.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredContracts.slice(0, 5).map((contract) => (
                <div
                  key={contract.id}
                  onClick={() => onNavigate('contracts')}
                  className="p-3.5 rounded-xl dark:bg-[#202220] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] hover:dark:border-[rgba(139,255,36,0.3)] hover:border-[#5046E5]/40 transition flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-semibold dark:text-[#8BFF24] text-[#5046E5]">{contract.contractNumber}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold font-mono ${
                          contract.status === 'ACTIVE'
                            ? 'dark:bg-[#8BFF24]/10 dark:text-[#8BFF24] bg-[#EEF2FF] text-[#5046E5] border dark:border-[rgba(139,255,36,0.25)] border-[#C7D2FE]'
                            : contract.status === 'COMPLETED'
                              ? 'dark:bg-[#E8EAE6]/10 bg-slate-200 dark:text-[#E8EAE6] text-slate-800 border dark:border-[rgba(255,255,255,0.15)] border-slate-300'
                              : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}
                      >
                        {contract.status}
                      </span>
                    </div>
                    <h5 className="text-xs font-bold dark:text-[#E8EAE6] text-[#111827] group-hover:dark:text-[#8BFF24] group-hover:text-[#5046E5] transition line-clamp-1">
                      {contract.title}
                    </h5>
                    <p className="text-[11px] dark:text-[#A5AAA2] text-[#64748B]">
                      {isClient ? `Specialist: ${contract.worker?.firstName || 'Assigned Specialist'}` : `Client: ${contract.client?.firstName || 'Client'}`}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold dark:text-[#8BFF24] text-[#111827] font-mono tabular-nums block">
                      ${Number(contract.totalAmount).toLocaleString()}
                    </span>
                    <span className="text-[10px] dark:text-[#A5AAA2] text-[#64748B] font-mono">{contract.currency}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right (Span 5): Real-Time Telemetry Event Stream */}
        <div className="lg:col-span-5 dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] rounded-2xl p-6 space-y-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between border-b dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] pb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 dark:text-[#8BFF24] text-[#5046E5]" />
              <h3 className="text-sm font-bold dark:text-[#E8EAE6] text-[#111827]">Audit Telemetry Feed</h3>
            </div>
            <span className="text-[10px] dark:text-[#8BFF24] text-[#5046E5] font-mono font-bold">SUPABASE REALTIME</span>
          </div>

          {metrics?.recentActivities && metrics.recentActivities.length > 0 ? (
            <div className="space-y-2.5">
              {metrics.recentActivities.slice(0, 6).map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded-xl dark:bg-[#202220] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold dark:text-[#E8EAE6] text-[#111827]">{act.title}</span>
                    <p className="dark:text-[#A5AAA2] text-[#64748B] text-[11px] leading-relaxed">{act.description}</p>
                  </div>
                  <span className="text-[10px] dark:text-[#A5AAA2] text-[#64748B] font-mono shrink-0">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] italic py-8 text-center">
              No recent activity recorded yet. Create a proposal or start work on an active contract to stream events.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
