import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Download,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  ExternalLink,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import { apiService } from '../services/api';
import { InvoiceDto, UserRole } from '@trustpay/shared';

interface ClientInvoicesProps {
  userRole?: UserRole;
}

export const ClientInvoices: React.FC<ClientInvoicesProps> = ({ userRole }) => {
  const isWorker = userRole === UserRole.WORKER;
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDto | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.listInvoices();
      if (res.success && res.data) {
        setInvoices(res.data.items || []);
      } else {
        setError(res.error?.message || 'Failed to load invoices');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error loading invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchQuery.toLowerCase();
      const num = inv.invoiceNumber.toLowerCase();
      const title = inv.contractTitle.toLowerCase();
      const spec = (inv.specialist?.name || '').toLowerCase();

      const matchesSearch = num.includes(q) || title.includes(q) || spec.includes(q);
      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchQuery, statusFilter]);

  // Metrics
  const metrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalInEscrow = 0;

    invoices.forEach((inv) => {
      totalInvoiced += inv.total;
      if (inv.status === 'PAID') totalPaid += inv.total;
      if (inv.status === 'IN_ESCROW') totalInEscrow += inv.total;
    });

    return {
      count: invoices.length,
      totalInvoiced,
      totalPaid,
      totalInEscrow,
    };
  }, [invoices]);

  // Handle PDF Download
  const handleDownloadPdf = async (inv: InvoiceDto) => {
    try {
      setDownloadingId(inv.id);
      const blob = await apiService.downloadInvoicePdf(inv.contractId, inv.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${inv.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err?.message || 'Failed to download invoice PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Paid / Settled
          </span>
        );
      case 'IN_ESCROW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold dark:bg-[#1C2740] bg-[#EEF2FF] dark:text-[#8FB5FF] text-[#5046E5] border dark:border-[#1F61EF]/30 border-[#C7D2FE]">
            <ShieldCheck className="w-3 h-3" />
            In Escrow Custody
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            Pending Funding
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
      <div className="interactive-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] flex items-center justify-center">
            <Receipt className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold dark:text-white text-slate-900 tracking-tight">
              {isWorker ? 'Specialist Invoices & Billing' : 'Invoices & Billing'}
            </h1>
            <p className="text-sm dark:text-zinc-400 text-slate-500">
              {isWorker
                ? 'Tax-compliant milestone escrow invoices, earnings records, and professional PDF generation.'
                : 'Tax-compliant milestone escrow invoices and professional PDF generation.'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchInvoices}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl dark:bg-[#191D2A] bg-slate-100 border dark:border-[#272B38] border-slate-300 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-slate-900 hover:dark:bg-[#282c28] hover:bg-slate-200 hover:dark:border-[#1F61EF]/40 border-[#C7D2FE] transition text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">Total Invoices</p>
          <p className="text-2xl font-bold dark:text-white text-slate-900 mt-1">{metrics.count}</p>
          <p className="text-xs text-zinc-500 mt-1">Contracts & Milestones</p>
        </div>

        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">Total Billed</p>
          <p className="text-2xl font-bold dark:text-white text-slate-900 mt-1 font-mono">${metrics.totalInvoiced.toLocaleString()}</p>
          <p className="text-xs text-zinc-500 mt-1">Gross Invoiced Value</p>
        </div>

        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#1F61EF]/30 border-[#C7D2FE] shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-[#8FB5FF] text-[#5046E5] uppercase tracking-wider font-semibold">Active in Escrow</p>
          <p className="text-2xl font-bold dark:text-[#8FB5FF] text-[#5046E5] mt-1 font-mono">${metrics.totalInEscrow.toLocaleString()}</p>
          <p className="text-xs dark:text-zinc-400 text-slate-500 mt-1">Locked in custody</p>
        </div>

        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">
            {isWorker ? 'Earned & Disbursed' : 'Settled & Released'}
          </p>
          <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">${metrics.totalPaid.toLocaleString()}</p>
          <p className="text-xs text-zinc-500 mt-1">
            {isWorker ? 'Disbursed to your wallet' : 'Disbursed to Specialists'}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 dark:text-zinc-400 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={isWorker ? 'Search invoice #, contract or client...' : 'Search invoice #, contract or specialist...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 rounded-lg pl-9 pr-4 py-2 text-sm dark:text-white text-slate-900 placeholder-zinc-400 focus:outline-none focus:dark:border-[#1F61EF]/60 focus:border-[#5046E5] transition"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'IN_ESCROW', 'PAID', 'PENDING'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === st
                  ? 'dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white shadow-sm'
                  : 'dark:bg-[#191B25] bg-slate-50 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-[#5046E5] hover:dark:bg-[#191D2A] hover:bg-[#EEF2FF] border dark:border-[#272B38] border-slate-300'
              }`}
            >
              {st === 'IN_ESCROW' ? 'In Escrow' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices List / Table */}
      {loading ? (
        <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-12 rounded-2xl flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 dark:text-[#8FB5FF] text-[#5046E5] animate-spin mb-3" />
          <p className="dark:text-zinc-400 text-slate-500 text-sm">Compiling verified billing invoices...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-12 rounded-2xl text-center">
          <Receipt className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold dark:text-white text-slate-900">No invoices available</h3>
          <p className="text-xs dark:text-zinc-400 text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No invoices matched your filter criteria.'
              : 'Execute a contract or allocate escrow milestones to generate tax-compliant invoices.'}
          </p>
        </div>
      ) : (
        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="dark:bg-[#191B25] bg-slate-50 border-b dark:border-[#272B38] border-slate-200 text-xs uppercase dark:text-zinc-400 text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Invoice #</th>
                  <th className="py-3.5 px-4 font-semibold">Date Issued</th>
                  <th className="py-3.5 px-4 font-semibold">Contract / Scope</th>
                  <th className="py-3.5 px-4 font-semibold">{isWorker ? 'Client' : 'Issued By'}</th>
                  <th className="py-3.5 px-4 font-semibold">Amount</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-[#262926] divide-slate-200 dark:text-zinc-300 text-slate-700">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="dark:hover:bg-[#161816] hover:bg-[#EEF2FF]/70 transition">
                    <td className="py-3.5 px-4 font-mono text-xs font-bold dark:text-white text-slate-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 text-xs dark:text-zinc-400 text-slate-500">
                      {new Date(inv.issuedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs max-w-xs truncate">
                      <span className="font-semibold dark:text-zinc-200 text-slate-800 block truncate">{inv.contractTitle}</span>
                      <span className="text-[11px] text-zinc-500 font-mono">{inv.contractNumber}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {isWorker
                        ? (inv.client?.name || 'Verified Client')
                        : (inv.specialist?.name || 'Assigned Specialist')}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold dark:text-white text-slate-900 text-xs">
                      ${inv.total.toLocaleString()} <span className="text-[10px] dark:text-zinc-400 text-slate-500 font-normal">{inv.currency}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg dark:bg-[#191D2A] bg-slate-100 hover:dark:bg-[#282c28] hover:bg-[#EEF2FF] border dark:border-[#272B38] border-slate-300 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-[#5046E5] text-xs transition"
                        >
                          <Eye className="w-3 h-3 dark:text-zinc-400 text-slate-500" />
                          View
                        </button>

                        <button
                          onClick={() => handleDownloadPdf(inv)}
                          disabled={downloadingId === inv.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg dark:bg-[#1C2740] bg-[#EEF2FF] hover:dark:bg-[#1C2740] hover:bg-[#E0E7FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] dark:text-[#8FB5FF] text-[#5046E5] text-xs font-semibold transition"
                        >
                          <Download className={`w-3 h-3 ${downloadingId === inv.id ? 'animate-bounce' : ''}`} />
                          {downloadingId === inv.id ? 'PDF...' : 'PDF'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm w-full max-w-xl rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 dark:text-zinc-400 text-slate-500 hover:dark:text-white hover:text-slate-900 p-1 rounded-lg hover:dark:bg-zinc-800 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] flex items-center justify-center dark:text-[#8FB5FF] text-[#5046E5]">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold dark:text-white text-slate-900 font-mono">{selectedInvoice.invoiceNumber}</h3>
                  <p className="text-xs dark:text-zinc-400 text-slate-500">Issued: {new Date(selectedInvoice.issuedAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div>{getStatusBadge(selectedInvoice.status)}</div>
            </div>

            {/* Parties info */}
            <div className="grid grid-cols-2 gap-3 p-3.5 dark:bg-[#191B25] bg-slate-50 rounded-xl border dark:border-[#272B38] border-slate-200 text-xs">
              <div>
                <span className="text-zinc-500 uppercase font-semibold text-[10px] block">Billed To (Client)</span>
                <p className="font-semibold dark:text-white text-slate-900 mt-0.5">{selectedInvoice.client?.name}</p>
                <p className="dark:text-zinc-400 text-slate-500 text-[11px]">{selectedInvoice.client?.email}</p>
              </div>
              <div>
                <span className="text-zinc-500 uppercase font-semibold text-[10px] block">Issued By (Specialist)</span>
                <p className="font-semibold dark:text-white text-slate-900 mt-0.5">{selectedInvoice.specialist?.name}</p>
                <p className="dark:text-zinc-400 text-slate-500 text-[11px]">{selectedInvoice.specialist?.email}</p>
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold dark:text-zinc-400 text-slate-500 uppercase tracking-wider">Itemized Line Items</span>
              <div className="dark:bg-[#191B25] bg-slate-50 rounded-xl border dark:border-[#272B38] border-slate-200 divide-y dark:divide-[#262926] divide-slate-200 overflow-hidden">
                {selectedInvoice.lineItems.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium dark:text-white text-slate-900">{item.description}</p>
                      <span className="text-[11px] text-zinc-500">Status: {item.status}</span>
                    </div>
                    <span className="font-mono font-bold dark:text-white text-slate-900">
                      ${item.amount.toLocaleString()} {item.currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="p-3.5 dark:bg-[#191B25] bg-slate-50 rounded-xl border dark:border-[#272B38] border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between dark:text-zinc-400 text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono dark:text-zinc-200 text-slate-800">${selectedInvoice.subtotal.toLocaleString()} {selectedInvoice.currency}</span>
              </div>
              <div className="flex justify-between dark:text-zinc-400 text-slate-500">
                <span>Platform Escrow Fee:</span>
                <span className="font-mono dark:text-zinc-200 text-slate-800">${selectedInvoice.taxOrFee.toLocaleString()} {selectedInvoice.currency}</span>
              </div>
              <div className="flex justify-between dark:text-white text-slate-900 font-bold pt-2 border-t dark:border-[#272B38] border-slate-200 text-sm">
                <span>Total Amount:</span>
                <span className="font-mono dark:text-[#8FB5FF] text-[#5046E5]">${selectedInvoice.total.toLocaleString()} {selectedInvoice.currency}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2.5 pt-2 border-t dark:border-[#272B38] border-slate-200">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl dark:bg-zinc-800 bg-slate-100 hover:dark:bg-zinc-700 hover:bg-slate-200 dark:text-zinc-200 text-slate-700 hover:dark:text-white hover:text-slate-900 text-xs font-semibold transition"
              >
                Close
              </button>
              <button
                onClick={() => handleDownloadPdf(selectedInvoice)}
                disabled={downloadingId === selectedInvoice.id}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] hover:dark:bg-[#78e018] hover:bg-[#4338CA] dark:text-black text-white shadow-md shadow-[#5046E5]/25 text-xs font-bold transition"
              >
                <Download className="w-3.5 h-3.5" />
                {downloadingId === selectedInvoice.id ? 'Generating...' : 'Download Official PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

