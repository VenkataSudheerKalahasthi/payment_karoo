import React, { useState } from 'react';
import { ContractDto, UserRole, ContractStatus } from '@trustpay/shared';
import { User, Download, ExternalLink, ShieldCheck, Briefcase, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
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
  const [activeFilter, setActiveFilter] = useState<'ALL' | ContractStatus | 'PENDING_ACCEPTANCE'>('ALL');

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
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            ACTIVE
          </span>
        );
      case ContractStatus.PENDING_ACCEPTANCE:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
            PENDING SIGN-OFF
          </span>
        );
      case ContractStatus.COMPLETED:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#5046E5]/10 text-[#5046E5] border border-[#5046E5]/20">
            COMPLETED
          </span>
        );
      case ContractStatus.CANCELLED:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-[#202020] text-[#64748B] dark:text-[#777777] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)]">
            CANCELLED
          </span>
        );
      case ContractStatus.DISPUTED:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            DISPUTED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-[#64748B] dark:text-[#A5A5A5]">
            {status}
          </span>
        );
    }
  };

  const filteredContracts = contracts.filter((c) => {
    if (activeFilter === 'ALL') return true;
    return c.status === activeFilter;
  });

  const totalAgreedValue = contracts.reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0);
  const activeCount = contracts.filter((c) => c.status === ContractStatus.ACTIVE).length;
  const pendingCount = contracts.filter((c) => c.status === ContractStatus.PENDING_ACCEPTANCE).length;

  return (
    <div className="space-y-5">
      {/* Portfolio Summary Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="interactive-card p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#171717] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#A5A5A5] uppercase tracking-wider block">
              Total Contracted Volume
            </span>
            <span className="text-xl font-bold text-[#242424] dark:text-[#CDCBCA] font-mono tabular-nums">
              ${totalAgreedValue.toLocaleString()} USD
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] dark:bg-[#202020] border border-[#C7D2FE] dark:border-[rgba(205,203,202,0.18)] flex items-center justify-center text-[#5046E5]">
            <Briefcase className="w-4 h-4" />
          </div>
        </div>

        <div className="interactive-card p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#171717] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#A5A5A5] uppercase tracking-wider block">
              Active Agreements
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
              {activeCount} Active
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="interactive-card p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#171717] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#A5A5A5] uppercase tracking-wider block">
              Pending Signatures
            </span>
            <span className="text-xl font-bold text-amber-500 dark:text-amber-400 font-mono tabular-nums">
              {pendingCount} Pending
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter Tabs Toolbar */}
      <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-[#FFFFFF] dark:bg-[#171717] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] shadow-sm overflow-x-auto">
        {[
          { label: 'All Agreements', value: 'ALL' },
          { label: 'Active', value: ContractStatus.ACTIVE },
          { label: 'Pending Sign-Off', value: ContractStatus.PENDING_ACCEPTANCE },
          { label: 'Completed', value: ContractStatus.COMPLETED },
          { label: 'Disputed', value: ContractStatus.DISPUTED },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveFilter(tab.value as typeof activeFilter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
              activeFilter === tab.value
                ? 'bg-[#5046E5] text-white shadow-sm dark:bg-[#202020] dark:text-[#CDCBCA] dark:border dark:border-[rgba(205,203,202,0.18)]'
                : 'text-[#64748B] dark:text-[#A5A5A5] hover:text-[#242424] dark:hover:text-[#CDCBCA] hover:bg-[#F1F5F9] dark:hover:bg-[#202020]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredContracts.length === 0 ? (
        <div className="bg-[#FFFFFF] dark:bg-[#171717] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] rounded-xl p-16 text-center text-[#64748B] dark:text-[#A5A5A5] text-sm shadow-sm">
          No digital contracts match the selected status filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredContracts.map((c) => {
            const isClient = userRole === UserRole.CLIENT;
            const counterParty = isClient ? c.worker : c.client;
            const partyLabel = isClient ? 'Specialist' : 'Client';
            const partyName = counterParty?.firstName
              ? `${counterParty.firstName} ${counterParty.lastName || ''}`.trim()
              : counterParty?.email || 'Counterparty';

            // Calculate milestone progress
            const totalMilestones = c.milestones?.length || 0;
            const approvedMilestones = c.milestones?.filter((m) => m.status === 'APPROVED').length || 0;
            const progressPercent = totalMilestones > 0 ? (approvedMilestones / totalMilestones) * 100 : 0;

            return (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedContract(c);
                  setIsDetailOpen(true);
                }}
                className="interactive-card bg-[#FFFFFF] dark:bg-[#171717] border border-[#E2E8F0] dark:border-[rgba(205,203,202,0.18)] hover:border-[#5046E5]/40 dark:hover:border-[#5046E5]/40 rounded-xl p-5 cursor-pointer transition-all flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs text-[#5046E5] group-hover:underline font-semibold block">
                        {c.contractNumber} (v{c.version})
                      </span>
                      <h4 className="text-sm font-bold text-[#242424] dark:text-[#CDCBCA] mt-0.5 line-clamp-1">{c.title}</h4>
                    </div>
                    {getStatusBadge(c.status)}
                  </div>

                  <p className="text-xs text-[#64748B] dark:text-[#A5A5A5] line-clamp-2 leading-relaxed">{c.description}</p>

                  {/* Milestone Progress Bar */}
                  {totalMilestones > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-[#64748B] dark:text-[#777777] font-mono">
                        <span>Milestones Progress</span>
                        <span>{approvedMilestones}/{totalMilestones} ({progressPercent.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#202020] overflow-hidden">
                        <div
                          style={{ width: `${progressPercent}%` }}
                          className="bg-emerald-500 h-full rounded-full transition-all"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 text-xs text-[#64748B] dark:text-[#A5A5A5] pt-1">
                    <User className="w-3.5 h-3.5 text-[#5046E5]" />
                    <span>
                      {partyLabel}: <span className="text-[#242424] dark:text-[#CDCBCA] font-medium">{partyName}</span>
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F1F5F9] dark:border-[rgba(205,203,202,0.18)] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-[#64748B] dark:text-[#777777] block uppercase tracking-wider font-semibold">
                      Total Agreement
                    </span>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                      ${Number(c.totalAmount).toLocaleString()} <span className="text-xs font-normal text-[#64748B] dark:text-[#A5A5A5]">{c.currency}</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => handleDownloadPdf(e, c.id, c.contractNumber)}
                      disabled={downloadingId === c.id}
                      title="Download PDF"
                      className="p-1.5 rounded-lg bg-[#F8FAFC] dark:bg-[#202020] hover:bg-[#F1F5F9] dark:hover:bg-[#303030] text-[#242424] dark:text-[#CDCBCA] border border-[#CBD5E1] dark:border-[rgba(205,203,202,0.18)] transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#5046E5]" />
                    </button>

                    <button
                      onClick={() => {
                        setSelectedContract(c);
                        setIsDetailOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#EEF2FF] dark:bg-[#202020] hover:bg-[#C7D2FE] dark:hover:bg-[#303030] text-xs font-semibold text-[#5046E5] border border-[#C7D2FE] dark:border-[rgba(205,203,202,0.18)] transition flex items-center space-x-1 cursor-pointer"
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
