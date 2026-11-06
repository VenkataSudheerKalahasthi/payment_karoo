import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Users, MapPin, DollarSign, Calendar, Eye, Pause, Play, CheckCircle2, AlertCircle, FileText, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import { JobPostDto } from '@trustpay/shared';
import { ClientJobPostingModal } from './ClientJobPostingModal';
import { ClientProposalComparisonModal } from './ClientProposalComparisonModal';

interface ClientJobsManagementProps {
  onStartChat?: (specialistUserId: string) => void;
}

export const ClientJobsManagement: React.FC<ClientJobsManagementProps> = ({ onStartChat }) => {
  const [jobs, setJobs] = useState<JobPostDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT' | 'PAUSED' | 'CLOSED'>('ALL');
  const [isPostingModalOpen, setIsPostingModalOpen] = useState(false);
  const [selectedJobForProposals, setSelectedJobForProposals] = useState<JobPostDto | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await apiService.listMyJobs(statusFilter !== 'ALL' ? { status: statusFilter } : undefined);
      if (res.success && res.data) {
        setJobs(res.data);
      }
    } catch (err) {
      console.error('Failed to load client jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [statusFilter]);

  const handleToggleJobStatus = async (job: JobPostDto, nextStatus: 'PUBLISHED' | 'PAUSED' | 'CLOSED') => {
    try {
      await apiService.updateJob(job.id, { status: nextStatus });
      fetchJobs();
    } catch (err) {
      console.error('Failed to update job status:', err);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to permanently remove this job post?')) return;
    try {
      const res = await apiService.deleteJob(jobId);
      if (res.success) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
      } else {
        alert(res.error?.message || 'Failed to delete job');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Error deleting job');
    }
  };

  return (
    <div className="space-y-6 feature-enter">
      {/* Top Banner */}
      <div className="dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#5046E5] dark:text-[#8BFF24] uppercase tracking-wider">
            <Briefcase className="w-4 h-4" />
            <span>Client Job Postings Command Center</span>
          </div>
          <h2 className="text-xl font-extrabold dark:text-[#E8EAE6] text-[#111827] mt-1">
            Work Opportunities & Applications Hub
          </h2>
          <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] mt-0.5">
            Create work specifications, review applicant proposals, negotiate terms, and initialize escrow agreements.
          </p>
        </div>

        <button
          onClick={() => setIsPostingModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-[#5046E5] dark:bg-[#8BFF24] hover:bg-[#4338CA] dark:hover:bg-[#7AE01F] text-white dark:text-[#050605] font-bold text-xs flex items-center justify-center space-x-2 shadow-md transition cursor-pointer active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Post New Opportunity</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] pb-2 text-xs">
        {(['ALL', 'PUBLISHED', 'DRAFT', 'PAUSED', 'CLOSED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
              statusFilter === tab
                ? 'bg-[#5046E5] dark:bg-[#8BFF24] text-white dark:text-[#050605] shadow-sm'
                : 'dark:text-[#A5AAA2] text-[#64748B] hover:dark:bg-[#202020] hover:bg-slate-100'
            }`}
          >
            {tab === 'ALL' ? 'All Opportunities' : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Job Cards List */}
      {loading ? (
        <div className="p-12 text-center text-xs dark:text-[#A5AAA2] text-[#64748B]">Loading posted jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl dark:bg-[#121212] bg-white border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] space-y-3">
          <Briefcase className="w-10 h-10 mx-auto text-[#64748B] dark:text-[#777777]" />
          <h4 className="text-sm font-bold dark:text-[#E8EAE6] text-[#111827]">No Work Opportunities Found</h4>
          <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] max-w-sm mx-auto">
            You haven't posted any jobs in this category yet. Click below to publish your first work opportunity.
          </p>
          <button
            onClick={() => setIsPostingModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#5046E5] dark:bg-[#8BFF24] text-white dark:text-[#050605] font-semibold text-xs transition cursor-pointer"
          >
            Post Work Opportunity
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="dark:bg-[#121212] bg-white border dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4 interactive-card flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md dark:bg-[#1C1F1C] bg-[#EEF2FF] text-[#5046E5] dark:text-[#8BFF24] border dark:border-[rgba(139,255,36,0.2)] border-[#C7D2FE]">
                      {job.category}
                    </span>
                    <h3 className="text-sm font-bold dark:text-[#E8EAE6] text-[#111827] mt-1.5 leading-snug">
                      {job.title}
                    </h3>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      job.status === 'PUBLISHED'
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : job.status === 'DRAFT'
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        : job.status === 'PAUSED'
                        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>

                <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] line-clamp-2 leading-relaxed">
                  {job.description}
                </p>

                {/* Metadata Pills */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="flex items-center space-x-1.5 dark:text-[#CDCBCA] text-[#475569]">
                    <DollarSign className="w-3.5 h-3.5 text-[#5046E5] dark:text-[#8BFF24]" />
                    <span className="font-mono tabular-nums font-semibold">
                      ${job.minBudget ? Number(job.minBudget).toLocaleString() : '0'} - ${job.maxBudget ? Number(job.maxBudget).toLocaleString() : '0'} {job.currency}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 dark:text-[#CDCBCA] text-[#475569]">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    <span>
                      {job.workMode} {job.city ? `(${job.city})` : ''}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 dark:text-[#CDCBCA] text-[#475569]">
                    <Users className="w-3.5 h-3.5 text-purple-500" />
                    <span>
                      {job.hiringType === 'TEAM'
                        ? `Team (${job.requiredSpecialists} Specialists)`
                        : 'Individual Specialist'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 dark:text-[#CDCBCA] text-[#475569]">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    <span>{job.estimatedDuration || 'Flexible timeline'}</span>
                  </div>
                </div>

                {/* Skills tags */}
                {job.skills && job.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {job.skills.map((s) => (
                      <span
                        key={s.id}
                        className="px-2 py-0.5 rounded-md dark:bg-[#1C1C1C] bg-slate-100 dark:text-[#A5AAA2] text-[#475569] text-[10px] border dark:border-[rgba(255,255,255,0.06)] border-[#E2E8F0]"
                      >
                        {s.skill?.name || s.customSkillName}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-3 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] gap-2">
                <button
                  onClick={() => setSelectedJobForProposals(job)}
                  className="px-3 py-1.5 rounded-xl bg-[#5046E5] dark:bg-[#8BFF24] text-white dark:text-[#050605] font-semibold text-xs flex items-center space-x-1.5 shadow-sm transition hover:scale-105 cursor-pointer active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>
                    Review Applications ({job.proposalsCount || (job as any)._count?.proposals || 0})
                  </span>
                </button>

                <div className="flex items-center space-x-1 text-xs">
                  {job.status === 'PUBLISHED' && (
                    <button
                      onClick={() => handleToggleJobStatus(job, 'PAUSED')}
                      title="Pause Job"
                      className="p-1.5 rounded-lg dark:hover:bg-[#202020] hover:bg-slate-100 dark:text-[#A5AAA2] text-[#64748B] transition cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {job.status === 'PAUSED' && (
                    <button
                      onClick={() => handleToggleJobStatus(job, 'PUBLISHED')}
                      title="Resume Job"
                      className="p-1.5 rounded-lg dark:hover:bg-[#202020] hover:bg-slate-100 text-emerald-500 transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {job.status !== 'CLOSED' && (
                    <button
                      onClick={() => handleToggleJobStatus(job, 'CLOSED')}
                      title="Close Job"
                      className="p-1.5 rounded-lg dark:hover:bg-[#202020] hover:bg-slate-100 text-red-400 transition cursor-pointer"
                    >
                      <span className="text-[11px] font-semibold">Close</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteJob(job.id)}
                    title="Remove / Delete Job Post"
                    className="p-1.5 rounded-lg dark:hover:bg-rose-500/20 hover:bg-rose-100 text-rose-500 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post a Job Modal */}
      <ClientJobPostingModal
        isOpen={isPostingModalOpen}
        onClose={() => setIsPostingModalOpen(false)}
        onSuccess={() => fetchJobs()}
      />

      {/* Proposal Review & Comparison Modal */}
      {selectedJobForProposals && (
        <ClientProposalComparisonModal
          job={selectedJobForProposals}
          isOpen={!!selectedJobForProposals}
          onClose={() => setSelectedJobForProposals(null)}
          onStartChat={onStartChat}
          onProposalAccepted={() => {
            fetchJobs();
          }}
        />
      )}
    </div>
  );
};

