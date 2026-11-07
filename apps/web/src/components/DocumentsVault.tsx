import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder,
  FileText,
  Download,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileCode,
  Image as ImageIcon,
  FileSpreadsheet,
  AlertCircle,
  Eye,
  FileCheck,
} from 'lucide-react';
import { apiService } from '../services/api';
import { ContractDto } from '@trustpay/shared';

interface VaultDocument {
  id: string;
  name: string;
  category: 'CONTRACT' | 'DELIVERABLE' | 'INVOICE' | 'EVIDENCE';
  contractId: string;
  contractNumber: string;
  contractTitle: string;
  url?: string;
  fileSize?: string;
  createdAt: string;
  downloadHandler?: () => Promise<void>;
}

export const DocumentsVault: React.FC = () => {
  const [contracts, setContracts] = useState<ContractDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.listContracts();
      if (res.success && res.data) {
        setContracts(res.data);
      } else {
        setError(res.error?.message || 'Failed to load vault documents');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error loading documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Consolidate documents across all contracts
  const documents: VaultDocument[] = useMemo(() => {
    const list: VaultDocument[] = [];

    contracts.forEach((c) => {
      // 1. Contract Agreement PDF
      list.push({
        id: `doc-contract-${c.id}`,
        name: `Legal-Agreement-${c.contractNumber}-v${c.version || 1}.pdf`,
        category: 'CONTRACT',
        contractId: c.id,
        contractNumber: c.contractNumber,
        contractTitle: c.title,
        createdAt: c.createdAt,
        fileSize: '340 KB',
        downloadHandler: async () => {
          const blob = await apiService.downloadContractPdf(c.id);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Contract-${c.contractNumber}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        },
      });

      // 2. Invoices for contract
      list.push({
        id: `doc-inv-${c.id}`,
        name: `Invoice-${c.contractNumber}-FULL.pdf`,
        category: 'INVOICE',
        contractId: c.id,
        contractNumber: c.contractNumber,
        contractTitle: c.title,
        createdAt: c.createdAt,
        fileSize: '210 KB',
        downloadHandler: async () => {
          const blob = await apiService.downloadInvoicePdf(c.id, `inv-${c.id}`);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Invoice-${c.contractNumber}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        },
      });

      // 3. Deliverables from milestones
      (c.milestones || []).forEach((m) => {
        (m.submissions || []).forEach((sub: any, sIdx: number) => {
          (sub.attachmentUrls || []).forEach((url: string, aIdx: number) => {
            const fileName = url.split('/').pop()?.split('?')[0] || `Deliverable-M${m.order}-${aIdx + 1}.bin`;
            list.push({
              id: `doc-deliv-${sub.id}-${aIdx}`,
              name: fileName,
              category: 'DELIVERABLE',
              contractId: c.id,
              contractNumber: c.contractNumber,
              contractTitle: `${c.title} (M#${m.order})`,
              url,
              createdAt: sub.createdAt,
              fileSize: 'File Asset',
            });
          });
        });
      });
    });

    return list;
  }, [contracts]);

  // Filtered
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        doc.name.toLowerCase().includes(q) ||
        doc.contractNumber.toLowerCase().includes(q) ||
        doc.contractTitle.toLowerCase().includes(q);

      const matchesCat = categoryFilter === 'ALL' || doc.category === categoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [documents, searchQuery, categoryFilter]);

  const handleDownload = async (doc: VaultDocument) => {
    try {
      setDownloadingId(doc.id);
      if (doc.downloadHandler) {
        await doc.downloadHandler();
      } else if (doc.url) {
        window.open(doc.url, '_blank');
      }
    } catch (err: any) {
      alert(err?.message || 'Error downloading document');
    } finally {
      setDownloadingId(null);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'CONTRACT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <FileText className="w-3 h-3" />
            Legal Agreement
          </span>
        );
      case 'INVOICE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <FileCheck className="w-3 h-3" />
            Billing Invoice
          </span>
        );
      case 'DELIVERABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold dark:bg-[#1C2740] bg-[#EEF2FF] dark:text-[#8FB5FF] text-[#5046E5] border dark:border-[#1F61EF]/30 border-[#C7D2FE]">
            <Folder className="w-3 h-3" />
            Deliverable Asset
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold dark:bg-zinc-800 bg-[#EEF2FF] dark:text-zinc-300 text-[#475569] dark:border-zinc-700 border-[#C7D2FE]">
            {cat}
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
            <Folder className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold dark:text-white text-slate-900 tracking-tight">Secure Document Vault</h1>
            <p className="text-sm dark:text-zinc-400 text-slate-500">
              Encrypted non-custodial repository for contracts, invoices, and deliverable attachments.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl dark:bg-[#191D2A] bg-slate-100 border dark:border-[#272B38] border-slate-300 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-slate-900 hover:dark:bg-[#282c28] hover:bg-slate-200 hover:dark:border-[#1F61EF]/40 border-[#C7D2FE] transition text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Vault
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">Total Documents</p>
          <p className="text-2xl font-bold dark:text-white text-slate-900 mt-1">{documents.length}</p>
          <p className="text-xs text-zinc-500 mt-1">Archived in secure storage</p>
        </div>

        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">Executed Agreements</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {documents.filter((d) => d.category === 'CONTRACT').length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Signed contracts</p>
        </div>

        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">Deliverables Stored</p>
          <p className="text-2xl font-bold dark:text-[#8FB5FF] text-[#5046E5] mt-1">
            {documents.filter((d) => d.category === 'DELIVERABLE').length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Submitted files & assets</p>
        </div>

        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl">
          <p className="text-xs dark:text-zinc-400 text-slate-500 uppercase tracking-wider font-medium">Official Invoices</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {documents.filter((d) => d.category === 'INVOICE').length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">PDF receipts & bills</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 dark:text-zinc-400 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search document name or contract..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 rounded-lg pl-9 pr-4 py-2 text-sm dark:text-white text-slate-900 placeholder-zinc-400 focus:outline-none focus:dark:border-[#1F61EF]/60 focus:border-[#5046E5] transition"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'CONTRACT', 'DELIVERABLE', 'INVOICE'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                categoryFilter === cat
                  ? 'dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white shadow-sm'
                  : 'dark:bg-[#191B25] bg-slate-50 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-[#5046E5] hover:dark:bg-[#191D2A] hover:bg-[#EEF2FF] border dark:border-[#272B38] border-slate-300'
              }`}
            >
              {cat === 'ALL' ? 'All' : cat === 'CONTRACT' ? 'Agreements' : cat === 'DELIVERABLE' ? 'Deliverables' : 'Invoices'}
            </button>
          ))}
        </div>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-12 rounded-2xl flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 dark:text-[#8FB5FF] text-[#5046E5] animate-spin mb-3" />
          <p className="dark:text-zinc-400 text-slate-500 text-sm">Indexing cryptographic vault storage...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm p-12 rounded-2xl text-center">
          <Folder className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold dark:text-white text-slate-900">No documents found</h3>
          <p className="text-xs dark:text-zinc-400 text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || categoryFilter !== 'ALL'
              ? 'No documents matched your search filter.'
              : 'Executed contracts and submitted deliverables will automatically be indexed here.'}
          </p>
        </div>
      ) : (
        <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="dark:bg-[#191B25] bg-slate-50 border-b dark:border-[#272B38] border-slate-200 text-xs uppercase dark:text-zinc-400 text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Document Name</th>
                  <th className="py-3.5 px-4 font-semibold">Classification</th>
                  <th className="py-3.5 px-4 font-semibold">Associated Contract</th>
                  <th className="py-3.5 px-4 font-semibold">Size</th>
                  <th className="py-3.5 px-4 font-semibold">Date Archived</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-[#262926] divide-slate-200 dark:text-zinc-300 text-slate-700">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="dark:hover:bg-[#161816] hover:bg-[#EEF2FF]/70 transition">
                    <td className="py-3.5 px-4 text-xs font-semibold dark:text-white text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 dark:text-[#8FB5FF] text-[#5046E5]" />
                        <span className="font-mono">{doc.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {getCategoryBadge(doc.category)}
                    </td>
                    <td className="py-3.5 px-4 text-xs max-w-xs truncate">
                      <span className="dark:text-zinc-300 text-slate-700 block truncate">{doc.contractTitle}</span>
                      <span className="text-[11px] text-zinc-500 font-mono">{doc.contractNumber}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs dark:text-zinc-400 text-slate-500">
                      {doc.fileSize || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-xs dark:text-zinc-400 text-slate-500">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg dark:bg-[#1C2740] bg-[#EEF2FF] hover:dark:bg-[#1C2740] hover:bg-[#E0E7FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] dark:text-[#8FB5FF] text-[#5046E5] text-xs font-semibold transition"
                      >
                        <Download className={`w-3.5 h-3.5 ${downloadingId === doc.id ? 'animate-bounce' : ''}`} />
                        {downloadingId === doc.id ? 'Fetching...' : 'Download'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

