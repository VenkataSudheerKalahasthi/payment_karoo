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
    <div className="space-y-6 font-sans">
      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="dark:text-[#777777] text-[#64748B] hover:dark:text-white hover:text-black">
            &times;
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="dark:text-[#777777] text-[#64748B] hover:dark:text-white hover:text-black">
            &times;
          </button>
        </div>
      )}

      {/* Metrics Bento Row */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-4 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] shadow-sm space-y-1">
            <span className="text-[10px] dark:text-[#A5A5A5] text-[#64748B] uppercase font-semibold">Total</span>
            <div className="text-xl font-bold font-mono dark:text-[#CDCBCA] text-[#242424]">{metrics.totalDisputes}</div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 shadow-sm space-y-1">
            <span className="text-[10px] text-amber-500 uppercase font-semibold">Open</span>
            <div className="text-xl font-bold font-mono text-amber-500">{metrics.openDisputes}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#2563EB]/5 border border-[#2563EB]/20 shadow-sm space-y-1">
            <span className="text-[10px] text-[#2563EB] uppercase font-semibold">Under Review</span>
            <div className="text-xl font-bold font-mono text-[#2563EB]">{metrics.underReviewDisputes}</div>
          </div>
          <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 shadow-sm space-y-1">
            <span className="text-[10px] text-rose-500 uppercase font-semibold">Escalated</span>
            <div className="text-xl font-bold font-mono text-rose-500">{metrics.escalatedDisputes}</div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-sm space-y-1">
            <span className="text-[10px] text-emerald-500 uppercase font-semibold">Resolved</span>
            <div className="text-xl font-bold font-mono text-emerald-500">{metrics.resolvedDisputes}</div>
          </div>
          <div className="p-4 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] shadow-sm space-y-1">
            <span className="text-[10px] dark:text-[#A5A5A5] text-[#64748B] uppercase font-semibold">Res. Rate</span>
            <div className="text-xl font-bold font-mono dark:text-[#CDCBCA] text-[#242424]">{metrics.resolutionRatePercentage}%</div>
          </div>
          <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 shadow-sm space-y-1">
            <span className="text-[10px] text-rose-500 uppercase font-semibold">Active Holds</span>
            <div className="text-xl font-bold font-mono text-rose-500">{metrics.activeDisputeHoldCount}</div>
          </div>
          <div className="p-4 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] shadow-sm space-y-1">
            <span className="text-[10px] dark:text-[#A5A5A5] text-[#64748B] uppercase font-semibold">Claimed</span>
            <div className="text-sm font-bold font-mono dark:text-[#CDCBCA] text-[#242424] truncate">
              {formatCurrencyMinor(metrics.totalClaimedMinor)}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] shadow-sm">
        <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 dark:text-[#777777] text-[#94A3B8] shrink-0" />
          <input
            type="text"
            placeholder="Search by dispute #, contract #, or participant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs dark:text-[#CDCBCA] text-[#242424] placeholder-slate-400 focus:outline-none focus:border-[#2563EB]"
          />
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-xs dark:text-[#A5A5A5] text-[#64748B]">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl px-2.5 py-1.5 text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB]"
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
            className="dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl px-2.5 py-1.5 text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB]"
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
            className="p-2 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] dark:text-[#CDCBCA] text-[#242424] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] transition shadow-sm"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#2563EB]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Disputes Table */}
      <div className="rounded-2xl border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] dark:bg-[#171717] bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] dark:bg-[#202020] bg-[#F1F5F9] dark:text-[#A5A5A5] text-[#64748B] uppercase font-semibold">
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
            <tbody className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0] dark:text-[#CDCBCA] text-[#242424]">
              {filteredDisputes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center dark:text-[#777777] text-[#64748B]">
                    No disputes match the current criteria.
                  </td>
                </tr>
              ) : (
                filteredDisputes.map((d) => (
                  <tr key={d.id} className="hover:dark:bg-[#202020]/40 hover:bg-[#F8FAFC] transition">
                    <td className="py-3 px-4 font-mono font-semibold text-[#2563EB]">{d.disputeNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium dark:text-[#CDCBCA] text-[#242424]">{d.contractNumber}</div>
                      <div className="text-[11px] dark:text-[#777777] text-[#64748B] truncate max-w-[160px]">{d.contractTitle}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-[11px]">
                        <span className="dark:text-[#777777] text-[#64748B]">By:</span> {d.initiatorName}
                      </div>
                      <div className="text-[11px]">
                        <span className="dark:text-[#777777] text-[#64748B]">Vs:</span> {d.respondentName}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] dark:bg-[#202020] bg-slate-200 dark:text-[#CDCBCA] text-[#475569] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0]">
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
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : d.status === DisputeStatus.ESCALATED
                              ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                              : d.status === DisputeStatus.RESOLVED
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/20'
                        }`}
                      >
                        {d.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {d.disputeHoldActive ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] text-rose-500 font-semibold">
                          <Lock className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-[10px] dark:text-[#777777] text-[#64748B]">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openDisputeDetail(d.id)}
                        className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] dark:text-[#CDCBCA] text-[#242424] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] text-xs font-semibold transition shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#2563EB]" />
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl dark:bg-[#171717] bg-white border-l dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0]">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold dark:text-[#CDCBCA] text-[#242424]">{selectedDispute.disputeNumber}</h3>
                  <p className="text-xs dark:text-[#A5A5A5] text-[#64748B]">Contract #{selectedDispute.contractNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                className="p-1 rounded-lg text-slate-400 hover:dark:text-white hover:text-black hover:dark:bg-[#202020] hover:bg-[#F1F5F9] transition"
              >
                &times;
              </button>
            </div>

            {/* Hold Status Badge */}
            <div className="p-3.5 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex items-center justify-between text-xs">
              <span className="dark:text-[#A5A5A5] text-[#475569]">Protective Escrow Hold:</span>
              <span
                className={`font-semibold px-2.5 py-0.5 rounded text-[11px] ${
                  selectedDispute.disputeHoldActive
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                }`}
              >
                {selectedDispute.disputeHoldActive ? 'ACTIVE (Disbursements Locked)' : 'CLEARED'}
              </span>
            </div>

            {/* Dispute Summary */}
            <div className="p-4 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold dark:text-[#CDCBCA] text-[#242424]">{selectedDispute.title}</span>
                <span className="dark:text-[#777777] text-[#64748B] font-mono text-[11px]">{new Date(selectedDispute.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-xs dark:text-[#A5A5A5] text-[#64748B] leading-relaxed">{selectedDispute.description}</p>
            </div>

            {/* Evidence Viewer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold dark:text-[#CDCBCA] text-[#242424]">
                <span className="flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Submitted Evidence ({selectedDispute.evidence.length})</span>
                </span>
              </div>
              {selectedDispute.evidence.length === 0 ? (
                <p className="text-xs dark:text-[#777777] text-[#64748B] italic">No evidence documents uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedDispute.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <div className="font-medium dark:text-[#CDCBCA] text-[#242424] truncate">{ev.fileName}</div>
                        <div className="text-[10px] dark:text-[#777777] text-[#64748B]">By {ev.uploaderName}</div>
                      </div>
                      <a
                        href={ev.downloadUrl || ev.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/20 shrink-0"
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
              <div className="flex items-center justify-between text-xs font-semibold dark:text-[#CDCBCA] text-[#242424]">
                <span className="flex items-center space-x-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Participant Statements ({selectedDispute.responses.length})</span>
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedDispute.responses.length === 0 ? (
                  <p className="text-xs dark:text-[#777777] text-[#64748B] italic">No statements submitted yet.</p>
                ) : (
                  selectedDispute.responses.map((r) => (
                    <div key={r.id} className="p-3.5 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] dark:text-[#777777] text-[#64748B]">
                        <span className="font-semibold dark:text-[#CDCBCA] text-[#242424]">
                          {r.authorName} ({r.authorRole})
                        </span>
                        <span className="font-mono">{new Date(r.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="dark:text-[#A5A5A5] text-[#64748B]">{r.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Administrative Internal Notes */}
            <div className="space-y-2 p-4 rounded-xl dark:bg-[#202020]/40 bg-[#F1F5F9] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0]">
              <div className="text-xs font-semibold dark:text-[#CDCBCA] text-[#242424] flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>Internal Staff Notes (Admin Confidential)</span>
              </div>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {selectedDispute.internalNotes?.map((n) => (
                  <div key={n.id} className="text-[11px] p-2.5 rounded-lg dark:bg-[#080808] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-y-0.5">
                    <div className="dark:text-[#777777] text-[#64748B] flex justify-between">
                      <span className="font-medium dark:text-[#CDCBCA] text-[#242424]">{n.authorName}</span>
                      <span className="font-mono">{new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="dark:text-[#A5A5A5] text-[#64748B]">{n.note}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="text"
                  placeholder="Add internal investigation note..."
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  className="flex-1 dark:bg-[#080808] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs dark:text-[#CDCBCA] text-[#242424] placeholder-slate-400 focus:outline-none focus:border-[#2563EB]"
                />
                <button
                  onClick={handleAddNote}
                  disabled={isAddingNote || !internalNote.trim()}
                  className="px-4 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white transition disabled:opacity-50 shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Binding Arbitration & Resolution Enforcement */}
            {selectedDispute.status !== DisputeStatus.RESOLVED && selectedDispute.status !== DisputeStatus.CLOSED && (
              <div className="p-4 rounded-xl dark:bg-[#202020]/60 bg-[#EFF6FF] border dark:border-[rgba(205,203,202,0.18)] border-[#DBEAFE] space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#2563EB]">
                  <Gavel className="w-4 h-4 text-[#2563EB]" />
                  <span>Administrative Arbitration &amp; Enforcement</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block dark:text-[#A5A5A5] text-[#475569] mb-1">Resolution Decision</label>
                    <select
                      value={resolutionType}
                      onChange={(e) => setResolutionType(e.target.value as DisputeResolutionType)}
                      className="w-full dark:bg-[#080808] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl px-2.5 py-1.5 dark:text-[#CDCBCA] text-[#242424] focus:outline-none"
                    >
                      <option value={DisputeResolutionType.SPLIT_SETTLEMENT}>Split Settlement</option>
                      <option value={DisputeResolutionType.FULL_REFUND_TO_CLIENT}>Full Refund to Client</option>
                      <option value={DisputeResolutionType.FULL_RELEASE_TO_WORKER}>Full Release to Worker</option>
                      <option value={DisputeResolutionType.CANCEL_CONTRACT}>Cancel Contract</option>
                      <option value={DisputeResolutionType.DISMISS_DISPUTE}>Dismiss Dispute</option>
                    </select>
                  </div>

                  <div>
                    <label className="block dark:text-[#A5A5A5] text-[#475569] mb-1">Client Share ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={clientAmount}
                      onChange={(e) => setClientAmount(e.target.value)}
                      className="w-full dark:bg-[#080808] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl px-2.5 py-1.5 dark:text-[#CDCBCA] text-[#242424] font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block dark:text-[#A5A5A5] text-[#475569] mb-1">Worker Share ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workerAmount}
                      onChange={(e) => setWorkerAmount(e.target.value)}
                      className="w-full dark:bg-[#080808] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl px-2.5 py-1.5 dark:text-[#CDCBCA] text-[#242424] font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block dark:text-[#A5A5A5] text-[#475569] text-xs mb-1">Binding Arbitration Rationale</label>
                  <textarea
                    rows={2}
                    placeholder="State binding arbitration justification and contractual findings..."
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="w-full dark:bg-[#080808] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl p-2.5 text-xs dark:text-[#CDCBCA] text-[#242424] placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleEnforceResolution}
                    disabled={isSubmittingResolution || !rationale.trim()}
                    className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white flex items-center space-x-1.5 transition disabled:opacity-50 shadow-sm"
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
