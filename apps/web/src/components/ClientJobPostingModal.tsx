import React, { useState } from 'react';
import { X, Briefcase, MapPin, DollarSign, Users, Calendar, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { apiService } from '../services/api';
import { CreateJobPostRequest } from '@trustpay/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ClientJobPostingModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Software Engineering');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [deliverables, setDeliverables] = useState('');

  // Location & Work Mode
  const [workMode, setWorkMode] = useState<'REMOTE' | 'ON_SITE' | 'HYBRID'>('REMOTE');
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('Andhra Pradesh');
  const [district, setDistrict] = useState('Prakasam');
  const [city, setCity] = useState('Ongole');
  const [postalCode, setPostalCode] = useState('');
  const [address, setAddress] = useState('');

  // Financials
  const [minBudget, setMinBudget] = useState('1000');
  const [maxBudget, setMaxBudget] = useState('5000');
  const [currency, setCurrency] = useState('USD');
  const [paymentType, setPaymentType] = useState<'MILESTONE_BASED' | 'FIXED' | 'HOURLY'>('MILESTONE_BASED');
  const [isNegotiable, setIsNegotiable] = useState(true);

  // Team & Specialists
  const [hiringType, setHiringType] = useState<'INDIVIDUAL' | 'TEAM'>('INDIVIDUAL');
  const [requiredSpecialists, setRequiredSpecialists] = useState(1);
  const [teamLeadRequired, setTeamLeadRequired] = useState(false);
  const [requiredExperience, setRequiredExperience] = useState('Intermediate');

  // Timeline
  const [estimatedDuration, setEstimatedDuration] = useState('1 - 3 months');
  const [applicationDeadline, setApplicationDeadline] = useState('');

  // Skills
  const [skillInput, setSkillInput] = useState('');
  const [skillsList, setSkillsList] = useState<string[]>(['React', 'TypeScript', 'Node.js']);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddSkill = () => {
    const val = skillInput.trim();
    if (!val) return;
    const names = val.split(',').map((s) => s.trim()).filter(Boolean);
    const updated = Array.from(new Set([...skillsList, ...names]));
    setSkillsList(updated);
    setSkillInput('');
  };

  const handleRemoveSkill = (skill: string) => {
    setSkillsList(skillsList.filter((s) => s !== skill));
  };

  const handleSubmit = async (publishStatus: 'DRAFT' | 'PUBLISHED') => {
    if (!title.trim()) {
      setError('Job Title is required');
      return;
    }
    if (!description.trim()) {
      setError('Job Description is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: CreateJobPostRequest = {
      title,
      description,
      category,
      objectives: objectives.trim() || undefined,
      deliverables: deliverables.trim() || undefined,
      workMode,
      country: country || undefined,
      state: state || undefined,
      district: district || undefined,
      city: city || undefined,
      postalCode: postalCode || undefined,
      address: workMode !== 'REMOTE' ? address : undefined,
      minBudget: minBudget ? parseFloat(minBudget) : undefined,
      maxBudget: maxBudget ? parseFloat(maxBudget) : undefined,
      currency,
      paymentType,
      isNegotiable,
      hiringType,
      requiredSpecialists: hiringType === 'TEAM' ? requiredSpecialists : 1,
      teamLeadRequired: hiringType === 'TEAM' ? teamLeadRequired : false,
      requiredExperience,
      estimatedDuration,
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline).toISOString() : undefined,
      status: publishStatus,
      skills: skillsList.map((s) => ({ name: s, isPrimary: false })),
    };

    try {
      const res = await apiService.createJob(payload);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error?.message || 'Failed to post job');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to post job');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="dark:bg-[#121212] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-6 shadow-2xl dark:text-[#CDCBCA] text-[#242424]">
        {/* Header */}
        <div className="flex items-center justify-between border-b dark:border-[rgba(205,203,202,0.15)] border-[#E2E8F0] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl dark:bg-[#1C1F1C] bg-[#EEF2FF] border dark:border-[rgba(139,255,36,0.3)] border-[#C7D2FE] flex items-center justify-center text-[#5046E5] dark:text-[#8BFF24]">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold dark:text-[#CDCBCA] text-[#111827]">Post a Work Opportunity</h3>
              <p className="text-xs dark:text-[#A5A5A5] text-[#64748B]">
                Publish project requirements, budget, team scale, and location preferences for verified Specialists.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg dark:hover:bg-[#202020] hover:bg-[#F1F5F9] dark:text-[#A5A5A5] text-[#64748B] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-500 font-medium">
            {error}
          </div>
        )}

        <div className="space-y-5 text-xs">
          {/* 1. Basic Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider dark:text-[#8BFF24] text-[#5046E5] flex items-center gap-1.5">
              <span>1. Basic Job Information</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold">Job Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Enterprise Full-Stack Healthcare Portal Development"
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none focus:border-[#5046E5] dark:focus:border-[#8BFF24]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold">Work Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none"
                >
                  <option value="Software Engineering">Software Engineering</option>
                  <option value="AI & Machine Learning">AI & Machine Learning</option>
                  <option value="UI/UX & Product Design">UI/UX & Product Design</option>
                  <option value="Cloud & DevOps Architecture">Cloud & DevOps Architecture</option>
                  <option value="Blockchain & Smart Contracts">Blockchain & Smart Contracts</option>
                  <option value="Content & Marketing">Content & Marketing</option>
                  <option value="Civil & Physical Works">Civil & Physical Works</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Detailed Work Description *</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Comprehensive overview of the work requirements, scope, and technical context..."
                className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none focus:border-[#5046E5] dark:focus:border-[#8BFF24]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold">Key Project Objectives (Optional)</label>
                <textarea
                  rows={2}
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  placeholder="Goals, performance targets, and success criteria..."
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold">Expected Deliverables (Optional)</label>
                <textarea
                  rows={2}
                  value={deliverables}
                  onChange={(e) => setDeliverables(e.target.value)}
                  placeholder="Specific outputs, milestones, artifacts, or source code..."
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. Work Mode & Location */}
          <div className="space-y-3 pt-3 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0]">
            <h4 className="text-xs font-bold uppercase tracking-wider dark:text-[#8BFF24] text-[#5046E5] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>2. Work Location & Operational Mode</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="font-semibold">Work Mode</label>
                <select
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none"
                >
                  <option value="REMOTE">Remote (Any Location)</option>
                  <option value="HYBRID">Hybrid (Partial On-Site)</option>
                  <option value="ON_SITE">On-Site (Physical Location)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. India, United States"
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold">State / Region</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Andhra Pradesh, California"
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold">District / County</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Prakasam, Orange"
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-semibold">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Ongole, Hyderabad, Bangalore"
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold">Postal Code</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="e.g. 523001"
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold">Work Address / Venue (Non-Public)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Tech Park Phase 2"
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Budget & Team Scaling */}
          <div className="space-y-3 pt-3 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0]">
            <h4 className="text-xs font-bold uppercase tracking-wider dark:text-[#8BFF24] text-[#5046E5] flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              <span>3. Budget & Hiring Specifications</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="font-semibold">Min Budget</label>
                <input
                  type="number"
                  min="0"
                  value={minBudget}
                  onChange={(e) => setMinBudget(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold">Max Budget</label>
                <input
                  type="number"
                  min="0"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none font-mono"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold">Payment Type</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none"
                >
                  <option value="MILESTONE_BASED">Milestone-Based Escrow</option>
                  <option value="FIXED">Fixed Price Agreement</option>
                  <option value="HOURLY">Hourly Engagement</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-semibold">Hiring Type</label>
                <select
                  value={hiringType}
                  onChange={(e) => setHiringType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none"
                >
                  <option value="INDIVIDUAL">Individual Specialist</option>
                  <option value="TEAM">Specialist Team (Multi-Member)</option>
                </select>
              </div>

              {hiringType === 'TEAM' && (
                <>
                  <div className="space-y-1">
                    <label className="font-semibold">Required Specialists Count</label>
                    <input
                      type="number"
                      min="2"
                      max="30"
                      value={requiredSpecialists}
                      onChange={(e) => setRequiredSpecialists(parseInt(e.target.value, 10) || 2)}
                      className="w-full px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1 flex items-center pt-5">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={teamLeadRequired}
                        onChange={(e) => setTeamLeadRequired(e.target.checked)}
                        className="rounded accent-[#5046E5] dark:accent-[#8BFF24]"
                      />
                      <span className="font-medium">Designated Team Lead Required</span>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 4. Required Skills */}
          <div className="space-y-3 pt-3 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0]">
            <h4 className="text-xs font-bold uppercase tracking-wider dark:text-[#8BFF24] text-[#5046E5] flex items-center gap-1.5">
              <span>4. Required Skills Taxonomy</span>
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                placeholder="Type skill name (e.g. Next.js, PostgreSQL, UI Design) or comma-separated..."
                className="flex-1 px-3 py-2 rounded-xl dark:bg-[#1A1A1A] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.12)] border-[#E2E8F0] dark:text-[#CDCBCA] text-[#111827] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-4 py-2 rounded-xl bg-[#5046E5] dark:bg-[#8BFF24] text-white dark:text-[#050605] font-semibold text-xs flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {skillsList.map((skill) => (
                <span
                  key={skill}
                  className="px-2.5 py-1 rounded-lg dark:bg-[#202020] bg-[#EEF2FF] border dark:border-[rgba(255,255,255,0.1)] border-[#C7D2FE] flex items-center space-x-1.5 text-[11px]"
                >
                  <span className="dark:text-[#CDCBCA] text-[#5046E5] font-medium">{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="hover:text-red-500 transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border dark:border-[rgba(255,255,255,0.15)] border-[#E2E8F0] hover:bg-slate-100 dark:hover:bg-[#202020] text-xs font-semibold dark:text-[#CDCBCA] text-[#64748B] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit('DRAFT')}
            className="px-4 py-2 rounded-xl border dark:border-[rgba(255,255,255,0.2)] border-[#C7D2FE] bg-[#F1F5F9] dark:bg-[#202020] hover:scale-105 text-xs font-semibold dark:text-[#E8EAE6] text-[#475569] transition cursor-pointer"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit('PUBLISHED')}
            className="px-5 py-2 rounded-xl bg-[#5046E5] dark:bg-[#8BFF24] hover:bg-[#4338CA] dark:hover:bg-[#7AE01F] text-white dark:text-[#050605] font-bold text-xs shadow-md transition cursor-pointer active:scale-95"
          >
            {isSubmitting ? 'Publishing...' : 'Publish Job Listing'}
          </button>
        </div>
      </div>
    </div>
  );
};

