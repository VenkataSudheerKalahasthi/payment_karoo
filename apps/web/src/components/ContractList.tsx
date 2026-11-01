import React, { useState } from 'react';
import { ContractDto, UserRole, ContractStatus } from '@trustpay/shared';
import { User, Download, ExternalLink } from 'lucide-react';
import { ContractDetailModal } from './ContractDetailModal';
import { apiService } from '../services/api';

interface ContractListProps {
  contracts: ContractDto[];
  userRole: UserRole;
  currentUserId?: string;
  onRefresh: () => void;
}

export const ContractList: React.FC<ContractListProps> = ({
  contracts,
  userRole,
  currentUserId = '',
  onRefresh,
}) => {
  const [selectedContract, setSelectedContract] = useState<ContractDto | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadPdf = async (e: React.MouseEvent, contractId: string, contractNumber: string) => {
    e.stopPropagation();
    setDownloadingId(contractId);
    try {
      const blob = await apiService.downloadContractPdf(contractId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contract-${contractNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert('Failed to generate contract PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case ContractStatus.ACTIVE:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ACTIVE
          </span>
        );
      case ContractStatus.PENDING_ACCEPTANCE:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            PENDING SIGN-OFF
          </span>
        );
      case ContractStatus.COMPLETED:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            COMPLETED
          </span>
        );
      case ContractStatus.CANCELLED:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            CANCELLED
          </span>
        );
      case ContractStatus.DISPUTED:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            DISPUTED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {contracts.length === 0 ? (
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-16 text-center text-slate-400 text-sm">
          No digital contracts found. Create a new contract or convert an accepted hiring request.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {contracts.map((c) => {
            const isClient = userRole === UserRole.CLIENT;
            const counterParty = isClient ? c.worker : c.client;
            const partyLabel = isClient ? 'Specialist' : 'Client';
            const partyName = counterParty?.firstName
              ? `${counterParty.firstName} ${counterParty.lastName || ''}`.trim()
              : counterParty?.email || 'Counterparty';

            return (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedContract(c);
                  setIsDetailOpen(true);
                }}
                className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-xl p-5 cursor-pointer transition flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-slate-500 group-hover:text-emerald-400 transition">
                        {c.contractNumber} (v{c.version})
                      </span>
                      <h4 className="text-sm font-bold text-white mt-0.5 line-clamp-1">{c.title}</h4>
                    </div>
                    {getStatusBadge(c.status)}
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">{c.description}</p>

                  <div className="flex items-center space-x-2 text-xs text-slate-400 pt-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {partyLabel}: <span className="text-slate-200 font-medium">{partyName}</span>
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Total Agreement</span>
                    <span className="text-base font-bold text-emerald-400">
                      ${Number(c.totalAmount).toLocaleString()} <span className="text-xs font-normal text-slate-400">{c.currency}</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => handleDownloadPdf(e, c.id, c.contractNumber)}
                      disabled={downloadingId === c.id}
                      title="Download PDF"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setSelectedContract(c);
                        setIsDetailOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-emerald-400 border border-slate-700 transition flex items-center space-x-1"
                    >
                      <span>Manage</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contract Detail Modal */}
      {selectedContract && (
        <ContractDetailModal
          contract={selectedContract}
          currentUserRole={userRole}
          currentUserId={currentUserId}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedContract(null);
          }}
          onRefresh={() => {
            setIsDetailOpen(false);
            setSelectedContract(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
