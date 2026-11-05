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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#121412] dark:bg-[#121412] border border-[#262926] p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8BFF24]/10 border border-[#8BFF24]/30 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-[#8BFF24]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Payment & Escrow History</h1>
            <p className="text-sm text-zinc-400">
              Complete non-custodial ledger transactions, escrow movements, and settlements.
            </p>
          </div>
        </div>

        <button
          onClick={fetchTransactions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e201e] border border-[#2e322e] text-zinc-300 hover:text-white hover:border-[#8BFF24]/40 transition text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Ledger
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Total Transactions</p>
          <p className="text-2xl font-bold text-white mt-1">{metrics.count}</p>
          <p className="text-xs text-zinc-500 mt-1">Immutable ledger entries</p>
        </div>

        <div className="bg-[#121412] border border-[#8BFF24]/30 p-4 rounded-xl">
          <p className="text-xs text-[#8BFF24] uppercase tracking-wider font-semibold">Total Escrow Inflow</p>
          <p className="text-2xl font-bold text-[#8BFF24] mt-1 font-mono">${metrics.totalDeposited.toLocaleString()}</p>
          <p className="text-xs text-zinc-400 mt-1">Client funded escrow</p>
        </div>

        <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Settled to Specialists</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">${metrics.totalSettled.toLocaleString()}</p>
          <p className="text-xs text-zinc-500 mt-1">Disbursed on milestone approval</p>
        </div>

        <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Refunded Escrow</p>
          <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">${metrics.totalRefunded.toLocaleString()}</p>
          <p className="text-xs text-zinc-500 mt-1">Returned to wallet</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by reference or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181a18] border border-[#2e322e] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'SUCCESS', 'PENDING', 'FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-[#8BFF24] text-black'
                  : 'bg-[#181a18] text-zinc-300 hover:text-white border border-[#2e322e]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="bg-[#121412] border border-[#262926] p-12 rounded-2xl flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 text-[#8BFF24] animate-spin mb-3" />
          <p className="text-zinc-400 text-sm">Querying verified ledger transactions...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-[#121412] border border-[#262926] p-12 rounded-2xl text-center">
          <CreditCard className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No payment transactions recorded</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No transactions matched your search criteria.'
              : 'Fund a contract or approve a deliverable to generate escrow ledger movements.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#121412] border border-[#262926] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#181a18] border-b border-[#262926] text-xs uppercase text-zinc-400 tracking-wider">
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
              <tbody className="divide-y divide-[#262926] text-zinc-300">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id || tx.transactionReference} className="hover:bg-[#161816] transition">
                    <td className="py-3.5 px-4 font-mono text-xs text-white">
                      {tx.transactionReference || tx.providerTransactionId || 'TX-' + tx.id.slice(0, 8)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-zinc-400">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className="font-medium text-zinc-200">{tx.type}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs max-w-xs truncate">
                      {tx.contractNumber ? `Contract: ${tx.contractNumber}` : 'Escrow Milestone Movement'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white text-xs">
                      ${(Number(tx.amountMinor || 0) / 100).toLocaleString()} <span className="text-[10px] text-zinc-400 font-normal">{tx.currency || 'USD'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1e201e] hover:bg-[#282c28] border border-[#2e322e] text-zinc-300 hover:text-white text-xs transition"
                      >
                        <Eye className="w-3 h-3 text-[#8BFF24]" />
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
          <div className="bg-[#121412] border border-[#262926] w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedTx(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8BFF24]/10 border border-[#8BFF24]/30 flex items-center justify-center text-[#8BFF24]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Ledger Transaction Details</h3>
                <p className="text-xs text-zinc-400 font-mono">{selectedTx.transactionReference || selectedTx.id}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#181a18] border border-[#262926] space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Timestamp:</span>
                <span className="text-white font-mono">{new Date(selectedTx.createdAt).toUTCString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Amount:</span>
                <span className="text-white font-mono font-bold text-sm text-[#8BFF24]">
                  ${(Number(selectedTx.amountMinor || 0) / 100).toLocaleString()} {selectedTx.currency || 'USD'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Transaction Status:</span>
                <div>{getStatusBadge(selectedTx.status)}</div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Type / Classification:</span>
                <span className="text-zinc-200 font-semibold">{selectedTx.type}</span>
              </div>
              {selectedTx.contractId && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Contract ID:</span>
                  <span className="font-mono text-zinc-300">{selectedTx.contractId}</span>
                </div>
              )}
              {selectedTx.providerTransactionId && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Gateway Ref:</span>
                  <span className="font-mono text-zinc-300">{selectedTx.providerTransactionId}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-[#181a18] rounded-xl border border-[#262926] flex items-center gap-2 text-xs text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-[#8BFF24] flex-shrink-0" />
              <span>Immutable double-entry cryptographic ledger transaction recorded by TrustPay Enterprise.</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
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
