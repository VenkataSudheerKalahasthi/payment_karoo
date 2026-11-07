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
    <div className="space-y-6 font-sans">
      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black">
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
          <button onClick={() => setErrorMessage(null)} className="dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black">
            &times;
          </button>
        </div>
      )}

      {/* Global Governance Metrics Bento */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
          <div className="p-4 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-1">
            <span className="text-[10px] dark:text-[#9AA4B8] text-[#64748B] uppercase font-semibold">Total Disputes</span>
            <div className="text-2xl font-bold font-mono dark:text-[#E8ECF5] text-[#242424]">{metrics.totalDisputes}</div>
          </div>
          <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 shadow-sm space-y-1">
            <span className="text-[10px] text-rose-500 uppercase font-semibold">Escalated</span>
            <div className="text-2xl font-bold font-mono text-rose-500">{metrics.escalatedDisputes}</div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 shadow-sm space-y-1">
            <span className="text-[10px] text-amber-500 uppercase font-semibold">Active Holds</span>
            <div className="text-2xl font-bold font-mono text-amber-500">{metrics.activeDisputeHoldCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#2563EB]/5 border border-[#2563EB]/20 shadow-sm space-y-1">
            <span className="text-[10px] text-[#2563EB] uppercase font-semibold">Under Review</span>
            <div className="text-2xl font-bold font-mono text-[#2563EB]">{metrics.underReviewDisputes}</div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-sm space-y-1">
            <span className="text-[10px] text-emerald-500 uppercase font-semibold">Resolved</span>
            <div className="text-2xl font-bold font-mono text-emerald-500">{metrics.resolvedDisputes}</div>
          </div>
          <div className="p-4 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm space-y-1">
            <span className="text-[10px] dark:text-[#9AA4B8] text-[#64748B] uppercase font-semibold">Total Claimed</span>
            <div className="text-lg font-bold dark:text-[#E8ECF5] text-[#242424] truncate font-mono">
              {formatCurrencyMinor(metrics.totalClaimedMinor)}
            </div>
          </div>
        </div>
      )}

      {/* View Switcher & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] shadow-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeSubTab === 'all'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
            }`}
          >
            All Disputes ({metrics?.totalDisputes || 0})
          </button>
          <button
            onClick={() => setActiveSubTab('escalated')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeSubTab === 'escalated'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
            }`}
          >
            Escalated to Superadmin ({metrics?.escalatedDisputes || 0})
          </button>
          <button
            onClick={() => setActiveSubTab('active_holds')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeSubTab === 'active_holds'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black border dark:border-[#272B38] border-[#E2E8F0]'
            }`}
          >
            Active Protective Holds ({metrics?.activeDisputeHoldCount || 0})
          </button>
        </div>

        <div className="flex items-center space-x-2 flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 dark:text-[#9AA4B8] text-[#94A3B8] shrink-0" />
          <input
            type="text"
            placeholder="Search dossier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full dark:bg-[#0B0D14] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl px-2.5 py-1.5 text-xs dark:text-[#E8ECF5] text-[#242424] placeholder-slate-400 focus:outline-none focus:border-[#2563EB]"
          />
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] dark:text-[#E8ECF5] text-[#242424] border dark:border-[#272B38] border-[#E2E8F0] shadow-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#2563EB]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Disputes Dossier Table */}
      <div className="rounded-2xl border dark:border-[#272B38] border-[#E2E8F0] dark:bg-[#191B25] bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b dark:border-[#272B38] border-[#E2E8F0] dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#9AA4B8] text-[#64748B] uppercase font-semibold">
              <th className="py-3 px-4">Dispute #</th>
              <th className="py-3 px-4">Contract</th>
              <th className="py-3 px-4">Parties Involved</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Escrow Hold</th>
              <th className="py-3 px-4 text-right">Arbitration</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0] dark:text-[#E8ECF5] text-[#242424]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center dark:text-[#9AA4B8] text-[#64748B]">
                  No disputes in this governance category.
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.id} className="hover:dark:bg-[#191D2A]/40 hover:bg-[#F8FAFC] transition">
                  <td className="py-3 px-4 font-mono font-semibold text-[#2563EB]">{d.disputeNumber}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium dark:text-[#E8ECF5] text-[#242424]">{d.contractNumber}</div>
                    <div className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] truncate max-w-[140px]">{d.contractTitle}</div>
                  </td>
                  <td className="py-3 px-4 text-[11px]">
                    <div>
                      <span className="dark:text-[#9AA4B8] text-[#64748B]">Initiator:</span> {d.initiatorName}
                    </div>
                    <div>
                      <span className="dark:text-[#9AA4B8] text-[#64748B]">Respondent:</span> {d.respondentName}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] dark:bg-[#191D2A] bg-slate-200 dark:text-[#E8ECF5] text-[#475569]">
                      {d.category.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        d.status === DisputeStatus.ESCALATED
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse'
                          : d.status === DisputeStatus.RESOLVED
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20'
                      }`}
                    >
                      {d.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {d.disputeHoldActive ? (
                      <span className="inline-flex items-center space-x-1 text-rose-500 font-semibold text-[11px]">
                        <Lock className="w-3 h-3" />
                        <span>LOCKED</span>
                      </span>
                    ) : (
                      <span className="text-[11px] dark:text-[#9AA4B8] text-[#64748B]">CLEARED</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openDispute(d.id)}
                      className="px-3 py-1 rounded-lg bg-[#2563EB]/10 hover:bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/20 text-xs font-semibold inline-flex items-center space-x-1 transition shadow-sm"
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl dark:bg-[#191B25] bg-white border-l dark:border-[#272B38] border-[#E2E8F0] h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b dark:border-[#272B38] border-[#E2E8F0]">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold dark:text-[#E8ECF5] text-[#242424]">{selectedDispute.disputeNumber}</h3>
                  <p className="text-xs dark:text-[#9AA4B8] text-[#64748B]">Superadmin Governance Dossier</p>
                </div>
              </div>
              <button onClick={() => setSelectedDispute(null)} className="p-1 rounded-lg text-slate-400 hover:dark:text-white hover:text-black hover:dark:bg-[#191D2A] hover:bg-[#F1F5F9] transition">
                &times;
              </button>
            </div>

            <div className="p-4 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] space-y-2 text-xs">
              <div className="font-bold dark:text-[#E8ECF5] text-[#242424]">{selectedDispute.title}</div>
              <p className="dark:text-[#9AA4B8] text-[#64748B] leading-relaxed">{selectedDispute.description}</p>
            </div>

            {/* Evidence Inspector */}
            <div className="space-y-2">
              <div className="text-xs font-semibold dark:text-[#E8ECF5] text-[#242424] flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Evidence Records ({selectedDispute.evidence.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {selectedDispute.evidence.map((ev) => (
                  <div key={ev.id} className="p-3 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] flex justify-between items-center">
                    <div className="truncate pr-2">
                      <div className="font-medium dark:text-[#E8ECF5] text-[#242424] truncate">{ev.fileName}</div>
                      <div className="text-[10px] dark:text-[#9AA4B8] text-[#64748B]">{ev.uploaderName}</div>
                    </div>
                    <a
                      href={ev.downloadUrl || ev.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/20 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Arbitration Form */}
            {selectedDispute.status !== DisputeStatus.RESOLVED && selectedDispute.status !== DisputeStatus.CLOSED && (
              <div className="p-5 rounded-2xl dark:bg-[#191D2A]/60 bg-[#EFF6FF] border dark:border-[#272B38] border-[#DBEAFE] space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#2563EB]">
                  <Gavel className="w-4 h-4 text-[#2563EB]" />
                  <span>Binding Superadmin Arbitrated Ruling</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block dark:text-[#9AA4B8] text-[#475569] mb-1">Ruling Action</label>
                    <select
                      value={resolutionType}
                      onChange={(e) => setResolutionType(e.target.value as DisputeResolutionType)}
                      className="w-full dark:bg-[#0B0D14] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl px-2.5 py-1.5 dark:text-[#E8ECF5] text-[#242424] focus:outline-none"
                    >
                      <option value={DisputeResolutionType.SPLIT_SETTLEMENT}>Split Settlement</option>
                      <option value={DisputeResolutionType.FULL_REFUND_TO_CLIENT}>Full Refund to Client</option>
                      <option value={DisputeResolutionType.FULL_RELEASE_TO_WORKER}>Full Release to Worker</option>
                      <option value={DisputeResolutionType.CANCEL_CONTRACT}>Cancel Contract</option>
                    </select>
                  </div>

                  <div>
                    <label className="block dark:text-[#9AA4B8] text-[#475569] mb-1">Client Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={clientAmount}
                      onChange={(e) => setClientAmount(e.target.value)}
                      className="w-full dark:bg-[#0B0D14] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl px-2.5 py-1.5 dark:text-[#E8ECF5] text-[#242424] font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block dark:text-[#9AA4B8] text-[#475569] mb-1">Worker Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workerAmount}
                      onChange={(e) => setWorkerAmount(e.target.value)}
                      className="w-full dark:bg-[#0B0D14] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl px-2.5 py-1.5 dark:text-[#E8ECF5] text-[#242424] font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block dark:text-[#9AA4B8] text-[#475569] text-xs mb-1">Superadmin Decision Rationale</label>
                  <textarea
                    rows={2}
                    placeholder="Enter authoritative administrative rationale for platform dispute resolution..."
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="w-full dark:bg-[#0B0D14] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl p-2.5 text-xs dark:text-[#E8ECF5] text-[#242424] placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleArbitrate}
                    disabled={isSubmitting || !rationale.trim()}
                    className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white transition disabled:opacity-50 flex items-center space-x-1.5 shadow-sm"
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
