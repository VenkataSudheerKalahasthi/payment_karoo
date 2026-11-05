import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Send,
  FileText,
  ShieldAlert,
  ChevronRight,
  X,
  Upload,
  ExternalLink,
} from 'lucide-react';
import { apiService } from '../services/api';
import { DisputeDto, DisputeDetailDto, ContractDto, DisputeCategory, DisputeStatus, UserRole } from '@trustpay/shared';

interface ClientDisputesProps {
  userRole?: UserRole;
}

export const ClientDisputes: React.FC<ClientDisputesProps> = ({ userRole }) => {
  const isWorker = userRole === UserRole.WORKER;
  const [disputes, setDisputes] = useState<DisputeDto[]>([]);
  const [contracts, setContracts] = useState<ContractDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Case details modal
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [disputeDetail, setDisputeDetail] = useState<DisputeDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);

  // Evidence upload in detail modal
  const [newEvidenceName, setNewEvidenceName] = useState('');
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [showAddEvidence, setShowAddEvidence] = useState(false);

  // File Dispute Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [disputeCategory, setDisputeCategory] = useState<DisputeCategory>(DisputeCategory.QUALITY_OF_WORK);
  const [disputeTitle, setDisputeTitle] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputedAmount, setDisputedAmount] = useState<number>(0);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [creatingDispute, setCreatingDispute] = useState(false);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.listDisputes();
      if (res.success && res.data) {
        setDisputes(res.data.items || []);
      } else {
        setError(res.error?.message || 'Failed to load disputes');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error loading disputes');
    } finally {
      setLoading(false);
    }
  };

  const fetchContracts = async () => {
    try {
      const res = await apiService.listContracts();
      if (res.success && res.data) {
        setContracts(res.data);
      }
    } catch (err) {
      console.error('Error loading contracts for disputes:', err);
    }
  };

  useEffect(() => {
    fetchDisputes();
    fetchContracts();
  }, []);

  // Fetch full details of single dispute
  const handleOpenDetail = async (id: string) => {
    try {
      setSelectedDisputeId(id);
      setDetailLoading(true);
      const res = await apiService.getDisputeById(id);
      if (res.success && res.data) {
        setDisputeDetail(res.data);
      }
    } catch (err: any) {
      alert(err?.message || 'Error loading dispute details');
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit response message
  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeId || !responseText.trim() || sendingResponse) return;

    try {
      setSendingResponse(true);
      const res = await apiService.submitDisputeResponse(selectedDisputeId, responseText.trim());
      if (res.success) {
        setResponseText('');
        await handleOpenDetail(selectedDisputeId);
      }
    } catch (err: any) {
      alert(err?.message || 'Error submitting response');
    } finally {
      setSendingResponse(false);
    }
  };

  // Accept or reject proposed resolution
  const handleResolutionAction = async (resolutionId: string, agree: boolean) => {
    if (!selectedDisputeId) return;
    try {
      const res = await apiService.respondToDisputeResolution(selectedDisputeId, resolutionId, agree);
      if (res.success) {
        alert(agree ? 'Resolution accepted!' : 'Resolution rejected.');
        await handleOpenDetail(selectedDisputeId);
        await fetchDisputes();
      }
    } catch (err: any) {
      alert(err?.message || 'Error responding to resolution');
    }
  };

  // Submit additional evidence or rebuttal documentation
  const handleUploadAdditionalEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeId || !newEvidenceUrl.trim()) return;

    try {
      setUploadingEvidence(true);
      const res = await apiService.uploadDisputeEvidence(selectedDisputeId, {
        fileName: newEvidenceName.trim() || 'Work Evidence & Rebuttal Document',
        fileKey: 'disputes/' + selectedDisputeId + '/' + Date.now(),
        fileUrl: newEvidenceUrl.trim(),
        description: isWorker ? 'Specialist work deliverables and audit rebuttal' : 'Client dispute claim evidence',
      });
      if (res.success) {
        setNewEvidenceName('');
        setNewEvidenceUrl('');
        setShowAddEvidence(false);
        await handleOpenDetail(selectedDisputeId);
      } else {
        alert(res.error?.message || 'Failed to upload evidence');
      }
    } catch (err: any) {
      alert(err?.message || 'Error uploading evidence');
    } finally {
      setUploadingEvidence(false);
    }
  };

  // Create dispute
  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractId || !disputeDescription.trim()) {
      alert('Please select a contract and provide dispute details.');
      return;
    }

    try {
      setCreatingDispute(true);
      const res = await apiService.createDispute({
        contractId: selectedContractId,
        category: disputeCategory,
        title: disputeTitle.trim() || `Dispute: ${disputeCategory}`,
        description: disputeDescription.trim(),
        claimedAmountMinor: disputedAmount ? disputedAmount * 100 : undefined,
        evidence: evidenceUrl.trim()
          ? [
              {
                fileName: 'Initial Evidence Document',
                fileKey: 'evidence/' + Date.now(),
                fileUrl: evidenceUrl.trim(),
              },
            ]
          : undefined,
      });

      if (res.success) {
        setShowCreateModal(false);
        setSelectedContractId('');
        setDisputeTitle('');
        setDisputeDescription('');
        setEvidenceUrl('');
        await fetchDisputes();
      } else {
        alert(res.error?.message || 'Failed to file dispute');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Error filing dispute');
    } finally {
      setCreatingDispute(false);
    }
  };

  // Filtered
  const filteredDisputes = useMemo(() => {
    return disputes.filter((d) => {
      const q = searchQuery.toLowerCase();
      const num = (d.disputeNumber || d.id).toLowerCase();
      const desc = (d.description || '').toLowerCase();
      const matchesSearch = num.includes(q) || desc.includes(q);
      const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [disputes, searchQuery, statusFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const active = disputes.filter((d) => d.status === DisputeStatus.OPEN || d.status === DisputeStatus.UNDER_REVIEW).length;
    const resolved = disputes.filter((d) => d.status === DisputeStatus.RESOLVED || d.status === DisputeStatus.CLOSED).length;
    const totalDisputedAmount = disputes.reduce((sum, d) => sum + Number(d.claimedAmountMinor ? Number(d.claimedAmountMinor) / 100 : 0), 0);

    return {
      count: disputes.length,
      active,
      resolved,
      totalDisputedAmount,
    };
  }, [disputes]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            Under Review
          </span>
        );
      case 'RESOLVED':
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Resolved
          </span>
        );
      case 'ESCALATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
            <AlertTriangle className="w-3 h-3" />
            Escalated to Arbitration
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#121412] dark:bg-[#121412] border border-[#262926] p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {isWorker ? 'Specialist Dispute & Arbitration Center' : 'Dispute Resolution Center'}
            </h1>
            <p className="text-sm text-zinc-400">
              {isWorker
                ? 'Review client dispute claims, file formal rebuttals, submit work evidence, and arbitrate escrow releases.'
                : 'Fair arbitration, milestone evidence review, and escrow custody hold protection.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8BFF24] hover:bg-[#78e018] text-black text-xs font-bold transition shadow-[0_0_12px_rgba(139,255,36,0.2)]"
          >
            <Plus className="w-4 h-4" />
            {isWorker ? 'Raise Issue' : 'File a Dispute'}
          </button>
          <button
            onClick={fetchDisputes}
            disabled={loading}
            className="p-2 rounded-xl bg-[#1e201e] border border-[#2e322e] text-zinc-300 hover:text-white transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Total Cases</p>
          <p className="text-2xl font-bold text-white mt-1">{metrics.count}</p>
          <p className="text-xs text-zinc-500 mt-1">Disputes filed</p>
        </div>

        <div className="bg-[#121412] border border-amber-500/30 p-4 rounded-xl">
          <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold">Active In Arbitration</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{metrics.active}</p>
          <p className="text-xs text-zinc-400 mt-1">Escrow held in safety</p>
        </div>

        <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Resolved Cases</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{metrics.resolved}</p>
          <p className="text-xs text-zinc-500 mt-1">Successfully settled</p>
        </div>

        <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Escrow Protected</p>
          <p className="text-2xl font-bold text-[#8BFF24] mt-1 font-mono">${metrics.totalDisputedAmount.toLocaleString()}</p>
          <p className="text-xs text-zinc-500 mt-1">Funds frozen from release</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search dispute # or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181a18] border border-[#2e322e] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'OPEN', 'UNDER_REVIEW', 'RESOLVED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-[#8BFF24] text-black'
                  : 'bg-[#181a18] text-zinc-300 hover:text-white border border-[#2e322e]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Disputes Table */}
      {loading ? (
        <div className="bg-[#121412] border border-[#262926] p-12 rounded-2xl flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 text-[#8BFF24] animate-spin mb-3" />
          <p className="text-zinc-400 text-sm">Querying active arbitration files...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      ) : filteredDisputes.length === 0 ? (
        <div className="bg-[#121412] border border-[#262926] p-12 rounded-2xl text-center">
          <Scale className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No active dispute cases</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            All your agreements and milestone deliverables are currently in good standing.
          </p>
        </div>
      ) : (
        <div className="bg-[#121412] border border-[#262926] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#181a18] border-b border-[#262926] text-xs uppercase text-zinc-400 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Case #</th>
                  <th className="py-3.5 px-4 font-semibold">Category</th>
                  <th className="py-3.5 px-4 font-semibold">Claim Description</th>
                  <th className="py-3.5 px-4 font-semibold">Date Filed</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262926] text-zinc-300">
                {filteredDisputes.map((d) => (
                  <tr key={d.id} className="hover:bg-[#161816] transition">
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-white">
                      {d.disputeNumber || 'DSP-' + d.id.slice(0, 8)}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-amber-400">
                      {d.category}
                    </td>
                    <td className="py-3.5 px-4 text-xs max-w-xs truncate">
                      {d.description}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-zinc-400">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {getStatusBadge(d.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenDetail(d.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#1e201e] hover:bg-[#282c28] border border-[#2e322e] text-zinc-300 hover:text-white text-xs transition"
                      >
                        Inspect Case
                        <ChevronRight className="w-3.5 h-3.5 text-[#8BFF24]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Case Details Drawer / Modal */}
      {selectedDisputeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121412] border border-[#262926] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedDisputeId(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            {detailLoading || !disputeDetail ? (
              <div className="p-12 text-center flex flex-col items-center">
                <RefreshCw className="w-6 h-6 text-[#8BFF24] animate-spin mb-2" />
                <p className="text-zinc-400 text-xs">Loading case dossier...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Scale className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white font-mono">
                        {disputeDetail.disputeNumber || 'DSP-' + disputeDetail.id.slice(0, 8)}
                      </h3>
                      <p className="text-xs text-zinc-400">Category: <strong className="text-amber-400">{disputeDetail.category}</strong></p>
                    </div>
                  </div>
                  <div>{getStatusBadge(disputeDetail.status)}</div>
                </div>

                {/* Escrow Hold Warning Banner */}
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 text-xs text-amber-300">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                  <p>
                    Escrow funds associated with this dispute are locked in non-custodial custody. No funds can be released until mutual agreement or mediator determination.
                  </p>
                </div>

                {/* Case Claim */}
                <div className="p-4 rounded-xl bg-[#181a18] border border-[#262926] space-y-2 text-xs">
                  <span className="text-zinc-500 font-semibold uppercase text-[10px] block">Claim Details</span>
                  <p className="text-zinc-200">{disputeDetail.description}</p>
                </div>

                {/* Evidence attachments & Rebuttal Upload */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Submitted Evidence & Rebuttals
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddEvidence(!showAddEvidence)}
                      className="text-xs text-[#8BFF24] hover:underline flex items-center gap-1 font-medium"
                    >
                      <Plus className="w-3 h-3" />
                      {showAddEvidence ? 'Cancel' : isWorker ? 'Submit Work Rebuttal / Evidence' : 'Attach More Evidence'}
                    </button>
                  </div>

                  {disputeDetail.evidence && disputeDetail.evidence.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {disputeDetail.evidence.map((ev, idx) => (
                        <a
                          key={idx}
                          href={ev.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181a18] border border-[#262926] hover:border-[#8BFF24]/40 text-xs text-zinc-300 hover:text-white transition"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#8BFF24]" />
                          {ev.fileName || `Evidence #${idx + 1}`}
                          <ExternalLink className="w-3 h-3 text-zinc-500" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 italic">No formal evidence documents uploaded yet.</p>
                  )}

                  {showAddEvidence && (
                    <form onSubmit={handleUploadAdditionalEvidence} className="p-3 bg-[#181a18] rounded-xl border border-[#262926] space-y-2.5 text-xs">
                      <div className="flex items-center gap-2 text-zinc-300 font-semibold text-xs">
                        <Upload className="w-3.5 h-3.5 text-[#8BFF24]" />
                        {isWorker ? 'Upload Specialist Rebuttal or Deliverable Proof' : 'Upload Dispute Evidence Document'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Evidence title (e.g. GitHub PR, Deliverable ZIP, Chat Logs)..."
                          value={newEvidenceName}
                          onChange={(e) => setNewEvidenceName(e.target.value)}
                          className="bg-[#141614] border border-[#2e322e] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60"
                        />
                        <input
                          type="url"
                          required
                          placeholder="Document or storage URL (https://...)..."
                          value={newEvidenceUrl}
                          onChange={(e) => setNewEvidenceUrl(e.target.value)}
                          className="bg-[#141614] border border-[#2e322e] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddEvidence(false)}
                          className="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={uploadingEvidence || !newEvidenceUrl.trim()}
                          className="px-3 py-1 rounded-lg bg-[#8BFF24] text-black font-bold text-xs hover:bg-[#78e018] transition disabled:opacity-50"
                        >
                          {uploadingEvidence ? 'Uploading...' : 'Submit Evidence Dossier'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Proposed Resolutions */}
                {disputeDetail.resolutions && disputeDetail.resolutions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Proposed Resolutions</span>
                    {disputeDetail.resolutions.map((res: any) => (
                      <div key={res.id} className="p-3.5 bg-[#181a18] border border-blue-500/30 rounded-xl text-xs space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-white">Proposal: {res.resolutionType}</span>
                          <span className="text-zinc-400 text-[11px] font-mono">Status: {res.status}</span>
                        </div>
                        <p className="text-zinc-300">{res.notes || 'No proposal notes.'}</p>
                        {res.status === 'PROPOSED' && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleResolutionAction(res.id, true)}
                              className="px-3 py-1 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition"
                            >
                              Accept Proposal
                            </button>
                            <button
                              onClick={() => handleResolutionAction(res.id, false)}
                              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs hover:bg-red-500/30 transition"
                            >
                              Reject Proposal
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Responses Thread */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Case Discussion & Statements</span>
                  <div className="max-h-52 overflow-y-auto space-y-2 p-3 bg-[#181a18] rounded-xl border border-[#262926]">
                    {disputeDetail.responses && disputeDetail.responses.length > 0 ? (
                      disputeDetail.responses.map((resp: any) => (
                        <div key={resp.id} className="p-2.5 rounded-lg bg-[#141614] border border-[#222422] text-xs space-y-1">
                          <div className="flex justify-between items-center text-[11px] text-zinc-500">
                            <span className="font-bold text-zinc-300">
                              {resp.user?.firstName || 'Party Statement'}
                            </span>
                            <span>{new Date(resp.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-zinc-200">{resp.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 italic">No statements filed yet.</p>
                    )}
                  </div>
                </div>

                {/* Response Input */}
                <form onSubmit={handleSendResponse} className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Submit a statement or question for arbitration..."
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    className="flex-1 bg-[#181a18] border border-[#2e322e] rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60"
                  />
                  <button
                    type="submit"
                    disabled={!responseText.trim() || sendingResponse}
                    className="px-4 py-2 rounded-xl bg-[#8BFF24] hover:bg-[#78e018] text-black text-xs font-bold transition disabled:opacity-40"
                  >
                    {sendingResponse ? 'Submitting...' : 'Submit'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* File Dispute Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121412] border border-[#262926] w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">File a Formal Dispute</h3>
                <p className="text-xs text-zinc-400">
                  Escrow will freeze milestone funds until resolution is reached.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateDispute} className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Target Contract *</label>
                <select
                  value={selectedContractId}
                  onChange={(e) => setSelectedContractId(e.target.value)}
                  className="w-full bg-[#181a18] border border-[#2e322e] rounded-xl p-2.5 text-zinc-200 focus:outline-none focus:border-[#8BFF24]/60"
                >
                  <option value="">Select an active contract...</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contractNumber} - {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Dispute Reason / Category *</label>
                <select
                  value={disputeCategory}
                  onChange={(e) => setDisputeCategory(e.target.value as DisputeCategory)}
                  className="w-full bg-[#181a18] border border-[#2e322e] rounded-xl p-2.5 text-zinc-200 focus:outline-none focus:border-[#8BFF24]/60"
                >
                  <option value={DisputeCategory.QUALITY_OF_WORK}>Quality of Work / Unsatisfactory Deliverables</option>
                  <option value={DisputeCategory.MISSED_DEADLINE}>Missed Deadlines / Delayed Delivery</option>
                  <option value={DisputeCategory.SCOPE_DISPUTE}>Scope Misalignment</option>
                  <option value={DisputeCategory.BREACH_OF_TERMS}>Contract Breach</option>
                  <option value={DisputeCategory.UNRESPONSIVE_PARTY}>Unresponsive Specialist</option>
                  <option value={DisputeCategory.PAYMENT_ISSUE}>Payment / Escrow Issue</option>
                  <option value={DisputeCategory.OTHER}>Other</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Dispute Title / Subject (Optional)</label>
                <input
                  type="text"
                  value={disputeTitle}
                  onChange={(e) => setDisputeTitle(e.target.value)}
                  placeholder="e.g. Incomplete API implementation for milestone 2"
                  className="w-full bg-[#181a18] border border-[#2e322e] rounded-xl p-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60"
                />
              </div>

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Detailed Explanation *</label>
                <textarea
                  rows={4}
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Explain the specific issue, milestone deliverable concerns, and desired resolution..."
                  className="w-full bg-[#181a18] border border-[#2e322e] rounded-xl p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60"
                />
              </div>

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">Evidence URL / Screenshot Link (Optional)</label>
                <input
                  type="url"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#181a18] border border-[#2e322e] rounded-xl p-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#262926]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingDispute || !selectedContractId || !disputeDescription.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition disabled:opacity-40"
                >
                  {creatingDispute ? 'Filing...' : 'Confirm & Open Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
