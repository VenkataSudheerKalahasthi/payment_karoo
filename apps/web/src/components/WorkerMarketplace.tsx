import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { WorkerProfileDto, SkillDto } from '@trustpay/shared';
import {
  Search,
  Star,
  Briefcase,
  Bookmark,
  BookmarkCheck,
  Send,
  FileText,
  Filter,
  ExternalLink,
  X,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  MessageSquare,
} from 'lucide-react';

interface WorkerMarketplaceProps {
  onSelectWorkerForContract?: (workerId: string) => void;
  onOpenHiringModal?: (worker: WorkerProfileDto) => void;
  onStartChat?: (specialistUserId: string) => void;
  isClient?: boolean;
}

export const WorkerMarketplace: React.FC<WorkerMarketplaceProps> = ({
  onSelectWorkerForContract,
  onOpenHiringModal,
  onStartChat,
  isClient = true,
}) => {
  const [workers, setWorkers] = useState<WorkerProfileDto[]>([]);
  const [skills, setSkills] = useState<SkillDto[]>([]);
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());
  const [selectedWorkerDetail, setSelectedWorkerDetail] = useState<WorkerProfileDto | null>(null);

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [availability, setAvailability] = useState('');
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'hourlyRate' | 'totalCompletedContracts'>('rating');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalWorkers, setTotalWorkers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch available platform skills for filter dropdown
  useEffect(() => {
    apiService.listSkills().then((res) => {
      if (res.success && res.data) {
        setSkills(res.data);
      }
    });
  }, []);

  // Fetch client shortlists to show active bookmark status
  const loadShortlists = useCallback(async () => {
    if (!isClient) return;
    try {
      const res = await apiService.listShortlists();
      if (res.success && res.data) {
        const ids = new Set(res.data.map((s) => s.workerProfileId));
        setShortlistedIds(ids);
      }
    } catch {
      // Ignored if unauthenticated
    }
  }, [isClient]);

  useEffect(() => {
    loadShortlists();
  }, [loadShortlists]);

  // Fetch workers with backend filtering and pagination
  const fetchWorkers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        limit: 9,
        search: searchTerm || undefined,
        skill: selectedSkill || undefined,
        availability: availability || undefined,
        minRate: minRate ? parseFloat(minRate) : undefined,
        maxRate: maxRate ? parseFloat(maxRate) : undefined,
        sortBy,
        sortOrder,
      };

      const res = await apiService.listWorkers(params);
      if (res.success && res.data) {
        setWorkers(res.data.items);
        setTotalPages(res.data.totalPages || 1);
        setTotalWorkers(res.data.total || 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, selectedSkill, availability, minRate, maxRate, sortBy, sortOrder]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const handleToggleShortlist = async (worker: WorkerProfileDto) => {
    if (!isClient) return;
    const isCurrentlyShortlisted = shortlistedIds.has(worker.id);

    try {
      if (isCurrentlyShortlisted) {
        await apiService.removeFromShortlist(worker.id);
        setShortlistedIds((prev) => {
          const updated = new Set(prev);
          updated.delete(worker.id);
          return updated;
        });
      } else {
        await apiService.addToShortlist({ workerProfileId: worker.id });
        setShortlistedIds((prev) => new Set(prev).add(worker.id));
      }
    } catch (err) {
      console.error('Failed to toggle shortlist:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-xl font-bold dark:text-[#E8EAE6] text-[#111827] tracking-tight">
              Verified Specialist Marketplace
            </h3>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#8FB5FF] text-[#16a34a] border dark:border-[rgba(31,97,239,0.2)] border-[#E2E8F0] font-mono">
              <Sparkles className="w-3 h-3 dark:text-[#8FB5FF] text-[#5046E5]" />
              <span className="font-mono tabular-nums">{totalWorkers}</span> Verified
            </span>
          </div>
          <p className="text-xs dark:text-[#9AA4B8] text-[#64748B] mt-1">
            Browse verified technical specialists, inspect real portfolio deliverables, and initiate escrow-backed agreements.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 dark:text-[#9AA4B8] text-[#64748B]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, expertise or keywords..."
              className="w-full pl-9 pr-3 py-2 rounded-xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-300 text-xs dark:text-[#E8EAE6] text-slate-900 placeholder:text-slate-400 focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Filter & Sorting Controls */}
      <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3 text-xs dark:text-[#9AA4B8] text-slate-600 shadow-sm">
        <div className="flex items-center space-x-1.5 dark:text-[#E8EAE6] text-slate-900 font-medium">
          <Filter className="w-3.5 h-3.5 dark:text-[#8FB5FF] text-[#5046E5]" />
          <span>Filters:</span>
        </div>

        {/* Skill Filter */}
        <select
          value={selectedSkill}
          onChange={(e) => {
            setSelectedSkill(e.target.value);
            setPage(1);
          }}
          className="dark:bg-[#191D2A] bg-slate-50 border dark:border-[#272B38] border-slate-300 rounded-lg px-3 py-1.5 text-xs dark:text-[#E8EAE6] text-slate-900 focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] transition"
        >
          <option value="">All Skills ({skills.length})</option>
          {skills.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Availability Filter */}
        <select
          value={availability}
          onChange={(e) => {
            setAvailability(e.target.value);
            setPage(1);
          }}
          className="dark:bg-[#191D2A] bg-slate-50 border dark:border-[#272B38] border-slate-300 rounded-lg px-3 py-1.5 text-xs dark:text-[#E8EAE6] text-slate-900 focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] transition"
        >
          <option value="">All Availability</option>
          <option value="AVAILABLE">Available Now</option>
          <option value="BUSY">In Active Contract</option>
        </select>

        {/* Rate Min / Max */}
        <div className="flex items-center space-x-1.5">
          <input
            type="number"
            placeholder="Min $/hr"
            value={minRate}
            onChange={(e) => {
              setMinRate(e.target.value);
              setPage(1);
            }}
            className="w-24 dark:bg-[#191D2A] bg-slate-50 border dark:border-[#272B38] border-slate-300 rounded-lg px-2.5 py-1.5 text-xs dark:text-[#E8EAE6] text-slate-900 focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] font-mono tabular-nums transition"
          />
          <span className="text-[#6A6F68]">-</span>
          <input
            type="number"
            placeholder="Max $/hr"
            value={maxRate}
            onChange={(e) => {
              setMaxRate(e.target.value);
              setPage(1);
            }}
            className="w-24 dark:bg-[#191D2A] bg-slate-50 border dark:border-[#272B38] border-slate-300 rounded-lg px-2.5 py-1.5 text-xs dark:text-[#E8EAE6] text-slate-900 focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] font-mono tabular-nums transition"
          />
        </div>

        {/* Sorting */}
        <div className="ml-auto flex items-center space-x-2">
          <span className="dark:text-[#9AA4B8] text-slate-600">Sort:</span>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
              setSortBy(sb);
              setSortOrder(so);
              setPage(1);
            }}
            className="dark:bg-[#191D2A] bg-slate-50 border dark:border-[#272B38] border-slate-300 rounded-lg px-3 py-1.5 text-xs dark:text-[#E8EAE6] text-slate-900 focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] transition font-medium"
          >
            <option value="rating-desc">Highest Rated</option>
            <option value="hourlyRate-asc">Lowest Hourly Rate</option>
            <option value="hourlyRate-desc">Highest Hourly Rate</option>
            <option value="totalCompletedContracts-desc">Most Contracts Completed</option>
          </select>
        </div>
      </div>

      {/* Specialist Cards Grid */}
      {isLoading ? (
        <div className="p-16 text-center dark:text-[#9AA4B8] text-[#64748B] text-sm dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-xl animate-pulse font-mono">
          Querying verified database specialists...
        </div>
      ) : workers.length === 0 ? (
        <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-xl p-16 text-center dark:text-[#9AA4B8] text-[#64748B] text-sm shadow-sm">
          No specialized workers matched your filter criteria. Try resetting skill or budget filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {workers.map((worker) => {
            const isShortlisted = shortlistedIds.has(worker.id);
            const workerName = worker.user?.firstName
              ? `${worker.user.firstName} ${worker.user.lastName || ''}`.trim()
              : `Specialist ${worker.userId.slice(0, 8)}`;

            return (
              <div
                key={worker.id}
                className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-xl p-5 hover:border-[rgba(31,97,239,0.35)] transition-all flex flex-col justify-between space-y-4 shadow-sm group"
              >
                <div className="space-y-3">
                  {/* Top Bar with Avatar, Rating, and Shortlist Bookmark */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-full dark:bg-[#191D2A] bg-[#EFF6FF] border dark:border-[rgba(31,97,239,0.2)] border-[#DBEAFE] flex items-center justify-center dark:text-[#8FB5FF] text-[#2563EB] font-bold text-base shadow-inner">
                        {worker.user?.firstName?.[0] || 'W'}
                      </div>
                      <div>
                        <h4
                          onClick={() => setSelectedWorkerDetail(worker)}
                          className="text-sm font-semibold dark:text-[#E8EAE6] text-slate-900 dark:hover:text-[#8FB5FF] hover:text-[#5046E5] transition cursor-pointer"
                        >
                          {workerName}
                        </h4>
                        <p className="text-xs dark:text-[#9AA4B8] text-slate-500 line-clamp-1">
                          {worker.headline || 'Technical Consultant'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center space-x-1 text-xs text-amber-500 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono tabular-nums">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>{Number(worker.rating || 5.0).toFixed(1)}</span>
                      </span>

                      {isClient && (
                        <button
                          onClick={() => handleToggleShortlist(worker)}
                          title={isShortlisted ? 'Remove from shortlist' : 'Save to shortlist'}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            isShortlisted
                              ? 'dark:bg-[#1C2740] bg-[#EEF2FF] dark:border-[rgba(31,97,239,0.25)] border-[#C7D2FE] dark:text-[#8FB5FF] text-[#5046E5]'
                              : 'dark:bg-[#191D2A] bg-slate-100 dark:border-[#272B38] border-slate-200 dark:text-[#9AA4B8] text-slate-600 hover:text-[#5046E5]'
                          }`}
                        >
                          {isShortlisted ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metrics Bar */}
                  <div className="flex items-center justify-between text-xs dark:text-[#9AA4B8] text-slate-500 pt-2 border-t dark:border-[#272B38] border-slate-200">
                    <span className="flex items-center space-x-1">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono tabular-nums dark:text-[#E8EAE6] text-slate-900 font-semibold">{worker.totalCompletedContracts}</span>
                      <span>completed</span>
                    </span>

                    {worker.hourlyRate && (
                      <span className="font-semibold dark:text-[#8FB5FF] text-[#5046E5] text-xs font-mono tabular-nums">
                        ${Number(worker.hourlyRate).toFixed(0)}
                        <span className="text-[11px] font-normal dark:text-[#9AA4B8] text-slate-500">/hr</span>
                      </span>
                    )}

                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        worker.availability === 'AVAILABLE'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}
                    >
                      {worker.availability === 'AVAILABLE' ? 'Available' : 'Busy'}
                    </span>
                  </div>

                  {/* Skills Badges */}
                  {worker.skills && worker.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {worker.skills.slice(0, 4).map((ws) => (
                        <span
                          key={ws.id}
                          className="px-2 py-0.5 rounded-md dark:bg-[#191D2A] bg-slate-100 border dark:border-[#272B38] border-slate-200 text-[11px] dark:text-[#E8EAE6] text-slate-800 font-medium"
                        >
                          {ws.skillName || (ws as unknown as { skill?: { name: string } }).skill?.name}
                        </span>
                      ))}
                      {worker.skills.length > 4 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">
                          +{worker.skills.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t dark:border-[#272B38] border-slate-200 flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedWorkerDetail(worker)}
                    className="flex-1 py-1.5 px-3 rounded-xl dark:bg-[#191D2A] bg-slate-100 hover:dark:bg-[#191D2A] hover:bg-slate-200 text-xs font-semibold dark:text-[#E8EAE6] text-slate-800 transition text-center border dark:border-[#272B38] border-slate-300"
                  >
                    View Portfolio
                  </button>

                  {onStartChat && (
                    <button
                      onClick={() => onStartChat(worker.userId)}
                      className="py-1.5 px-3 rounded-xl dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] text-xs font-bold dark:text-[#8FB5FF] text-[#5046E5] hover:opacity-80 transition flex items-center gap-1 cursor-pointer"
                      title="Chat / Message Specialist"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>
                  )}

                  {isClient && onOpenHiringModal && (
                    <button
                      onClick={() => onOpenHiringModal(worker)}
                      className="py-1.5 px-3.5 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] hover:dark:bg-[#A3FF50] hover:bg-[#4338CA] text-xs font-bold dark:text-white text-white transition flex items-center justify-center space-x-1 dark:shadow-[0_0_15px_rgba(31,97,239,0.15)] shadow-md shadow-[#5046E5]/25 active:scale-95 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Hire</span>
                    </button>
                  )}

                  {isClient && onSelectWorkerForContract && (
                    <button
                      onClick={() => onSelectWorkerForContract(worker.userId)}
                      className="py-1.5 px-3 rounded-xl dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#191D2A] hover:bg-[#E2E8F0] border dark:border-[#272B38] border-[#CBD5E1] text-xs font-medium dark:text-[#8FB5FF] text-[#5046E5] transition hover:border-[rgba(31,97,239,0.25)]"
                      title="Draft Direct Contract"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t dark:border-[#272B38] border-[#E2E8F0] text-xs dark:text-[#9AA4B8] text-[#64748B]">
          <div>
            Showing Page <span className="font-semibold dark:text-[#E8EAE6] text-[#111827] font-mono tabular-nums">{page}</span> of{' '}
            <span className="font-semibold dark:text-[#E8EAE6] text-[#111827] font-mono tabular-nums">{totalPages}</span> (
            <span className="font-mono tabular-nums dark:text-[#8FB5FF] text-[#5046E5]">{totalWorkers}</span> total specialists)
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#191D2A] hover:bg-[#E2E8F0] disabled:opacity-40 disabled:cursor-not-allowed dark:text-[#E8EAE6] text-[#111827] border dark:border-[#272B38] border-[#CBD5E1] transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#191D2A] hover:bg-[#E2E8F0] disabled:opacity-40 disabled:cursor-not-allowed dark:text-[#E8EAE6] text-[#111827] border dark:border-[#272B38] border-[#CBD5E1] transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Full Worker Profile & Portfolio Detail Modal */}
      {selectedWorkerDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto dark:text-[#E8EAE6] text-[#111827] shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-full dark:bg-[#191D2A] bg-[#EFF6FF] border dark:border-[rgba(31,97,239,0.2)] border-[#DBEAFE] flex items-center justify-center dark:text-[#8FB5FF] text-[#5046E5] font-bold text-xl shadow-[0_0_15px_rgba(31,97,239,0.12)]">
                  {selectedWorkerDetail.user?.firstName?.[0] || 'W'}
                </div>
                <div>
                  <h3 className="text-lg font-bold dark:text-[#E8EAE6] text-[#111827]">
                    {selectedWorkerDetail.user?.firstName
                      ? `${selectedWorkerDetail.user.firstName} ${selectedWorkerDetail.user.lastName || ''}`.trim()
                      : `Specialist ${selectedWorkerDetail.userId.slice(0, 8)}`}
                  </h3>
                  <p className="text-xs dark:text-[#8FB5FF] text-[#5046E5] font-medium font-mono">
                    {selectedWorkerDetail.headline || 'Verified Independent Specialist'}
                  </p>
                  <div className="flex items-center space-x-3 text-xs dark:text-[#9AA4B8] text-[#64748B] mt-1">
                    <span className="flex items-center space-x-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-semibold dark:text-[#E8EAE6] text-[#111827] font-mono tabular-nums">
                        {Number(selectedWorkerDetail.rating || 5.0).toFixed(1)}
                      </span>
                    </span>
                    <span>•</span>
                    <span>
                      <strong className="dark:text-[#8FB5FF] text-[#5046E5] font-mono tabular-nums">
                        {selectedWorkerDetail.totalCompletedContracts}
                      </strong>{' '}
                      completed agreements
                    </span>
                    {selectedWorkerDetail.hourlyRate && (
                      <>
                        <span>•</span>
                        <span className="font-semibold dark:text-[#8FB5FF] text-[#5046E5] font-mono tabular-nums">
                          ${Number(selectedWorkerDetail.hourlyRate).toFixed(0)}/hr
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedWorkerDetail(null)}
                className="dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-[#E8EAE6] hover:text-[#111827] p-1.5 rounded-lg dark:bg-[#191D2A] bg-[#F1F5F9] border dark:border-[#272B38] border-[#CBD5E1] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Skills & Experience */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] uppercase tracking-wider font-mono">
                Technical Skills &amp; Experience
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedWorkerDetail.skills && selectedWorkerDetail.skills.length > 0 ? (
                  selectedWorkerDetail.skills.map((ws) => (
                    <div
                      key={ws.id}
                      className="px-3 py-1.5 rounded-lg dark:bg-[#191D2A] bg-[#F1F5F9] border dark:border-[#272B38] border-[#E2E8F0] flex items-center space-x-2 text-xs"
                    >
                      <span className="dark:text-[#E8EAE6] text-[#111827] font-medium">
                        {ws.skillName || (ws as unknown as { skill?: { name: string } }).skill?.name}
                      </span>
                      {ws.yearsOfExperience > 0 && (
                        <span className="dark:text-[#8FB5FF] text-[#5046E5] text-[10px] dark:bg-[#1C2740] bg-[#EEF2FF] px-1.5 py-0.5 rounded border border-[rgba(31,97,239,0.2)] font-mono tabular-nums">
                          {ws.yearsOfExperience}y exp
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs dark:text-[#6A6F68] text-[#94A3B8] italic">No skills listed yet.</p>
                )}
              </div>
            </div>

            {/* Verified Portfolio Gallery */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] uppercase tracking-wider font-mono">
                Verified Portfolio Items
              </h4>
              {selectedWorkerDetail.portfolioItems && selectedWorkerDetail.portfolioItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedWorkerDetail.portfolioItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl dark:bg-[#191D2A] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] space-y-2 flex flex-col justify-between shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold dark:text-[#E8EAE6] text-[#111827]">{item.title}</h5>
                          {item.projectUrl && (
                            <a
                              href={item.projectUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="dark:text-[#8FB5FF] text-[#5046E5] hover:underline text-xs inline-flex items-center space-x-0.5 font-medium"
                            >
                              <span>Demo</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs dark:text-[#9AA4B8] text-[#64748B] mt-1 line-clamp-3 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="text-[10px] dark:text-[#6A6F68] text-[#94A3B8] pt-2 border-t dark:border-[#272B38] border-[#E2E8F0] flex items-center space-x-1 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>Added {new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs dark:text-[#6A6F68] text-[#94A3B8] italic">No portfolio items posted yet.</p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t dark:border-[#272B38] border-[#E2E8F0] flex items-center justify-end space-x-3">
              <button
                onClick={() => setSelectedWorkerDetail(null)}
                className="px-4 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#191D2A] hover:bg-[#E2E8F0] text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] border dark:border-[#272B38] border-[#CBD5E1] transition"
              >
                Close
              </button>

              {isClient && onOpenHiringModal && (
                <button
                  onClick={() => {
                    const worker = selectedWorkerDetail;
                    setSelectedWorkerDetail(null);
                    onOpenHiringModal(worker);
                  }}
                  className="px-5 py-2 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] hover:dark:bg-[#A3FF50] hover:bg-[#4338CA] text-xs font-bold dark:text-white text-white flex items-center space-x-1.5 dark:shadow-[0_0_15px_rgba(31,97,239,0.15)] shadow-md shadow-[#5046E5]/25 transition active:scale-95 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Hiring Proposal</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
