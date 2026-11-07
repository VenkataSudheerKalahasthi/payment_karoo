import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Send,
  Download,
  AlertTriangle,
  History,
  X,
  Upload,
  Play,
} from 'lucide-react';
import { apiService } from '../services/api';
import { ContractDto, ContractMilestoneDto, UserRole } from '@trustpay/shared';

interface MilestoneWithContract extends ContractMilestoneDto {
  contractId: string;
  contractNumber: string;
  contractTitle: string;
  workerName: string;
  currency: string;
}

interface MilestoneManagementProps {
  userRole?: UserRole;
  onNavigateToContract?: (contractId: string) => void;
}

export const MilestoneManagement: React.FC<MilestoneManagementProps> = ({
  userRole,
  onNavigateToContract,
}) => {
  const isWorker = userRole === UserRole.WORKER;
  const [contracts, setContracts] = useState<ContractDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [contractFilter, setContractFilter] = useState<string>('ALL');

  // Review Modal State
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneWithContract | null>(null);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');

  // Specialist Submission Modal State
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionAttachmentUrl, setSubmissionAttachmentUrl] = useState('');


  const fetchContracts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.listContracts();
      if (res.success && res.data) {
        setContracts(res.data);
      } else {
        setError(res.error?.message || 'Failed to load milestones');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error loading contracts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  // Flatten all milestones across contracts
  const allMilestones: MilestoneWithContract[] = useMemo(() => {
    const list: MilestoneWithContract[] = [];
    contracts.forEach((c) => {
      const workerName = c.worker
        ? `${c.worker.firstName || ''} ${c.worker.lastName || ''}`.trim() || 'Specialist'
        : 'Assigned Specialist';

      (c.milestones || []).forEach((m) => {
        list.push({
          ...m,
          contractId: c.id,
          contractNumber: c.contractNumber,
          contractTitle: c.title,
          workerName,
          currency: c.currency || 'USD',
        });
      });
    });
    return list;
  }, [contracts]);

  // Filtered milestones
  const filteredMilestones = useMemo(() => {
    return allMilestones.filter((m) => {
      const matchesSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.contractTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'REVIEW_NEEDED' && m.status === 'SUBMITTED') ||
        m.status === statusFilter;

      const matchesContract = contractFilter === 'ALL' || m.contractId === contractFilter;

      return matchesSearch && matchesStatus && matchesContract;
    });
  }, [allMilestones, searchQuery, statusFilter, contractFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const reviewNeeded = allMilestones.filter((m) => m.status === 'SUBMITTED').length;
    const inProgress = allMilestones.filter((m) => m.status === 'IN_PROGRESS').length;
    const approved = allMilestones.filter((m) => m.status === 'APPROVED').length;
    const inRevision = allMilestones.filter((m) => m.status === 'IN_REVISION').length;
    const totalAmount = allMilestones.reduce((acc, m) => acc + Number(m.amount || 0), 0);

    return {
      total: allMilestones.length,
      reviewNeeded,
      inProgress,
      approved,
      inRevision,
      totalAmount,
    };
  }, [allMilestones]);

  // Handle Approve Deliverable
  const handleApprove = async (m: MilestoneWithContract) => {
    if (!confirm(`Are you sure you want to approve "${m.title}" and authorize escrow release for $${m.amount}?`)) {
      return;
    }

    try {
      setActionLoading(m.id);
      const res = await apiService.approveMilestone(m.contractId, m.id);
      if (res.success) {
        setSelectedMilestone(null);
        await fetchContracts();
      } else {
        alert(res.error?.message || 'Failed to approve milestone');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Error approving milestone');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Request Revision
  const handleRequestRevision = async () => {
    if (!selectedMilestone) return;
    if (!revisionFeedback.trim()) {
      alert('Please specify the revisions required.');
      return;
    }

    try {
      setActionLoading(selectedMilestone.id);
      const submissionId = selectedMilestone.submissions?.[0]?.id || selectedMilestone.id;
      const res = await apiService.requestRevision(selectedMilestone.contractId, selectedMilestone.id, {
        submissionId,
        reason: revisionFeedback.trim(),
      });
      if (res.success) {
        setShowRevisionModal(false);
        setRevisionFeedback('');
        setSelectedMilestone(null);
        await fetchContracts();
      } else {
        alert(res.error?.message || 'Failed to request revision');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Error submitting revision request');
    } finally {
      setActionLoading(null);
    }
  };

  // Specialist: Start Milestone Work
  const handleStartMilestone = async (m: MilestoneWithContract) => {
    try {
      setActionLoading(m.id);
      const res = await apiService.startMilestone(m.contractId, m.id);
      if (res.success) {
        await fetchContracts();
      } else {
        alert(res.error?.message || 'Failed to commence milestone work');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Error commencing milestone');
    } finally {
      setActionLoading(null);
    }
  };

  // Specialist: Submit Milestone Deliverable
  const handleSubmitDeliverable = async () => {
    if (!selectedMilestone || !submissionNotes.trim()) {
      alert('Please provide deliverable notes explaining your completed work.');
      return;
    }

    try {
      setActionLoading(selectedMilestone.id);
      const attachments = submissionAttachmentUrl.trim() ? [submissionAttachmentUrl.trim()] : [];
      const res = await apiService.submitMilestone(selectedMilestone.contractId, selectedMilestone.id, {
        notes: submissionNotes.trim(),
        attachmentUrls: attachments,
      });

      if (res.success) {
        setShowSubmissionModal(false);
        setSubmissionNotes('');
        setSubmissionAttachmentUrl('');
        setSelectedMilestone(null);
        await fetchContracts();
      } else {
        alert(res.error?.message || 'Failed to submit milestone deliverable');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Error submitting deliverable');
    } finally {
      setActionLoading(null);
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold dark:bg-[#1C2740] bg-[#EEF2FF] dark:text-[#8FB5FF] text-[#5046E5] border dark:border-[#1F61EF]/40 border-[#C7D2FE] animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            Deliverable Ready for Review
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved &amp; Released
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            In Progress
          </span>
        );
      case 'IN_REVISION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <History className="w-3.5 h-3.5" />
            Revision Requested
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            Disputed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold dark:bg-zinc-800 bg-[#EEF2FF] dark:text-zinc-400 text-[#475569] dark:border-zinc-700 border-[#C7D2FE]">
            <Clock className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="interactive-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold dark:text-white text-slate-900 tracking-tight">
                {isWorker ? 'Specialist Milestone Deliverables' : 'Milestone Management & Review'}
              </h1>
              <p className="text-sm dark:text-zinc-400 text-slate-500">
                {isWorker
                  ? 'Commence milestone work, upload deliverable evidence, address client feedback, and track escrow settlements.'
                  : 'Track deliverables, inspect submitted work, and authorize escrow release.'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchContracts}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl dark:bg-[#191D2A] bg-slate-100 border dark:border-[#272B38] border-slate-200 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-slate-900 hover:dark:bg-[#282c28] hover:bg-slate-200 hover:dark:border-[#1F61EF]/40 border-[#C7D2FE] transition text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">Total Milestones</p>
          <p className="text-2xl font-bold dark:text-white text-slate-900 mt-1">{metrics.total}</p>
          <p className="text-xs text-zinc-500 mt-1">${metrics.totalAmount.toLocaleString()} Allocated</p>
        </div>

        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#1F61EF]/30 border-[#C7D2FE] shadow-sm p-4 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 dark:bg-[#1C2740] bg-[#EEF2FF] rounded-full blur-xl pointer-events-none" />
          <p className="text-xs dark:text-[#8FB5FF] text-[#5046E5] uppercase tracking-wider font-semibold">Ready for Review</p>
          <p className="text-2xl font-bold dark:text-[#8FB5FF] text-[#5046E5] mt-1">{metrics.reviewNeeded}</p>
          <p className="text-xs dark:text-zinc-400 text-slate-500 mt-1">Pending Approval</p>
        </div>

        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">In Progress</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{metrics.inProgress}</p>
          <p className="text-xs text-zinc-500 mt-1">Work in development</p>
        </div>

        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">Revisions Open</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{metrics.inRevision}</p>
          <p className="text-xs text-zinc-500 mt-1">Awaiting updates</p>
        </div>

        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl col-span-2 md:col-span-1">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">Settled / Approved</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{metrics.approved}</p>
          <p className="text-xs text-zinc-500 mt-1">Escrow Disbursed</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 dark:text-zinc-400 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search milestones or contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm dark:text-white text-slate-900 placeholder-zinc-500 focus:outline-none focus:dark:border-[#1F61EF]/60 border-[#5046E5] transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status filter pills */}
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'ALL'
                ? 'dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white shadow-sm'
                : 'dark:bg-[#191B25] bg-slate-50 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-slate-900 border dark:border-[#272B38] border-slate-200'
            }`}
          >
            All ({allMilestones.length})
          </button>

          <button
            onClick={() => setStatusFilter('REVIEW_NEEDED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'REVIEW_NEEDED'
                ? 'dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white shadow-sm'
                : 'dark:bg-[#191B25] bg-slate-50 dark:text-[#8FB5FF] text-[#5046E5] hover:dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE]'
            }`}
          >
            Review Needed ({metrics.reviewNeeded})
          </button>

          <button
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-blue-500 text-white'
                : 'dark:bg-[#191B25] bg-slate-50 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-slate-900 border dark:border-[#272B38] border-slate-200'
            }`}
          >
            In Progress ({metrics.inProgress})
          </button>

          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-500 text-white'
                : 'dark:bg-[#191B25] bg-slate-50 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-slate-900 border dark:border-[#272B38] border-slate-200'
            }`}
          >
            Approved ({metrics.approved})
          </button>

          {/* Contract selector */}
          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
            className="dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-200 rounded-lg px-3 py-1.5 text-xs dark:text-zinc-300 text-slate-700 focus:outline-none focus:dark:border-[#1F61EF]/60 border-[#5046E5]"
          >
            <option value="ALL">All Contracts ({contracts.length})</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.contractNumber} - {c.title.slice(0, 24)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Milestones List */}
      {loading ? (
        <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-12 rounded-2xl flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 dark:text-[#8FB5FF] text-[#5046E5] animate-spin mb-3" />
          <p className="dark:text-zinc-400 text-slate-500 text-sm">Loading contract milestones & deliverables...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      ) : filteredMilestones.length === 0 ? (
        <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-12 rounded-2xl text-center">
          <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold dark:text-white text-slate-900">No milestones found</h3>
          <p className="text-xs dark:text-zinc-400 text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL' || contractFilter !== 'ALL'
              ? 'Try adjusting your search criteria or status filter.'
              : 'Create a contract to generate escrow-protected milestones.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMilestones.map((m) => {
            const isReviewable = m.status === 'SUBMITTED';
            const latestSubmission = m.submissions && m.submissions.length > 0 ? m.submissions[0] : null;

            return (
              <div
                key={m.id}
                className={`interactive-card dark:bg-[#191B25] bg-white border transition rounded-xl p-5 ${
                  isReviewable
                    ? 'dark:border-[#1F61EF]/40 border-[#C7D2FE] shadow-[0_0_15px_rgba(31,97,239,0.06)]'
                    : 'dark:border-[#272B38] border-slate-200 hover:dark:border-[#383d38] hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Info */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded dark:bg-zinc-800 bg-[#EEF2FF] dark:text-zinc-300 text-[#475569] border border-transparent dark:border-transparent border-[#C7D2FE]">
                        Milestone #{m.order}
                      </span>
                      <h3 className="text-base font-semibold dark:text-white text-slate-900">{m.title}</h3>
                      {getStatusBadge(m.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs dark:text-zinc-400 text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1 dark:text-zinc-300 text-slate-700">
                        <FileText className="w-3.5 h-3.5 text-zinc-500" />
                        <button
                          onClick={() => onNavigateToContract?.(m.contractId)}
                          className="hover:dark:text-[#8FB5FF] text-[#5046E5] underline-offset-2 hover:underline transition"
                        >
                          {m.contractNumber} — {m.contractTitle}
                        </button>
                      </span>

                      <span>Specialist: <strong className="dark:text-zinc-200 text-slate-800">{m.workerName}</strong></span>

                      {m.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" />
                          Due: {new Date(m.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {m.description && (
                      <p className="text-xs dark:text-zinc-400 text-slate-500 line-clamp-2 pt-1">{m.description}</p>
                    )}

                    {/* Latest Submission Banner preview if submitted */}
                    {latestSubmission && (
                      <div className="mt-2.5 p-3 rounded-lg dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between dark:text-zinc-300 text-slate-700 font-medium">
                          <span className="flex items-center gap-1.5 dark:text-[#8FB5FF] text-[#5046E5]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Deliverable submitted:
                          </span>
                          <span className="text-zinc-500 text-[11px]">
                            {latestSubmission.createdAt ? new Date(latestSubmission.createdAt).toLocaleString() : 'Recently'}
                          </span>
                        </div>
                        <p className="dark:text-zinc-300 text-slate-700 italic">{latestSubmission.notes || 'Deliverable files submitted for review.'}</p>
                        {latestSubmission.attachmentUrls && latestSubmission.attachmentUrls.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {latestSubmission.attachmentUrls.map((url: string, idx: number) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] dark:text-[#8FB5FF] text-[#5046E5] hover:underline dark:bg-[#1C2740] bg-[#EEF2FF] px-2 py-0.5 rounded border dark:border-[#1F61EF]/20 border-[#C7D2FE]"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Attachment {idx + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Financials & Action Buttons */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 border-t lg:border-t-0 dark:border-[#272B38] border-slate-200 pt-3 lg:pt-0">
                    <div className="text-left lg:text-right">
                      <span className="text-xs text-zinc-500 uppercase tracking-wider block">Escrow Allocation</span>
                      <span className="text-xl font-bold font-mono dark:text-white text-slate-900">
                        ${Number(m.amount).toLocaleString()} <span className="text-xs dark:text-zinc-400 text-slate-500 font-normal">{m.currency}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isWorker ? (
                        <>
                          {m.status === 'PENDING' && (
                            <button
                              onClick={() => handleStartMilestone(m)}
                              disabled={actionLoading === m.id}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg dark:bg-[#1F61EF] bg-[#5046E5] hover:dark:bg-[#78e018] hover:bg-[#4338CA] dark:text-black text-white shadow-md shadow-[#5046E5]/25 text-xs font-bold transition shadow-[0_0_12px_rgba(31,97,239,0.2)]"
                            >
                              <Play className="w-3.5 h-3.5" />
                              {actionLoading === m.id ? 'Starting...' : 'Commence Work'}
                            </button>
                          )}

                          {(m.status === 'IN_PROGRESS' || m.status === 'IN_REVISION') && (
                            <button
                              onClick={() => {
                                setSelectedMilestone(m);
                                setShowSubmissionModal(true);
                              }}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg dark:bg-[#1F61EF] bg-[#5046E5] hover:dark:bg-[#78e018] hover:bg-[#4338CA] dark:text-black text-white shadow-md shadow-[#5046E5]/25 text-xs font-bold transition shadow-[0_0_12px_rgba(31,97,239,0.2)]"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              {m.status === 'IN_REVISION' ? 'Resubmit Work' : 'Submit Deliverable'}
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedMilestone(m)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg dark:bg-[#191B25] bg-slate-50 hover:dark:bg-[#191D2A] hover:bg-slate-100 border dark:border-[#272B38] border-slate-200 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-slate-900 text-xs font-medium transition"
                          >
                            Details
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : isReviewable ? (
                        <>
                          <button
                            onClick={() => {
                              setSelectedMilestone(m);
                              setShowRevisionModal(true);
                            }}
                            disabled={actionLoading === m.id}
                            className="px-3 py-1.5 rounded-lg dark:bg-zinc-800 bg-slate-100 hover:dark:bg-zinc-700 hover:bg-slate-200 dark:text-zinc-200 text-slate-700 border dark:border-zinc-700 border-slate-300 text-xs font-semibold transition"
                          >
                            Request Revision
                          </button>

                          <button
                            onClick={() => handleApprove(m)}
                            disabled={actionLoading === m.id}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg dark:bg-[#1F61EF] bg-[#5046E5] hover:dark:bg-[#78e018] hover:bg-[#4338CA] dark:text-black text-white shadow-md shadow-[#5046E5]/25 text-xs font-bold transition shadow-[0_0_12px_rgba(31,97,239,0.2)]"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {actionLoading === m.id ? 'Approving...' : 'Approve & Release'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setSelectedMilestone(m)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg dark:bg-[#191B25] bg-slate-50 hover:dark:bg-[#191D2A] hover:bg-slate-100 border dark:border-[#272B38] border-slate-200 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-slate-900 text-xs font-medium transition"
                        >
                          View Details
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deliverable Details / Modal */}
      {selectedMilestone && !showRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm w-full max-w-xl rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedMilestone(null)}
              className="absolute top-4 right-4 dark:text-zinc-400 text-slate-500 hover:dark:text-white hover:text-slate-900 p-1 rounded-lg hover:dark:bg-zinc-800 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] flex items-center justify-center dark:text-[#8FB5FF] text-[#5046E5]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs dark:text-zinc-400 text-slate-500 font-mono">Milestone #{selectedMilestone.order}</span>
                <h3 className="text-lg font-bold dark:text-white text-slate-900">{selectedMilestone.title}</h3>
              </div>
            </div>

            <div className="p-4 rounded-xl dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="dark:text-zinc-400 text-slate-500">Contract:</span>
                <span className="font-semibold dark:text-white text-slate-900">{selectedMilestone.contractTitle} ({selectedMilestone.contractNumber})</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="dark:text-zinc-400 text-slate-500">Specialist:</span>
                <span className="font-semibold dark:text-white text-slate-900">{selectedMilestone.workerName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="dark:text-zinc-400 text-slate-500">Escrow Value:</span>
                <span className="font-mono font-bold dark:text-[#8FB5FF] text-[#5046E5]">${Number(selectedMilestone.amount).toLocaleString()} {selectedMilestone.currency}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="dark:text-zinc-400 text-slate-500">Status:</span>
                <div>{getStatusBadge(selectedMilestone.status)}</div>
              </div>
            </div>

            {selectedMilestone.description && (
              <div className="space-y-1">
                <label className="text-xs font-semibold dark:text-zinc-400 text-slate-500 uppercase tracking-wider">Scope & Instructions</label>
                <p className="text-xs dark:text-zinc-300 text-slate-700 dark:bg-[#191B25] bg-slate-50 p-3 rounded-lg border dark:border-[#272B38] border-slate-200">{selectedMilestone.description}</p>
              </div>
            )}

            {/* Submissions list */}
            <div className="space-y-2">
              <label className="text-xs font-semibold dark:text-zinc-400 text-slate-500 uppercase tracking-wider">Submissions History</label>
              {selectedMilestone.submissions && selectedMilestone.submissions.length > 0 ? (
                selectedMilestone.submissions.map((sub: any, idx: number) => (
                  <div key={sub.id || idx} className="p-3 dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-200 rounded-lg text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold dark:text-zinc-200 text-slate-800">Submission #{selectedMilestone.submissions!.length - idx}</span>
                      <span className="text-zinc-500 text-[11px]">{new Date(sub.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="dark:text-zinc-300 text-slate-700">{sub.notes || 'No description provided with this submission.'}</p>
                    {sub.attachmentUrls && sub.attachmentUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {sub.attachmentUrls.map((url: string, aIdx: number) => (
                          <a
                            key={aIdx}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] dark:text-[#8FB5FF] text-[#5046E5] hover:underline dark:bg-[#1C2740] bg-[#EEF2FF] px-2 py-0.5 rounded border dark:border-[#1F61EF]/20 border-[#C7D2FE]"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Deliverable File {aIdx + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500 italic p-3 dark:bg-[#191B25] bg-slate-50 rounded-lg border dark:border-[#272B38] border-slate-200">
                  No deliverables submitted for this milestone yet.
                </p>
              )}
            </div>

            {/* Actions in modal */}
            <div className="flex justify-end gap-2.5 pt-3 border-t dark:border-[#272B38] border-slate-200">
              <button
                onClick={() => setSelectedMilestone(null)}
                className="px-4 py-2 rounded-xl dark:bg-zinc-800 bg-slate-100 hover:dark:bg-zinc-700 hover:bg-slate-200 dark:text-zinc-200 text-slate-700 border dark:border-transparent border-slate-300 text-xs font-semibold"
              >
                Close
              </button>
              {selectedMilestone.status === 'SUBMITTED' && (
                <>
                  <button
                    onClick={() => setShowRevisionModal(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 dark:text-amber-400 border border-amber-500/40 text-xs font-semibold"
                  >
                    Request Revision
                  </button>
                  <button
                    onClick={() => handleApprove(selectedMilestone)}
                    disabled={actionLoading === selectedMilestone.id}
                    className="px-4 py-2 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] hover:dark:bg-[#78e018] hover:bg-[#4338CA] dark:text-black text-white shadow-md shadow-[#5046E5]/25 text-xs font-bold"
                  >
                    {actionLoading === selectedMilestone.id ? 'Approving...' : 'Approve & Release'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revision Request Dialog Modal */}
      {showRevisionModal && selectedMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowRevisionModal(false)}
              className="absolute top-4 right-4 dark:text-zinc-400 text-slate-500 hover:dark:text-white hover:text-slate-900 p-1 rounded-lg hover:dark:bg-zinc-800 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold dark:text-white text-slate-900">Request Milestone Revision</h3>
                <p className="text-xs dark:text-zinc-400 text-slate-500">
                  Provide actionable feedback to the specialist explaining required adjustments.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold dark:text-zinc-300 text-slate-700">
                Revision Details & Feedback <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={4}
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                placeholder="Describe what needs to be changed, added, or verified before approval..."
                className="w-full dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-200 rounded-xl p-3 text-xs dark:text-white text-slate-900 placeholder-zinc-500 focus:outline-none focus:dark:border-[#1F61EF]/60 border-[#5046E5] transition"
              />
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-500 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                Escrow funds remain locked in custody. The milestone status will transition to <strong>REVISION_REQUESTED</strong> and notify the specialist.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t dark:border-[#272B38] border-slate-200">
              <button
                onClick={() => setShowRevisionModal(false)}
                className="px-4 py-2 rounded-xl dark:bg-zinc-800 bg-slate-100 hover:dark:bg-zinc-700 hover:bg-slate-200 dark:text-zinc-200 text-slate-700 border dark:border-transparent border-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestRevision}
                disabled={actionLoading === selectedMilestone.id || !revisionFeedback.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition disabled:opacity-50"
              >
                {actionLoading === selectedMilestone.id ? 'Submitting...' : 'Submit Revision Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Specialist Deliverable Submission Modal (Phase 14 & 15) */}
      {showSubmissionModal && selectedMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowSubmissionModal(false)}
              className="absolute top-4 right-4 dark:text-zinc-400 text-slate-500 hover:dark:text-white hover:text-slate-900 p-1 rounded-lg hover:dark:bg-zinc-800 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] flex items-center justify-center dark:text-[#8FB5FF] text-[#5046E5]">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold dark:text-white text-slate-900">
                  {selectedMilestone.status === 'IN_REVISION' ? 'Resubmit Revised Deliverable' : 'Submit Milestone Deliverable'}
                </h3>
                <p className="text-xs dark:text-zinc-400 text-slate-500">
                  Milestone #{selectedMilestone.order}: {selectedMilestone.title} (${Number(selectedMilestone.amount).toLocaleString()} {selectedMilestone.currency})
                </p>
              </div>
            </div>

            {selectedMilestone.status === 'IN_REVISION' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 text-xs text-amber-500 dark:text-amber-300">
                <span className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Client Requested Changes
                </span>
                <p className="dark:text-zinc-300 text-slate-700">
                  Ensure all requested revisions and feedback from the client have been addressed before submitting.
                </p>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="dark:text-zinc-300 text-slate-700 font-semibold block mb-1">
                  Deliverable Notes & Summary of Work <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="Detail the work completed, feature implementations, and testing outcomes..."
                  className="w-full dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-200 rounded-xl p-3 dark:text-white text-slate-900 placeholder-zinc-500 focus:outline-none focus:dark:border-[#1F61EF]/60 border-[#5046E5]"
                  required
                />
              </div>

              <div>
                <label className="dark:text-zinc-300 text-slate-700 font-semibold block mb-1">
                  Deliverable File Attachment / URL (Supabase Storage / GitHub / Figma)
                </label>
                <input
                  type="url"
                  value={submissionAttachmentUrl}
                  onChange={(e) => setSubmissionAttachmentUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-200 rounded-xl p-2.5 dark:text-white text-slate-900 placeholder-zinc-500 focus:outline-none focus:dark:border-[#1F61EF]/60 border-[#5046E5]"
                />
              </div>
            </div>

            <div className="p-3 dark:bg-[#191B25] bg-slate-50 rounded-xl border dark:border-[#272B38] border-slate-200 flex items-center gap-2 text-xs dark:text-zinc-400 text-slate-500">
              <ShieldCheck className="w-4 h-4 dark:text-[#8FB5FF] text-[#5046E5] flex-shrink-0" />
              <span>Submission will transition the milestone to SUBMITTED and notify the client for escrow release.</span>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t dark:border-[#272B38] border-slate-200">
              <button
                type="button"
                onClick={() => setShowSubmissionModal(false)}
                className="px-4 py-2 rounded-xl dark:bg-zinc-800 bg-slate-100 hover:dark:bg-zinc-700 hover:bg-slate-200 dark:text-zinc-200 text-slate-700 border dark:border-transparent border-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitDeliverable}
                disabled={actionLoading === selectedMilestone.id || !submissionNotes.trim()}
                className="px-5 py-2 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] hover:dark:bg-[#78e018] hover:bg-[#4338CA] dark:text-black text-white shadow-md shadow-[#5046E5]/25 text-xs font-bold transition disabled:opacity-50"
              >
                {actionLoading === selectedMilestone.id ? 'Submitting...' : 'Transmit Deliverable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

