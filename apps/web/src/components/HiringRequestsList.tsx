import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { HiringRequestDto, UserRole } from '@trustpay/shared';
import {
  Send,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  RotateCcw,
  MessageSquare,
  AlertCircle,
  DollarSign,
  Calendar,
} from 'lucide-react';

interface HiringRequestsListProps {
  userRole: UserRole;
  onContractCreated?: () => void;
}

export const HiringRequestsList: React.FC<HiringRequestsListProps> = ({
  userRole,
  onContractCreated,
}) => {
  const [requests, setRequests] = useState<HiringRequestDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRespondId, setActiveRespondId] = useState<string | null>(null);
  const [respondStatus, setRespondStatus] = useState<'ACCEPTED' | 'DECLINED' | 'NEGOTIATION'>('ACCEPTED');
  const [workerResponseNote, setWorkerResponseNote] = useState('');
  const [workerNegotiateBudget, setWorkerNegotiateBudget] = useState('');
  const [activeCounterofferId, setActiveCounterofferId] = useState<string | null>(null);
  const [counterBudget, setCounterBudget] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isClient = userRole === UserRole.CLIENT;
  const isWorker = userRole === UserRole.WORKER;

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiService.listHiringRequests();
      if (res.success && res.data) {
        setRequests(res.data.items);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleWithdraw = async (id: string) => {
    if (!confirm('Are you sure you want to withdraw this hiring proposal?')) return;
    setIsActionLoading(true);
    try {
      const res = await apiService.withdrawHiringRequest(id);
      if (res.success) {
        loadRequests();
      } else {
        alert(res.error?.message || 'Failed to withdraw request');
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRespondSubmit = async () => {
    if (!activeRespondId) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const budget = respondStatus === 'NEGOTIATION' && workerNegotiateBudget ? parseFloat(workerNegotiateBudget) : undefined;
      const res = await apiService.respondHiringRequest(activeRespondId, {
        status: respondStatus,
        workerResponse: workerResponseNote.trim() || undefined,
        proposedBudget: budget,
      });

      if (res.success) {
        setActiveRespondId(null);
        setWorkerResponseNote('');
        setWorkerNegotiateBudget('');
        loadRequests();
      } else {
        setErrorMessage(res.error?.message || 'Failed to respond to proposal');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error responding to proposal');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCounterofferSubmit = async () => {
    if (!activeCounterofferId || !counterMessage.trim()) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const budget = counterBudget ? parseFloat(counterBudget) : undefined;
      const res = await apiService.counterofferHiringRequest(activeCounterofferId, {
        proposedBudget: budget,
        clientMessage: counterMessage.trim(),
      });

      if (res.success) {
        setActiveCounterofferId(null);
        setCounterBudget('');
        setCounterMessage('');
        loadRequests();
      } else {
        setErrorMessage(res.error?.message || 'Failed to submit counteroffer');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error submitting counteroffer');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConvertToContract = async (id: string) => {
    setIsActionLoading(true);
    try {
      const res = await apiService.convertHiringRequestToContract(id);
      if (res.success) {
        alert(`Contract #${res.data?.contractNumber} generated successfully!`);
        loadRequests();
        if (onContractCreated) onContractCreated();
      } else {
        alert(res.error?.message || 'Failed to convert proposal to contract');
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            <span>Pending Response</span>
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#8BFF24]/10 text-[#8BFF24] border border-[rgba(139,255,36,0.25)]">
            <CheckCircle className="w-3 h-3" />
            <span>Accepted</span>
          </span>
        );
      case 'DECLINED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            <span>Declined</span>
          </span>
        );
      case 'WITHDRAWN':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#202220] text-[#A5AAA2] border border-[rgba(255,255,255,0.10)]">
            <RotateCcw className="w-3 h-3" />
            <span>Withdrawn</span>
          </span>
        );
      case 'NEGOTIATION':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#8BFF24]/10 text-[#8BFF24] border border-[rgba(139,255,36,0.25)]">
            <MessageSquare className="w-3 h-3" />
            <span>Terms Negotiation</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold dark:text-[#E8EAE6] text-[#111827] tracking-tight">
            {isClient ? 'Sent Hiring Proposals' : 'Received Hiring Proposals'}
          </h3>
          <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] mt-1">
            {isClient
              ? 'Track the status of your specialist proposals and convert accepted terms into active digital escrow contracts.'
              : 'Review client project proposals, accept terms, or request negotiation before digital contracts are formalized.'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center dark:text-[#A5AAA2] text-[#64748B] text-sm dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] rounded-xl animate-pulse font-mono">
          Querying proposal pipeline...
        </div>
      ) : requests.length === 0 ? (
        <div className="dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] rounded-xl p-16 text-center dark:text-[#A5AAA2] text-[#64748B] text-sm shadow-sm">
          No hiring proposals recorded yet.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const party = isClient ? req.worker : req.client;
            const partyName = party?.firstName
              ? `${party.firstName} ${party.lastName || ''}`.trim()
              : party?.email || 'User';

            return (
              <div
                key={req.id}
                className="dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] rounded-xl p-5 hover:border-[rgba(139,255,36,0.4)] transition-all space-y-4 shadow-sm group"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h4 className="text-base font-bold dark:text-[#E8EAE6] text-[#111827]">{req.title}</h4>
                      {getStatusBadge(req.status)}
                    </div>
                    <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] mt-1">
                      {isClient ? 'Proposed to specialist: ' : 'From client: '}
                      <span className="text-[#8BFF24] dark:text-[#8BFF24] font-semibold">{partyName}</span>
                      <span className="text-[#6A6F68] ml-2 font-mono">({party?.email})</span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl dark:bg-[#202220] bg-[#EFF6FF] border dark:border-[rgba(139,255,36,0.25)] border-[#DBEAFE] dark:text-[#8BFF24] text-[#2563EB] font-bold text-sm font-mono tabular-nums">
                      <DollarSign className="w-4 h-4" />
                      <span>{Number(req.proposedBudget).toLocaleString()}</span>
                      <span className="text-xs font-normal dark:text-[#A5AAA2] text-[#64748B]">{req.currency}</span>
                    </span>
                  </div>
                </div>

                <p className="text-xs dark:text-[#E8EAE6] text-[#242424] leading-relaxed dark:bg-[#202220] bg-[#F8FAFC] p-3.5 rounded-xl border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0]">
                  {req.description}
                </p>

                {/* Dates & Skills Bar */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-[#A5AAA2] pt-1">
                  {req.proposedStartDate && (
                    <span className="flex items-center space-x-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-[#6A6F68]" />
                      <span>Starts: {new Date(req.proposedStartDate).toLocaleDateString()}</span>
                    </span>
                  )}

                  {req.expectedCompletionDate && (
                    <span className="flex items-center space-x-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-[#6A6F68]" />
                      <span>Due: {new Date(req.expectedCompletionDate).toLocaleDateString()}</span>
                    </span>
                  )}

                  {req.requiredSkills && req.requiredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {req.requiredSkills.map((sk, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-[#202220] text-[10px] text-[#E8EAE6] border border-[rgba(255,255,255,0.08)]"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes Feed */}
                {req.clientMessage && (
                  <div className="text-xs bg-[#202220] p-3 rounded-xl border border-[rgba(255,255,255,0.08)] text-[#E8EAE6]">
                    <span className="font-semibold text-[#8BFF24]">Client Note: </span>
                    <span>{req.clientMessage}</span>
                  </div>
                )}

                {req.workerResponse && (
                  <div className="text-xs bg-[#8BFF24]/10 p-3 rounded-xl border border-[rgba(139,255,36,0.25)] text-[#E8EAE6]">
                    <span className="font-semibold text-[#8BFF24]">Specialist Response: </span>
                    <span>{req.workerResponse}</span>
                  </div>
                )}

                {/* Actions Bar */}
                <div className="pt-3 border-t border-[rgba(255,255,255,0.08)] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] text-[#6A6F68] font-mono">
                    Sent {new Date(req.createdAt).toLocaleString()}
                    {req.respondedAt && ` • Responded ${new Date(req.respondedAt).toLocaleString()}`}
                  </span>

                  <div className="flex items-center space-x-2">
                    {/* Client Actions */}
                    {isClient && req.status === 'NEGOTIATION' && (
                      <button
                        onClick={() => {
                          setActiveCounterofferId(req.id);
                          setCounterBudget(req.proposedBudget ? req.proposedBudget.toString() : '');
                          setCounterMessage('');
                          setErrorMessage(null);
                        }}
                        disabled={isActionLoading}
                        className="px-3.5 py-1.5 rounded-xl bg-[#8BFF24] hover:bg-[#A3FF50] text-xs font-bold text-[#050605] flex items-center space-x-1 shadow-[0_0_15px_rgba(139,255,36,0.2)] transition active:scale-95"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Counteroffer Terms</span>
                      </button>
                    )}

                    {isClient && (req.status === 'PENDING' || req.status === 'NEGOTIATION') && (
                      <button
                        onClick={() => handleWithdraw(req.id)}
                        disabled={isActionLoading}
                        className="px-3 py-1.5 rounded-xl bg-[#202220] hover:bg-[#292C28] text-xs font-semibold text-[#E8EAE6] border border-[rgba(255,255,255,0.10)] transition"
                      >
                        Withdraw
                      </button>
                    )}

                    {isClient && req.status === 'ACCEPTED' && !req.contractId && (
                      <button
                        onClick={() => handleConvertToContract(req.id)}
                        disabled={isActionLoading}
                        className="px-4 py-1.5 rounded-xl bg-[#8BFF24] hover:bg-[#A3FF50] text-xs font-bold text-[#050605] flex items-center space-x-1.5 shadow-[0_0_15px_rgba(139,255,36,0.25)] transition active:scale-95 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Convert to Contract Draft</span>
                      </button>
                    )}

                    {req.contractId && (
                      <span className="text-xs text-[#8BFF24] font-medium px-2.5 py-1 rounded-full bg-[#8BFF24]/10 border border-[rgba(139,255,36,0.25)] font-mono">
                        ✓ Contract Generated
                      </span>
                    )}

                    {/* Worker Actions */}
                    {isWorker && (req.status === 'PENDING' || req.status === 'NEGOTIATION') && (
                      <button
                        onClick={() => {
                          setActiveRespondId(req.id);
                          setRespondStatus('ACCEPTED');
                          setWorkerResponseNote('');
                        }}
                        className="px-4 py-1.5 rounded-xl bg-[#8BFF24] hover:bg-[#A3FF50] text-xs font-bold text-[#050605] flex items-center space-x-1 shadow-[0_0_15px_rgba(139,255,36,0.2)] transition active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Respond to Proposal</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Worker Respond Modal */}
      {activeRespondId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#151715] border border-[rgba(255,255,255,0.10)] rounded-2xl max-w-md w-full p-6 space-y-4 text-[#E8EAE6] shadow-2xl">
            <h3 className="text-base font-bold text-[#E8EAE6]">Respond to Proposal</h3>
            <p className="text-xs text-[#A5AAA2]">
              Select your decision regarding this project proposal. You may also propose modified terms.
            </p>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#E8EAE6] mb-1">Decision</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRespondStatus('ACCEPTED')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition ${
                      respondStatus === 'ACCEPTED'
                        ? 'bg-[#8BFF24] text-[#050605] border-[#8BFF24] shadow-[0_0_10px_rgba(139,255,36,0.3)]'
                        : 'bg-[#202220] border-[rgba(255,255,255,0.10)] text-[#A5AAA2] hover:text-[#E8EAE6]'
                    }`}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => setRespondStatus('NEGOTIATION')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition ${
                      respondStatus === 'NEGOTIATION'
                        ? 'bg-[#8BFF24]/20 border-[#8BFF24] text-[#8BFF24]'
                        : 'bg-[#202220] border-[rgba(255,255,255,0.10)] text-[#A5AAA2] hover:text-[#E8EAE6]'
                    }`}
                  >
                    Negotiate
                  </button>
                  <button
                    type="button"
                    onClick={() => setRespondStatus('DECLINED')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition ${
                      respondStatus === 'DECLINED'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                        : 'bg-[#202220] border-[rgba(255,255,255,0.10)] text-[#A5AAA2] hover:text-[#E8EAE6]'
                    }`}
                  >
                    Decline
                  </button>
                </div>
              </div>

              {respondStatus === 'NEGOTIATION' && (
                <div>
                  <label className="block text-xs font-semibold text-[#E8EAE6] mb-1">
                    Proposed Counter Budget ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={workerNegotiateBudget}
                    onChange={(e) => setWorkerNegotiateBudget(e.target.value)}
                    placeholder="Enter revised proposed budget"
                    className="w-full px-3 py-2 rounded-xl bg-[#202220] border border-[rgba(255,255,255,0.10)] text-xs text-[#8BFF24] focus:outline-none focus:border-[#8BFF24] font-mono tabular-nums transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#E8EAE6] mb-1">Response Note (Optional)</label>
                <textarea
                  value={workerResponseNote}
                  onChange={(e) => setWorkerResponseNote(e.target.value)}
                  rows={3}
                  placeholder={
                    respondStatus === 'NEGOTIATION'
                      ? 'Specify requested changes to budget, timeline, or deliverable scope...'
                      : 'Add an optional note to the client...'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#202220] border border-[rgba(255,255,255,0.10)] text-xs text-[#E8EAE6] focus:outline-none focus:border-[#8BFF24] transition leading-relaxed"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[rgba(255,255,255,0.10)] flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setActiveRespondId(null)}
                disabled={isActionLoading}
                className="px-4 py-2 rounded-xl bg-[#202220] hover:bg-[#292C28] text-xs font-semibold text-[#E8EAE6] border border-[rgba(255,255,255,0.10)] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRespondSubmit}
                disabled={isActionLoading}
                className="px-5 py-2 rounded-xl bg-[#8BFF24] hover:bg-[#A3FF50] disabled:opacity-50 text-xs font-bold text-[#050605] shadow-[0_0_15px_rgba(139,255,36,0.2)] transition cursor-pointer"
              >
                {isActionLoading ? 'Saving...' : 'Submit Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Counteroffer Modal */}
      {activeCounterofferId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#151715] border border-[rgba(255,255,255,0.10)] rounded-2xl max-w-md w-full p-6 space-y-4 text-[#E8EAE6] shadow-2xl">
            <h3 className="text-base font-bold text-[#E8EAE6]">Propose Counteroffer</h3>
            <p className="text-xs text-[#A5AAA2]">
              Submit renegotiated terms or adjusted budget in response to the specialist's feedback.
            </p>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#E8EAE6] mb-1">Adjusted Proposed Budget ($)</label>
                <input
                  type="number"
                  step="1"
                  value={counterBudget}
                  onChange={(e) => setCounterBudget(e.target.value)}
                  placeholder="e.g. 750"
                  className="w-full px-3 py-2 rounded-xl bg-[#202220] border border-[rgba(255,255,255,0.10)] text-xs text-[#8BFF24] focus:outline-none focus:border-[#8BFF24] font-mono tabular-nums transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#E8EAE6] mb-1">Counteroffer Message / Terms *</label>
                <textarea
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  rows={4}
                  placeholder="Explain your adjusted terms, deliverables, or pricing justification..."
                  className="w-full px-3 py-2 rounded-xl bg-[#202220] border border-[rgba(255,255,255,0.10)] text-xs text-[#E8EAE6] focus:outline-none focus:border-[#8BFF24] transition leading-relaxed"
                  required
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[rgba(255,255,255,0.10)] flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setActiveCounterofferId(null);
                  setCounterBudget('');
                  setCounterMessage('');
                }}
                disabled={isActionLoading}
                className="px-4 py-2 rounded-xl bg-[#202220] hover:bg-[#292C28] text-xs font-semibold text-[#E8EAE6] border border-[rgba(255,255,255,0.10)] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCounterofferSubmit}
                disabled={isActionLoading || !counterMessage.trim()}
                className="px-5 py-2 rounded-xl bg-[#8BFF24] hover:bg-[#A3FF50] disabled:opacity-50 text-xs font-bold text-[#050605] shadow-[0_0_15px_rgba(139,255,36,0.2)] transition cursor-pointer"
              >
                {isActionLoading ? 'Submitting...' : 'Send Counteroffer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
