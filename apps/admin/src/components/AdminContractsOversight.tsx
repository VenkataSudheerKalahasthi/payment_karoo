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
      c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.client?.email && c.client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.worker?.email && c.worker.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ACTIVE</span>;
      case 'PENDING_ACCEPTANCE':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">PENDING SIGN-OFF</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">COMPLETED</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">CANCELLED</span>;
      case 'DISPUTED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">DISPUTED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <span>Digital Contract Oversight &amp; Audit</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time inspection of all platform contracts, version increments, and milestone fulfillments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search contracts or parties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 w-56 sm:w-64 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none"
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
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition"
            title="Refresh contracts"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800">
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
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    Loading platform contracts...
                  </td>
                </tr>
              ) : filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500 italic">
                    No contracts matched the current filters.
                  </td>
                </tr>
              ) : (
                filteredContracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono font-bold text-slate-200">{c.contractNumber}</td>
                    <td className="p-3">
                      <span className="font-semibold text-white block truncate max-w-xs">{c.title}</span>
                      <span className="text-[10px] text-slate-500 font-mono">v{c.version}</span>
                    </td>
                    <td className="p-3">
                      <span className="block text-slate-200">
                        {c.client?.firstName ? `${c.client.firstName} ${c.client.lastName || ''}`.trim() : 'Client'}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate block max-w-[140px]">{c.client?.email}</span>
                    </td>
                    <td className="p-3">
                      <span className="block text-slate-200">
                        {c.worker?.firstName ? `${c.worker.firstName} ${c.worker.lastName || ''}`.trim() : 'Specialist'}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate block max-w-[140px]">{c.worker?.email}</span>
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-400">
                      ${Number(c.totalAmount).toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{c.currency}</span>
                    </td>
                    <td className="p-3">{getStatusBadge(c.status)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">
                        {c.milestones?.length || 0} deliverable{(c.milestones?.length || 0) > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {c.status === 'DISPUTED' && onNavigateToDisputes && (
                        <button
                          onClick={() => onNavigateToDisputes(c.id)}
                          className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold"
                          title="View Dispute"
                        >
                          <Scale className="w-3 h-3 inline mr-1" />
                          <span>Dispute</span>
                        </button>
                      )}
                      <button
                        onClick={() => loadContractDetails(c)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-semibold inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3 h-3 text-emerald-400" />
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto text-slate-200 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-white">
                    {selectedContract.contractNumber}
                  </span>
                  <span className="text-xs text-slate-400">v{selectedContract.version}</span>
                  {getStatusBadge(selectedContract.status)}
                  {isLoadingDetails && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400 inline" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mt-1">{selectedContract.title}</h3>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={`/api/v1/contracts/${selectedContract.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download PDF</span>
                </a>
                <button
                  onClick={() => setSelectedContract(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Cryptographic Hash & Metadata */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Canonical Document Hash (SHA-256)</span>
              <p className="font-mono text-[11px] text-emerald-400 break-all">
                {selectedContract.documentHash || 'Awaiting initial mutual signature'}
              </p>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-slate-800 space-x-4 text-xs font-semibold">
              <button
                onClick={() => setDetailTab('milestones')}
                className={`pb-2 transition ${
                  detailTab === 'milestones'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Milestones ({selectedContract.milestones?.length || 0})
              </button>
              <button
                onClick={() => setDetailTab('amendments')}
                className={`pb-2 transition ${
                  detailTab === 'amendments'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Amendments History ({contractAmendments.length})
              </button>
              <button
                onClick={() => setDetailTab('versions')}
                className={`pb-2 transition ${
                  detailTab === 'versions'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Versions ({contractVersions.length})
              </button>
              <button
                onClick={() => setDetailTab('integrity')}
                className={`pb-2 transition ${
                  detailTab === 'integrity'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Integrity & Hash
              </button>
              <button
                onClick={() => setDetailTab('activities')}
                className={`pb-2 transition ${
                  detailTab === 'activities'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Escrow Audit Trail ({contractActivities.length})
              </button>
            </div>

            {/* Tab 1: Milestones */}
            {detailTab === 'milestones' && (
              <div className="space-y-2">
                {selectedContract.milestones?.map((m) => (
                  <div key={m.id} className="p-3 rounded-lg bg-slate-800/50 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">#{m.order} {m.title}</span>
                      <p className="text-slate-400 text-[11px]">{m.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-400 block">${Number(m.amount).toLocaleString()}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-semibold">{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 2: Amendments */}
            {detailTab === 'amendments' && (
              <div className="space-y-2">
                {contractAmendments.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-4">No amendments recorded on this contract.</p>
                ) : (
                  contractAmendments.map((a) => (
                    <div key={a.id} className="p-3 rounded-lg bg-slate-800/50 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-400">{a.amendmentNumber}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">{a.status}</span>
                      </div>
                      <p className="text-slate-300 font-medium">Target Version: v{a.proposedVersion}</p>
                      <p className="text-slate-400 text-[11px]">{a.reason}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Versions */}
            {detailTab === 'versions' && (
              <div className="space-y-2">
                {contractVersions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-4">Current version: v{selectedContract.version}</p>
                ) : (
                  contractVersions.map((ver) => (
                    <div key={ver.id} className="p-3 rounded-lg bg-slate-800/50 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-emerald-400">Version {ver.version}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                          {ver.isAccepted ? 'MUTUALLY ACCEPTED' : 'PENDING'}
                        </span>
                      </div>
                      <p className="text-slate-200 font-medium">{ver.title} — ${ver.totalAmount.toLocaleString()} {ver.currency}</p>
                      <p className="text-[10px] font-mono text-slate-400 break-all">Hash: {ver.documentHash}</p>
                      <p className="text-slate-400 text-[11px]">Reason: {ver.versionReason}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 4: Integrity Audit */}
            {detailTab === 'integrity' && (
              <div className="space-y-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Cryptographic Integrity Status</span>
                  {integrityReport?.isTamperFree ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>CRYPTOGRAPHICALLY TAMPER-FREE</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>HASH DIVERGENCE / COMPLIANCE VIOLATION</span>
                    </span>
                  )}
                </div>

                <div className="font-mono text-[10px] space-y-1">
                  <div className="text-slate-400">Stored Document Hash:</div>
                  <div className="p-1.5 bg-slate-900 rounded border border-slate-800 break-all text-slate-300">
                    {integrityReport?.storedDocumentHash || selectedContract.documentHash || 'Pending bilateral sign-off'}
                  </div>
                  <div className="text-slate-400 mt-1">Recalculated Canonical SHA-256:</div>
                  <div className="p-1.5 bg-slate-900 rounded border border-slate-800 break-all text-emerald-400">
                    {integrityReport?.recalculatedCanonicalHash || 'Calculating on demand'}
                  </div>
                </div>

                {integrityReport && (
                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-slate-800">
                    <div>Total Milestones: ${integrityReport.details.totalMilestoneAmount.toLocaleString()}</div>
                    <div>Contract Sum: ${integrityReport.details.contractTotalAmount.toLocaleString()}</div>
                    <div>Client Signed: {integrityReport.details.clientAccepted ? 'Yes' : 'No'}</div>
                    <div>Worker Signed: {integrityReport.details.workerAccepted ? 'Yes' : 'No'}</div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Activities */}
            {detailTab === 'activities' && (
              <div className="space-y-2">
                {contractActivities.length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-4">No escrow events recorded yet.</p>
                ) : (
                  contractActivities.map((act) => (
                    <div key={act.id} className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-300">{act.eventType}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(act.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px]">{act.description}</p>
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

