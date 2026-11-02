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
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            <span>Pending Response</span>
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" />
            <span>Accepted</span>
          </span>
        );
      case 'DECLINED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            <span>Declined</span>
          </span>
        );
      case 'WITHDRAWN':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <RotateCcw className="w-3 h-3" />
            <span>Withdrawn</span>
          </span>
        );
      case 'NEGOTIATION':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
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
          <h3 className="text-xl font-bold text-white tracking-tight">
            {isClient ? 'Sent Hiring Proposals' : 'Received Hiring Proposals'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {isClient
              ? 'Track the status of your specialist hiring requests and convert accepted terms into active digital contracts.'
              : 'Review client project proposals, accept terms, or request negotiation before digital contracts are formalized.'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-slate-500 text-sm">Querying proposal pipeline...</div>
      ) : requests.length === 0 ? (
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-16 text-center text-slate-400 text-sm">
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
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h4 className="text-base font-bold text-white">{req.title}</h4>
                      {getStatusBadge(req.status)}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {isClient ? 'Proposed to specialist: ' : 'From client: '}
                      <span className="text-emerald-400 font-semibold">{partyName}</span>
                      <span className="text-slate-500 ml-2">({party?.email})</span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm">
                      <DollarSign className="w-4 h-4" />
                      <span>{Number(req.proposedBudget).toLocaleString()}</span>
                      <span className="text-xs font-normal text-emerald-500/80">{req.currency}</span>
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                  {req.description}
                </p>

                {/* Dates & Skills Bar */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                  {req.proposedStartDate && (
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>Starts: {new Date(req.proposedStartDate).toLocaleDateString()}</span>
                    </span>
                  )}
                  {req.expectedCompletionDate && (
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>Due: {new Date(req.expectedCompletionDate).toLocaleDateString()}</span>
                    </span>
                  )}

                  {req.requiredSkills && req.requiredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {req.requiredSkills.map((sk, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
                          {sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes Feed */}
                {req.clientMessage && (
                  <div className="text-xs bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 text-slate-300">
                    <span className="font-semibold text-slate-200">Client Note: </span>
                    <span>{req.clientMessage}</span>
                  </div>
                )}

                {req.workerResponse && (
                  <div className="text-xs bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/40 text-emerald-300">
                    <span className="font-semibold text-emerald-200">Specialist Response: </span>
                    <span>{req.workerResponse}</span>
                  </div>
                )}

                {/* Actions Bar */}
                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[10px] text-slate-500">
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
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center space-x-1 shadow-sm"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Counteroffer Terms</span>
                      </button>
                    )}

                    {isClient && (req.status === 'PENDING' || req.status === 'NEGOTIATION') && (
                      <button
                        onClick={() => handleWithdraw(req.id)}
                        disabled={isActionLoading}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700"
                      >
                        Withdraw
                      </button>
                    )}

                    {isClient && req.status === 'ACCEPTED' && !req.contractId && (
                      <button
                        onClick={() => handleConvertToContract(req.id)}
                        disabled={isActionLoading}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Convert to Contract Draft</span>
                      </button>
                    )}

                    {req.contractId && (
                      <span className="text-xs text-emerald-400 font-medium px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                        Contract Generated
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
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center space-x-1 shadow-lg shadow-emerald-600/20"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 text-slate-100 shadow-2xl">
            <h3 className="text-base font-bold text-white">Respond to Proposal</h3>
            <p className="text-xs text-slate-400">
              Select your decision regarding this project proposal. You may also propose modified terms.
            </p>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Decision</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRespondStatus('ACCEPTED')}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition ${
                      respondStatus === 'ACCEPTED'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => setRespondStatus('NEGOTIATION')}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition ${
                      respondStatus === 'NEGOTIATION'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    Negotiate
                  </button>
                  <button
                    type="button"
                    onClick={() => setRespondStatus('DECLINED')}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition ${
                      respondStatus === 'DECLINED'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    Decline
                  </button>
                </div>
              </div>

              {respondStatus === 'NEGOTIATION' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Proposed Counter Budget ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={workerNegotiateBudget}
                    onChange={(e) => setWorkerNegotiateBudget(e.target.value)}
                    placeholder="Enter revised proposed budget"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Response Note (Optional)</label>
                <textarea
                  value={workerResponseNote}
                  onChange={(e) => setWorkerResponseNote(e.target.value)}
                  rows={3}
                  placeholder={
                    respondStatus === 'NEGOTIATION'
                      ? 'Specify requested changes to budget, timeline, or deliverable scope...'
                      : 'Add an optional note to the client...'
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setActiveRespondId(null)}
                disabled={isActionLoading}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRespondSubmit}
                disabled={isActionLoading}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20"
              >
                {isActionLoading ? 'Saving...' : 'Submit Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Counteroffer Modal */}
      {activeCounterofferId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 text-slate-100 shadow-2xl">
            <h3 className="text-base font-bold text-white">Propose Counteroffer</h3>
            <p className="text-xs text-slate-400">
              Submit renegotiated terms or adjusted budget in response to the specialist's feedback.
            </p>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Adjusted Proposed Budget ($)</label>
                <input
                  type="number"
                  step="1"
                  value={counterBudget}
                  onChange={(e) => setCounterBudget(e.target.value)}
                  placeholder="e.g. 750"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Counteroffer Message / Terms *</label>
                <textarea
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  rows={4}
                  placeholder="Explain your adjusted terms, deliverables, or pricing justification..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setActiveCounterofferId(null);
                  setCounterBudget('');
                  setCounterMessage('');
                }}
                disabled={isActionLoading}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCounterofferSubmit}
                disabled={isActionLoading || !counterMessage.trim()}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-blue-600/20"
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

