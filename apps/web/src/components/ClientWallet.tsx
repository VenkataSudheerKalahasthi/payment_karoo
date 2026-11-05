import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ShieldCheck,
  TrendingUp,
  RotateCcw,
  Clock,
  Eye,
  X,
  AlertCircle,
  FileText,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import { apiService } from '../services/api';
import { ClientWalletDto, PaymentTransactionDto } from '@trustpay/shared';

interface ClientWalletProps {
  onNavigateToContract?: (contractId: string) => void;
}

export const ClientWallet: React.FC<ClientWalletProps> = ({ onNavigateToContract }) => {
  const [wallet, setWallet] = useState<ClientWalletDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<PaymentTransactionDto | null>(null);
  const [refundContractId, setRefundContractId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiService.getWalletOverview();
      if (res.success && res.data && res.data.role === 'CLIENT') {
        setWallet(res.data as ClientWalletDto);
      }
    } catch {
      setErrorMessage('Failed to load virtual wallet records.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundContractId || refundReason.trim().length < 5) {
      setErrorMessage('Please provide a valid refund justification (min 5 characters).');
      return;
    }

    setIsSubmittingRefund(true);
    setErrorMessage(null);
    try {
      const res = await apiService.processRefund({
        contractId: refundContractId,
        reason: refundReason.trim(),
      });
      if (res.success) {
        setActionNotice(`Refund of $${res.data?.refundAmount} processed successfully under reference ${res.data?.transactionReference}.`);
        setRefundContractId(null);
        setRefundReason('');
        loadWallet();
      } else {
        setErrorMessage(res.error?.message || 'Refund processing failed');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error processing refund');
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center space-y-3 dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl animate-pulse">
        <RefreshCw className="w-8 h-8 animate-spin text-[#2563EB] mx-auto" />
        <p className="text-xs dark:text-[#A5A5A5] text-[#64748B]">Loading ledger-verified wallet metrics...</p>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="p-8 dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl text-center space-y-3 shadow-sm">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-sm font-bold dark:text-[#CDCBCA] text-[#242424]">Wallet Unavailable</h3>
        <p className="text-xs dark:text-[#A5A5A5] text-[#64748B]">Could not retrieve client wallet records from financial ledger.</p>
        <button
          onClick={loadWallet}
          className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white transition shadow-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg dark:bg-[#202020] bg-[#EFF6FF] border dark:border-[rgba(205,203,202,0.18)] border-[#DBEAFE] flex items-center justify-center text-[#2563EB]">
              <Wallet className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold dark:text-[#CDCBCA] text-[#242424] tracking-tight">Client Virtual Wallet</h2>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono font-semibold">
              LEDGER VERIFIED
            </span>
          </div>
          <p className="text-xs dark:text-[#A5A5A5] text-[#64748B]">
            Authoritative financial balances calculated directly from double-entry ledger transactions and escrow custody records.
          </p>
        </div>

        <button
          onClick={loadWallet}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg dark:bg-[#202020] bg-[#F8FAFC] dark:hover:bg-[#303030] hover:bg-[#F1F5F9] text-xs font-semibold dark:text-[#CDCBCA] text-[#242424] transition border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1] shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#2563EB]" />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {actionNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium dark:text-[#A5A5A5] text-[#64748B]">Total Contract Funding</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            ${wallet.totalContractFunding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] dark:text-[#777777] text-[#94A3B8]">Confirmed deposits across all contracts</p>
        </div>

        <div className="p-5 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium dark:text-[#A5A5A5] text-[#64748B]">Active Escrow Balance</span>
            <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="text-2xl font-bold text-[#2563EB] font-mono tabular-nums">
            ${wallet.activeContractFunding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] dark:text-[#777777] text-[#94A3B8]">Held in secure milestone custody</p>
        </div>

        <div className="p-5 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium dark:text-[#A5A5A5] text-[#64748B]">Completed &amp; Released</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums">
            ${wallet.completedMilestoneAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] dark:text-[#777777] text-[#94A3B8]">Settled deliverables approved by you</p>
        </div>

        <div className="p-5 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium dark:text-[#A5A5A5] text-[#64748B]">Refund History</span>
            <RotateCcw className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-500 dark:text-amber-400 font-mono tabular-nums">
            ${wallet.totalRefundedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] dark:text-[#777777] text-[#94A3B8]">Returned from cancelled escrows</p>
        </div>
      </div>

      {/* Contract-Wise Financial Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-sm font-bold dark:text-[#CDCBCA] text-[#242424]">Contract-Wise Financial Breakdown</h3>
          </div>
          <span className="text-xs font-mono dark:text-[#A5A5A5] text-[#64748B]">
            {wallet.contracts.length} Contract{wallet.contracts.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs dark:text-[#CDCBCA] text-[#334155]">
              <thead className="dark:bg-[#202020] bg-[#F8FAFC] dark:text-[#A5A5A5] text-[#64748B] font-medium border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4">Contract</th>
                  <th className="py-3 px-4">Agreed Value</th>
                  <th className="py-3 px-4">Funded</th>
                  <th className="py-3 px-4">Released</th>
                  <th className="py-3 px-4">Remaining Escrow</th>
                  <th className="py-3 px-4">Escrow State</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-[rgba(205,203,202,0.18)] divide-[#F1F5F9]">
                {wallet.contracts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center dark:text-[#777777] text-[#94A3B8] italic">
                      No contracts found.
                    </td>
                  </tr>
                ) : (
                  wallet.contracts.map((c) => (
                    <tr key={c.contractId} className="dark:hover:bg-[#202020] hover:bg-[#F8FAFC] transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold dark:text-[#CDCBCA] text-[#242424]">{c.title}</div>
                        <div className="text-[10px] font-mono dark:text-[#777777] text-[#94A3B8]">#{c.contractNumber}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium tabular-nums">
                        ${c.totalAgreedAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                        ${c.fundedAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400 tabular-nums">
                        ${c.releasedAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#2563EB] tabular-nums">
                        ${c.remainingInEscrow.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            c.escrowStatus === 'FUNDED'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : c.escrowStatus === 'DISPUTED'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : c.escrowStatus === 'RELEASED'
                                  ? 'bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20'
                                  : 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {c.escrowStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {c.remainingInEscrow > 0 && c.escrowStatus !== 'DISPUTED' && (
                          <button
                            onClick={() => {
                              setRefundContractId(c.contractId);
                              setRefundReason('');
                            }}
                            className="px-2 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-semibold transition"
                          >
                            Refund
                          </button>
                        )}
                        {onNavigateToContract && (
                          <button
                            onClick={() => onNavigateToContract(c.contractId)}
                            className="px-2.5 py-1 rounded-md dark:bg-[#202020] bg-[#F1F5F9] dark:hover:bg-[#303030] hover:bg-[#E2E8F0] dark:text-[#CDCBCA] text-[#242424] text-[10px] font-semibold border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1] transition"
                          >
                            Inspect
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payment Transactions History */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-[#2563EB]" />
          <h3 className="text-sm font-bold dark:text-[#CDCBCA] text-[#242424]">Payment Transaction Ledger History</h3>
        </div>

        <div className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs dark:text-[#CDCBCA] text-[#334155]">
              <thead className="dark:bg-[#202020] bg-[#F8FAFC] dark:text-[#A5A5A5] text-[#64748B] font-medium border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4">Transaction Reference</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-[rgba(205,203,202,0.18)] divide-[#F1F5F9]">
                {wallet.recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center dark:text-[#777777] text-[#94A3B8] italic">
                      No payment transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  wallet.recentTransactions.map((tx) => (
                    <tr key={tx.id} className="dark:hover:bg-[#202020] hover:bg-[#F8FAFC] transition">
                      <td className="py-3 px-4 font-mono font-semibold dark:text-[#CDCBCA] text-[#242424]">
                        {tx.transactionReference}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono dark:bg-[#202020] bg-[#F1F5F9] dark:text-[#CDCBCA] text-[#475569] border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1]">
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold dark:text-[#CDCBCA] text-[#242424] tabular-nums">
                        ${(Number(tx.amountMinor) / 100).toFixed(2)} {tx.currency}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.status === 'SUCCEEDED'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : tx.status === 'FAILED'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 dark:text-[#A5A5A5] text-[#64748B] text-[11px] font-mono">
                        {new Date(tx.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="px-2.5 py-1 rounded-md dark:bg-[#202020] bg-[#F1F5F9] dark:hover:bg-[#303030] hover:bg-[#E2E8F0] dark:text-[#CDCBCA] text-[#242424] text-xs transition inline-flex items-center space-x-1 border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1]"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#2563EB]" />
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
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl dark:text-[#CDCBCA] text-[#242424]">
            <div className="flex items-center justify-between border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-sm font-bold dark:text-[#CDCBCA] text-[#242424]">Transaction Record Inspection</h3>
              </div>
              <button onClick={() => setSelectedTx(null)} className="dark:text-[#777777] text-[#64748B] hover:dark:text-[#CDCBCA] hover:text-[#242424]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.18)] border-[#F1F5F9]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Transaction Reference:</span>
                <span className="font-mono font-bold dark:text-[#CDCBCA] text-[#242424]">{selectedTx.transactionReference}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.18)] border-[#F1F5F9]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Transaction Type:</span>
                <span className="font-mono text-[#2563EB] font-semibold">{selectedTx.type}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.18)] border-[#F1F5F9]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Monetary Value:</span>
                <span className="font-mono font-bold dark:text-[#CDCBCA] text-[#242424] tabular-nums">
                  ${(Number(selectedTx.amountMinor) / 100).toFixed(2)} {selectedTx.currency}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.18)] border-[#F1F5F9]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Status:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{selectedTx.status}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.18)] border-[#F1F5F9]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Provider Transaction ID:</span>
                <span className="font-mono dark:text-[#CDCBCA] text-[#242424]">{selectedTx.providerTransactionId || 'Internal Ledger'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.18)] border-[#F1F5F9]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Idempotency Key:</span>
                <span className="font-mono dark:text-[#777777] text-[#94A3B8] text-[10px] truncate max-w-[200px]">{selectedTx.idempotencyKey}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Recorded At:</span>
                <span className="font-mono dark:text-[#CDCBCA] text-[#242424]">{new Date(selectedTx.createdAt).toISOString()}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedTx(null)}
                className="w-full py-2 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] dark:hover:bg-[#303030] hover:bg-[#E2E8F0] text-xs font-semibold dark:text-[#CDCBCA] text-[#242424] border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1] transition"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Request Modal */}
      {refundContractId && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl dark:text-[#CDCBCA] text-[#242424]">
            <div className="flex items-center justify-between border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] pb-3">
              <div className="flex items-center space-x-2">
                <RotateCcw className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold dark:text-[#CDCBCA] text-[#242424]">Process Escrow Refund</h3>
              </div>
              <button onClick={() => setRefundContractId(null)} className="dark:text-[#777777] text-[#64748B] hover:dark:text-[#CDCBCA] hover:text-[#242424]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProcessRefund} className="space-y-4">
              <p className="text-xs dark:text-[#A5A5A5] text-[#64748B] leading-relaxed">
                Refunds return unreleased escrow funds back to your original payment method. The transaction will be posted to the double-entry financial ledger.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold dark:text-[#CDCBCA] text-[#242424]">Justification / Reason:</label>
                <textarea
                  rows={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Explain the cancellation or refund justification (minimum 5 characters)..."
                  className="w-full p-2.5 rounded-xl dark:bg-[#202020] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1] text-xs dark:text-[#CDCBCA] text-[#242424] placeholder:dark:text-[#777777] placeholder:text-[#94A3B8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] transition leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundContractId(null)}
                  className="px-4 py-2 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] dark:hover:bg-[#303030] hover:bg-[#E2E8F0] text-xs font-medium dark:text-[#CDCBCA] text-[#242424] border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRefund || refundReason.trim().length < 5}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition disabled:opacity-50 shadow-sm"
                >
                  {isSubmittingRefund ? 'Processing...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
