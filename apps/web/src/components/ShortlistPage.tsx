import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { WorkerShortlistDto, WorkerProfileDto } from '@trustpay/shared';
import {
  BookmarkX,
  Send,
  FileText,
  Star,
  Briefcase,
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
      <div>
        <h3 className="text-xl font-bold text-white tracking-tight">Client Specialist Shortlist</h3>
        <p className="text-xs text-slate-400 mt-1">
          Saved specialists for quick hiring, proposal dispatch, and milestone contract creation.
        </p>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-slate-500 text-sm">Querying saved specialists...</div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-16 text-center text-slate-400 text-sm">
          No specialists have been bookmarked to your shortlist yet. Discover specialists in the Marketplace.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const worker = item.workerProfile;
            if (!worker) return null;

            const workerName = worker.user?.firstName
              ? `${worker.user.firstName} ${worker.user.lastName || ''}`.trim()
              : `Specialist ${worker.userId.slice(0, 8)}`;

            return (
              <div
                key={item.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-base">
                        {worker.user?.firstName?.[0] || 'W'}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{workerName}</h4>
                        <p className="text-xs text-slate-400 line-clamp-1">{worker.headline || 'Technical Consultant'}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemove(item.workerProfileId)}
                      disabled={actionLoadingId === item.workerProfileId}
                      title="Remove from shortlist"
                      className="p-1.5 rounded-md bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-700 text-slate-400 transition"
                    >
                      <BookmarkX className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                    <span className="flex items-center space-x-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-slate-200">
                        {Number(worker.rating || 5.0).toFixed(1)}
                      </span>
                    </span>

                    {worker.hourlyRate && (
                      <span className="font-semibold text-slate-200">
                        ${Number(worker.hourlyRate).toFixed(0)}/hr
                      </span>
                    )}

                    <span className="flex items-center space-x-1">
                      <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                      <span>{worker.totalCompletedContracts} completed</span>
                    </span>
                  </div>

                  {worker.skills && worker.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {worker.skills.slice(0, 3).map((ws) => (
                        <span
                          key={ws.id}
                          className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-xs text-slate-300"
                        >
                          {ws.skillName || (ws as unknown as { skill?: { name: string } }).skill?.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.notes && (
                    <p className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-800/80 italic">
                      Note: {item.notes}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center space-x-2">
                  <button
                    onClick={() => onOpenHiringModal(worker)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition flex items-center justify-center space-x-1 shadow-lg shadow-emerald-600/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Proposal</span>
                  </button>

                  <button
                    onClick={() => onSelectWorkerForContract(worker.userId)}
                    className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-emerald-400 transition flex items-center space-x-1"
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
