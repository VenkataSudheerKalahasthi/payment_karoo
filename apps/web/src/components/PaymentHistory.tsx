import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Download,
  Eye,
  X,
  ShieldCheck,
} from 'lucide-react';
import { apiService } from '../services/api';
import { PaymentTransactionDto } from '@trustpay/shared';

export const PaymentHistory: React.FC = () => {
  const [transactions, setTransactions] = useState<PaymentTransactionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedTx, setSelectedTx] = useState<PaymentTransactionDto | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.listPaymentTransactions({ limit: 100 });
      if (res.success && res.data) {
        setTransactions(res.data.items || []);
      } else {
        setError(res.error?.message || 'Failed to load payment transactions');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error loading payment transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const ref = (tx.transactionReference || tx.providerTransactionId || tx.id).toLowerCase();
      const q = searchQuery.toLowerCase();

      const matchesSearch = ref.includes(q) || (tx.type && tx.type.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'ALL' || tx.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchQuery, statusFilter]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    let totalDeposited = 0;
    let totalSettled = 0;
    let totalRefunded = 0;

    transactions.forEach((tx) => {
      const amt = Number(tx.amountMinor || 0) / 100;
      if (tx.status === 'SUCCEEDED') {
        if (tx.type?.includes('DEPOSIT') || tx.type?.includes('ORDER')) {
          totalDeposited += amt;
        } else if (tx.type?.includes('RELEASE') || tx.type?.includes('SETTLE')) {
          totalSettled += amt;
        } else if (tx.type?.includes('REFUND')) {
          totalRefunded += amt;
        } else {
          totalDeposited += amt;
        }
      }
    });

    return {
      count: transactions.length,
      totalDeposited,
      totalSettled,
      totalRefunded,
    };
  }, [transactions]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Succeeded
          </span>
        );
      case 'INITIATED':
      case 'PROCESSING':
      case 'REQUIRES_ACTION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3 animate-spin" />
            {status}
          </span>
        );
      case 'FAILED':
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
            <AlertCircle className="w-3 h-3" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold dark:bg-zinc-800 bg-[#EEF2FF] dark:text-zinc-300 text-[#475569] dark:border-zinc-700 border-[#C7D2FE]">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="interactive-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 shadow-sm p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl dark:bg-[#8BFF24]/10 bg-[#EEF2FF] border dark:border-[#8BFF24]/30 border-[#C7D2FE] flex items-center justify-center">
            <CreditCard className="w-5 h-5 dark:text-[#8BFF24] text-[#5046E5]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold dark:text-white text-slate-900 tracking-tight">Payment & Escrow History</h1>
            <p className="text-sm dark:text-zinc-400 text-slate-500">
              Complete non-custodial ledger transactions, escrow movements, and settlements.
            </p>
          </div>
        </div>

        <button
          onClick={fetchTransactions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl dark:bg-[#1e201e] bg-slate-100 border dark:border-[#2e322e] border-slate-300 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-slate-900 hover:dark:bg-[#282c28] hover:bg-slate-200 hover:dark:border-[#8BFF24]/40 border-[#C7D2FE] transition text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Ledger
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="interactive-card dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">Total Transactions</p>
          <p className="text-2xl font-bold dark:text-white text-slate-900 mt-1">{metrics.count}</p>
          <p className="text-xs text-zinc-500 mt-1">Immutable ledger entries</p>
        </div>

        <div className="interactive-card dark:bg-[#121412] bg-white border dark:border-[#8BFF24]/30 border-[#C7D2FE] shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-[#8BFF24] text-[#5046E5] uppercase tracking-wider font-semibold">Total Escrow Inflow</p>
          <p className="text-2xl font-bold dark:text-[#8BFF24] text-[#5046E5] mt-1 font-mono">${metrics.totalDeposited.toLocaleString()}</p>
          <p className="text-xs dark:text-zinc-400 text-slate-500 mt-1">Client funded escrow</p>
        </div>

        <div className="interactive-card dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">Settled to Specialists</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">${metrics.totalSettled.toLocaleString()}</p>
          <p className="text-xs text-zinc-500 mt-1">Disbursed on milestone approval</p>
        </div>

        <div className="interactive-card dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">Refunded Escrow</p>
          <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">${metrics.totalRefunded.toLocaleString()}</p>
          <p className="text-xs text-zinc-500 mt-1">Returned to wallet</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="interactive-card dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 shadow-sm p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 dark:text-zinc-400 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by reference or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full dark:bg-[#181a18] bg-slate-50 border dark:border-[#2e322e] border-slate-300 rounded-lg pl-9 pr-4 py-2 text-sm dark:text-white text-slate-900 placeholder-zinc-400 focus:outline-none focus:dark:border-[#8BFF24]/60 focus:border-[#5046E5] transition"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'SUCCESS', 'PENDING', 'FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === st
                  ? 'dark:bg-[#8BFF24] bg-[#5046E5] dark:text-black text-white shadow-sm'
                  : 'dark:bg-[#181a18] bg-slate-50 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-[#5046E5] hover:dark:bg-[#202220] hover:bg-[#EEF2FF] border dark:border-[#2e322e] border-slate-300'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 shadow-sm p-12 rounded-2xl flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 dark:text-[#8BFF24] text-[#5046E5] animate-spin mb-3" />
          <p className="dark:text-zinc-400 text-slate-500 text-sm">Querying verified ledger transactions...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 shadow-sm p-12 rounded-2xl text-center">
          <CreditCard className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold dark:text-white text-slate-900">No payment transactions recorded</h3>
          <p className="text-xs dark:text-zinc-400 text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No transactions matched your search criteria.'
              : 'Fund a contract or approve a deliverable to generate escrow ledger movements.'}
          </p>
        </div>
      ) : (
        <div className="interactive-card dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="dark:bg-[#181a18] bg-slate-50 border-b dark:border-[#262926] border-slate-200 text-xs uppercase dark:text-zinc-400 text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Transaction / Ref</th>
                  <th className="py-3.5 px-4 font-semibold">Date & Time</th>
                  <th className="py-3.5 px-4 font-semibold">Type</th>
                  <th className="py-3.5 px-4 font-semibold">Description</th>
                  <th className="py-3.5 px-4 font-semibold">Amount</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-[#262926] divide-slate-200 dark:text-zinc-300 text-slate-700">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id || tx.transactionReference} className="dark:hover:bg-[#161816] hover:bg-[#EEF2FF]/70 transition">
                    <td className="py-3.5 px-4 font-mono text-xs dark:text-white text-slate-900 font-bold">
                      {tx.transactionReference || tx.providerTransactionId || 'TX-' + tx.id.slice(0, 8)}
                    </td>
                    <td className="py-3.5 px-4 text-xs dark:text-zinc-400 text-slate-500">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className="font-medium dark:text-zinc-200 text-slate-800">{tx.type}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs max-w-xs truncate">
                      {tx.contractNumber ? `Contract: ${tx.contractNumber}` : 'Escrow Milestone Movement'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold dark:text-white text-slate-900 text-xs">
                      ${(Number(tx.amountMinor || 0) / 100).toLocaleString()} <span className="text-[10px] dark:text-zinc-400 text-slate-500 font-normal">{tx.currency || 'USD'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg dark:bg-[#1e201e] bg-slate-100 hover:dark:bg-[#282c28] hover:bg-[#EEF2FF] border dark:border-[#2e322e] border-slate-300 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-[#5046E5] text-xs transition"
                      >
                        <Eye className="w-3 h-3 dark:text-[#8BFF24] text-[#5046E5]" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 shadow-sm w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedTx(null)}
              className="absolute top-4 right-4 dark:text-zinc-400 text-slate-500 hover:dark:text-white hover:text-slate-900 p-1 rounded-lg hover:dark:bg-zinc-800 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl dark:bg-[#8BFF24]/10 bg-[#EEF2FF] border dark:border-[#8BFF24]/30 border-[#C7D2FE] flex items-center justify-center dark:text-[#8BFF24] text-[#5046E5]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold dark:text-white text-slate-900">Ledger Transaction Details</h3>
                <p className="text-xs dark:text-zinc-400 text-slate-500 font-mono">{selectedTx.transactionReference || selectedTx.id}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl dark:bg-[#181a18] bg-slate-50 border dark:border-[#262926] border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="dark:text-zinc-400 text-slate-500">Timestamp:</span>
                <span className="dark:text-white text-slate-900 font-mono">{new Date(selectedTx.createdAt).toUTCString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="dark:text-zinc-400 text-slate-500">Amount:</span>
                <span className="font-mono font-bold text-sm dark:text-[#8BFF24] text-[#5046E5]">
                  ${(Number(selectedTx.amountMinor || 0) / 100).toLocaleString()} {selectedTx.currency || 'USD'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="dark:text-zinc-400 text-slate-500">Transaction Status:</span>
                <div>{getStatusBadge(selectedTx.status)}</div>
              </div>
              <div className="flex justify-between items-center">
                <span className="dark:text-zinc-400 text-slate-500">Type / Classification:</span>
                <span className="dark:text-zinc-200 text-slate-800 font-semibold">{selectedTx.type}</span>
              </div>
              {selectedTx.contractId && (
                <div className="flex justify-between items-center">
                  <span className="dark:text-zinc-400 text-slate-500">Contract ID:</span>
                  <span className="font-mono dark:text-zinc-300 text-slate-700">{selectedTx.contractId}</span>
                </div>
              )}
              {selectedTx.providerTransactionId && (
                <div className="flex justify-between items-center">
                  <span className="dark:text-zinc-400 text-slate-500">Gateway Ref:</span>
                  <span className="font-mono dark:text-zinc-300 text-slate-700">{selectedTx.providerTransactionId}</span>
                </div>
              )}
            </div>

            <div className="p-3 dark:bg-[#181a18] bg-slate-50 rounded-xl border dark:border-[#262926] border-slate-200 flex items-center gap-2 text-xs dark:text-zinc-400 text-slate-500">
              <ShieldCheck className="w-4 h-4 dark:text-[#8BFF24] text-[#5046E5] flex-shrink-0" />
              <span>Immutable double-entry cryptographic ledger transaction recorded by TrustPay Enterprise.</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 rounded-xl dark:bg-zinc-800 bg-slate-100 hover:dark:bg-zinc-700 hover:bg-slate-200 dark:text-zinc-200 text-slate-700 hover:dark:text-white hover:text-slate-900 text-xs font-semibold transition"
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
