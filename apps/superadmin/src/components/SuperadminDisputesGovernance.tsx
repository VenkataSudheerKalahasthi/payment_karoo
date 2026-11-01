import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Gavel,
  RefreshCw,
  Lock,
  ShieldCheck,
  FileText,
  Download,
} from 'lucide-react';
import { apiService } from '../services/api';
import {
  DisputeDto,
  DisputeDetailDto,
  DisputeMetricsDto,
  DisputeResolutionType,
  DisputeStatus,
  formatCurrencyMinor,
} from '@trustpay/shared';

export const SuperadminDisputesGovernance: React.FC = () => {
  const [metrics, setMetrics] = useState<DisputeMetricsDto | null>(null);
  const [disputes, setDisputes] = useState<DisputeDto[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<DisputeDetailDto | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'escalated' | 'active_holds'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Arbitration form state
  const [resolutionType, setResolutionType] = useState<DisputeResolutionType>(DisputeResolutionType.SPLIT_SETTLEMENT);
  const [clientAmount, setClientAmount] = useState<string>('0');
  const [workerAmount, setWorkerAmount] = useState<string>('0');
  const [rationale, setRationale] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [metricsRes, disputesRes] = await Promise.all([
        apiService.getDisputeMetrics(),
        apiService.listDisputes({
          status: activeSubTab === 'escalated' ? DisputeStatus.ESCALATED : undefined,
        }),
      ]);

      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      }
      if (disputesRes.success && disputesRes.data) {
        let items = disputesRes.data.items;
        if (activeSubTab === 'active_holds') {
          items = items.filter((d) => d.disputeHoldActive);
        }
        setDisputes(items);
      }
    } catch {
      setErrorMessage('Failed to load global dispute governance records.');
    } finally {
      setIsLoading(false);
    }
  }, [activeSubTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openDispute = async (id: string) => {
    try {
      const res = await apiService.getDisputeById(id);
      if (res.success && res.data) {
        setSelectedDispute(res.data);
      }
    } catch {
      setErrorMessage('Failed to load dispute dossier.');
    }
  };

  const handleArbitrate = async () => {
    if (!selectedDispute || !rationale.trim()) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const clientMinor = Math.round(Number(clientAmount || 0) * 100);
      const workerMinor = Math.round(Number(workerAmount || 0) * 100);

      const res = await apiService.adminEnforceResolution(selectedDispute.id, {
        resolutionType,
        clientAmountMinor: clientMinor,
        workerAmountMinor: workerMinor,
        rationale: rationale.trim(),
      });

      if (res.success) {
        setActionMessage(
          `Superadmin decision enforced on ${selectedDispute.disputeNumber}. Escrow protective hold cleared and contract status restored.`,
        );
        await openDispute(selectedDispute.id);
        await loadData();
      }
    } catch {
      setErrorMessage('Superadmin arbitration action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = disputes.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.disputeNumber.toLowerCase().includes(q) ||
      d.contractNumber?.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q) ||
      d.initiatorName?.toLowerCase().includes(q) ||
      d.respondentName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-500 hover:text-emerald-300">
            &times;
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-300">
            &times;
          </button>
        </div>
      )}

      {/* Global Governance Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Platform Disputes</span>
            <div className="text-2xl font-bold text-white">{metrics.totalDisputes}</div>
          </div>
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1">
            <span className="text-[10px] text-rose-400 uppercase font-semibold">Escalated (Action Req)</span>
            <div className="text-2xl font-bold text-rose-300">{metrics.escalatedDisputes}</div>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
            <span className="text-[10px] text-amber-400 uppercase font-semibold">Active Escrow Holds</span>
            <div className="text-2xl font-bold text-amber-300">{metrics.activeDisputeHoldCount}</div>
          </div>
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-1">
            <span className="text-[10px] text-blue-400 uppercase font-semibold">In Mediation / Review</span>
            <div className="text-2xl font-bold text-blue-300">{metrics.underReviewDisputes}</div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
            <span className="text-[10px] text-emerald-400 uppercase font-semibold">Resolved</span>
            <div className="text-2xl font-bold text-emerald-300">{metrics.resolvedDisputes}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Claimed Value</span>
            <div className="text-lg font-bold text-white truncate font-mono">
              {formatCurrencyMinor(metrics.totalClaimedMinor)}
            </div>
          </div>
        </div>
      )}

      {/* View Switcher & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Disputes ({metrics?.totalDisputes || 0})
          </button>
          <button
            onClick={() => setActiveSubTab('escalated')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'escalated'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Escalated to Superadmin ({metrics?.escalatedDisputes || 0})
          </button>
          <button
            onClick={() => setActiveSubTab('active_holds')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'active_holds'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Active Protective Holds ({metrics?.activeDisputeHoldCount || 0})
          </button>
        </div>

        <div className="flex items-center space-x-2 flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search dossier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500"
          />
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Disputes Dossier Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase font-semibold">
              <th className="py-3 px-4">Dispute #</th>
              <th className="py-3 px-4">Contract</th>
              <th className="py-3 px-4">Parties Involved</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Escrow Hold</th>
              <th className="py-3 px-4 text-right">Arbitration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No disputes in this governance category.
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 font-mono font-semibold text-purple-400">{d.disputeNumber}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-100">{d.contractNumber}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{d.contractTitle}</div>
                  </td>
                  <td className="py-3 px-4 text-[11px]">
                    <div>
                      <span className="text-slate-400">Initiator:</span> {d.initiatorName}
                    </div>
                    <div>
                      <span className="text-slate-400">Respondent:</span> {d.respondentName}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                      {d.category.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        d.status === DisputeStatus.ESCALATED
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                          : d.status === DisputeStatus.RESOLVED
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {d.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {d.disputeHoldActive ? (
                      <span className="inline-flex items-center space-x-1 text-rose-400 font-semibold text-[11px]">
                        <Lock className="w-3 h-3" />
                        <span>LOCKED</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">CLEARED</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openDispute(d.id)}
                      className="px-2.5 py-1 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium inline-flex items-center space-x-1"
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      <span>Arbitrate</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Superadmin Arbitration Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedDispute.disputeNumber}</h3>
                  <p className="text-xs text-slate-400">Superadmin Governance Dossier</p>
                </div>
              </div>
              <button onClick={() => setSelectedDispute(null)} className="p-1 text-slate-400 hover:text-white">
                &times;
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 space-y-2 text-xs">
              <div className="font-bold text-slate-200">{selectedDispute.title}</div>
              <p className="text-slate-300 leading-relaxed">{selectedDispute.description}</p>
            </div>

            {/* Evidence Inspector */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Evidence Records ({selectedDispute.evidence.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {selectedDispute.evidence.map((ev) => (
                  <div key={ev.id} className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 flex justify-between items-center">
                    <div className="truncate pr-2">
                      <div className="font-medium text-slate-200 truncate">{ev.fileName}</div>
                      <div className="text-[10px] text-slate-400">{ev.uploaderName}</div>
                    </div>
                    <a
                      href={ev.downloadUrl || ev.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Arbitration Form */}
            {selectedDispute.status !== DisputeStatus.RESOLVED && selectedDispute.status !== DisputeStatus.CLOSED && (
              <div className="p-5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-purple-300">
                  <Gavel className="w-4 h-4 text-purple-400" />
                  <span>Binding Superadmin Arbitrated Ruling</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Ruling Action</label>
                    <select
                      value={resolutionType}
                      onChange={(e) => setResolutionType(e.target.value as DisputeResolutionType)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                    >
                      <option value={DisputeResolutionType.SPLIT_SETTLEMENT}>Split Settlement</option>
                      <option value={DisputeResolutionType.FULL_REFUND_TO_CLIENT}>Full Refund to Client</option>
                      <option value={DisputeResolutionType.FULL_RELEASE_TO_WORKER}>Full Release to Worker</option>
                      <option value={DisputeResolutionType.CANCEL_CONTRACT}>Cancel Contract</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Client Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={clientAmount}
                      onChange={(e) => setClientAmount(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Worker Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workerAmount}
                      onChange={(e) => setWorkerAmount(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs mb-1">Superadmin Decision Rationale</label>
                  <textarea
                    rows={2}
                    placeholder="Enter authoritative administrative rationale for platform dispute resolution..."
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleArbitrate}
                    disabled={isSubmitting || !rationale.trim()}
                    className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Enforcing...' : 'Enforce Administrative Decision'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
