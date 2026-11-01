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
} from 'lucide-react';

interface WorkerMarketplaceProps {
  onSelectWorkerForContract?: (workerId: string) => void;
  onOpenHiringModal?: (worker: WorkerProfileDto) => void;
  isClient?: boolean;
}

export const WorkerMarketplace: React.FC<WorkerMarketplaceProps> = ({
  onSelectWorkerForContract,
  onOpenHiringModal,
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
          <h3 className="text-xl font-bold text-white tracking-tight">Verified Specialist Marketplace</h3>
          <p className="text-xs text-slate-400 mt-1">
            Browse verified technical professionals, inspect portfolio deliverables, and initiate milestone contracts.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, headline or bio..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Filter & Sorting Controls */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <div className="flex items-center space-x-1.5 text-slate-400 font-medium">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {/* Skill Filter */}
        <select
          value={selectedSkill}
          onChange={(e) => {
            setSelectedSkill(e.target.value);
            setPage(1);
          }}
          className="bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Skills</option>
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
          className="bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Availability</option>
          <option value="AVAILABLE">Available Now</option>
          <option value="BUSY">In Engagement</option>
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
            className="w-20 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <span className="text-slate-500">-</span>
          <input
            type="number"
            placeholder="Max $/hr"
            value={maxRate}
            onChange={(e) => {
              setMaxRate(e.target.value);
              setPage(1);
            }}
            className="w-20 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Sorting */}
        <div className="ml-auto flex items-center space-x-2">
          <span className="text-slate-500">Sort by:</span>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
              setSortBy(sb);
              setSortOrder(so);
              setPage(1);
            }}
            className="bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="rating-desc">Highest Rating</option>
            <option value="hourlyRate-asc">Lowest Rate</option>
            <option value="hourlyRate-desc">Highest Rate</option>
            <option value="totalCompletedContracts-desc">Most Contracts</option>
          </select>
        </div>
      </div>

      {/* Specialist Cards Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-500 text-sm">Querying verified database specialists...</div>
      ) : workers.length === 0 ? (
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-16 text-center text-slate-400 text-sm">
          No specialized workers matched your filter criteria. Try resetting skill or budget filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => {
            const isShortlisted = shortlistedIds.has(worker.id);
            const workerName = worker.user?.firstName
              ? `${worker.user.firstName} ${worker.user.lastName || ''}`.trim()
              : `Specialist ${worker.userId.slice(0, 8)}`;

            return (
              <div
                key={worker.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Bar with Avatar, Rating, and Shortlist Bookmark */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-base">
                        {worker.user?.firstName?.[0] || 'W'}
                      </div>
                      <div>
                        <h4
                          onClick={() => setSelectedWorkerDetail(worker)}
                          className="text-sm font-semibold text-white hover:text-emerald-400 transition cursor-pointer"
                        >
                          {workerName}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-1">{worker.headline || 'Technical Consultant'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center space-x-1 text-xs text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>{Number(worker.rating || 5.0).toFixed(1)}</span>
                      </span>

                      {isClient && (
                        <button
                          onClick={() => handleToggleShortlist(worker)}
                          title={isShortlisted ? 'Remove from shortlist' : 'Save to shortlist'}
                          className={`p-1.5 rounded-md border transition ${
                            isShortlisted
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {isShortlisted ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metrics Bar */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                    <span className="flex items-center space-x-1">
                      <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                      <span>{worker.totalCompletedContracts} completed</span>
                    </span>

                    {worker.hourlyRate && (
                      <span className="font-semibold text-slate-200 text-sm">
                        ${Number(worker.hourlyRate).toFixed(0)}
                        <span className="text-xs font-normal text-slate-400">/hr</span>
                      </span>
                    )}

                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        worker.availability === 'AVAILABLE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {worker.availability === 'AVAILABLE' ? 'Available' : 'Engaged'}
                    </span>
                  </div>

                  {/* Skills Badges */}
                  {worker.skills && worker.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {worker.skills.slice(0, 4).map((ws) => (
                        <span
                          key={ws.id}
                          className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-xs text-slate-300"
                        >
                          {ws.skillName || (ws as unknown as { skill?: { name: string } }).skill?.name}
                        </span>
                      ))}
                      {worker.skills.length > 4 && (
                        <span className="px-1.5 py-0.5 text-xs text-slate-500">
                          +{worker.skills.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedWorkerDetail(worker)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition text-center border border-slate-700"
                  >
                    View Portfolio
                  </button>

                  {isClient && onOpenHiringModal && (
                    <button
                      onClick={() => onOpenHiringModal(worker)}
                      className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition flex items-center justify-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Hire</span>
                    </button>
                  )}

                  {isClient && onSelectWorkerForContract && (
                    <button
                      onClick={() => onSelectWorkerForContract(worker.userId)}
                      className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-emerald-400 transition"
                      title="Draft Contract directly"
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
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
          <div>
            Showing Page <span className="font-semibold text-slate-200">{page}</span> of{' '}
            <span className="font-semibold text-slate-200">{totalPages}</span> ({totalWorkers} total specialists)
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 border border-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 border border-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Full Worker Profile & Portfolio Detail Modal */}
      {selectedWorkerDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xl">
                  {selectedWorkerDetail.user?.firstName?.[0] || 'W'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {selectedWorkerDetail.user?.firstName
                      ? `${selectedWorkerDetail.user.firstName} ${selectedWorkerDetail.user.lastName || ''}`.trim()
                      : `Specialist ${selectedWorkerDetail.userId.slice(0, 8)}`}
                  </h3>
                  <p className="text-xs text-emerald-400 font-medium">
                    {selectedWorkerDetail.headline || 'Verified Independent Contractor'}
                  </p>
                  <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                    <span className="flex items-center space-x-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-slate-200">
                        {Number(selectedWorkerDetail.rating || 5.0).toFixed(1)}
                      </span>
                    </span>
                    <span>•</span>
                    <span>{selectedWorkerDetail.totalCompletedContracts} completed agreements</span>
                    {selectedWorkerDetail.hourlyRate && (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-slate-200">
                          ${Number(selectedWorkerDetail.hourlyRate).toFixed(0)}/hr
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedWorkerDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 border border-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Skills & Experience */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Technical Skills &amp; Experience</h4>
              <div className="flex flex-wrap gap-2">
                {selectedWorkerDetail.skills && selectedWorkerDetail.skills.length > 0 ? (
                  selectedWorkerDetail.skills.map((ws) => (
                    <div
                      key={ws.id}
                      className="px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 flex items-center space-x-2 text-xs"
                    >
                      <span className="text-white font-medium">
                        {ws.skillName || (ws as unknown as { skill?: { name: string } }).skill?.name}
                      </span>
                      {ws.yearsOfExperience > 0 && (
                        <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          {ws.yearsOfExperience}y exp
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No skills listed yet.</p>
                )}
              </div>
            </div>

            {/* Verified Portfolio Gallery */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Verified Portfolio Items</h4>
              {selectedWorkerDetail.portfolioItems && selectedWorkerDetail.portfolioItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedWorkerDetail.portfolioItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold text-white">{item.title}</h5>
                          {item.projectUrl && (
                            <a
                              href={item.projectUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 text-xs inline-flex items-center space-x-0.5"
                            >
                              <span>Demo</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-3">{item.description}</p>
                      </div>

                      <div className="text-[10px] text-slate-500 pt-1 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>Added {new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No portfolio items posted yet.</p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                onClick={() => setSelectedWorkerDetail(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700"
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
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20"
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
