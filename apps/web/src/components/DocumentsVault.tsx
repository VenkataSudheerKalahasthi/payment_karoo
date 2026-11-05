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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#8BFF24]/10 text-[#8BFF24] border border-[#8BFF24]/30">
            <Folder className="w-3 h-3" />
            Deliverable Asset
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            {cat}
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
            <Folder className="w-5 h-5 text-[#8BFF24]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Secure Document Vault</h1>
            <p className="text-sm text-zinc-400">
              Encrypted non-custodial repository for contracts, invoices, and deliverable attachments.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e201e] border border-[#2e322e] text-zinc-300 hover:text-white hover:border-[#8BFF24]/40 transition text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Vault
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Total Documents</p>
          <p className="text-2xl font-bold text-white mt-1">{documents.length}</p>
          <p className="text-xs text-zinc-500 mt-1">Archived in secure storage</p>
        </div>

        <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Executed Agreements</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {documents.filter((d) => d.category === 'CONTRACT').length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Signed contracts</p>
        </div>

        <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Deliverables Stored</p>
          <p className="text-2xl font-bold text-[#8BFF24] mt-1">
            {documents.filter((d) => d.category === 'DELIVERABLE').length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Submitted files & assets</p>
        </div>

        <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Official Invoices</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {documents.filter((d) => d.category === 'INVOICE').length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">PDF receipts & bills</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search document name or contract..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181a18] border border-[#2e322e] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'CONTRACT', 'DELIVERABLE', 'INVOICE'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                categoryFilter === cat
                  ? 'bg-[#8BFF24] text-black'
                  : 'bg-[#181a18] text-zinc-300 hover:text-white border border-[#2e322e]'
              }`}
            >
              {cat === 'ALL' ? 'All' : cat === 'CONTRACT' ? 'Agreements' : cat === 'DELIVERABLE' ? 'Deliverables' : 'Invoices'}
            </button>
          ))}
        </div>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="bg-[#121412] border border-[#262926] p-12 rounded-2xl flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 text-[#8BFF24] animate-spin mb-3" />
          <p className="text-zinc-400 text-sm">Indexing cryptographic vault storage...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-[#121412] border border-[#262926] p-12 rounded-2xl text-center">
          <Folder className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No documents found</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            {searchQuery || categoryFilter !== 'ALL'
              ? 'No documents matched your search filter.'
              : 'Executed contracts and submitted deliverables will automatically be indexed here.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#121412] border border-[#262926] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#181a18] border-b border-[#262926] text-xs uppercase text-zinc-400 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Document Name</th>
                  <th className="py-3.5 px-4 font-semibold">Classification</th>
                  <th className="py-3.5 px-4 font-semibold">Associated Contract</th>
                  <th className="py-3.5 px-4 font-semibold">Size</th>
                  <th className="py-3.5 px-4 font-semibold">Date Archived</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262926] text-zinc-300">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#161816] transition">
                    <td className="py-3.5 px-4 text-xs font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#8BFF24]" />
                        <span className="font-mono">{doc.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {getCategoryBadge(doc.category)}
                    </td>
                    <td className="py-3.5 px-4 text-xs max-w-xs truncate">
                      <span className="text-zinc-300 block truncate">{doc.contractTitle}</span>
                      <span className="text-[11px] text-zinc-500 font-mono">{doc.contractNumber}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-zinc-400">
                      {doc.fileSize || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-zinc-400">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#8BFF24]/10 hover:bg-[#8BFF24]/20 border border-[#8BFF24]/30 text-[#8BFF24] text-xs font-semibold transition"
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

