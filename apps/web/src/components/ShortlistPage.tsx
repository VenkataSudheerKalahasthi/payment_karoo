import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { WorkerShortlistDto, WorkerProfileDto } from '@trustpay/shared';
import {
  BookmarkX,
  Send,
  FileText,
  Star,
  Briefcase,
  BookmarkCheck,
} from 'lucide-react';

interface ShortlistPageProps {
  onOpenHiringModal: (worker: WorkerProfileDto) => void;
  onSelectWorkerForContract: (workerId: string) => void;
}

export const ShortlistPage: React.FC<ShortlistPageProps> = ({
  onOpenHiringModal,
  onSelectWorkerForContract,
}) => {
  const [items, setItems] = useState<WorkerShortlistDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadShortlist = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiService.listShortlists();
      if (res.success && res.data) {
        setItems(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShortlist();
  }, [loadShortlist]);

  const handleRemove = async (workerProfileId: string) => {
    setActionLoadingId(workerProfileId);
    try {
      const res = await apiService.removeFromShortlist(workerProfileId);
      if (res.success) {
        setItems((prev) => prev.filter((i) => i.workerProfileId !== workerProfileId));
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-xl font-bold dark:text-[#E8EAE6] text-[#111827] tracking-tight">
              Client Specialist Shortlist
            </h3>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold dark:bg-[#202220] bg-[#F1F5F9] dark:text-[#8BFF24] text-[#16a34a] border dark:border-[rgba(139,255,36,0.25)] border-[#E2E8F0] font-mono">
              <BookmarkCheck className="w-3 h-3 dark:text-[#8BFF24] text-[#5046E5]" />
              <span className="font-mono tabular-nums">{items.length}</span> Bookmarked
            </span>
          </div>
          <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] mt-1">
            Bookmarked specialists for direct hiring proposals, milestone planning, and rapid digital contract creation.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center dark:text-[#A5AAA2] text-[#64748B] text-sm dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] rounded-xl animate-pulse font-mono">
          Querying saved specialists from custody ledger...
        </div>
      ) : items.length === 0 ? (
        <div className="dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] rounded-xl p-16 text-center dark:text-[#A5AAA2] text-[#64748B] text-sm shadow-sm">
          No specialists have been bookmarked to your shortlist yet. Discover specialists in the Marketplace.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => {
            const worker = item.workerProfile;
            if (!worker) return null;

            const workerName = worker.user?.firstName
              ? `${worker.user.firstName} ${worker.user.lastName || ''}`.trim()
              : `Specialist ${worker.userId.slice(0, 8)}`;

            return (
              <div
                key={item.id}
                className="interactive-card dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] rounded-xl p-5 hover:border-[rgba(139,255,36,0.4)] transition-all flex flex-col justify-between space-y-4 shadow-sm group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-full dark:bg-[#202220] bg-[#EFF6FF] border dark:border-[rgba(139,255,36,0.25)] border-[#DBEAFE] flex items-center justify-center dark:text-[#8BFF24] text-[#2563EB] font-bold text-base shadow-inner">
                        {worker.user?.firstName?.[0] || 'W'}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold dark:text-[#E8EAE6] text-[#111827]">{workerName}</h4>
                        <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] line-clamp-1">
                          {worker.headline || 'Technical Consultant'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemove(item.workerProfileId)}
                      disabled={actionLoadingId === item.workerProfileId}
                      title="Remove from shortlist"
                      className="p-1.5 rounded-lg dark:bg-[#202220] bg-[#F1F5F9] hover:bg-rose-500/10 hover:text-rose-500 border dark:border-[rgba(255,255,255,0.10)] border-[#CBD5E1] dark:text-[#A5AAA2] text-[#64748B] transition cursor-pointer"
                    >
                      <BookmarkX className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs dark:text-[#A5AAA2] text-[#64748B] pt-2 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0]">
                    <span className="flex items-center space-x-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-semibold dark:text-[#E8EAE6] text-[#111827] font-mono tabular-nums">
                        {Number(worker.rating || 5.0).toFixed(1)}
                      </span>
                    </span>

                    {worker.hourlyRate && (
                      <span className="font-semibold dark:text-[#8BFF24] text-[#5046E5] dark:text-[#8BFF24] font-mono tabular-nums">
                        ${Number(worker.hourlyRate).toFixed(0)}
                        <span className="text-[11px] font-normal dark:text-[#A5AAA2] text-[#64748B]">/hr</span>
                      </span>
                    )}

                    <span className="flex items-center space-x-1">
                      <Briefcase className="w-3.5 h-3.5 text-[#6A6F68]" />
                      <span className="font-mono tabular-nums dark:text-[#E8EAE6] text-[#111827]">{worker.totalCompletedContracts}</span>
                      <span>completed</span>
                    </span>
                  </div>

                  {worker.skills && worker.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {worker.skills.slice(0, 3).map((ws) => (
                        <span
                          key={ws.id}
                          className="px-2 py-0.5 rounded-md dark:bg-[#202220] bg-[#F1F5F9] border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] text-[11px] dark:text-[#E8EAE6] text-[#111827] font-medium"
                        >
                          {ws.skillName || (ws as unknown as { skill?: { name: string } }).skill?.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.notes && (
                    <p className="text-[11px] dark:text-[#A5AAA2] text-[#64748B] dark:bg-[#202220] bg-[#F8FAFC] p-2.5 rounded-lg border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] italic">
                      Note: {item.notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] flex items-center space-x-2">
                  <button
                    onClick={() => onOpenHiringModal(worker)}
                    className="flex-1 py-1.5 px-3 rounded-xl dark:bg-[#8BFF24] bg-[#5046E5] hover:dark:bg-[#A3FF50] hover:bg-[#4338CA] text-xs font-bold dark:text-[#050605] text-white transition flex items-center justify-center space-x-1 dark:shadow-[0_0_15px_rgba(139,255,36,0.2)] shadow-md shadow-[#5046E5]/25 active:scale-95 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Proposal</span>
                  </button>

                  <button
                    onClick={() => onSelectWorkerForContract(worker.userId)}
                    className="py-1.5 px-3 rounded-xl dark:bg-[#202220] bg-[#F1F5F9] hover:dark:bg-[#292C28] hover:bg-[#E2E8F0] border dark:border-[rgba(255,255,255,0.10)] border-[#CBD5E1] text-xs font-medium dark:text-[#8BFF24] text-[#5046E5] transition flex items-center space-x-1 hover:border-[rgba(139,255,36,0.3)]"
                    title="Draft Direct Contract"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Contract</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
