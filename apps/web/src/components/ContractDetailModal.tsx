import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import {
  ContractDto,
  UserRole,
  MilestoneStatus,
  ContractStatus,
  EscrowRecordDto,
} from '@trustpay/shared';
import {
  X,
  Download,
  CheckCircle,
  AlertCircle,
  Upload,
  ShieldCheck,
  Send,
  Lock,
  AlertTriangle,
  CreditCard,
} from 'lucide-react';
import { ContractLifecyclePanel } from './ContractLifecyclePanel';

interface CashfreeSDKInstance {
  checkout: (options: { paymentSessionId: string; redirectTarget: '_modal' | '_self' }) => Promise<{
    error?: { message?: string };
    paymentDetails?: unknown;
  }>;
}

type CashfreeConstructor = (options: { mode: 'sandbox' | 'production' }) => CashfreeSDKInstance;

declare global {
  interface Window {
    Cashfree?: CashfreeConstructor;
  }
}

interface ContractDetailModalProps {
  contract: ContractDto;
  currentUserRole: UserRole;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const ContractDetailModal: React.FC<ContractDetailModalProps> = ({
  contract,
  currentUserRole: _currentUserRole,
  currentUserId,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [actionType, setActionType] = useState<'SUBMIT' | 'REVISE' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [escrowRecord, setEscrowRecord] = useState<EscrowRecordDto | null>(null);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentTransactions, setPaymentTransactions] = useState<Array<{
    id: string;
    transactionReference: string;
    providerOrderId?: string;
    status: string;
    amountMinor: string;
    currency: string;
    createdAt: string;
  }>>([]);

  const loadPayments = () => {
    if (contract.id) {
      apiService.listPaymentTransactions({ contractId: contract.id }).then((res) => {
        if (res.success && res.data?.items) {
          setPaymentTransactions(res.data.items as typeof paymentTransactions);
        }
      }).catch(() => {
        // Silently handled
      });
    }
  };

  useEffect(() => {
    if (isOpen && contract.id) {
      apiService.getContractEscrow(contract.id).then((res) => {
        if (res.success && res.data) {
          setEscrowRecord(res.data);
        }
      }).catch(() => {
        // Silently handled
      });
      loadPayments();
    }
  }, [isOpen, contract.id]);

  const loadCashfreeSdk = (): Promise<CashfreeConstructor> => {
    return new Promise((resolve, reject) => {
      if (window.Cashfree) {
        return resolve(window.Cashfree);
      }
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.onload = () => {
        if (window.Cashfree) {
          resolve(window.Cashfree);
        } else {
          reject(new Error('Cashfree SDK loaded but constructor unavailable'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load Cashfree Checkout SDK script'));
      document.body.appendChild(script);
    });
  };

  const handleCashfreeCheckout = async () => {
    setIsInitiatingPayment(true);
    setPaymentError(null);
    setPaymentNotice(null);

    try {
      // 1. Create backend order
      const orderRes = await apiService.createPaymentOrder(contract.id);
      if (!orderRes.success || !orderRes.data) {
        setPaymentError(orderRes.error?.message || 'Failed to initialize Cashfree payment order.');
        setIsInitiatingPayment(false);
        return;
      }

      const { orderId, paymentSessionId } = orderRes.data;

      // 2. Load SDK and launch sandbox modal
      setPaymentNotice(`Sandbox order initialized (${orderId}). Launching checkout...`);
      const CashfreeFn = await loadCashfreeSdk();
      const cashfree = CashfreeFn({ mode: 'sandbox' });

      cashfree.checkout({
        paymentSessionId,
        redirectTarget: '_modal',
      }).then(async (result) => {
        if (result.error) {
          setPaymentError(result.error.message || 'Payment was cancelled or failed in sandbox.');
        }
        // Always verify authoritative server state
        setIsVerifyingPayment(true);
        const verifyRes = await apiService.verifyPaymentStatus(orderId);
        setIsVerifyingPayment(false);
        if (verifyRes.success && verifyRes.data) {
          setPaymentNotice(
            `Payment Status: ${verifyRes.data.status} (${verifyRes.data.cashfreeOrderStatus}) for Order #${orderId} [SANDBOX / ZERO REAL MONEY].`,
          );
          loadPayments();
          onRefresh();
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cashfree payment initiation failed';
      setPaymentError(msg);
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  if (!isOpen) return null;

  const isClient = contract.clientId === currentUserId;
  const isWorker = contract.workerId === currentUserId;

  const hasUserAccepted = contract.acceptances?.some(
    (a) => a.userId === currentUserId && a.version === contract.version,
  );
  const hasOtherAccepted = contract.acceptances?.some(
    (a) => a.userId !== currentUserId && a.version === contract.version,
  );

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const blob = await apiService.downloadContractPdf(contract.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contract-${contract.contractNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to download contract PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDigitalAccept = async () => {
    if (!confirm('Digitally accept the terms and milestone allocations of this agreement?')) return;
    setIsAccepting(true);
    setErrorMessage(null);
    try {
      const res = await apiService.acceptContract(contract.id, {
        acceptanceMethod: 'DIGITAL_CONFIRMATION',
        expectedVersion: contract.version,
      });
      if (res.success) {
        onRefresh();
      } else {
        setErrorMessage(res.error?.message || 'Failed to record digital acceptance');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error accepting contract');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleStartMilestone = async (milestoneId: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await apiService.startMilestone(contract.id, milestoneId);
      if (res.success) {
        onRefresh();
      } else {
        setErrorMessage(res.error?.message || 'Failed to start milestone work');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveMilestone = async (milestoneId: string) => {
    if (!confirm('Approve this milestone deliverable?')) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await apiService.approveMilestone(contract.id, milestoneId);
      if (res.success) {
        onRefresh();
      } else {
        setErrorMessage(res.error?.message || 'Failed to approve milestone');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMilestoneId) return;

    if (!submissionNotes.trim() || submissionNotes.length < 10) {
      setErrorMessage('Submission notes must be at least 10 characters');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const urls = attachmentUrl.trim() ? [attachmentUrl.trim()] : [];
      const res = await apiService.submitMilestone(contract.id, activeMilestoneId, {
        notes: submissionNotes.trim(),
        attachmentUrls: urls,
      });

      if (res.success) {
        setActiveMilestoneId(null);
        setActionType(null);
        setSubmissionNotes('');
        setAttachmentUrl('');
        onRefresh();
      } else {
        setErrorMessage(res.error?.message || 'Failed to submit milestone deliverable');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error submitting deliverable');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMilestoneId) return;

    if (!revisionReason.trim() || revisionReason.length < 10) {
      setErrorMessage('Revision reason must be at least 10 characters');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      // Find latest submission ID
      const targetMilestone = contract.milestones?.find((m) => m.id === activeMilestoneId);
      const submissionId = targetMilestone?.submissions?.[0]?.id;

      if (!submissionId) {
        setErrorMessage('Cannot request revision without a recorded submission');
        setIsSubmitting(false);
        return;
      }

      const res = await apiService.requestRevision(contract.id, activeMilestoneId, {
        submissionId,
        reason: revisionReason.trim(),
      });

      if (res.success) {
        setActiveMilestoneId(null);
        setActionType(null);
        setRevisionReason('');
        onRefresh();
      } else {
        setErrorMessage(res.error?.message || 'Failed to submit revision request');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error requesting revision');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case ContractStatus.ACTIVE:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ACTIVE</span>;
      case ContractStatus.PENDING_ACCEPTANCE:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">PENDING SIGN-OFF</span>;
      case ContractStatus.COMPLETED:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">COMPLETED</span>;
      case ContractStatus.CANCELLED:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">CANCELLED</span>;
      case ContractStatus.DISPUTED:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">DISPUTED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 space-y-6 max-h-[92vh] overflow-y-auto text-slate-100 shadow-2xl">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                {contract.contractNumber}
              </span>
              <span className="text-xs text-slate-400 font-medium">v{contract.version}</span>
              {getStatusBadge(contract.status)}
            </div>
            <h3 className="text-xl font-bold text-white mt-1.5">{contract.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{contract.description}</p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800 border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Dispute Warning Banner (Phase 6) */}
        {(contract.status === ContractStatus.DISPUTED || escrowRecord?.disputeHold) && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              This contract is currently under formal dispute review. Milestone approvals and financial releases are held until resolution.
            </span>
          </div>
        )}

        {/* Commercial & Parties Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Client Card */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Client (Buyer)</span>
            <p className="text-xs font-bold text-white">
              {contract.client?.firstName
                ? `${contract.client.firstName} ${contract.client.lastName || ''}`.trim()
                : 'Verified Client'}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{contract.client?.email}</p>
          </div>

          {/* Worker Card */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Specialist (Provider)</span>
            <p className="text-xs font-bold text-white">
              {contract.worker?.firstName
                ? `${contract.worker.firstName} ${contract.worker.lastName || ''}`.trim()
                : 'Verified Worker'}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{contract.worker?.email}</p>
          </div>

          {/* Total Agreement Value */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Contracted Value</span>
            <p className="text-lg font-bold text-emerald-400">
              ${Number(contract.totalAmount).toLocaleString()} <span className="text-xs font-normal text-slate-400">{contract.currency}</span>
            </p>
            <p className="text-[10px] text-slate-400">
              {contract.milestones?.length || 0} milestone deliverable{(contract.milestones?.length || 0) > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Escrow & Financial Safeguards Overview (Phase 4.1) */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-2.5">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Escrow &amp; Financial Governance</h4>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                escrowRecord?.status === 'FUNDED'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : escrowRecord?.status === 'DISPUTED'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {escrowRecord?.status || 'PENDING_INITIALIZATION'}
              </span>
              {escrowRecord?.disputeHold && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">
                  DISPUTE HOLD
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans">Agreed Contractual Total</span>
              <div className="text-sm font-bold text-white mt-0.5">
                ${Number(contract.totalAmount).toLocaleString()} <span className="text-slate-400 text-xs font-normal">{contract.currency}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans">Verified Custodial Deposits</span>
              <div className="text-sm font-bold text-amber-400 mt-0.5">
                $0.00 <span className="text-slate-500 text-xs font-normal">USD</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans">Verified Released to Worker</span>
              <div className="text-sm font-bold text-blue-400 mt-0.5">
                $0.00 <span className="text-slate-500 text-xs font-normal">USD</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex items-start space-x-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              {isClient
                ? 'Client Notice: Payment provider integration is pending. Real money has not been debited from your accounts. Milestone approvals acknowledge deliverable completion; financial ledger movements remain disabled until payment gateway activation.'
                : 'Specialist Notice: Live payouts are disabled pending payment provider selection. Milestone deliverables approved by the client are logged as verified claims.'}
            </span>
          </div>

          {/* Cashfree Payment Gateway (Phase 5 - SANDBOX Checkout) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white">Cashfree Payment Gateway</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SANDBOX / TEST ONLY
                </span>
              </div>
              <span className="text-[10px] text-slate-400">Zero Real Money Debited</span>
            </div>

            {paymentNotice && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{paymentNotice}</span>
              </div>
            )}

            {paymentError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-300">
                <p className="font-semibold">
                  Test Contract Escrow Funding:{' '}
                  <span className="text-indigo-300 font-mono">
                    ₹{(Number(contract.totalAmount)).toLocaleString()} INR
                  </span>
                </p>
                <p className="text-[11px] text-slate-400">
                  Official Cashfree Hosted Checkout modal initiates test card/UPI payment simulations.
                </p>
              </div>

              {isClient ? (
                <button
                  onClick={handleCashfreeCheckout}
                  disabled={isInitiatingPayment || isVerifyingPayment}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white shrink-0 shadow-lg shadow-indigo-600/20 transition flex items-center space-x-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>
                    {isInitiatingPayment
                      ? 'Creating Sandbox Order...'
                      : isVerifyingPayment
                      ? 'Verifying Payment...'
                      : 'Pay via Cashfree (Sandbox)'}
                  </span>
                </button>
              ) : (
                <div className="text-[11px] text-slate-400 italic">
                  Specialist view: Client initiates sandbox funding. No real payouts occur.
                </div>
              )}
            </div>

            {/* Verified Test Payment Records */}
            {paymentTransactions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Contract Sandbox Payment History ({paymentTransactions.length})
                </span>
                <div className="space-y-1">
                  {paymentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-2 rounded bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-[11px] font-mono"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-300">{tx.transactionReference}</span>
                        {tx.providerOrderId && (
                          <span className="text-[10px] text-slate-500">({tx.providerOrderId})</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400">
                          {(Number(tx.amountMinor) / 100).toFixed(2)} {tx.currency}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            tx.status === 'SUCCEEDED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : tx.status === 'FAILED'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Digital Sign-off Banner */}
        {contract.status === ContractStatus.PENDING_ACCEPTANCE && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-amber-300 flex items-center space-x-1">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Digital Acceptance Pending</span>
              </span>
              <p className="text-slate-300">
                {hasUserAccepted
                  ? '✓ You have digitally accepted this version. Awaiting counterparty sign-off to activate agreement.'
                  : hasOtherAccepted
                  ? 'Counterparty has digitally signed this agreement. Review terms below and provide your sign-off.'
                  : 'Review the commercial scope and milestones below, then provide your digital sign-off to activate.'}
              </p>
            </div>

            {!hasUserAccepted && (
              <button
                onClick={handleDigitalAccept}
                disabled={isAccepting}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white shrink-0 shadow-lg shadow-emerald-600/20 transition flex items-center space-x-1"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isAccepting ? 'Recording Acceptance...' : 'Accept & Sign Contract'}</span>
              </button>
            )}
          </div>
        )}

        {/* Scope and Terms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-800 space-y-1">
            <span className="font-semibold text-slate-300">Scope of Work</span>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              {contract.scopeOfWork || contract.description}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-800 space-y-1">
            <span className="font-semibold text-slate-300">Terms &amp; Cancellation Policy</span>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              {contract.termsAndConditions || 'Standard TrustPay Enterprise digital contract terms apply.'}
            </p>
          </div>
        </div>

        {/* Milestones Deliverables Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Contract Milestones ({contract.milestones?.length || 0})
            </h4>
          </div>

          <div className="space-y-2">
            {contract.milestones?.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-xl bg-slate-800/50 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-semibold">
                      #{m.order}
                    </span>
                    <span className="font-semibold text-white">{m.title}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        m.status === MilestoneStatus.APPROVED
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : m.status === MilestoneStatus.SUBMITTED
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : m.status === MilestoneStatus.IN_PROGRESS
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : m.status === MilestoneStatus.IN_REVISION
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">{m.description}</p>
                </div>

                <div className="flex items-center space-x-4 shrink-0">
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-400">${Number(m.amount).toLocaleString()}</span>
                    {m.dueDate && (
                      <p className="text-[10px] text-slate-500">
                        Due {new Date(m.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Actions depending on role and milestone status */}
                  <div className="flex items-center space-x-2">
                    {/* Worker: Start work on pending milestone */}
                    {isWorker && contract.status === ContractStatus.ACTIVE && m.status === MilestoneStatus.PENDING && (
                      <button
                        onClick={() => handleStartMilestone(m.id)}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white"
                      >
                        Start Work
                      </button>
                    )}

                    {/* Worker: Submit deliverable */}
                    {isWorker &&
                      contract.status === ContractStatus.ACTIVE &&
                      (m.status === MilestoneStatus.IN_PROGRESS || m.status === MilestoneStatus.IN_REVISION) && (
                        <button
                          onClick={() => {
                            setActiveMilestoneId(m.id);
                            setActionType('SUBMIT');
                            setSubmissionNotes('');
                            setAttachmentUrl('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center space-x-1"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Submit Deliverable</span>
                        </button>
                      )}

                    {/* Client: Review and approve or request revision */}
                    {isClient && m.status === MilestoneStatus.SUBMITTED && (
                      <>
                        <button
                          onClick={() => handleApproveMilestone(m.id)}
                          disabled={isSubmitting}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                        >
                          Approve Deliverable
                        </button>
                        <button
                          onClick={() => {
                            setActiveMilestoneId(m.id);
                            setActionType('REVISE');
                            setRevisionReason('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-700 text-xs font-medium text-slate-300"
                        >
                          Request Revision
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deliverable Submission / Revision Drawer Form */}
        {activeMilestoneId && actionType && (
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-white">
              {actionType === 'SUBMIT' ? 'Submit Milestone Deliverable' : 'Request Milestone Revision'}
            </h4>

            {actionType === 'SUBMIT' ? (
              <form onSubmit={handleSubmitDeliverable} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Deliverable Notes &amp; Evidence *</label>
                  <textarea
                    value={submissionNotes}
                    onChange={(e) => setSubmissionNotes(e.target.value)}
                    rows={3}
                    placeholder="Describe completed work, deliverables provided, pull request references..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Attachment or Repository URL (Optional)</label>
                  <input
                    type="url"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    placeholder="https://github.com/... or https://storage..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMilestoneId(null);
                      setActionType(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center space-x-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Uploading...' : 'Confirm Submission'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRequestRevision} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Reason for Revision *</label>
                  <textarea
                    value={revisionReason}
                    onChange={(e) => setRevisionReason(e.target.value)}
                    rows={3}
                    placeholder="Detail specific criteria that require correction or additional deliverables..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMilestoneId(null);
                      setActionType(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                  >
                    {isSubmitting ? 'Submitting...' : 'Send Revision Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Advanced Escrow, Disputes & Contract Lifecycle (Phase 6) */}
        <ContractLifecyclePanel
          contract={contract}
          currentUserId={currentUserId}
          isClient={isClient}
          isWorker={isWorker}
          onRefresh={onRefresh}
        />

        {/* Digital Acceptance Audit Trail */}
        {contract.acceptances && contract.acceptances.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
            <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
              Digital Acceptance Audit Trail
            </span>
            <div className="space-y-1">
              {contract.acceptances.map((acc) => (
                <div key={acc.id} className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 flex items-center justify-between">
                  <span className="text-emerald-400 font-medium">
                    ✓ {acc.role}: {acc.user?.firstName || ''} {acc.user?.lastName || ''} ({acc.user?.email})
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    Method: {acc.acceptanceMethod} • {new Date(acc.acceptedAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
