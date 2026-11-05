import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  FileText,
  RefreshCw,
  Scale,
  Eye,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { apiService } from '../services/api';
import {
  ContractDto,
  ContractAmendmentDto,
  EscrowActivityDto,
  ContractVersionDto,
  ContractIntegrityReportDto,
} from '@trustpay/shared';

interface AdminContractsOversightProps {
  onNavigateToDisputes?: (contractId: string) => void;
}

export const AdminContractsOversight: React.FC<AdminContractsOversightProps> = ({
  onNavigateToDisputes,
}) => {
  const [contracts, setContracts] = useState<ContractDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedContract, setSelectedContract] = useState<ContractDto | null>(null);
  const [contractAmendments, setContractAmendments] = useState<ContractAmendmentDto[]>([]);
  const [contractActivities, setContractActivities] = useState<EscrowActivityDto[]>([]);
  const [contractVersions, setContractVersions] = useState<ContractVersionDto[]>([]);
  const [integrityReport, setIntegrityReport] = useState<ContractIntegrityReportDto | null>(null);
  const [detailTab, setDetailTab] = useState<'milestones' | 'amendments' | 'activities' | 'versions' | 'integrity'>('milestones');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const loadContracts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiService.listContracts();
      if (res.success && res.data) {
        setContracts(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const loadContractDetails = async (c: ContractDto) => {
    setSelectedContract(c);
    setIsLoadingDetails(true);
    setDetailTab('milestones');
    try {
      const [amendRes, actRes, verRes, intRes] = await Promise.allSettled([
        apiService.listContractAmendments(c.id),
        apiService.listEscrowActivities(c.id),
        apiService.getContractVersions(c.id),
        apiService.verifyContractIntegrity(c.id),
      ]);
      if (amendRes.status === 'fulfilled' && amendRes.value.success && amendRes.value.data) {
        setContractAmendments(amendRes.value.data);
      } else {
        setContractAmendments([]);
      }
      if (actRes.status === 'fulfilled' && actRes.value.success && actRes.value.data) {
        setContractActivities(actRes.value.data);
      } else {
        setContractActivities([]);
      }
      if (verRes.status === 'fulfilled' && verRes.value.success && verRes.value.data) {
        setContractVersions(verRes.value.data);
      } else {
        setContractVersions([]);
      }
      if (intRes.status === 'fulfilled' && intRes.value.success && intRes.value.data) {
        setIntegrityReport(intRes.value.data);
      } else {
        setIntegrityReport(null);
      }
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const filteredContracts = contracts.filter((c) => {
    const matchesSearch =
      !searchTerm ||
      c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.client?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.worker?.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            ACTIVE
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20">
            COMPLETED
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            DISPUTED
          </span>
        );
      case 'PENDING_ACCEPTANCE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            PENDING SIGN-OFF
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold dark:bg-[#202020] bg-slate-200 dark:text-[#A5A5A5] text-[#64748B]">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Controls */}
      <div className="p-4 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h3 className="text-base font-bold dark:text-[#CDCBCA] text-[#242424] flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#2563EB]" />
            <span>Digital Contract Oversight &amp; Audit</span>
          </h3>
          <p className="text-xs dark:text-[#A5A5A5] text-[#64748B] mt-0.5">
            Real-time inspection of all platform contracts, version increments, and milestone fulfillments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 dark:text-[#777777] text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search contracts or parties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] placeholder-slate-400 w-56 sm:w-64 focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 dark:text-[#777777] text-[#64748B]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING_ACCEPTANCE">PENDING SIGN-OFF</option>
              <option value="DISPUTED">DISPUTED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <button
            onClick={loadContracts}
            disabled={isLoading}
            className="p-2 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#242424] transition shadow-sm"
            title="Refresh contracts"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#2563EB]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="dark:bg-[#202020] bg-[#F1F5F9] dark:text-[#A5A5A5] text-[#64748B] font-semibold uppercase tracking-wider text-[10px] border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0]">
              <tr>
                <th className="p-3">Contract Ref</th>
                <th className="p-3">Title &amp; Version</th>
                <th className="p-3">Client (Buyer)</th>
                <th className="p-3">Specialist (Provider)</th>
                <th className="p-3">Total Value</th>
                <th className="p-3">Status</th>
                <th className="p-3">Milestones</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center dark:text-[#777777] text-[#64748B]">
                    Loading platform contracts...
                  </td>
                </tr>
              ) : filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center dark:text-[#777777] text-[#64748B] italic">
                    No contracts matched the current filters.
                  </td>
                </tr>
              ) : (
                filteredContracts.map((c) => (
                  <tr key={c.id} className="hover:dark:bg-[#202020]/40 hover:bg-[#F8FAFC] transition">
                    <td className="p-3 font-mono font-bold dark:text-[#CDCBCA] text-[#242424]">{c.contractNumber}</td>
                    <td className="p-3">
                      <span className="font-semibold dark:text-[#CDCBCA] text-[#242424] block truncate max-w-xs">{c.title}</span>
                      <span className="text-[10px] dark:text-[#777777] text-[#64748B] font-mono">v{c.version}</span>
                    </td>
                    <td className="p-3">
                      <span className="block dark:text-[#CDCBCA] text-[#242424]">
                        {c.client?.firstName ? `${c.client.firstName} ${c.client.lastName || ''}`.trim() : 'Client'}
                      </span>
                      <span className="text-[10px] dark:text-[#777777] text-[#64748B] truncate block max-w-[140px]">{c.client?.email}</span>
                    </td>
                    <td className="p-3">
                      <span className="block dark:text-[#CDCBCA] text-[#242424]">
                        {c.worker?.firstName ? `${c.worker.firstName} ${c.worker.lastName || ''}`.trim() : 'Specialist'}
                      </span>
                      <span className="text-[10px] dark:text-[#777777] text-[#64748B] truncate block max-w-[140px]">{c.worker?.email}</span>
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-500 tabular-nums">
                      ${Number(c.totalAmount).toLocaleString()} <span className="text-[10px] font-normal dark:text-[#777777] text-[#64748B]">{c.currency}</span>
                    </td>
                    <td className="p-3">{getStatusBadge(c.status)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-lg dark:bg-[#202020] bg-[#F1F5F9] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] text-[10px] font-mono">
                        {c.milestones?.length || 0} deliverable{(c.milestones?.length || 0) > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {c.status === 'DISPUTED' && onNavigateToDisputes && (
                        <button
                          onClick={() => onNavigateToDisputes(c.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 text-[10px] font-semibold"
                          title="View Dispute"
                        >
                          <Scale className="w-3 h-3 inline mr-1" />
                          <span>Dispute</span>
                        </button>
                      )}
                      <button
                        onClick={() => loadContractDetails(c)}
                        className="px-3 py-1 rounded-lg dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] dark:text-[#CDCBCA] text-[#242424] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] text-[10px] font-semibold inline-flex items-center space-x-1 transition shadow-sm"
                      >
                        <Eye className="w-3 h-3 text-[#2563EB]" />
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

      {/* Contract Detail Drawer / Modal */}
      {selectedContract && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto dark:text-[#CDCBCA] text-[#242424] shadow-2xl">
            <div className="flex items-start justify-between border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg dark:bg-[#202020] bg-[#F1F5F9] dark:text-[#CDCBCA] text-[#242424]">
                    {selectedContract.contractNumber}
                  </span>
                  <span className="text-xs dark:text-[#777777] text-[#64748B] font-mono">v{selectedContract.version}</span>
                  {getStatusBadge(selectedContract.status)}
                  {isLoadingDetails && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2563EB] inline" />
                  )}
                </div>
                <h3 className="text-lg font-bold dark:text-[#CDCBCA] text-[#242424] mt-1">{selectedContract.title}</h3>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={`/api/v1/contracts/${selectedContract.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] text-xs font-semibold dark:text-[#CDCBCA] text-[#242424] flex items-center space-x-1 shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Download PDF</span>
                </a>
                <button
                  onClick={() => setSelectedContract(null)}
                  className="px-3.5 py-1.5 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] transition"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Cryptographic Hash & Metadata */}
            <div className="p-3.5 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-y-1 text-xs">
              <span className="text-[10px] dark:text-[#777777] text-[#64748B] font-semibold uppercase">Canonical Document Hash (SHA-256)</span>
              <p className="font-mono text-[11px] text-[#2563EB] break-all">
                {selectedContract.documentHash || 'Awaiting initial mutual signature'}
              </p>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-x-4 text-xs font-semibold">
              <button
                onClick={() => setDetailTab('milestones')}
                className={`pb-2 transition ${
                  detailTab === 'milestones'
                    ? 'text-[#2563EB] border-b-2 border-[#2563EB]'
                    : 'dark:text-[#A5A5A5] text-[#64748B] hover:dark:text-white hover:text-black'
                }`}
              >
                Milestones ({selectedContract.milestones?.length || 0})
              </button>
              <button
                onClick={() => setDetailTab('amendments')}
                className={`pb-2 transition ${
                  detailTab === 'amendments'
                    ? 'text-[#2563EB] border-b-2 border-[#2563EB]'
                    : 'dark:text-[#A5A5A5] text-[#64748B] hover:dark:text-white hover:text-black'
                }`}
              >
                Amendments History ({contractAmendments.length})
              </button>
              <button
                onClick={() => setDetailTab('versions')}
                className={`pb-2 transition ${
                  detailTab === 'versions'
                    ? 'text-[#2563EB] border-b-2 border-[#2563EB]'
                    : 'dark:text-[#A5A5A5] text-[#64748B] hover:dark:text-white hover:text-black'
                }`}
              >
                Versions ({contractVersions.length})
              </button>
              <button
                onClick={() => setDetailTab('integrity')}
                className={`pb-2 transition ${
                  detailTab === 'integrity'
                    ? 'text-[#2563EB] border-b-2 border-[#2563EB]'
                    : 'dark:text-[#A5A5A5] text-[#64748B] hover:dark:text-white hover:text-black'
                }`}
              >
                Integrity &amp; Hash
              </button>
              <button
                onClick={() => setDetailTab('activities')}
                className={`pb-2 transition ${
                  detailTab === 'activities'
                    ? 'text-[#2563EB] border-b-2 border-[#2563EB]'
                    : 'dark:text-[#A5A5A5] text-[#64748B] hover:dark:text-white hover:text-black'
                }`}
              >
                Escrow Audit Trail ({contractActivities.length})
              </button>
            </div>

            {/* Tab 1: Milestones */}
            {detailTab === 'milestones' && (
              <div className="space-y-2">
                {selectedContract.milestones?.map((m) => (
                  <div key={m.id} className="p-3.5 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold dark:text-[#CDCBCA] text-[#242424]">#{m.order} {m.title}</span>
                      <p className="dark:text-[#A5A5A5] text-[#64748B] text-[11px]">{m.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-500 block">${Number(m.amount).toLocaleString()}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-lg dark:bg-[#202020] bg-slate-200 dark:text-[#CDCBCA] text-[#475569] font-semibold">{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 2: Amendments */}
            {detailTab === 'amendments' && (
              <div className="space-y-2">
                {contractAmendments.length === 0 ? (
                  <p className="text-xs dark:text-[#777777] text-[#64748B] italic text-center py-4">No amendments recorded on this contract.</p>
                ) : (
                  contractAmendments.map((a) => (
                    <div key={a.id} className="p-3.5 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#2563EB]">{a.amendmentNumber}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded dark:bg-[#202020] bg-slate-200 dark:text-[#CDCBCA] text-[#475569]">{a.status}</span>
                      </div>
                      <p className="dark:text-[#CDCBCA] text-[#242424] font-medium">Target Version: v{a.proposedVersion}</p>
                      <p className="dark:text-[#A5A5A5] text-[#64748B] text-[11px]">{a.reason}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Versions */}
            {detailTab === 'versions' && (
              <div className="space-y-2">
                {contractVersions.length === 0 ? (
                  <p className="text-xs dark:text-[#777777] text-[#64748B] italic text-center py-4">Current version: v{selectedContract.version}</p>
                ) : (
                  contractVersions.map((ver) => (
                    <div key={ver.id} className="p-3.5 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-emerald-500">Version {ver.version}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono dark:bg-[#202020] bg-slate-200 dark:text-[#CDCBCA] text-[#475569]">
                          {ver.isAccepted ? 'MUTUALLY ACCEPTED' : 'PENDING'}
                        </span>
                      </div>
                      <p className="dark:text-[#CDCBCA] text-[#242424] font-medium">{ver.title} — ${ver.totalAmount.toLocaleString()} {ver.currency}</p>
                      <p className="text-[10px] font-mono dark:text-[#777777] text-[#64748B] break-all">Hash: {ver.documentHash}</p>
                      <p className="dark:text-[#A5A5A5] text-[#64748B] text-[11px]">Reason: {ver.versionReason}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 4: Integrity Audit */}
            {detailTab === 'integrity' && (
              <div className="space-y-3 p-4 dark:bg-[#080808] bg-[#F8FAFC] rounded-2xl border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold dark:text-[#CDCBCA] text-[#242424]">Cryptographic Integrity Status</span>
                  {integrityReport?.isTamperFree ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>CRYPTOGRAPHICALLY TAMPER-FREE</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>HASH DIVERGENCE / COMPLIANCE VIOLATION</span>
                    </span>
                  )}
                </div>

                <div className="font-mono text-[10px] space-y-1">
                  <div className="dark:text-[#777777] text-[#64748B]">Stored Document Hash:</div>
                  <div className="p-2 dark:bg-[#171717] bg-white rounded-lg border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] break-all dark:text-[#CDCBCA] text-[#242424]">
                    {integrityReport?.storedDocumentHash || selectedContract.documentHash || 'Pending bilateral sign-off'}
                  </div>
                  <div className="dark:text-[#777777] text-[#64748B] mt-1">Recalculated Canonical SHA-256:</div>
                  <div className="p-2 dark:bg-[#171717] bg-white rounded-lg border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] break-all text-emerald-500 font-bold">
                    {integrityReport?.recalculatedCanonicalHash || 'Calculating on demand'}
                  </div>
                </div>

                {integrityReport && (
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-2 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                    <div>Total Milestones: ${integrityReport.details.totalMilestoneAmount.toLocaleString()}</div>
                    <div>Contract Sum: ${integrityReport.details.contractTotalAmount.toLocaleString()}</div>
                    <div>Client Signed: {integrityReport.details.clientAccepted ? 'Yes' : 'No'}</div>
                    <div>Worker Signed: {integrityReport.details.workerAccepted ? 'Yes' : 'No'}</div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: Activities */}
            {detailTab === 'activities' && (
              <div className="space-y-2">
                {contractActivities.length === 0 ? (
                  <p className="text-xs dark:text-[#777777] text-[#64748B] italic text-center py-4">No escrow events recorded yet.</p>
                ) : (
                  contractActivities.map((act) => (
                    <div key={act.id} className="p-3 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold dark:text-[#CDCBCA] text-[#242424]">{act.eventType}</span>
                        <span className="text-[10px] dark:text-[#777777] text-[#64748B] font-mono">
                          {new Date(act.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="dark:text-[#A5A5A5] text-[#64748B] text-[11px]">{act.description}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
