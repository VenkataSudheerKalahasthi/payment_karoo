import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  FileEdit,
  AlertTriangle,
  CheckCircle2,
  Lock,
  History,
  Check,
  XCircle,
  ShieldAlert,
  FileUp,
  ExternalLink,
  ShieldCheck,
  Binary,
  Download,
  RefreshCw,
} from 'lucide-react';
import { apiService } from '../services/api';
import {
  ContractDto,
  DisputeCategory,
  DisputeDetailDto,
  ContractAmendmentDto,
  ContractTerminationRequestDto,
  EscrowActivityDto,
  ContractVersionDto,
  ContractIntegrityReportDto,
  ContractActivityHistoryDto,
  formatCurrencyMinor,
} from '@trustpay/shared';

interface ContractLifecyclePanelProps {
  contract: ContractDto;
  currentUserId: string;
  isClient: boolean;
  isWorker: boolean;
  onRefresh: () => void;
}

export const ContractLifecyclePanel: React.FC<ContractLifecyclePanelProps> = ({
  contract,
  currentUserId,
  isClient: _isClient,
  isWorker: _isWorker,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'disputes' | 'amendments' | 'termination' | 'versions' | 'integrity' | 'activities'>('disputes');
  const [dispute, setDispute] = useState<DisputeDetailDto | null>(null);
  const [amendments, setAmendments] = useState<ContractAmendmentDto[]>([]);
  const [terminations, setTerminations] = useState<ContractTerminationRequestDto[]>([]);
  const [activities, setActivities] = useState<EscrowActivityDto[]>([]);
  const [versions, setVersions] = useState<ContractVersionDto[]>([]);
  const [integrityReport, setIntegrityReport] = useState<ContractIntegrityReportDto | null>(null);
  const [activityHistory, setActivityHistory] = useState<ContractActivityHistoryDto[]>([]);
  const [isAuditingIntegrity, setIsAuditingIntegrity] = useState(false);

  // Dispute form state
  const [showCreateDispute, setShowCreateDispute] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState<DisputeCategory>(DisputeCategory.QUALITY_OF_WORK);
  const [disputeMilestoneId, setDisputeMilestoneId] = useState('');
  const [disputeTitle, setDisputeTitle] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeClaim, setDisputeClaim] = useState('');
  const [statementContent, setStatementContent] = useState('');
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [evidenceFileUrl, setEvidenceFileUrl] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');

  // Amendment form state
  const [showProposeAmendment, setShowProposeAmendment] = useState(false);
  const [amendTitle, setAmendTitle] = useState('');
  const [amendScope, setAmendScope] = useState('');
  const [amendTerms, setAmendTerms] = useState('');
  const [amendReason, setAmendReason] = useState('');

  // Termination form state
  const [showRequestTermination, setShowRequestTermination] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [terminationSettlement, setTerminationSettlement] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLifecycleData = useCallback(async () => {
    if (!contract.id) return;
    try {
      const [disputesRes, amendmentsRes, termRes, actRes, verRes, histRes] = await Promise.all([
        apiService.listDisputes({ contractId: contract.id }),
        apiService.listAmendments(contract.id),
        apiService.listTerminationRequests(contract.id),
        apiService.getEscrowActivities(contract.id),
        apiService.getContractVersions(contract.id),
        apiService.getContractActivityHistory(contract.id),
      ]);

      if (verRes.success && verRes.data) {
        setVersions(verRes.data);
      }
      if (histRes.success && histRes.data) {
        setActivityHistory(histRes.data);
      }

      if (disputesRes.success && disputesRes.data?.items?.[0]) {
        // Fetch detailed active dispute
        const detailRes = await apiService.getDisputeById(disputesRes.data.items[0].id);
        if (detailRes.success && detailRes.data) {
          setDispute(detailRes.data);
        }
      } else {
        setDispute(null);
      }

      if (amendmentsRes.success && amendmentsRes.data) {
        setAmendments(amendmentsRes.data);
      }
      if (termRes.success && termRes.data) {
        setTerminations(termRes.data);
      }
      if (actRes.success && actRes.data) {
        setActivities(actRes.data);
      }
    } catch {
      // Handled silently
    }
  }, [contract.id]);

  useEffect(() => {
    loadLifecycleData();
  }, [loadLifecycleData]);

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeTitle.trim() || !disputeDesc.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const claimMinor = disputeClaim ? Math.round(Number(disputeClaim) * 100) : undefined;
      const res = await apiService.createDispute({
        contractId: contract.id,
        milestoneId: disputeMilestoneId || undefined,
        category: disputeCategory,
        title: disputeTitle.trim(),
        description: disputeDesc.trim(),
        claimedAmountMinor: claimMinor,
      });

      if (res.success && res.data) {
        setDispute(res.data);
        setShowCreateDispute(false);
        setDisputeTitle('');
        setDisputeDesc('');
        setDisputeClaim('');
        setDisputeMilestoneId('');
        setActionMessage('Dispute opened. Escrow funds placed on protective hold.');
        onRefresh();
        await loadLifecycleData();
      } else {
        setErrorMessage(res.error?.message || 'Failed to open dispute');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error creating dispute');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispute || !evidenceFileName.trim() || !evidenceFileUrl.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiService.uploadDisputeEvidence(dispute.id, {
        fileName: evidenceFileName.trim(),
        fileUrl: evidenceFileUrl.trim(),
        fileKey: evidenceFileName.trim().replace(/\s+/g, '-'),
        description: evidenceDescription.trim() || undefined,
      });

      if (res.success) {
        setShowAddEvidence(false);
        setEvidenceFileName('');
        setEvidenceFileUrl('');
        setEvidenceDescription('');
        setActionMessage('Evidence file attached to dispute record.');
        const updated = await apiService.getDisputeById(dispute.id);
        if (updated.success && updated.data) setDispute(updated.data);
      } else {
        setErrorMessage(res.error?.message || 'Failed to attach evidence');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error uploading evidence');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendStatement = async () => {
    if (!dispute || !statementContent.trim()) return;
    setIsLoading(true);
    try {
      const res = await apiService.submitDisputeResponse(dispute.id, statementContent.trim());
      if (res.success) {
        setStatementContent('');
        setActionMessage('Statement added to dispute record.');
        const updated = await apiService.getDisputeById(dispute.id);
        if (updated.success && updated.data) setDispute(updated.data);
      } else {
        setErrorMessage(res.error?.message || 'Failed to submit statement');
      }
    } catch {
      setErrorMessage('Failed to submit statement.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoteResolution = async (resolutionId: string, agree: boolean) => {
    if (!dispute) return;
    setIsLoading(true);
    try {
      const res = await apiService.respondToDisputeResolution(dispute.id, resolutionId, agree);
      if (res.success) {
        setActionMessage(`Resolution decision (${agree ? 'Accepted' : 'Declined'}) recorded.`);
        onRefresh();
        await loadLifecycleData();
      } else {
        setErrorMessage(res.error?.message || 'Failed to record decision');
      }
    } catch {
      setErrorMessage('Failed to vote on proposed settlement.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProposeAmendment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendReason.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiService.proposeAmendment(contract.id, {
        titleChange: amendTitle.trim() || undefined,
        scopeChange: amendScope.trim() || undefined,
        termsChange: amendTerms.trim() || undefined,
        reason: amendReason.trim(),
      });

      if (res.success) {
        setShowProposeAmendment(false);
        setActionMessage('Amendment proposal sent for counterparty review.');
        onRefresh();
        await loadLifecycleData();
      } else {
        setErrorMessage(res.error?.message || 'Failed to propose amendment');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error proposing amendment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoteAmendment = async (amendmentId: string, accept: boolean) => {
    setIsLoading(true);
    try {
      const res = await apiService.respondToAmendment(contract.id, amendmentId, { accept });
      if (res.success) {
        setActionMessage(`Amendment ${accept ? 'Accepted! Contract updated to new version.' : 'Declined.'}`);
        onRefresh();
        await loadLifecycleData();
      } else {
        setErrorMessage(res.error?.message || 'Failed to respond to amendment');
      }
    } catch {
      setErrorMessage('Failed to process amendment vote.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProposeTermination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminationReason.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const settlementMinor = terminationSettlement ? Math.round(Number(terminationSettlement) * 100) : undefined;
      const res = await apiService.proposeTermination(contract.id, {
        reason: terminationReason.trim(),
        proposedSettlementMinor: settlementMinor,
      });

      if (res.success) {
        setShowRequestTermination(false);
        setActionMessage('Termination request submitted for counterparty review.');
        onRefresh();
        await loadLifecycleData();
      } else {
        setErrorMessage(res.error?.message || 'Failed to propose termination');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error requesting termination');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoteTermination = async (requestId: string, accept: boolean) => {
    setIsLoading(true);
    try {
      const res = await apiService.respondToTermination(contract.id, requestId, { accept });
      if (res.success) {
        setActionMessage(`Termination request ${accept ? 'Accepted. Contract cancelled.' : 'Declined.'}`);
        onRefresh();
        await loadLifecycleData();
      } else {
        setErrorMessage(res.error?.message || 'Failed to respond to termination');
      }
    } catch {
      setErrorMessage('Failed to process termination response.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunIntegrityAudit = async () => {
    setIsAuditingIntegrity(true);
    setErrorMessage(null);
    try {
      const res = await apiService.verifyContractIntegrity(contract.id);
      if (res.success && res.data) {
        setIntegrityReport(res.data);
        setActionMessage(
          res.data.isTamperFree
            ? 'Cryptographic integrity check passed: Zero tampering detected.'
            : 'Alert: Document hash or milestone allocation divergence detected!',
        );
      } else {
        setErrorMessage(res.error?.message || 'Failed to complete integrity audit');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error executing cryptographic audit');
    } finally {
      setIsAuditingIntegrity(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
      {/* Alert Notices */}
      {actionMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-500 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Tabs Row */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2.5 text-xs">
        <button
          onClick={() => setActiveTab('disputes')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition ${
            activeTab === 'disputes'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Disputes {dispute ? '(1 Active)' : ''}</span>
        </button>

        <button
          onClick={() => setActiveTab('amendments')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition ${
            activeTab === 'amendments'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          <FileEdit className="w-3.5 h-3.5" />
          <span>Amendments ({amendments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('termination')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition ${
            activeTab === 'termination'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Termination</span>
        </button>

        <button
          onClick={() => setActiveTab('versions')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition ${
            activeTab === 'versions'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Versions ({versions.length || 1})</span>
        </button>

        <button
          onClick={() => setActiveTab('integrity')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition ${
            activeTab === 'integrity'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Integrity & Hash</span>
        </button>

        <button
          onClick={() => setActiveTab('activities')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition ${
            activeTab === 'activities'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white bg-slate-800/60'
          }`}
        >
          <Binary className="w-3.5 h-3.5" />
          <span>Audit Log ({activityHistory.length || activities.length})</span>
        </button>
      </div>

      {/* 1. DISPUTES TAB */}
      {activeTab === 'disputes' && (
        <div className="space-y-4">
          {dispute ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-rose-400 text-xs">{dispute.disputeNumber}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                      {dispute.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white mt-1">{dispute.title}</h4>
                  <p className="text-[11px] text-slate-300">{dispute.description}</p>
                </div>
                {dispute.disputeHoldActive && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30 self-start sm:self-auto">
                    <Lock className="w-3 h-3" />
                    <span>ESCROW HOLD ACTIVE</span>
                  </span>
                )}
              </div>

              {/* Resolution Proposals */}
              {dispute.resolutions && dispute.resolutions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Settlement Proposals
                  </span>
                  {dispute.resolutions.map((res) => (
                    <div key={res.id} className="p-3 rounded-lg bg-slate-800/70 border border-slate-700 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-blue-300">
                          {res.resolutionType.replace(/_/g, ' ')} ({res.status})
                        </span>
                        <span className="text-slate-400 text-[10px]">{new Date(res.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{res.rationale}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700">
                        <div>
                          Client Share: <span className="font-mono text-white">{formatCurrencyMinor(res.clientAmountMinor)}</span> |{' '}
                          Worker Share: <span className="font-mono text-white">{formatCurrencyMinor(res.workerAmountMinor)}</span>
                        </div>
                        {res.status === 'PROPOSED' && (
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => handleVoteResolution(res.id, true)}
                              disabled={isLoading}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px]"
                            >
                              Agree
                            </button>
                            <button
                              onClick={() => handleVoteResolution(res.id, false)}
                              disabled={isLoading}
                              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[10px]"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Statements Timeline */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Dispute Discussion Thread
                </span>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {dispute.responses.map((r) => (
                    <div key={r.id} className="p-2.5 rounded bg-slate-800/40 border border-slate-800 text-[11px] space-y-0.5">
                      <div className="flex justify-between text-slate-400">
                        <span className="font-semibold text-slate-300">{r.authorName} ({r.authorRole})</span>
                        <span>{new Date(r.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-200">{r.content}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="text"
                    placeholder="Submit formal statement or evidence reference..."
                    value={statementContent}
                    onChange={(e) => setStatementContent(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500"
                  />
                  <button
                    onClick={handleSendStatement}
                    disabled={isLoading || !statementContent.trim()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Evidence Documents Section */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Dispute Evidence &amp; Attachments ({dispute.evidence?.length || 0})
                  </span>
                  {!showAddEvidence && (
                    <button
                      type="button"
                      onClick={() => setShowAddEvidence(true)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-[10px] font-medium border border-slate-700 flex items-center space-x-1"
                    >
                      <FileUp className="w-3 h-3" />
                      <span>Attach Evidence</span>
                    </button>
                  )}
                </div>

                {dispute.evidence && dispute.evidence.length > 0 ? (
                  <div className="space-y-1.5">
                    {dispute.evidence.map((ev) => (
                      <div key={ev.id} className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-white">{ev.fileName}</span>
                            <span className="text-[10px] text-slate-500">by {ev.uploaderName}</span>
                          </div>
                          {ev.description && <p className="text-[11px] text-slate-400">{ev.description}</p>}
                        </div>
                        <a
                          href={ev.downloadUrl || ev.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-[11px] border border-slate-700 flex items-center space-x-1 shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>View Evidence</span>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">No formal evidence attachments recorded yet.</p>
                )}

                {showAddEvidence && (
                  <form onSubmit={handleAddEvidence} className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 space-y-2 text-xs">
                    <span className="font-semibold text-white text-xs block">Submit New Evidence</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">File or Document Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. TestReport.pdf or PR-102"
                          value={evidenceFileName}
                          onChange={(e) => setEvidenceFileName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">File URL / Evidence Link *</label>
                        <input
                          type="url"
                          placeholder="https://..."
                          value={evidenceFileUrl}
                          onChange={(e) => setEvidenceFileUrl(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Description / Context</label>
                      <input
                        type="text"
                        placeholder="Brief note about this evidence..."
                        value={evidenceDescription}
                        onChange={(e) => setEvidenceDescription(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs"
                      />
                    </div>
                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddEvidence(false)}
                        className="px-2.5 py-1 rounded bg-slate-700 text-slate-300 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                      >
                        Attach
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <p className="text-xs text-slate-400">
                No disputes have been raised. If deliverables do not match contract requirements, contract participants can initiate mediation.
              </p>
              {!showCreateDispute && contract.status === 'ACTIVE' && (
                <button
                  onClick={() => setShowCreateDispute(true)}
                  className="px-4 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold inline-flex items-center space-x-1.5 transition"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Raise Formal Dispute</span>
                </button>
              )}
            </div>
          )}

          {/* Create Dispute Form */}
          {showCreateDispute && (
            <form onSubmit={handleCreateDispute} className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3 text-xs">
              <h4 className="font-bold text-white text-xs">Initiate Formal Contract Dispute</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Dispute Category *</label>
                  <select
                    value={disputeCategory}
                    onChange={(e) => setDisputeCategory(e.target.value as DisputeCategory)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200"
                  >
                    {Object.values(DisputeCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Claimed Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 500"
                    value={disputeClaim}
                    onChange={(e) => setDisputeClaim(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Dispute Summary *</label>
                <input
                  type="text"
                  placeholder="Summary of grievance (min 5 chars)..."
                  value={disputeTitle}
                  onChange={(e) => setDisputeTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Detailed Findings &amp; Evidence Description *</label>
                <textarea
                  rows={3}
                  placeholder="Explain why requirements were missed, breached, or disputed (min 20 chars)..."
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateDispute(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center space-x-1"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>{isLoading ? 'Submitting...' : 'File Dispute'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 2. AMENDMENTS TAB */}
      {activeTab === 'amendments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Contract Version Amendments</span>
            {!showProposeAmendment && contract.status === 'ACTIVE' && (
              <button
                onClick={() => setShowProposeAmendment(true)}
                className="px-3 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-medium"
              >
                + Propose Amendment
              </button>
            )}
          </div>

          {amendments.length === 0 && !showProposeAmendment ? (
            <p className="text-xs text-slate-500 italic text-center py-4">
              No amendments proposed. Both parties are operating on Contract v{contract.version}.
            </p>
          ) : (
            <div className="space-y-2">
              {amendments.map((amd) => {
                const isProposer = amd.proposedById === currentUserId;
                return (
                  <div key={amd.id} className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-blue-400">{amd.amendmentNumber}</span>
                        <span className="text-[10px] text-slate-400">Proposed v{amd.proposedVersion}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            amd.status === 'ACCEPTED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : amd.status === 'REJECTED'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {amd.status}
                        </span>
                      </div>
                      <span className="text-slate-400 text-[10px]">{new Date(amd.createdAt).toLocaleDateString()}</span>
                    </div>

                    <p className="text-slate-300">{amd.reason}</p>

                    {amd.status === 'PENDING_REVIEW' && !isProposer && (
                      <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-700">
                        <button
                          onClick={() => handleVoteAmendment(amd.id, true)}
                          disabled={isLoading}
                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Accept &amp; Increment Version</span>
                        </button>
                        <button
                          onClick={() => handleVoteAmendment(amd.id, false)}
                          disabled={isLoading}
                          className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center space-x-1"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Decline</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Propose Amendment Form */}
          {showProposeAmendment && (
            <form onSubmit={handleProposeAmendment} className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3 text-xs">
              <h4 className="font-bold text-white text-xs">Propose Contract Amendment</h4>
              <div>
                <label className="block text-slate-300 mb-1">Amended Title (Optional)</label>
                <input
                  type="text"
                  placeholder={contract.title}
                  value={amendTitle}
                  onChange={(e) => setAmendTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Updated Scope of Work (Optional)</label>
                <textarea
                  rows={2}
                  placeholder={contract.scopeOfWork || 'Additional scope requirements...'}
                  value={amendScope}
                  onChange={(e) => setAmendScope(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Updated Contract Terms (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional contractual terms or stipulations..."
                  value={amendTerms}
                  onChange={(e) => setAmendTerms(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Justification Reason *</label>
                <textarea
                  rows={2}
                  placeholder="Explain why this amendment is necessary..."
                  value={amendReason}
                  onChange={(e) => setAmendReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowProposeAmendment(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Submit Proposal
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 3. TERMINATION TAB */}
      {activeTab === 'termination' && (
        <div className="space-y-4 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-300">Early Termination Workflows</span>
            {!showRequestTermination && contract.status === 'ACTIVE' && (
              <button
                onClick={() => setShowRequestTermination(true)}
                className="px-3 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-medium"
              >
                Request Termination
              </button>
            )}
          </div>

          {terminations.length === 0 && !showRequestTermination ? (
            <p className="text-slate-500 italic text-center py-4">No early termination requests on file.</p>
          ) : (
            <div className="space-y-2">
              {terminations.map((t) => (
                <div key={t.id} className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-200">Initiated by {t.initiatorName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">{t.status}</span>
                  </div>
                  <p className="text-slate-300">{t.reason}</p>
                  {t.status === 'PENDING_REVIEW' && t.initiatedById !== currentUserId && (
                    <div className="flex justify-end space-x-2 pt-2 border-t border-slate-700">
                      <button
                        onClick={() => handleVoteTermination(t.id, true)}
                        disabled={isLoading}
                        className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                      >
                        Accept Termination
                      </button>
                      <button
                        onClick={() => handleVoteTermination(t.id, false)}
                        disabled={isLoading}
                        className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white font-semibold"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showRequestTermination && (
            <form onSubmit={handleProposeTermination} className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3">
              <h4 className="font-bold text-white">Request Mutual Early Contract Termination</h4>
              <div>
                <label className="block text-slate-300 mb-1">Reason for Termination *</label>
                <textarea
                  rows={3}
                  placeholder="Detail the circumstances necessitating early cancellation..."
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Proposed Settlement Amount ($) (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={terminationSettlement}
                  onChange={(e) => setTerminationSettlement(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRequestTermination(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                >
                  Submit Request
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 4. VERSIONS TAB */}
      {activeTab === 'versions' && (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">Monotonically Increasing Version Snapshots</span>
            <span className="text-[11px] text-slate-400">Current: v{contract.version}</span>
          </div>

          {versions.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-800 text-center text-slate-400">
              <p>Current Version: v{contract.version}</p>
              <p className="text-[11px] text-slate-500 mt-1">Initial contract version snapshot active.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {versions.map((v) => (
                <div key={v.id} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px]">
                        v{v.version}
                      </span>
                      <span className="font-semibold text-white">{v.title}</span>
                      {v.version === contract.version && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">${v.totalAmount.toLocaleString()} {v.currency}</span>
                  </div>

                  <p className="text-slate-300 text-[11px]">{v.description}</p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800 gap-1">
                    <span className="font-mono truncate max-w-xs" title={v.documentHash}>
                      SHA-256: {v.documentHash.slice(0, 20)}...
                    </span>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span>Reason: {v.versionReason}</span>
                      <a
                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/contracts/${contract.id}/pdf?version=${v.version}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>PDF</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. INTEGRITY & CRYPTOGRAPHIC HASH TAB */}
      {activeTab === 'integrity' && (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-200">Cryptographic Integrity Audit</span>
              <p className="text-[11px] text-slate-400">Deterministic SHA-256 canonical hash comparison & tamper detection</p>
            </div>
            <button
              onClick={handleRunIntegrityAudit}
              disabled={isAuditingIntegrity}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold flex items-center space-x-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAuditingIntegrity ? 'animate-spin' : ''}`} />
              <span>{isAuditingIntegrity ? 'Auditing...' : 'Run Audit'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2 font-mono text-[11px]">
            <div className="space-y-1">
              <span className="text-slate-400 font-sans text-xs">Authoritative Stored Hash:</span>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 break-all text-slate-300">
                {contract.documentHash || 'Hash pending bilateral sign-off'}
              </div>
            </div>

            {integrityReport && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="font-sans text-xs text-slate-400">Audit Status:</span>
                  {integrityReport.isTamperFree ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>CRYPTOGRAPHICALLY VERIFIED & TAMPER-FREE</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>INTEGRITY VIOLATION / HASH DIVERGENCE</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-sans">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Milestone Total vs Contract:</span>
                    <p className="font-bold text-white mt-0.5">
                      ${integrityReport.details.totalMilestoneAmount.toLocaleString()} vs ${integrityReport.details.contractTotalAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Acceptances:</span>
                    <p className="font-bold text-white mt-0.5">
                      Client: {integrityReport.details.clientAccepted ? '✓ Signed' : 'Pending'} • Specialist: {integrityReport.details.workerAccepted ? '✓ Signed' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. ESCROW & CONTRACT AUDIT LOG TAB */}
      {activeTab === 'activities' && (
        <div className="space-y-2 text-xs">
          <span className="font-semibold text-slate-300">Chronological Contract Activity History</span>
          {activityHistory.length === 0 && activities.length === 0 ? (
            <p className="text-slate-500 italic text-center py-4">No activity events recorded yet.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {(activityHistory.length > 0 ? activityHistory : activities).map((item) => {
                const isActLog = 'action' in item;
                const title = isActLog ? (item as ContractActivityHistoryDto).action : (item as EscrowActivityDto).eventType;
                const desc = isActLog ? JSON.stringify((item as ContractActivityHistoryDto).details || {}) : (item as EscrowActivityDto).description;
                const date = new Date(item.createdAt).toLocaleString();
                return (
                  <div key={item.id} className="p-2.5 rounded bg-slate-800/40 border border-slate-800 space-y-0.5">
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span className="font-bold text-slate-200">{title}</span>
                      <span>{date}</span>
                    </div>
                    <p className="text-slate-300 font-mono text-[10px] truncate">{desc}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
