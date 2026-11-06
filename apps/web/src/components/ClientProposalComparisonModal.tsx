import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, ArrowRightLeft, Star, Users, DollarSign, Calendar, FileText, Check, ShieldCheck, MessageSquare } from 'lucide-react';
import { apiService } from '../services/api';
import { JobPostDto, JobProposalDto } from '@trustpay/shared';

interface Props {
  job: JobPostDto;
  isOpen: boolean;
  onClose: () => void;
  onProposalAccepted: () => void;
  onStartChat?: (specialistUserId: string) => void;
}

export const ClientProposalComparisonModal: React.FC<Props> = ({ job, isOpen, onClose, onProposalAccepted, onStartChat }) => {
  const [proposals, setProposals] = useState<JobProposalDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<JobProposalDto | null>(null);

  // Counteroffer form state
  const [isCounteroffering, setIsCounteroffering] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterTimeline, setCounterTimeline] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const res = await apiService.listJobProposals(job.id, false);
      if (res.success && res.data) {
        setProposals(res.data);
        if (res.data.length > 0 && !selectedProposal) {
          setSelectedProposal(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProposals();
    }
  }, [isOpen, job.id]);

  if (!isOpen) return null;

  const handleAccept = async (proposalId: string) => {
    setSubmitting(true);
    try {
      const res = await apiService.acceptProposal(proposalId);
      if (res.success) {
        setActionMessage('Proposal accepted successfully! You can now initialize the escrow contract.');
        onProposalAccepted();
        fetchProposals();
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Failed to accept proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async (proposalId: string) => {
    if (!confirm('Are you sure you want to decline this proposal? It will be removed from your active review list.')) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiService.declineProposal(proposalId);
      if (res.success) {
        fetchProposals();
        setSelectedProposal(null);
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Failed to decline proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendCounteroffer = async () => {
    if (!selectedProposal || !counterAmount || !counterMessage) return;
    setSubmitting(true);
    try {
      const res = await apiService.submitCounteroffer(selectedProposal.id, {
        proposedAmount: parseFloat(counterAmount),
        timeline: counterTimeline || undefined,
        message: counterMessage,
      });
      if (res.success) {
        setIsCounteroffering(false);
        setCounterAmount('');
        setCounterMessage('');
        fetchProposals();
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Failed to submit counteroffer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleShortlist = async (proposalId: string) => {
    try {
      await apiService.toggleShortlistProposal(proposalId);
      fetchProposals();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="dark:bg-[#121212] bg-white border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] rounded-2xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl dark:text-[#CDCBCA] text-[#242424] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5046E5] dark:text-[#8BFF24]">
              Candidate Proposal Review & Comparison
            </span>
            <h3 className="text-base font-extrabold dark:text-[#E8EAE6] text-[#111827]">
              {job.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg dark:hover:bg-[#202020] hover:bg-slate-100 dark:text-[#A5AAA2] text-[#64748B] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {actionMessage && (
          <div className="m-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-500 font-semibold flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-xs font-bold cursor-pointer underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Main Content: Left Column Proposals List + Right Column Comparison & Action */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden text-xs">
          {/* Left Proposals Sidebar */}
          <div className="w-full md:w-80 border-r dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] overflow-y-auto p-3 space-y-2 shrink-0">
            <div className="flex items-center justify-between pb-2 text-[11px] font-semibold dark:text-[#A5AAA2] text-[#64748B]">
              <span>Applications ({proposals.length})</span>
              <span>Sorted by Shortlist</span>
            </div>

            {loading ? (
              <div className="p-6 text-center dark:text-[#777777] text-[#94A3B8]">Loading candidate proposals...</div>
            ) : proposals.length === 0 ? (
              <div className="p-6 text-center dark:text-[#777777] text-[#94A3B8]">No active applications received yet.</div>
            ) : (
              proposals.map((p) => {
                const isSelected = selectedProposal?.id === p.id;
                const isTeam = p.proposalType === 'TEAM';
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProposal(p);
                      setIsCounteroffering(false);
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer space-y-2 ${
                      isSelected
                        ? 'dark:bg-[#1E221E] bg-[#EEF2FF] dark:border-[#8BFF24] border-[#5046E5] shadow-sm'
                        : 'dark:bg-[#171717] bg-[#F8FAFC] dark:border-[rgba(255,255,255,0.06)] border-[#E2E8F0] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold dark:text-[#E8EAE6] text-[#111827] truncate">
                        {isTeam ? p.team?.name || 'Specialist Team' : `${p.worker?.firstName || ''} ${p.worker?.lastName || 'Specialist'}`}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          p.status === 'ACCEPTED'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : p.status === 'UNDER_REVISION'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="font-extrabold dark:text-[#8BFF24] text-[#5046E5]">
                        ${Number(p.proposedAmount).toLocaleString()} {p.currency}
                      </span>
                      <span className="text-[10px] dark:text-[#A5AAA2] text-[#64748B]">
                        {p.estimatedTimeline || 'Flexible'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] dark:text-[#A5AAA2] text-[#64748B] pt-1 border-t dark:border-[rgba(255,255,255,0.05)] border-[#E2E8F0]">
                      <span className="flex items-center space-x-1">
                        {isTeam ? <Users className="w-3 h-3 text-purple-400" /> : <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                        <span>{isTeam ? `Team (${p.team?.members?.length || 0})` : `${p.worker?.workerProfile?.rating || '5.0'} / 5.0`}</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleShortlist(p.id);
                        }}
                        className={`hover:scale-110 transition ${p.isShortlisted ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
                      >
                        ★ {p.isShortlisted ? 'Shortlisted' : 'Shortlist'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Proposal Detail & Actions */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {selectedProposal ? (
              <div className="space-y-5">
                {/* Applicant Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl dark:bg-[#181818] bg-slate-50 border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">
                      {selectedProposal.proposalType === 'TEAM' ? 'Team Lead Submission' : 'Individual Specialist'}
                    </span>
                    <h3 className="text-base font-bold dark:text-[#E8EAE6] text-[#111827]">
                      {selectedProposal.proposalType === 'TEAM'
                        ? selectedProposal.team?.name
                        : `${selectedProposal.worker?.firstName} ${selectedProposal.worker?.lastName}`}
                    </h3>
                    <p className="text-xs dark:text-[#A5AAA2] text-[#64748B]">
                      {selectedProposal.worker?.workerProfile?.headline || 'Verified Professional Specialist'}
                    </p>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-lg font-black dark:text-[#8BFF24] text-[#5046E5] tabular-nums">
                      ${Number(selectedProposal.proposedAmount).toLocaleString()} {selectedProposal.currency}
                    </div>
                    <div className="text-[11px] dark:text-[#A5AAA2] text-[#64748B]">
                      Est. Timeline: {selectedProposal.estimatedTimeline || 'Standard'}
                    </div>
                  </div>
                </div>

                {/* Cover Letter & Approach */}
                <div className="space-y-1.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider dark:text-[#CDCBCA] text-[#475569]">
                    Cover Letter & Scope Pitch
                  </h4>
                  <div className="p-3.5 rounded-xl dark:bg-[#151515] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] leading-relaxed dark:text-[#CDCBCA] text-[#334155]">
                    {selectedProposal.coverLetter}
                  </div>
                </div>

                {selectedProposal.workApproach && (
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-xs uppercase tracking-wider dark:text-[#CDCBCA] text-[#475569]">
                      Work Methodology & Approach
                    </h4>
                    <div className="p-3.5 rounded-xl dark:bg-[#151515] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] leading-relaxed dark:text-[#CDCBCA] text-[#334155]">
                      {selectedProposal.workApproach}
                    </div>
                  </div>
                )}

                {/* Team Members Breakdown if Team Proposal */}
                {selectedProposal.proposalType === 'TEAM' && selectedProposal.team && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-purple-400 flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>Proposed Team Composition ({selectedProposal.team.members?.length || 0} Members)</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedProposal.team.members?.map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-xl dark:bg-[#1A1A1A] bg-white border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold dark:text-[#E8EAE6] text-[#111827]">
                              {m.worker?.firstName} {m.worker?.lastName}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                              {m.role}
                            </span>
                          </div>
                          <div className="text-[10px] dark:text-[#A5AAA2] text-[#64748B]">
                            {m.responsibility || 'Project Contributor'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Versioned Negotiation History */}
                {selectedProposal.negotiations && selectedProposal.negotiations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#5046E5] dark:text-[#8BFF24] flex items-center space-x-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Negotiation Version History ({selectedProposal.negotiations.length} Versions)</span>
                    </h4>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {selectedProposal.negotiations.map((v) => (
                        <div
                          key={v.id}
                          className="p-2.5 rounded-xl dark:bg-[#161816] bg-slate-50 border dark:border-[rgba(255,255,255,0.06)] border-[#E2E8F0] flex items-center justify-between"
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold text-[11px] dark:text-[#CDCBCA] text-[#111827]">
                              v{v.versionNumber} — {v.counterOfferBy === 'CLIENT' ? 'Client Counteroffer' : 'Specialist Proposal'}
                            </span>
                            <p className="text-[10px] dark:text-[#A5AAA2] text-[#64748B]">{v.message}</p>
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <span className="font-bold dark:text-[#8BFF24] text-[#5046E5]">
                              ${Number(v.proposedAmount).toLocaleString()}
                            </span>
                            <div className="text-[9px] uppercase font-bold text-slate-400">{v.status}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Counteroffer Sub-Form */}
                {isCounteroffering && (
                  <div className="p-4 rounded-xl dark:bg-[#1C1F1C] bg-[#EEF2FF] border dark:border-[rgba(139,255,36,0.3)] border-[#C7D2FE] space-y-3">
                    <h4 className="font-bold text-xs dark:text-[#8BFF24] text-[#5046E5]">
                      Submit Counteroffer & Revised Terms
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-[11px]">Revised Amount ($)</label>
                        <input
                          type="number"
                          value={counterAmount}
                          onChange={(e) => setCounterAmount(e.target.value)}
                          placeholder="e.g. 4500"
                          className="w-full px-3 py-1.5 rounded-lg dark:bg-[#121212] bg-white border dark:border-[rgba(255,255,255,0.15)] border-[#CBD5E1] font-mono tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-[11px]">Revised Timeline</label>
                        <input
                          type="text"
                          value={counterTimeline}
                          onChange={(e) => setCounterTimeline(e.target.value)}
                          placeholder="e.g. 3 weeks"
                          className="w-full px-3 py-1.5 rounded-lg dark:bg-[#121212] bg-white border dark:border-[rgba(255,255,255,0.15)] border-[#CBD5E1]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-semibold text-[11px]">Negotiation Note / Message *</label>
                      <textarea
                        rows={2}
                        value={counterMessage}
                        onChange={(e) => setCounterMessage(e.target.value)}
                        placeholder="Explain rationale for counteroffer terms..."
                        className="w-full px-3 py-1.5 rounded-lg dark:bg-[#121212] bg-white border dark:border-[rgba(255,255,255,0.15)] border-[#CBD5E1]"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsCounteroffering(false)}
                        className="px-3 py-1.5 rounded-lg border dark:border-[rgba(255,255,255,0.15)] border-slate-300 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleSendCounteroffer}
                        className="px-4 py-1.5 rounded-lg bg-[#5046E5] dark:bg-[#8BFF24] text-white dark:text-[#050605] font-bold text-xs cursor-pointer shadow-sm"
                      >
                        {submitting ? 'Submitting...' : 'Send Counteroffer'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Primary Decision Action Bar */}
                <div className="flex flex-wrap items-center justify-between pt-4 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] gap-2">
                  <div className="flex items-center space-x-2">
                    {onStartChat && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onStartChat(selectedProposal.workerId);
                        }}
                        className="px-3.5 py-2 rounded-xl dark:bg-[#8BFF24]/10 bg-[#EEF2FF] border dark:border-[#8BFF24]/30 border-[#C7D2FE] text-xs font-bold dark:text-[#8BFF24] text-[#5046E5] hover:opacity-80 flex items-center space-x-1.5 transition cursor-pointer"
                        title="Chat directly with specialist"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat Specialist</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleDecline(selectedProposal.id)}
                      className="px-3.5 py-2 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Decline Proposal</span>
                    </button>

                    {!isCounteroffering && selectedProposal.status !== 'ACCEPTED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCounteroffering(true);
                          setCounterAmount(selectedProposal.proposedAmount.toString());
                        }}
                        className="px-3.5 py-2 rounded-xl border dark:border-[rgba(255,255,255,0.15)] border-[#E2E8F0] hover:bg-slate-100 dark:hover:bg-[#202020] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Negotiate Terms</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {selectedProposal.status === 'ACCEPTED' ? (
                      <div className="flex items-center space-x-2">
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold text-xs flex items-center space-x-1">
                          <Check className="w-4 h-4" />
                          <span>Accepted — Contract Ready</span>
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleAccept(selectedProposal.id)}
                        className="px-5 py-2 rounded-xl bg-[#5046E5] dark:bg-[#8BFF24] hover:bg-[#4338CA] dark:hover:bg-[#7AE01F] text-white dark:text-[#050605] font-extrabold text-xs flex items-center space-x-2 shadow-lg transition cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Accept Proposal & Enable Contract</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center dark:text-[#777777] text-[#94A3B8]">
                Select a candidate proposal from the left list to review detailed breakdown and negotiate terms.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

