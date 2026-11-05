import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  Search,
  Filter,
  DollarSign,
  Clock,
  Briefcase,
  CheckCircle2,
  Send,
  Eye,
  X,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import { apiService } from '../services/api';
import { ProjectOpportunityDto } from '@trustpay/shared';

interface SpecialistOpportunitiesProps {
  onProposalSubmitted?: () => void;
}

export const SpecialistOpportunities: React.FC<SpecialistOpportunitiesProps> = ({
  onProposalSubmitted,
}) => {
  const [opportunities, setOpportunities] = useState<ProjectOpportunityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [budgetFilter, setBudgetFilter] = useState<string>('ALL');

  // Modals
  const [selectedOpportunity, setSelectedOpportunity] = useState<ProjectOpportunityDto | null>(null);
  const [proposalTarget, setProposalTarget] = useState<ProjectOpportunityDto | null>(null);

  // Proposal Form State
  const [proposedBudget, setProposedBudget] = useState<string>('');
  const [estimatedDays, setEstimatedDays] = useState<string>('14');
  const [proposalScope, setProposalScope] = useState<string>('');
  const [coverLetter, setCoverLetter] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.listOpportunities();
      if (res.success && res.data) {
        setOpportunities(res.data.items || []);
      } else {
        setError(res.error?.message || 'Failed to load project opportunities');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error loading opportunities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  // Filtered
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((op) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        op.title.toLowerCase().includes(q) ||
        op.description.toLowerCase().includes(q) ||
        op.clientName.toLowerCase().includes(q);

      const matchesCat = categoryFilter === 'ALL' || op.category === categoryFilter;

      let matchesBudget = true;
      if (budgetFilter === 'LOW') matchesBudget = op.budget < 1000;
      if (budgetFilter === 'MID') matchesBudget = op.budget >= 1000 && op.budget <= 5000;
      if (budgetFilter === 'HIGH') matchesBudget = op.budget > 5000;

      return matchesSearch && matchesCat && matchesBudget;
    });
  }, [opportunities, searchQuery, categoryFilter, budgetFilter]);

  // Handle Proposal Submission
  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalTarget || !proposedBudget || !proposalScope.trim()) {
      alert('Please fill in your proposed budget and scope of work.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiService.submitOpportunityProposal({
        opportunityId: proposalTarget.id,
        proposedBudget: parseFloat(proposedBudget),
        estimatedDays: parseInt(estimatedDays, 10) || undefined,
        proposalScope: proposalScope.trim(),
        coverLetter: coverLetter.trim() || undefined,
      });

      if (res.success) {
        setSubmitSuccess(true);
        setTimeout(() => {
          setSubmitSuccess(false);
          setProposalTarget(null);
          setProposedBudget('');
          setProposalScope('');
          setCoverLetter('');
          onProposalSubmitted?.();
        }, 1500);
      } else {
        alert(res.error?.message || 'Failed to submit proposal');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Error submitting proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    'ALL',
    'Full-Stack Development',
    'Smart Contracts & Escrow',
    'UI/UX & Frontend',
    'Backend & Cloud Systems',
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#121412] dark:bg-[#121412] border border-[#262926] p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8BFF24]/10 border border-[#8BFF24]/30 flex items-center justify-center">
            <Compass className="w-5 h-5 text-[#8BFF24]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Browse Project Opportunities</h1>
            <p className="text-sm text-zinc-400">
              Discover client opportunities, review milestone deliverables, and submit competitive proposals.
            </p>
          </div>
        </div>

        <button
          onClick={fetchOpportunities}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e201e] border border-[#2e322e] text-zinc-300 hover:text-white hover:border-[#8BFF24]/40 transition text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Feed
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#121412] border border-[#262926] p-4 rounded-xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects by title, scope, or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#181a18] border border-[#2e322e] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-zinc-400 font-semibold whitespace-nowrap">Budget Tier:</span>
            <select
              value={budgetFilter}
              onChange={(e) => setBudgetFilter(e.target.value)}
              className="bg-[#181a18] border border-[#2e322e] rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#8BFF24]/60"
            >
              <option value="ALL">All Budgets</option>
              <option value="LOW">&lt; $1,000</option>
              <option value="MID">$1,000 – $5,000</option>
              <option value="HIGH">&gt; $5,000</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#262926]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                categoryFilter === cat
                  ? 'bg-[#8BFF24] text-black'
                  : 'bg-[#181a18] text-zinc-300 hover:text-white border border-[#2e322e]'
              }`}
            >
              {cat === 'ALL' ? 'All Opportunities' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunities Grid */}
      {loading ? (
        <div className="bg-[#121412] border border-[#262926] p-12 rounded-2xl flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 text-[#8BFF24] animate-spin mb-3" />
          <p className="text-zinc-400 text-sm">Searching open client opportunities...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <div className="bg-[#121412] border border-[#262926] p-12 rounded-2xl text-center">
          <Compass className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No matching opportunities</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria or category filter to discover more client opportunities.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOpportunities.map((op) => (
            <div
              key={op.id}
              className="bg-[#121412] border border-[#262926] hover:border-[#8BFF24]/40 transition rounded-xl p-5 flex flex-col justify-between space-y-4 hover:shadow-[0_0_20px_rgba(139,255,36,0.06)]"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    {op.category}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#8BFF24]">
                    ${op.budget.toLocaleString()} <span className="text-[10px] text-zinc-400 font-normal">{op.currency}</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white hover:text-[#8BFF24] transition line-clamp-1 cursor-pointer" onClick={() => setSelectedOpportunity(op)}>
                    {op.title}
                  </h3>
                  <p className="text-xs text-zinc-400 line-clamp-3 mt-1">{op.description}</p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {op.requiredSkills.map((sk, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#181a18] text-zinc-300 border border-[#262926]"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#262926] space-y-3">
                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span className="flex items-center gap-1 text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#8BFF24]" />
                    {op.clientName}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Layers className="w-3 h-3 text-zinc-500" />
                    {op.milestonesCount} Milestones
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setSelectedOpportunity(op)}
                    className="flex-1 py-1.5 rounded-lg bg-[#181a18] hover:bg-[#202220] border border-[#2e322e] text-zinc-300 hover:text-white text-xs font-medium transition text-center"
                  >
                    View Scope
                  </button>
                  <button
                    onClick={() => {
                      setProposalTarget(op);
                      setProposedBudget(String(op.budget));
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-[#8BFF24] hover:bg-[#78e018] text-black text-xs font-bold transition text-center flex items-center justify-center gap-1 shadow-[0_0_10px_rgba(139,255,36,0.2)]"
                  >
                    <Send className="w-3 h-3" />
                    Apply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Opportunity Details Modal */}
      {selectedOpportunity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121412] border border-[#262926] w-full max-w-xl rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedOpportunity(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8BFF24]/10 border border-[#8BFF24]/30 flex items-center justify-center text-[#8BFF24]">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-zinc-400 font-semibold">{selectedOpportunity.category}</span>
                <h3 className="text-lg font-bold text-white">{selectedOpportunity.title}</h3>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#181a18] border border-[#262926] grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-zinc-500 block uppercase font-semibold text-[10px]">Client</span>
                <p className="font-semibold text-white mt-0.5">{selectedOpportunity.clientName}</p>
              </div>
              <div>
                <span className="text-zinc-500 block uppercase font-semibold text-[10px]">Agreed Budget</span>
                <p className="font-mono font-bold text-[#8BFF24] mt-0.5">
                  ${selectedOpportunity.budget.toLocaleString()} {selectedOpportunity.currency}
                </p>
              </div>
              <div>
                <span className="text-zinc-500 block uppercase font-semibold text-[10px]">Milestones</span>
                <p className="text-zinc-200 mt-0.5">{selectedOpportunity.milestonesCount} Escrow-Protected Deliverables</p>
              </div>
              <div>
                <span className="text-zinc-500 block uppercase font-semibold text-[10px]">Target Deadline</span>
                <p className="text-zinc-200 mt-0.5">
                  {selectedOpportunity.deadline ? new Date(selectedOpportunity.deadline).toLocaleDateString() : 'Flexible'}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Project Overview</label>
              <p className="text-xs text-zinc-300 bg-[#181a18] p-3 rounded-lg border border-[#262926] leading-relaxed">
                {selectedOpportunity.description}
              </p>
            </div>

            {selectedOpportunity.scope && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Scope of Work</label>
                <p className="text-xs text-zinc-300 bg-[#181a18] p-3 rounded-lg border border-[#262926] leading-relaxed">
                  {selectedOpportunity.scope}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#262926]">
              <button
                onClick={() => setSelectedOpportunity(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setProposalTarget(selectedOpportunity);
                  setProposedBudget(String(selectedOpportunity.budget));
                  setSelectedOpportunity(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#8BFF24] hover:bg-[#78e018] text-black text-xs font-bold transition flex items-center gap-1.5 shadow-[0_0_12px_rgba(139,255,36,0.25)]"
              >
                <Send className="w-3.5 h-3.5" />
                Apply for this Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Proposal Modal (Phase 8 Proposal Submission) */}
      {proposalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121412] border border-[#262926] w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setProposalTarget(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8BFF24]/10 border border-[#8BFF24]/30 flex items-center justify-center text-[#8BFF24]">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Submit Proposal</h3>
                <p className="text-xs text-zinc-400">Target Project: {proposalTarget.title}</p>
              </div>
            </div>

            {submitSuccess ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-[#8BFF24] mx-auto animate-bounce" />
                <h4 className="text-base font-bold text-white">Proposal Successfully Transmitted!</h4>
                <p className="text-xs text-zinc-400">
                  The client has been notified and can review or counteroffer your proposal in Hiring Requests.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitProposal} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-300 font-semibold block mb-1">Proposed Budget ($ USD) *</label>
                    <input
                      type="number"
                      value={proposedBudget}
                      onChange={(e) => setProposedBudget(e.target.value)}
                      placeholder="e.g. 1500"
                      min="1"
                      className="w-full bg-[#181a18] border border-[#2e322e] rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-[#8BFF24]/60"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-zinc-300 font-semibold block mb-1">Estimated Timeline (Days) *</label>
                    <input
                      type="number"
                      value={estimatedDays}
                      onChange={(e) => setEstimatedDays(e.target.value)}
                      placeholder="e.g. 14"
                      min="1"
                      className="w-full bg-[#181a18] border border-[#2e322e] rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-[#8BFF24]/60"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Proposed Approach & Scope *</label>
                  <textarea
                    rows={3}
                    value={proposalScope}
                    onChange={(e) => setProposalScope(e.target.value)}
                    placeholder="Outline your planned implementation, milestone roadmap, and tech stack..."
                    className="w-full bg-[#181a18] border border-[#2e322e] rounded-xl p-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60"
                    required
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">Cover Letter & Relevant Experience</label>
                  <textarea
                    rows={3}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Introduce yourself and highlight past achievements relevant to this project..."
                    className="w-full bg-[#181a18] border border-[#2e322e] rounded-xl p-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60"
                  />
                </div>

                <div className="p-3 bg-[#181a18] rounded-xl border border-[#262926] flex items-center gap-2 text-zinc-400">
                  <ShieldCheck className="w-4 h-4 text-[#8BFF24] flex-shrink-0" />
                  <span>Escrow guarantee: funds will be locked upon client acceptance before work commences.</span>
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-[#262926]">
                  <button
                    type="button"
                    onClick={() => setProposalTarget(null)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !proposedBudget || !proposalScope.trim()}
                    className="px-5 py-2 rounded-xl bg-[#8BFF24] hover:bg-[#78e018] text-black text-xs font-bold transition disabled:opacity-40"
                  >
                    {submitting ? 'Submitting...' : 'Submit Proposal'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

