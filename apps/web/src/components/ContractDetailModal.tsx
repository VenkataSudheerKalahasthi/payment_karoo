import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
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
  ExternalLink,
  Paperclip,
  FileText,
  Clock,
  Layers,
  Scale,
  Stamp,
  Star,
} from 'lucide-react';
import { ContractLifecyclePanel } from './ContractLifecyclePanel';
import { ContractReviewModal } from './ContractReviewModal';

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
  const [detailedContract, setDetailedContract] = useState<ContractDto>(contract);
  const [modalTab, setModalTab] = useState<'milestones' | 'scope' | 'escrow' | 'governance'>('milestones');
  const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [isAuthorizingUpload, setIsAuthorizingUpload] = useState(false);
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

  const fetchContractDetails = React.useCallback(async () => {
    if (!contract.id) return;
    try {
      const res = await apiService.getContract(contract.id);
      if (res.success && res.data) {
        setDetailedContract(res.data);
      }
    } catch {
      // Retain existing contract state
    }
  }, [contract.id]);

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
      setDetailedContract(contract);
      fetchContractDetails();
      apiService.getContractEscrow(contract.id).then((res) => {
        if (res.success && res.data) {
          setEscrowRecord(res.data);
        }
      }).catch(() => {
        // Silently handled
      });
      loadPayments();
    }
  }, [isOpen, contract, fetchContractDetails]);

  // Real-Time Socket.IO event subscription for live contract lifecycle updates
  useEffect(() => {
    if (!isOpen || !contract.id) return;
    const socketServerUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';
    const socket = io(socketServerUrl, {
      transports: ['websocket', 'polling'],
    });

    socket.emit('join:contract', contract.id);

    const handleLiveUpdate = () => {
      fetchContractDetails();
      onRefresh();
    };

    socket.on('contract:event', handleLiveUpdate);
    socket.on('contract:status_updated', handleLiveUpdate);
    socket.on('contract:activated', handleLiveUpdate);
    socket.on('contract:fresh_acceptance_required', handleLiveUpdate);

    return () => {
      socket.emit('leave:contract', contract.id);
      socket.disconnect();
    };
  }, [isOpen, contract.id, fetchContractDetails, onRefresh]);

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
      const orderRes = await apiService.createPaymentOrder(contract.id);
      if (!orderRes.success || !orderRes.data) {
        setPaymentError(orderRes.error?.message || 'Failed to initialize Cashfree payment order.');
        setIsInitiatingPayment(false);
        return;
      }

      const { orderId, paymentSessionId } = orderRes.data;

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

  const isClient = detailedContract.clientId === currentUserId;
  const isWorker = detailedContract.workerId === currentUserId;

  const hasUserAccepted = detailedContract.acceptances?.some(
    (a) => a.userId === currentUserId && a.version === detailedContract.version,
  );
  const hasOtherAccepted = detailedContract.acceptances?.some(
    (a) => a.userId !== currentUserId && a.version === detailedContract.version,
  );

  const hasClientStamp = (detailedContract.clientStamps && detailedContract.clientStamps.length > 0) || false;
  const isApproved =
    detailedContract.status === ContractStatus.ACTIVE ||
    detailedContract.status === ContractStatus.COMPLETED ||
    hasUserAccepted;

  const [showStampModal, setShowStampModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isApplyingStamp, setIsApplyingStamp] = useState(false);
  const [stampPosition, setStampPosition] = useState<'BOTTOM_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_CENTER'>('BOTTOM_RIGHT');

  const handleApplyStampFromModal = async () => {
    try {
      setIsApplyingStamp(true);
      const res = await apiService.applyClientStamp(detailedContract.id, { stampPosition });
      if (res.success) {
        setShowStampModal(false);
        await fetchContractDetails();
        onRefresh();
      } else {
        alert(res.error?.message || 'Failed to apply office stamp');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Error applying office stamp');
    } finally {
      setIsApplyingStamp(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const blob = await apiService.downloadContractPdf(detailedContract.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contract-${detailedContract.contractNumber}.pdf`;
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
      const res = await apiService.acceptContract(detailedContract.id, {
        acceptanceMethod: 'DIGITAL_CONFIRMATION',
        expectedVersion: detailedContract.version,
      });
      if (res.success) {
        await fetchContractDetails();
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

  const handleDeliverableFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeMilestoneId) return;

    setIsAuthorizingUpload(true);
    setErrorMessage(null);
    try {
      const mime = file.type || 'application/octet-stream';
      const authRes = await apiService.authorizeUpload({
        bucket: 'agreement-attachments',
        contractId: detailedContract.id,
        milestoneId: activeMilestoneId,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: mime,
      });

      if (authRes.success && authRes.data) {
        setUploadFileName(file.name);
        setAttachmentUrl(authRes.data.objectPath);
      } else {
        setErrorMessage(authRes.error?.message || 'File upload authorization rejected');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error authorizing file upload');
    } finally {
      setIsAuthorizingUpload(false);
    }
  };

  const handleStartMilestone = async (milestoneId: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await apiService.startMilestone(detailedContract.id, milestoneId);
      if (res.success) {
        await fetchContractDetails();
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
      const res = await apiService.approveMilestone(detailedContract.id, milestoneId);
      if (res.success) {
        await fetchContractDetails();
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
      const res = await apiService.submitMilestone(detailedContract.id, activeMilestoneId, {
        notes: submissionNotes.trim(),
        attachmentUrls: urls,
      });

      if (res.success) {
        setActiveMilestoneId(null);
        setActionType(null);
        setSubmissionNotes('');
        setAttachmentUrl('');
        await fetchContractDetails();
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
      const targetMilestone = detailedContract.milestones?.find((m) => m.id === activeMilestoneId);
      const submissionId = targetMilestone?.submissions?.[0]?.id;

      if (!submissionId) {
        setErrorMessage('Cannot request revision without a recorded submission');
        setIsSubmitting(false);
        return;
      }

      const res = await apiService.requestRevision(detailedContract.id, activeMilestoneId, {
        submissionId,
        reason: revisionReason.trim(),
      });

      if (res.success) {
        setActiveMilestoneId(null);
        setActionType(null);
        setRevisionReason('');
        await fetchContractDetails();
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
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">ACTIVE</span>;
      case ContractStatus.PENDING_ACCEPTANCE:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">PENDING SIGN-OFF</span>;
      case ContractStatus.COMPLETED:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20">COMPLETED</span>;
      case ContractStatus.CANCELLED:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-[#202020] text-[#64748B] dark:text-[#777777] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)]">CANCELLED</span>;
      case ContractStatus.DISPUTED:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">DISPUTED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-[#64748B] dark:text-[#A5A5A5]">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FFFFFF] dark:bg-[#171717] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] rounded-2xl max-w-4xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto text-[#242424] dark:text-[#CDCBCA] shadow-2xl transition-colors">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] pb-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#202020] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] text-[#242424] dark:text-[#CDCBCA] font-semibold">
                {detailedContract.contractNumber}
              </span>
              <span className="text-xs text-[#64748B] dark:text-[#A5A5A5] font-mono">v{detailedContract.version}</span>
              {getStatusBadge(detailedContract.status)}
            </div>
            <h3 className="text-xl font-bold text-[#242424] dark:text-[#CDCBCA] mt-1.5">{detailedContract.title}</h3>
            <p className="text-xs text-[#64748B] dark:text-[#A5A5A5] mt-0.5">{detailedContract.description}</p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {isClient && isApproved && (
              hasClientStamp ? (
                <span className="px-3 py-1.5 rounded-lg dark:bg-[#8BFF24]/10 bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] border dark:border-[#8BFF24]/30 border-[#C7D2FE] text-xs font-bold flex items-center gap-1.5">
                  <Stamp className="w-3.5 h-3.5" />
                  <span>Stamp Applied</span>
                </span>
              ) : (
                <button
                  onClick={() => setShowStampModal(true)}
                  className="px-3 py-1.5 rounded-lg dark:bg-[#8BFF24] bg-[#5046E5] hover:dark:bg-[#78e018] hover:bg-[#4338CA] dark:text-black text-white shadow-md shadow-[#5046E5]/25 text-xs font-bold flex items-center gap-1.5 transition shadow-[0_0_12px_rgba(139,255,36,0.25)] cursor-pointer"
                >
                  <Stamp className="w-3.5 h-3.5" />
                  <span>Add Stamp</span>
                </button>
              )
            )}

            {isWorker && hasClientStamp && (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
                <Stamp className="w-3.5 h-3.5" />
                <span>Client Stamped</span>
              </span>
            )}

            {detailedContract.status === ContractStatus.COMPLETED && (
              <button
                onClick={() => setShowReviewModal(true)}
                className="px-3 py-1.5 rounded-lg dark:bg-[#8BFF24]/10 bg-[#EEF2FF] border dark:border-[#8BFF24]/30 border-[#C7D2FE] dark:text-[#8BFF24] text-[#5046E5] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Star className="w-3.5 h-3.5" />
                <span>Verified Review</span>
              </button>
            )}

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-3 py-1.5 rounded-lg bg-[#F8FAFC] dark:bg-[#202020] hover:bg-[#F1F5F9] dark:hover:bg-[#303030] disabled:opacity-50 text-xs font-semibold text-[#242424] dark:text-[#CDCBCA] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-[#64748B] dark:text-[#777777] hover:text-[#242424] dark:hover:text-[#CDCBCA] p-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#202020] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Console Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] pb-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setModalTab('milestones')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              modalTab === 'milestones'
                ? 'bg-[#2563EB] text-white shadow-sm dark:bg-[#202020] dark:text-[#CDCBCA] dark:border dark:border-[rgba(205,203,202,0.18)]'
                : 'text-[#64748B] dark:text-[#A5A5A5] hover:text-[#242424] dark:hover:text-[#CDCBCA]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Milestones &amp; Work ({detailedContract.milestones?.length || 0})</span>
          </button>

          <button
            onClick={() => setModalTab('scope')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              modalTab === 'scope'
                ? 'bg-[#2563EB] text-white shadow-sm dark:bg-[#202020] dark:text-[#CDCBCA] dark:border dark:border-[rgba(205,203,202,0.18)]'
                : 'text-[#64748B] dark:text-[#A5A5A5] hover:text-[#242424] dark:hover:text-[#CDCBCA]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Scope &amp; Terms</span>
          </button>

          <button
            onClick={() => setModalTab('escrow')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              modalTab === 'escrow'
                ? 'bg-[#2563EB] text-white shadow-sm dark:bg-[#202020] dark:text-[#CDCBCA] dark:border dark:border-[rgba(205,203,202,0.18)]'
                : 'text-[#64748B] dark:text-[#A5A5A5] hover:text-[#242424] dark:hover:text-[#CDCBCA]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Escrow &amp; Cashfree Gateway</span>
          </button>

          <button
            onClick={() => setModalTab('governance')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition cursor-pointer ${
              modalTab === 'governance'
                ? 'bg-[#2563EB] text-white shadow-sm dark:bg-[#202020] dark:text-[#CDCBCA] dark:border dark:border-[rgba(205,203,202,0.18)]'
                : 'text-[#64748B] dark:text-[#A5A5A5] hover:text-[#242424] dark:hover:text-[#CDCBCA]'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Disputes &amp; Governance</span>
          </button>
        </div>

        {/* TAB 1: MILESTONES & WORK */}
        {modalTab === 'milestones' && (
          <div className="space-y-4">
            <div className="space-y-3">
              {detailedContract.milestones?.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#202020] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] space-y-3 text-xs"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1 max-w-lg">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FFFFFF] dark:bg-[#171717] border border-[#CBD5E1] dark:border-[rgba(205,203,202,0.18)] text-[#242424] dark:text-[#CDCBCA] font-semibold">
                          #{m.order}
                        </span>
                        <span className="font-semibold text-[#242424] dark:text-[#CDCBCA]">{m.title}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            m.status === MilestoneStatus.APPROVED
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : m.status === MilestoneStatus.SUBMITTED
                                ? 'bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20'
                                : m.status === MilestoneStatus.IN_PROGRESS
                                  ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20'
                                  : m.status === MilestoneStatus.IN_REVISION
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                    : 'bg-[#FFFFFF] dark:bg-[#171717] text-[#64748B] dark:text-[#A5A5A5] border border-[#CBD5E1] dark:border-[rgba(205,203,202,0.18)]'
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <p className="text-[#64748B] dark:text-[#A5A5A5] text-[11px] leading-relaxed">{m.description}</p>
                    </div>

                    <div className="flex items-center space-x-4 shrink-0">
                      <div className="text-right">
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                          ${Number(m.amount).toLocaleString()}
                        </span>
                        {m.dueDate && (
                          <p className="text-[10px] text-[#64748B] dark:text-[#777777] font-mono">
                            Due {new Date(m.dueDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {/* Actions depending on role and milestone status */}
                      <div className="flex items-center space-x-2">
                        {isWorker && detailedContract.status === ContractStatus.ACTIVE && m.status === MilestoneStatus.PENDING && (
                          <button
                            onClick={() => handleStartMilestone(m.id)}
                            disabled={isSubmitting}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition cursor-pointer"
                          >
                            Start Work
                          </button>
                        )}

                        {isWorker &&
                          detailedContract.status === ContractStatus.ACTIVE &&
                          (m.status === MilestoneStatus.IN_PROGRESS || m.status === MilestoneStatus.IN_REVISION) && (
                            <button
                              onClick={() => {
                                setActiveMilestoneId(m.id);
                                setActionType('SUBMIT');
                                setSubmissionNotes('');
                                setAttachmentUrl('');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white flex items-center space-x-1 shadow-sm transition cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Submit Deliverable</span>
                            </button>
                          )}

                        {isClient && m.status === MilestoneStatus.SUBMITTED && (
                          <>
                            <button
                              onClick={() => handleApproveMilestone(m.id)}
                              disabled={isSubmitting}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
                            >
                              Approve Deliverable
                            </button>
                            <button
                              onClick={() => {
                                setActiveMilestoneId(m.id);
                                setActionType('REVISE');
                                setRevisionReason('');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] dark:bg-[#171717] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 border border-[#CBD5E1] dark:border-[rgba(205,203,202,0.18)] text-xs font-medium text-[#475569] dark:text-[#CDCBCA] transition cursor-pointer"
                            >
                              Request Revision
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Submissions & Deliverables Review */}
                  {m.submissions && m.submissions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] space-y-2">
                      <span className="text-[10px] font-bold text-[#64748B] dark:text-[#777777] uppercase tracking-wider">
                        Submitted Deliverables &amp; Evidence ({m.submissions.length})
                      </span>
                      <div className="space-y-2">
                        {m.submissions.map((sub, sIdx) => {
                          const subNumber = m.submissions ? m.submissions.length - sIdx : 1;
                          const workerName = sub.worker ? `${sub.worker.firstName || ''} ${sub.worker.lastName || ''}`.trim() : 'Specialist';
                          return (
                            <div key={sub.id || sIdx} className="p-3 rounded-lg bg-[#FFFFFF] dark:bg-[#171717] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] space-y-2">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-[#242424] dark:text-[#CDCBCA]">
                                  Submission #{subNumber} by <span className="text-[#2563EB]">{workerName}</span>
                                </span>
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    sub.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' :
                                    sub.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300' :
                                    'bg-[#2563EB]/20 text-[#2563EB]'
                                  }`}>
                                    {sub.status}
                                  </span>
                                  <span className="text-[10px] text-[#64748B] dark:text-[#777777] font-mono">
                                    {new Date(sub.submittedAt || sub.createdAt || Date.now()).toLocaleString()}
                                  </span>
                                </div>
                              </div>

                              <p className="text-[#334155] dark:text-[#CDCBCA] text-xs bg-[#F8FAFC] dark:bg-[#202020] p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] leading-relaxed">
                                {sub.notes}
                              </p>

                              {sub.attachmentUrls && sub.attachmentUrls.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10px] text-[#64748B] dark:text-[#777777] font-medium">Deliverable Evidence / Repository Links:</span>
                                  <div className="flex flex-wrap gap-2">
                                    {sub.attachmentUrls.map((url, uIdx) => (
                                      <a
                                        key={uIdx}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#EFF6FF] dark:bg-[#202020] hover:bg-[#DBEAFE] dark:hover:bg-[#303030] text-[#2563EB] text-[11px] border border-[#DBEAFE] dark:border-[rgba(205,203,202,0.18)] transition font-mono"
                                      >
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                        <span className="truncate max-w-[240px]">{url}</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Deliverable Submission / Revision Drawer Form */}
            {activeMilestoneId && actionType && (
              <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#202020] border border-[#CBD5E1] dark:border-[rgba(205,203,202,0.18)] space-y-3">
                <h4 className="text-xs font-bold text-[#242424] dark:text-[#CDCBCA]">
                  {actionType === 'SUBMIT' ? 'Submit Milestone Deliverable' : 'Request Milestone Revision'}
                </h4>

                {actionType === 'SUBMIT' ? (
                  <form onSubmit={handleSubmitDeliverable} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[#242424] dark:text-[#CDCBCA] font-medium mb-1">
                        Deliverable Notes &amp; Evidence *
                      </label>
                      <textarea
                        value={submissionNotes}
                        onChange={(e) => setSubmissionNotes(e.target.value)}
                        rows={3}
                        placeholder="Describe completed deliverables, commit hashes, pull requests, test verification..."
                        className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] dark:bg-[#171717] border border-[#CBD5E1] dark:border-[rgba(205,203,202,0.18)] text-[#242424] dark:text-[#CDCBCA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] transition leading-relaxed"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[#242424] dark:text-[#CDCBCA] font-medium">Deliverable Evidence Files / Links</label>
                        {isAuthorizingUpload && (
                          <span className="text-[10px] text-[#2563EB] animate-pulse">Authorizing upload...</span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#64748B] dark:text-[#777777] block mb-1">Upload File (PDF, ZIP, Images, Docs)</label>
                          <label className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-[#FFFFFF] dark:bg-[#171717] border border-[#CBD5E1] dark:border-[rgba(205,203,202,0.18)] hover:border-[#2563EB] cursor-pointer text-[#242424] dark:text-[#CDCBCA] transition">
                            <Paperclip className="w-3.5 h-3.5 text-[#2563EB]" />
                            <span className="truncate max-w-[150px] text-[11px] font-mono">
                              {uploadFileName || 'Choose Local File'}
                            </span>
                            <input
                              type="file"
                              onChange={handleDeliverableFileUpload}
                              disabled={isAuthorizingUpload}
                              className="hidden"
                            />
                          </label>
                        </div>

                        <div>
                          <label className="text-[10px] text-[#64748B] dark:text-[#777777] block mb-1">Or Direct Attachment / Repo URL</label>
                          <input
                            type="url"
                            value={attachmentUrl}
                            onChange={(e) => setAttachmentUrl(e.target.value)}
                            placeholder="https://github.com/... or https://..."
                            className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] dark:bg-[#171717] border border-[#CBD5E1] dark:border-[rgba(205,203,202,0.18)] text-[#242424] dark:text-[#CDCBCA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] font-mono transition"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMilestoneId(null);
                          setActionType(null);
                          setUploadFileName(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#171717] text-[#242424] dark:text-[#CDCBCA] border border-[#CBD5E1] dark:border-[rgba(205,203,202,0.18)] transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold flex items-center space-x-1 shadow-sm transition cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isSubmitting ? 'Uploading...' : 'Confirm Submission'}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleRequestRevision} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[#242424] dark:text-[#CDCBCA] font-medium mb-1">Reason for Revision *</label>
                      <textarea
                        value={revisionReason}
                        onChange={(e) => setRevisionReason(e.target.value)}
                        rows={3}
                        placeholder="Detail specific criteria that require correction or additional deliverables..."
                        className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] dark:bg-[#171717] border border-[#CBD5E1] dark:border-[rgba(205,203,202,0.18)] text-[#242424] dark:text-[#CDCBCA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] transition leading-relaxed"
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
                        className="px-3 py-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#171717] text-[#242424] dark:text-[#CDCBCA] border border-[#CBD5E1] dark:border-[rgba(205,203,202,0.18)] transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-sm transition cursor-pointer"
                      >
                        {isSubmitting ? 'Submitting...' : 'Send Revision Request'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SCOPE & TERMS */}
        {modalTab === 'scope' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#202020] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] space-y-1">
                <span className="text-[10px] font-semibold text-[#64748B] dark:text-[#777777] uppercase tracking-wider">Client (Buyer)</span>
                <p className="text-xs font-bold text-[#242424] dark:text-[#CDCBCA]">
                  {contract.client?.firstName
                    ? `${contract.client.firstName} ${contract.client.lastName || ''}`.trim()
                    : 'Verified Client'}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-[#A5A5A5] font-mono">{contract.client?.email}</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#202020] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] space-y-1">
                <span className="text-[10px] font-semibold text-[#64748B] dark:text-[#777777] uppercase tracking-wider">Specialist (Provider)</span>
                <p className="text-xs font-bold text-[#242424] dark:text-[#CDCBCA]">
                  {contract.worker?.firstName
                    ? `${contract.worker.firstName} ${contract.worker.lastName || ''}`.trim()
                    : 'Verified Specialist'}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-[#A5A5A5] font-mono">{contract.worker?.email}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#202020] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] space-y-2">
              <h4 className="text-xs font-bold text-[#242424] dark:text-[#CDCBCA] uppercase tracking-wider">Statement of Work</h4>
              <p className="text-xs text-[#475569] dark:text-[#A5A5A5] leading-relaxed max-w-[68ch]">
                {detailedContract.scopeOfWork || detailedContract.description}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#202020] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] space-y-2">
              <h4 className="text-xs font-bold text-[#242424] dark:text-[#CDCBCA] uppercase tracking-wider">Commercial Terms &amp; Cancellation</h4>
              <p className="text-xs text-[#475569] dark:text-[#A5A5A5] leading-relaxed max-w-[68ch]">
                {detailedContract.termsAndConditions || 'Standard TrustPay Enterprise digital contract terms apply.'}
              </p>
            </div>

            {/* Digital Sign-off Banner if pending */}
            {detailedContract.status === ContractStatus.PENDING_ACCEPTANCE && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-600 dark:text-amber-300 flex items-center space-x-1">
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                    <span>Digital Sign-Off Required</span>
                  </span>
                  <p className="text-[#334155] dark:text-[#CDCBCA]">
                    {hasUserAccepted
                      ? '✓ You have digitally accepted this agreement version. Awaiting counterparty sign-off to activate.'
                      : hasOtherAccepted
                      ? 'Counterparty has digitally signed this agreement. Review terms and provide your sign-off.'
                      : 'Review the commercial scope and milestones, then provide your digital sign-off to activate.'}
                  </p>
                </div>

                {!hasUserAccepted && (
                  <button
                    onClick={handleDigitalAccept}
                    disabled={isAccepting}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white shrink-0 shadow-sm transition flex items-center space-x-1 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{isAccepting ? 'Recording Acceptance...' : 'Accept & Sign Contract'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Client Office Stamp Status Banner */}
            {isApproved && (
              <div className="p-4 rounded-xl bg-[#141614] border dark:border-[#262926] border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg dark:bg-[#8BFF24]/10 bg-[#EEF2FF] border dark:border-[#8BFF24]/30 border-[#C7D2FE] flex items-center justify-center dark:text-[#8BFF24] text-[#5046E5]">
                    <Stamp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold dark:text-white text-slate-900 flex items-center gap-1.5">
                      Client Digital Office Stamp
                      {hasClientStamp ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full dark:bg-[#8BFF24]/10 bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] border dark:border-[#8BFF24]/30 border-[#C7D2FE] font-semibold">
                          Applied ✓
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full dark:bg-zinc-800 bg-slate-100 dark:text-zinc-400 text-slate-600 border dark:border-zinc-700 border-slate-300 font-semibold">
                          Ready to Apply
                        </span>
                      )}
                    </span>
                    <p className="dark:text-zinc-400 text-slate-500 mt-0.5">
                      {hasClientStamp
                        ? 'Official TrustPay office seal is embedded in the reserved space at the bottom of the shared PDF.'
                        : isClient
                        ? 'This contract is approved. You can now apply your official circular office stamp to the shared agreement.'
                        : 'Awaiting Client office stamp application to the approved contract PDF.'}
                    </p>
                  </div>
                </div>

                {isClient && !hasClientStamp && (
                  <button
                    onClick={() => setShowStampModal(true)}
                    className="px-4 py-2 rounded-xl dark:bg-[#8BFF24] bg-[#5046E5] hover:dark:bg-[#78e018] hover:bg-[#4338CA] dark:text-black text-white shadow-md shadow-[#5046E5]/25 text-xs font-bold transition shrink-0 flex items-center gap-1.5 shadow-[0_0_12px_rgba(139,255,36,0.2)]"
                  >
                    <Stamp className="w-4 h-4" />
                    <span>Apply Office Stamp</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ESCROW & CASHFREE GATEWAY */}
        {modalTab === 'escrow' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#202020] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] space-y-3">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] pb-2.5">
                <div className="flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-[#2563EB]" />
                  <h4 className="text-xs font-bold text-[#242424] dark:text-[#CDCBCA] uppercase tracking-wider">Escrow Custody Status</h4>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-mono ${
                  escrowRecord?.status === 'FUNDED'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20'
                }`}>
                  {escrowRecord?.status || 'PENDING_INITIALIZATION'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono tabular-nums">
                <div className="p-2.5 rounded-lg bg-[#FFFFFF] dark:bg-[#171717] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)]">
                  <span className="text-[10px] text-[#64748B] dark:text-[#A5A5A5] font-sans">Agreed Total</span>
                  <div className="text-sm font-bold text-[#242424] dark:text-[#CDCBCA] mt-0.5">
                    ${Number(contract.totalAmount).toLocaleString()} <span className="text-xs font-normal text-[#64748B] dark:text-[#777777]">{contract.currency}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#FFFFFF] dark:bg-[#171717] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)]">
                  <span className="text-[10px] text-[#64748B] dark:text-[#A5A5A5] font-sans">Verified Escrow</span>
                  <div className="text-sm font-bold text-amber-500 dark:text-amber-400 mt-0.5">
                    {escrowRecord?.status === 'FUNDED' ? `$${Number(contract.totalAmount).toLocaleString()}` : '$0.00'}{' '}
                    <span className="text-xs font-normal text-[#64748B] dark:text-[#777777]">USD</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#FFFFFF] dark:bg-[#171717] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)]">
                  <span className="text-[10px] text-[#64748B] dark:text-[#A5A5A5] font-sans">Released Funds</span>
                  <div className="text-sm font-bold text-[#2563EB] mt-0.5">
                    $0.00 <span className="text-xs font-normal text-[#64748B] dark:text-[#777777]">USD</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cashfree Sandbox Terminal Card */}
            <div className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#171717] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-[#2563EB]" />
                  <span className="text-xs font-bold text-[#242424] dark:text-[#CDCBCA]">Cashfree Hosted Checkout</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                    SANDBOX / ZERO REAL MONEY
                  </span>
                </div>
              </div>

              {paymentNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-300 flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{paymentNotice}</span>
                </div>
              )}

              {paymentError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-300 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="text-xs text-[#334155] dark:text-[#CDCBCA]">
                  <p className="font-semibold">
                    Test Escrow Funding:{' '}
                    <span className="text-[#2563EB] font-mono tabular-nums">
                      ₹{(Number(contract.totalAmount)).toLocaleString()} INR
                    </span>
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-[#A5A5A5]">
                    Simulate card or UPI payments in Cashfree hosted checkout modal.
                  </p>
                </div>

                {isClient ? (
                  <button
                    onClick={handleCashfreeCheckout}
                    disabled={isInitiatingPayment || isVerifyingPayment}
                    className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-xs font-bold text-white shrink-0 shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>
                      {isInitiatingPayment
                        ? 'Creating Sandbox Order...'
                        : isVerifyingPayment
                        ? 'Verifying Payment...'
                        : 'Launch Cashfree Sandbox'}
                    </span>
                  </button>
                ) : (
                  <div className="text-[11px] text-[#64748B] dark:text-[#777777] italic">
                    Specialist view: Client funds escrow via Cashfree sandbox.
                  </div>
                )}
              </div>

              {paymentTransactions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] space-y-1.5">
                  <span className="text-[10px] font-semibold text-[#64748B] dark:text-[#777777] uppercase tracking-wider">
                    Sandbox Transactions ({paymentTransactions.length})
                  </span>
                  <div className="space-y-1">
                    {paymentTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-2 rounded-lg bg-[#F8FAFC] dark:bg-[#202020] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] flex items-center justify-between text-[11px] font-mono tabular-nums"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-[#242424] dark:text-[#CDCBCA] font-medium">{tx.transactionReference}</span>
                          {tx.providerOrderId && (
                            <span className="text-[10px] text-[#64748B] dark:text-[#777777]">({tx.providerOrderId})</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[#64748B] dark:text-[#A5A5A5]">
                            {(Number(tx.amountMinor) / 100).toFixed(2)} {tx.currency}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              tx.status === 'SUCCEEDED'
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                                : tx.status === 'FAILED'
                                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300'
                                : 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
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
        )}

        {/* TAB 4: DISPUTES & GOVERNANCE */}
        {modalTab === 'governance' && (
          <div className="space-y-4">
            <ContractLifecyclePanel
              contract={detailedContract}
              currentUserId={currentUserId}
              isClient={isClient}
              isWorker={isWorker}
              onRefresh={() => {
                fetchContractDetails();
                onRefresh();
              }}
            />

            {/* Digital Acceptance Audit Trail */}
            {detailedContract.acceptances && detailedContract.acceptances.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] text-xs">
                <span className="font-semibold text-[#64748B] dark:text-[#777777] uppercase tracking-wider text-[10px]">
                  Digital Acceptance Audit Trail
                </span>
                <div className="space-y-1">
                  {detailedContract.acceptances.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-2.5 rounded-lg bg-[#F8FAFC] dark:bg-[#202020] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] flex items-center justify-between font-mono"
                    >
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        ✓ {acc.role}: {acc.user?.firstName || ''} {acc.user?.lastName || ''} ({acc.user?.email})
                      </span>
                      <span className="text-[#64748B] dark:text-[#777777] text-[10px]">
                        Method: {acc.acceptanceMethod} • {new Date(acc.acceptedAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CLIENT STAMP APPLICATION MODAL */}
      {showStampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 shadow-sm w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowStampModal(false)}
              className="absolute top-4 right-4 dark:text-zinc-400 text-slate-500 hover:dark:text-white hover:text-slate-900 p-1 rounded-lg hover:dark:bg-zinc-800 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl dark:bg-[#8BFF24]/10 bg-[#EEF2FF] border dark:border-[#8BFF24]/30 border-[#C7D2FE] flex items-center justify-center dark:text-[#8BFF24] text-[#5046E5]">
                <Stamp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold dark:text-white text-slate-900">Apply Client Digital Office Stamp</h3>
                <p className="text-xs dark:text-zinc-400 text-slate-500">Embed your official seal into Contract #{detailedContract.contractNumber}</p>
              </div>
            </div>

            {/* Placement selection */}
            <div className="space-y-2 text-xs">
              <label className="dark:text-zinc-300 text-slate-700 font-semibold block">Placement in Reserved Empty Space</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'BOTTOM_RIGHT', label: 'Bottom Right' },
                  { id: 'BOTTOM_CENTER', label: 'Bottom Center' },
                  { id: 'BOTTOM_LEFT', label: 'Bottom Left' },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setStampPosition(pos.id as any)}
                    className={`p-2.5 rounded-xl border text-center font-medium transition ${
                      stampPosition === pos.id
                        ? 'dark:bg-[#8BFF24]/10 bg-[#EEF2FF] dark:border-[#8BFF24] border-[#5046E5] dark:text-white text-[#5046E5] shadow-sm'
                        : 'dark:bg-[#181a18] bg-slate-50 dark:border-[#262926] border-slate-200 dark:text-zinc-400 text-slate-600 hover:dark:text-white hover:text-slate-900'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3.5 dark:bg-[#181a18] bg-slate-50 rounded-xl border dark:border-[#262926] border-slate-200 text-xs dark:text-zinc-400 text-slate-500 space-y-1.5">
              <div className="flex justify-between dark:text-zinc-300 text-slate-700">
                <span>Signer:</span>
                <span className="font-semibold dark:text-white text-slate-900">Authenticated Client</span>
              </div>
              <div className="flex justify-between dark:text-zinc-300 text-slate-700">
                <span>Timestamp:</span>
                <span className="font-mono text-emerald-400">Server Live UTC</span>
              </div>
              <p className="text-[11px] text-zinc-500 pt-1 border-t dark:border-[#262926] border-slate-200">
                The stamp contains TRUSTPAY watermark, Client name, verified mobile, and server date. Embedded directly into the final PDF.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t dark:border-[#262926] border-slate-200">
              <button
                type="button"
                onClick={() => setShowStampModal(false)}
                className="px-4 py-2 rounded-xl dark:bg-zinc-800 bg-slate-100 hover:dark:bg-zinc-700 hover:bg-slate-200 dark:text-zinc-200 text-slate-700 border dark:border-transparent border-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyStampFromModal}
                disabled={isApplyingStamp}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl dark:bg-[#8BFF24] bg-[#5046E5] hover:dark:bg-[#78e018] hover:bg-[#4338CA] dark:text-black text-white shadow-md shadow-[#5046E5]/25 text-xs font-bold transition disabled:opacity-50"
              >
                <Stamp className="w-3.5 h-3.5" />
                <span>{isApplyingStamp ? 'Applying Stamp...' : 'Confirm & Apply Stamp'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && (
        <ContractReviewModal
          contractId={detailedContract.id}
          contractTitle={detailedContract.title}
          recipientName={isClient ? [detailedContract.worker?.firstName, detailedContract.worker?.lastName].filter(Boolean).join(' ') || 'Specialist' : [detailedContract.client?.firstName, detailedContract.client?.lastName].filter(Boolean).join(' ') || 'Client'}
          recipientRole={isClient ? 'SPECIALIST' : 'CLIENT'}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            // Refresh
          }}
        />
      )}
    </div>
  );
};
