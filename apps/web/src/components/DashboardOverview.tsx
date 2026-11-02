import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { DashboardMetricsDto, UserRole } from '@trustpay/shared';
import {
  FileText,
  Clock,
  CheckCircle2,
  Briefcase,
  TrendingUp,
  Activity,
  Send,
  Users,
  Scale,
  RotateCcw,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';

interface DashboardOverviewProps {
  userRole: UserRole;
  onNavigate: (tab: 'marketplace' | 'contracts' | 'hiring' | 'shortlist' | 'profile') => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  userRole,
  onNavigate,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetricsDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isClient = userRole === UserRole.CLIENT;
  const isWorker = userRole === UserRole.WORKER;

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiService.getDashboardMetrics();
      if (res.success && res.data) {
        setMetrics(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {isClient ? 'Client Operations' : isWorker ? 'Specialist Workspace' : 'Administrative Governance'}
          </span>
          <h2 className="text-2xl font-bold text-white mt-2">
            {isClient
              ? 'Client Agreement & Hiring Hub'
              : isWorker
                ? 'Specialist Milestone Workspace'
                : 'Platform Operations Oversight'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry and agreement statuses backed by Supabase database.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isClient && (
            <>
              <button
                onClick={() => onNavigate('marketplace')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 transition"
              >
                <Users className="w-4 h-4" />
                <span>Discover Specialists</span>
              </button>
              <button
                onClick={() => onNavigate('hiring')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition"
              >
                <Send className="w-4 h-4" />
                <span>Hiring Requests</span>
              </button>
            </>
          )}

          {isWorker && (
            <>
              <button
                onClick={() => onNavigate('contracts')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 transition"
              >
                <Briefcase className="w-4 h-4" />
                <span>My Active Contracts</span>
              </button>
              <button
                onClick={() => onNavigate('hiring')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition"
              >
                <Clock className="w-4 h-4" />
                <span>Incoming Proposals</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metrics Cards Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-500 text-sm">Loading live database metrics...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Active Contracts */}
          <div
            onClick={() => onNavigate('contracts')}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-400 block">Active Agreements</span>
            <span className="text-2xl font-bold text-white block">{metrics?.activeContracts ?? 0}</span>
          </div>

          {/* Pending Hiring Proposals */}
          <div
            onClick={() => onNavigate('hiring')}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-400 block">Pending Proposals</span>
            <span className="text-2xl font-bold text-white block">{metrics?.pendingHiringRequests ?? 0}</span>
          </div>

          {/* Contracts Awaiting Acceptance */}
          <div
            onClick={() => onNavigate('contracts')}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-400 block">Awaiting Sign-off</span>
            <span className="text-2xl font-bold text-white block">{metrics?.contractsAwaitingAcceptance ?? 0}</span>
          </div>

          {/* Pending Milestones */}
          <div
            onClick={() => onNavigate('contracts')}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-400 block">
              {isClient ? 'Pending Reviews' : 'Milestones in Progress'}
            </span>
            <span className="text-2xl font-bold text-white block">{metrics?.pendingMilestones ?? 0}</span>
          </div>

          {/* Completed Contracts */}
          <div
            onClick={() => onNavigate('contracts')}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-400 block">Completed</span>
            <span className="text-2xl font-bold text-white block">{metrics?.completedContracts ?? 0}</span>
          </div>

          {/* Open Disputes Tile */}
          <div
            onClick={() => onNavigate('contracts')}
            className={`p-4 rounded-xl border cursor-pointer transition space-y-2 ${
              (metrics?.openDisputes ?? 0) > 0
                ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              (metrics?.openDisputes ?? 0) > 0
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                : 'bg-slate-800 border border-slate-700 text-slate-400'
            }`}>
              <Scale className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-400 block">Open Disputes</span>
            <span className={`text-2xl font-bold block ${
              (metrics?.openDisputes ?? 0) > 0 ? 'text-rose-400' : 'text-white'
            }`}>
              {metrics?.openDisputes ?? 0}
            </span>
          </div>

          {/* Worker Revision Requests Tile (Worker only) */}
          {isWorker && (metrics?.revisionRequests ?? 0) > 0 && (
            <div
              onClick={() => onNavigate('contracts')}
              className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 hover:border-amber-500/50 cursor-pointer transition space-y-2"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <RotateCcw className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-medium text-slate-400 block">Revisions Requested</span>
              <span className="text-2xl font-bold text-amber-300 block">{metrics?.revisionRequests ?? 0}</span>
            </div>
          )}

          {/* Total Contracts Lifetime */}
          <div
            onClick={() => onNavigate('contracts')}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium text-slate-400 block">Total Lifetime</span>
            <span className="text-2xl font-bold text-white block">{metrics?.totalContracts ?? 0}</span>
          </div>
        </div>
      )}

      {/* Contractual Financial Telemetry Grid */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-emerald-950/20 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              {isWorker ? 'Contractual Specialist Earnings Telemetry' : 'Contractual Client Volume & Escrow Overview'}
            </h3>
          </div>
          <div className="flex items-center space-x-1.5 text-[10px] text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 font-mono">
            <ShieldAlert className="w-3 h-3" />
            <span>CASHFREE PHASE 5 DEFERRED • NON-CUSTODIAL ESCROW</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              {isWorker ? 'Total Contracted Value' : 'Total Agreement Volume'}
            </span>
            <div className="text-xl font-extrabold text-white">
              ${(metrics?.totalProjectValue ?? 0).toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-500">Active &amp; completed agreements</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
              Approved Milestones
            </span>
            <div className="text-xl font-extrabold text-emerald-400">
              ${(metrics?.approvedMilestoneAmount ?? 0).toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-500">Verified deliverable sign-offs</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
              Pipeline Deliverables
            </span>
            <div className="text-xl font-extrabold text-amber-300">
              ${(metrics?.pendingMilestoneAmount ?? 0).toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-500">In progress / under review</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
              Disputed Escrow Holds
            </span>
            <div className="text-xl font-extrabold text-rose-400">
              ${(metrics?.disputedMilestoneAmount ?? 0).toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-500">Operational dispute holds</span>
          </div>
        </div>
      </div>

      {/* Recent Activity Telemetry */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Live Activity Telemetry</h3>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">SUPABASE REALTIME FEED</span>
        </div>

        {metrics?.recentActivities && metrics.recentActivities.length > 0 ? (
          <div className="space-y-3">
            {metrics.recentActivities.map((act) => (
              <div
                key={act.id}
                className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800/80 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-semibold text-white">{act.title}</span>
                  <p className="text-slate-400 text-[11px]">{act.description}</p>
                </div>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-6 text-center">
            No recent activity recorded yet. Create a proposal or start work on an active contract to stream events.
          </p>
        )}
      </div>
    </div>
  );
};
