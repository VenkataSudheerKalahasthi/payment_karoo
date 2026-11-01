import React, { useEffect, useState, useCallback } from 'react';
import {
  Scale,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  ShieldAlert,
  Gavel,
  RefreshCw,
  Eye,
  MessageSquare,
  Lock,
} from 'lucide-react';
import { apiService } from '../services/api';
import {
  DisputeDto,
  DisputeDetailDto,
  DisputeMetricsDto,
  DisputeCategory,
  DisputeStatus,
  DisputeResolutionType,
  formatCurrencyMinor,
} from '@trustpay/shared';

export const DisputesWorkspace: React.FC = () => {
  const [metrics, setMetrics] = useState<DisputeMetricsDto | null>(null);
  const [disputes, setDisputes] = useState<DisputeDto[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<DisputeDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resolution Form State
  const [resolutionType, setResolutionType] = useState<DisputeResolutionType>(DisputeResolutionType.SPLIT_SETTLEMENT);
  const [clientAmount, setClientAmount] = useState<string>('0');
  const [workerAmount, setWorkerAmount] = useState<string>('0');
  const [rationale, setRationale] = useState<string>('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  // Internal Note State
  const [internalNote, setInternalNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [metricsRes, disputesRes] = await Promise.all([
        apiService.getDisputeMetrics(),
        apiService.listDisputes({
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
        }),
      ]);

      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      }
      if (disputesRes.success && disputesRes.data) {
        setDisputes(disputesRes.data.items);
      }
    } catch {
      setErrorMessage('Failed to load dispute workspace data.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openDisputeDetail = async (id: string) => {
    try {
      const res = await apiService.getDisputeById(id);
      if (res.success && res.data) {
        setSelectedDispute(res.data);
      }
    } catch {
      setErrorMessage('Failed to retrieve dispute details.');
    }
  };

  const handleAddNote = async () => {
    if (!selectedDispute || !internalNote.trim()) return;
    setIsAddingNote(true);
    try {
      const res = await apiService.addDisputeNote(selectedDispute.id, internalNote.trim());
      if (res.success) {
        setInternalNote('');
        setActionMessage('Internal administrative note saved.');
        await openDisputeDetail(selectedDispute.id);
      }
    } catch {
      setErrorMessage('Failed to add internal note.');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleEnforceResolution = async () => {
    if (!selectedDispute || !rationale.trim()) return;
    setIsSubmittingResolution(true);
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
        setActionMessage(`Dispute ${selectedDispute.disputeNumber} resolution enforced successfully. Escrow protective hold cleared.`);
        await openDisputeDetail(selectedDispute.id);
        await loadData();
      }
    } catch {
      setErrorMessage('Failed to enforce dispute resolution.');
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  const filteredDisputes = disputes.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.disputeNumber.toLowerCase().includes(q) ||
      d.contractNumber?.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q) ||
      d.initiatorName?.toLowerCase().includes(q)
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

      {/* Metrics Row */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Disputes</span>
            <div className="text-xl font-bold text-white">{metrics.totalDisputes}</div>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
            <span className="text-[10px] text-amber-400 uppercase font-semibold">Open</span>
            <div className="text-xl font-bold text-amber-300">{metrics.openDisputes}</div>
          </div>
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-1">
            <span className="text-[10px] text-blue-400 uppercase font-semibold">Under Review</span>
            <div className="text-xl font-bold text-blue-300">{metrics.underReviewDisputes}</div>
          </div>
          <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-1">
            <span className="text-[10px] text-rose-400 uppercase font-semibold">Escalated</span>
            <div className="text-xl font-bold text-rose-300">{metrics.escalatedDisputes}</div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
            <span className="text-[10px] text-emerald-400 uppercase font-semibold">Resolved</span>
            <div className="text-xl font-bold text-emerald-300">{metrics.resolvedDisputes}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Resolution Rate</span>
            <div className="text-xl font-bold text-slate-200">{metrics.resolutionRatePercentage}%</div>
          </div>
          <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-1">
            <span className="text-[10px] text-purple-400 uppercase font-semibold">Active Holds</span>
            <div className="text-xl font-bold text-purple-300">{metrics.activeDisputeHoldCount}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Claimed</span>
            <div className="text-sm font-bold text-white truncate">
              {formatCurrencyMinor(metrics.totalClaimedMinor)}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
        <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by dispute #, contract #, or participant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="">All Statuses</option>
            {Object.values(DisputeStatus).map((st) => (
              <option key={st} value={st}>
                {st.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="">All Categories</option>
            {Object.values(DisputeCategory).map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Disputes Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase font-semibold">
                <th className="py-3 px-4">Dispute #</th>
                <th className="py-3 px-4">Contract</th>
                <th className="py-3 px-4">Initiator / Respondent</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Claimed</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Hold</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredDisputes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No disputes match the current criteria.
                  </td>
                </tr>
              ) : (
                filteredDisputes.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-blue-400">{d.disputeNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-100">{d.contractNumber}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{d.contractTitle}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-[11px]">
                        <span className="text-slate-400">By:</span> {d.initiatorName}
                      </div>
                      <div className="text-[11px]">
                        <span className="text-slate-400">Vs:</span> {d.respondentName}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        {d.category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {d.claimedAmountMinor ? formatCurrencyMinor(d.claimedAmountMinor) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          d.status === DisputeStatus.OPEN
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : d.status === DisputeStatus.ESCALATED
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                              : d.status === DisputeStatus.RESOLVED
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                        }`}
                      >
                        {d.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {d.disputeHoldActive ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] text-rose-400">
                          <Lock className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openDisputeDetail(d.id)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispute Inspector Drawer / Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedDispute.disputeNumber}</h3>
                  <p className="text-xs text-slate-400">Contract #{selectedDispute.contractNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            {/* Hold Status Badge */}
            <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-300">Protective Escrow Hold:</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                  selectedDispute.disputeHoldActive
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {selectedDispute.disputeHoldActive ? 'ACTIVE (Disbursements Locked)' : 'CLEARED'}
              </span>
            </div>

            {/* Dispute Summary */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">{selectedDispute.title}</span>
                <span className="text-slate-400">{new Date(selectedDispute.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{selectedDispute.description}</p>
            </div>

            {/* Evidence Viewer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>Submitted Evidence ({selectedDispute.evidence.length})</span>
                </span>
              </div>
              {selectedDispute.evidence.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No evidence documents uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedDispute.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <div className="font-medium text-slate-200 truncate">{ev.fileName}</div>
                        <div className="text-[10px] text-slate-400">By {ev.uploaderName}</div>
                      </div>
                      <a
                        href={ev.downloadUrl || ev.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 shrink-0"
                        title="Download Document"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Statements & Responses Thread */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center space-x-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                  <span>Participant Statements ({selectedDispute.responses.length})</span>
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedDispute.responses.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No statements submitted yet.</p>
                ) : (
                  selectedDispute.responses.map((r) => (
                    <div key={r.id} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/60 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-200">
                          {r.authorName} ({r.authorRole})
                        </span>
                        <span>{new Date(r.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-300">{r.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Administrative Internal Notes */}
            <div className="space-y-2 p-4 rounded-xl bg-slate-800/30 border border-slate-700/70">
              <div className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Internal Staff Notes (Admin Confidential)</span>
              </div>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {selectedDispute.internalNotes?.map((n) => (
                  <div key={n.id} className="text-[11px] p-2 rounded bg-slate-800/60 border border-slate-700 space-y-0.5">
                    <div className="text-slate-400 flex justify-between">
                      <span className="font-medium text-slate-300">{n.authorName}</span>
                      <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-200">{n.note}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="text"
                  placeholder="Add internal investigation note..."
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500"
                />
                <button
                  onClick={handleAddNote}
                  disabled={isAddingNote || !internalNote.trim()}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-medium text-white transition disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Binding Arbitration & Resolution Enforcement */}
            {selectedDispute.status !== DisputeStatus.RESOLVED && selectedDispute.status !== DisputeStatus.CLOSED && (
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-blue-300">
                  <Gavel className="w-4 h-4 text-blue-400" />
                  <span>Administrative Arbitration &amp; Enforcement</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Resolution Decision</label>
                    <select
                      value={resolutionType}
                      onChange={(e) => setResolutionType(e.target.value as DisputeResolutionType)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
                    >
                      <option value={DisputeResolutionType.SPLIT_SETTLEMENT}>Split Settlement</option>
                      <option value={DisputeResolutionType.FULL_REFUND_TO_CLIENT}>Full Refund to Client</option>
                      <option value={DisputeResolutionType.FULL_RELEASE_TO_WORKER}>Full Release to Worker</option>
                      <option value={DisputeResolutionType.CANCEL_CONTRACT}>Cancel Contract</option>
                      <option value={DisputeResolutionType.DISMISS_DISPUTE}>Dismiss Dispute</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Client Share ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={clientAmount}
                      onChange={(e) => setClientAmount(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Worker Share ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workerAmount}
                      onChange={(e) => setWorkerAmount(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs mb-1">Binding Arbitration Rationale</label>
                  <textarea
                    rows={2}
                    placeholder="State binding arbitration justification and contractual findings..."
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleEnforceResolution}
                    disabled={isSubmittingResolution || !rationale.trim()}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition disabled:opacity-50"
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    <span>{isSubmittingResolution ? 'Enforcing...' : 'Enforce Binding Resolution'}</span>
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
