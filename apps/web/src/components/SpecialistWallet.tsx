import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  RefreshCw,
  Eye,
  X,
  Percent,
  Layers,
  ArrowDownLeft,
} from 'lucide-react';
import { apiService } from '../services/api';
import { SpecialistWalletDto, PaymentTransactionDto } from '@trustpay/shared';

interface SpecialistWalletProps {
  onNavigateToProjects?: () => void;
  onNavigateToContract?: (contractId: string) => void;
}

export const SpecialistWallet: React.FC<SpecialistWalletProps> = ({
  onNavigateToProjects,
  onNavigateToContract,
}) => {
  const [wallet, setWallet] = useState<SpecialistWalletDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<PaymentTransactionDto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiService.getWalletOverview();
      if (res.success && res.data && res.data.role === 'WORKER') {
        setWallet(res.data as SpecialistWalletDto);
      } else {
        setErrorMessage(res.error?.message || 'Failed to load specialist financial records.');
      }
    } catch {
      setErrorMessage('Failed to connect to financial ledger records.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  if (isLoading) {
    return (
      <div className="p-16 text-center space-y-3 dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl animate-pulse">
        <RefreshCw className="w-8 h-8 animate-spin text-[#2563EB] mx-auto" />
        <p className="text-xs dark:text-[#A5A5A5] text-[#64748B]">Loading specialist earnings and settlement records...</p>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="p-8 dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl text-center space-y-3 shadow-sm">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-sm font-bold dark:text-[#CDCBCA] text-[#242424]">Wallet Unavailable</h3>
        <p className="text-xs dark:text-[#A5A5A5] text-[#64748B]">Could not retrieve specialist earnings records from financial ledger.</p>
        <button
          onClick={loadWallet}
          className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white transition shadow-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl p-6 relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#2563EB]/10 text-[#2563EB] dark:text-[#CDCBCA] border border-[#2563EB]/20">
                Specialist Earnings &amp; Virtual Settlement
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Live Movement Disabled
              </span>
            </div>
            <h1 className="text-2xl font-bold dark:text-[#CDCBCA] text-[#242424] flex items-center gap-2 tracking-tight">
              <Wallet className="w-6 h-6 text-[#2563EB]" />
              Specialist Financial Ledger &amp; Earnings
            </h1>
            <p className="text-xs dark:text-[#A5A5A5] text-[#64748B] mt-1 max-w-2xl leading-relaxed">
              Real-time read projection of approved deliverables, platform commissions, and settled earnings computed directly from double-entry ledger journals.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onNavigateToProjects && (
              <button
                onClick={onNavigateToProjects}
                className="px-4 py-2 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] text-xs font-semibold dark:text-[#CDCBCA] text-[#242424] flex items-center gap-1.5 transition shadow-sm"
              >
                <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
                View Milestones
              </button>
            )}
            <button
              onClick={loadWallet}
              className="p-2.5 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#242424] transition shadow-sm"
              title="Refresh ledger state"
              aria-label="Refresh ledger state"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 5 KPI Cards Bento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Contract Value */}
        <div className="p-4 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] shadow-sm hover:border-[#2563EB]/40 transition">
          <div className="flex items-center justify-between dark:text-[#A5A5A5] text-[#64748B] text-xs mb-2">
            <span>Contract Value</span>
            <DollarSign className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="text-xl font-bold dark:text-[#CDCBCA] text-[#242424] font-mono tabular-nums tracking-tight">
            ${wallet.totalContractValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] dark:text-[#777777] text-[#64748B] font-mono mt-1">
            {wallet.contractsCount} contract{wallet.contractsCount === 1 ? '' : 's'} assigned
          </p>
        </div>

        {/* Pending Milestone Earnings */}
        <div className="p-4 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] shadow-sm hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between dark:text-[#A5A5A5] text-[#64748B] text-xs mb-2">
            <span>Pending Work</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-500 font-mono tabular-nums tracking-tight">
            ${wallet.pendingMilestoneEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] dark:text-[#777777] text-[#64748B] mt-1">In progress &amp; unsubmitted</p>
        </div>

        {/* Submitted Deliverables */}
        <div className="p-4 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] shadow-sm hover:border-[#2563EB]/40 transition">
          <div className="flex items-center justify-between dark:text-[#A5A5A5] text-[#64748B] text-xs mb-2">
            <span>In Review</span>
            <FileText className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="text-xl font-bold dark:text-[#CDCBCA] text-[#242424] font-mono tabular-nums tracking-tight">
            ${wallet.submittedMilestoneAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] dark:text-[#777777] text-[#64748B] mt-1">Awaiting client review</p>
        </div>

        {/* Approved / Settlement Eligible */}
        <div className="p-4 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] shadow-sm hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-emerald-500 text-xs mb-2">
            <span>Eligible for Settlement</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-500 font-mono tabular-nums tracking-tight">
            ${wallet.approvedMilestoneAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-emerald-500/80 font-mono mt-1">Approved &amp; ready to settle</p>
        </div>

        {/* Settled Net Earnings */}
        <div className="p-4 rounded-2xl dark:bg-[#202020] bg-[#EFF6FF] border dark:border-[rgba(205,203,202,0.25)] border-[#DBEAFE] shadow-sm hover:border-emerald-500/50 transition">
          <div className="flex items-center justify-between text-emerald-500 text-xs mb-2">
            <span className="font-semibold">Settled Earnings</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-500 font-mono tabular-nums tracking-tight">
            ${wallet.settledEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-emerald-500/80 font-mono mt-1">Ledger verified &amp; credited</p>
        </div>
      </div>

      {/* Financial Health & Commission Transparency Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex items-start gap-3 shadow-sm">
          <div className="p-2.5 rounded-xl bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20 shrink-0">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold dark:text-[#CDCBCA] text-[#242424]">Commission Transparency</h4>
            <p className="text-[11px] dark:text-[#A5A5A5] text-[#64748B] mt-1 leading-relaxed">
              Platform commission retained across settled milestones: <span className="font-mono font-semibold dark:text-[#CDCBCA] text-[#242424]">${wallet.platformCommission.toFixed(2)} USD</span>. Net earnings reflect full gross minus commission.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex items-start gap-3 shadow-sm">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold dark:text-[#CDCBCA] text-[#242424]">Escrow Protection Guarantee</h4>
            <p className="text-[11px] dark:text-[#A5A5A5] text-[#64748B] mt-1 leading-relaxed">
              Funds are held safely in client escrow prior to milestone commencement. Once deliverables are accepted, settlements are guaranteed by double-entry records.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex items-start gap-3 shadow-sm">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold dark:text-[#CDCBCA] text-[#242424]">Dispute &amp; Hold Status</h4>
            <p className="text-[11px] dark:text-[#A5A5A5] text-[#64748B] mt-1 leading-relaxed">
              Held or disputed reserves: <span className="font-mono font-semibold text-amber-500">${wallet.disputedOrHeldAmount.toFixed(2)} USD</span>.
              {wallet.disputedOrHeldAmount === 0 ? ' No active financial holds.' : ' Subject to dispute mediation.'}
            </p>
          </div>
        </div>
      </div>

      {/* Transaction & Settlement Ledger Table */}
      <div className="p-6 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-sm font-bold dark:text-[#CDCBCA] text-[#242424]">Settlement &amp; Earnings Journal</h3>
            <span className="text-xs dark:text-[#777777] text-[#64748B] font-mono">({wallet.recentTransactions.length} records)</span>
          </div>
          <span className="text-[11px] dark:text-[#777777] text-[#64748B]">Double-entry verified records</span>
        </div>

        {wallet.recentTransactions.length === 0 ? (
          <div className="p-8 text-center text-xs dark:text-[#777777] text-[#64748B] dark:bg-[#080808]/40 bg-[#F8FAFC] rounded-xl border border-dashed dark:border-[rgba(205,203,202,0.15)] border-[#E2E8F0]">
            No settlement transactions recorded yet. When the client approves milestones and settlements are executed, journal transactions will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="dark:bg-[#202020] bg-[#F1F5F9] dark:text-[#A5A5A5] text-[#64748B] uppercase tracking-wider text-[10px] border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0]">
                <tr>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0] font-mono text-[11px]">
                {wallet.recentTransactions.map((tx) => {
                  const amount = Number(tx.amountMinor) / 100;
                  return (
                    <tr key={tx.id} className="hover:dark:bg-[#202020]/50 hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-2.5 px-3 font-semibold dark:text-[#CDCBCA] text-[#242424]">
                        {tx.transactionReference}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium dark:bg-[#202020] bg-[#F1F5F9] dark:text-[#CDCBCA] text-[#475569] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0]">
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-500">
                        +${amount.toFixed(2)} {tx.currency}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            tx.status === 'SUCCEEDED'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : tx.status === 'PROCESSING' || tx.status === 'INITIATED'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 dark:text-[#A5A5A5] text-[#64748B] font-sans">
                        {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="px-2.5 py-1 rounded-lg dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] dark:text-[#CDCBCA] text-[#242424] text-[11px] font-medium flex items-center gap-1 transition shadow-sm"
                          >
                            <Eye className="w-3 h-3 text-[#2563EB]" />
                            Details
                          </button>
                          {tx.contractId && onNavigateToContract && (
                            <button
                              onClick={() => onNavigateToContract(tx.contractId!)}
                              className="px-2 py-1 rounded-lg dark:bg-[#202020]/60 bg-[#F1F5F9] hover:dark:bg-[#202020] hover:bg-[#E2E8F0] dark:text-[#A5A5A5] text-[#64748B] text-[11px] transition"
                            >
                              Contract
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative font-sans">
            <button
              onClick={() => setSelectedTx(null)}
              className="absolute right-4 top-4 p-1.5 rounded-lg dark:text-[#A5A5A5] text-[#64748B] hover:dark:text-white hover:text-black hover:dark:bg-[#202020] hover:bg-[#F1F5F9] transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-[#2563EB]" />
              <h3 className="text-base font-bold dark:text-[#CDCBCA] text-[#242424]">Settlement Journal Record</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Reference:</span>
                <span className="font-mono dark:text-[#CDCBCA] text-[#242424] font-semibold">{selectedTx.transactionReference}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Transaction ID:</span>
                <span className="font-mono dark:text-[#777777] text-[#64748B] text-[10px]">{selectedTx.id}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Contract ID:</span>
                <span className="font-mono dark:text-[#777777] text-[#64748B] text-[10px]">{selectedTx.contractId || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Type:</span>
                <span className="font-semibold dark:text-[#CDCBCA] text-[#242424]">{selectedTx.type}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Gross Settlement:</span>
                <span className="font-bold text-emerald-500 font-mono text-sm">
                  +${(Number(selectedTx.amountMinor) / 100).toFixed(2)} {selectedTx.currency}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Financial Status:</span>
                <span className="font-semibold text-emerald-500">{selectedTx.status}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Settlement Rail:</span>
                <span className="dark:text-[#CDCBCA] text-[#242424]">{selectedTx.provider || 'INTERNAL_ESCROW_ENGINE'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                <span className="dark:text-[#A5A5A5] text-[#64748B]">Recorded Timestamp:</span>
                <span className="dark:text-[#A5A5A5] text-[#64748B] font-mono">{new Date(selectedTx.createdAt).toLocaleString()}</span>
              </div>

              {selectedTx.metadata && (
                <div className="pt-2">
                  <span className="dark:text-[#A5A5A5] text-[#64748B] block mb-1">Metadata:</span>
                  <pre className="p-3 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0] text-[10px] font-mono dark:text-[#CDCBCA] text-[#242424] overflow-x-auto max-h-36">
                    {JSON.stringify(selectedTx.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] text-xs font-semibold dark:text-[#CDCBCA] text-[#242424] transition shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
