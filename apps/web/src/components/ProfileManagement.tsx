import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import {
  UserDto,
  WorkerProfileDto,
  SkillDto,
  UserRole,
  WorkerAvailability,
} from '@trustpay/shared';
import {
  User,
  Briefcase,
  Plus,
  Trash2,
  CheckCircle,
  ExternalLink,
  AlertCircle,
  Save,
  Layers,
} from 'lucide-react';

interface ProfileManagementProps {
  currentUser: UserDto;
  onProfileUpdated: () => void;
}

export const ProfileManagement: React.FC<ProfileManagementProps> = ({
  currentUser,
  onProfileUpdated,
}) => {
  const isWorker = currentUser.role.name === UserRole.WORKER;

  // General profile state
  const [bio, setBio] = useState(currentUser.profile?.bio || '');
  const [companyName, setCompanyName] = useState(currentUser.profile?.companyName || '');
  const [phoneNumber, setPhoneNumber] = useState(currentUser.profile?.phoneNumber || '');
  const [country, setCountry] = useState(currentUser.profile?.country || '');
  const [timezone, setTimezone] = useState(currentUser.profile?.timezone || 'UTC');
  const [address, setAddress] = useState(currentUser.profile?.address || '');

  // Worker specific state
  const [headline, setHeadline] = useState(currentUser.workerProfile?.headline || '');
  const [hourlyRate, setHourlyRate] = useState(currentUser.workerProfile?.hourlyRate?.toString() || '');
  const [availability, setAvailability] = useState<WorkerAvailability>(
    currentUser.workerProfile?.availability || 'AVAILABLE',
  );

  // Worker Skills & Portfolio
  const [workerProfile, setWorkerProfile] = useState<WorkerProfileDto | null>(null);
  const [availableSkills, setAvailableSkills] = useState<SkillDto[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [skillExperience, setSkillExperience] = useState('1');

  // Portfolio Item Form
  const [portfolioTitle, setPortfolioTitle] = useState('');
  const [portfolioDescription, setPortfolioDescription] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [isAddingPortfolio, setIsAddingPortfolio] = useState(false);

  // Feedback states
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingWorker, setIsSavingWorker] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWorkerData = useCallback(async () => {
    if (!isWorker) return;
    try {
      const [workerRes, skillsRes] = await Promise.all([
        apiService.getWorkerProfileMe(),
        apiService.listSkills(),
      ]);

      if (workerRes.success && workerRes.data) {
        setWorkerProfile(workerRes.data);
        if (workerRes.data.headline) setHeadline(workerRes.data.headline);
        if (workerRes.data.hourlyRate) setHourlyRate(workerRes.data.hourlyRate.toString());
        if (workerRes.data.availability) setAvailability(workerRes.data.availability);
      }

      if (skillsRes.success && skillsRes.data) {
        setAvailableSkills(skillsRes.data);
        if (skillsRes.data.length > 0) {
          setSelectedSkillId(skillsRes.data[0].id);
        }
      }
    } catch {
      // Ignored
    }
  }, [isWorker]);

  useEffect(() => {
    loadWorkerData();
  }, [loadWorkerData]);

  const handleSaveGeneralProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGeneral(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await apiService.updateProfile({
        bio: bio.trim(),
        companyName: companyName.trim(),
        phoneNumber: phoneNumber.trim(),
        country: country.trim(),
        timezone: timezone.trim(),
        address: address.trim(),
      });

      if (res.success) {
        setSuccessMessage('Profile information updated successfully!');
        onProfileUpdated();
      } else {
        setErrorMessage(res.error?.message || 'Failed to update profile');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error updating profile');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleSaveWorkerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWorker(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await apiService.updateWorkerProfile({
        headline: headline.trim(),
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        availability,
      });

      if (res.success) {
        setSuccessMessage('Worker professional details updated successfully!');
        onProfileUpdated();
        loadWorkerData();
      } else {
        setErrorMessage(res.error?.message || 'Failed to update specialist profile');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error updating specialist profile');
    } finally {
      setIsSavingWorker(false);
    }
  };

  const handleAddSkill = async () => {
    if (!selectedSkillId) return;
    try {
      const res = await apiService.addWorkerSkill({
        skillId: selectedSkillId,
        yearsOfExperience: parseInt(skillExperience, 10) || 1,
      });

      if (res.success) {
        loadWorkerData();
      } else {
        alert(res.error?.message || 'Failed to add skill');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    try {
      const res = await apiService.removeWorkerSkill(skillId);
      if (res.success) {
        loadWorkerData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPortfolioItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolioTitle.trim() || !portfolioDescription.trim()) return;

    try {
      const res = await apiService.createPortfolioItem({
        title: portfolioTitle.trim(),
        description: portfolioDescription.trim(),
        projectUrl: portfolioUrl.trim() || undefined,
      });

      if (res.success) {
        setPortfolioTitle('');
        setPortfolioDescription('');
        setPortfolioUrl('');
        setIsAddingPortfolio(false);
        loadWorkerData();
      } else {
        alert(res.error?.message || 'Failed to add portfolio item');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePortfolioItem = async (id: string) => {
    try {
      const res = await apiService.deletePortfolioItem(id);
      if (res.success) {
        loadWorkerData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h3 className="text-xl font-bold text-white tracking-tight">Account &amp; Professional Settings</h3>
        <p className="text-xs text-slate-400 mt-1">
          Manage your contact credentials, organization identity, and specialist taxonomy.
        </p>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* General Personal / Company Profile */}
      <form onSubmit={handleSaveGeneralProfile} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <User className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-bold text-white">Identity &amp; Contact Details</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Company / Organization</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Tech Innovations"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Contact Phone</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. United States, Germany, India"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Timezone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. America/New_York, UTC"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Professional Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Share an overview of your organization or personal technical domain..."
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Physical Street Address (Private)</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address (Never shared publicly)"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSavingGeneral}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingGeneral ? 'Saving...' : 'Save General Details'}</span>
          </button>
        </div>
      </form>

      {/* Specialist Details Form (Worker Only) */}
      {isWorker && (
        <>
          <form onSubmit={handleSaveWorkerProfile} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">Specialist Marketplace Parameters</h4>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Professional Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Senior Fullstack Architect &amp; Distributed Systems Specialist"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Hourly Commercial Rate ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g. 95"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Marketplace Availability Status</label>
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value as WorkerAvailability)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="AVAILABLE">Available for Engagements</option>
                  <option value="BUSY">In Active Engagement (Busy)</option>
                  <option value="UNAVAILABLE">Unavailable / Off-Market</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingWorker}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingWorker ? 'Saving...' : 'Update Marketplace Profile'}</span>
              </button>
            </div>
          </form>

          {/* Specialist Skills Management */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">Skills Taxonomy</h4>
              </div>
            </div>

            {/* Current Skills List */}
            <div className="flex flex-wrap gap-2">
              {workerProfile?.skills && workerProfile.skills.length > 0 ? (
                workerProfile.skills.map((ws) => (
                  <div
                    key={ws.id}
                    className="pl-3 pr-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 flex items-center space-x-2 text-xs"
                  >
                    <span className="text-white font-medium">
                      {ws.skillName || (ws as unknown as { skill?: { name: string } }).skill?.name}
                    </span>
                    <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20">
                      {ws.yearsOfExperience}y
                    </span>
                    <button
                      onClick={() => handleRemoveSkill(ws.skillId || (ws as unknown as { skill?: { id: string } }).skill?.id || '')}
                      className="text-slate-400 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">No skills attached to profile yet.</p>
              )}
            </div>

            {/* Add Skill Form */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
              <select
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {availableSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category || 'General'})
                  </option>
                ))}
              </select>

              <div className="flex items-center space-x-1 text-xs">
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={skillExperience}
                  onChange={(e) => setSkillExperience(e.target.value)}
                  className="w-16 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 text-center"
                />
                <span className="text-slate-400">years</span>
              </div>

              <button
                type="button"
                onClick={handleAddSkill}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Skill</span>
              </button>
            </div>
          </div>

          {/* Specialist Portfolio Management */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">Portfolio Items</h4>
              </div>

              {!isAddingPortfolio && (
                <button
                  type="button"
                  onClick={() => setIsAddingPortfolio(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Project</span>
                </button>
              )}
            </div>

            {/* Add Portfolio Form */}
            {isAddingPortfolio && (
              <form onSubmit={handleAddPortfolioItem} className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Project Title *</label>
                  <input
                    type="text"
                    value={portfolioTitle}
                    onChange={(e) => setPortfolioTitle(e.target.value)}
                    placeholder="e.g. Automated Escrow Smart Engine"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Project Description *</label>
                  <textarea
                    value={portfolioDescription}
                    onChange={(e) => setPortfolioDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe technology stack, your key contributions, and project outcomes..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Live Project / Demo URL</label>
                  <input
                    type="url"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://github.com/... or https://..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingPortfolio(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    Save Portfolio Item
                  </button>
                </div>
              </form>
            )}

            {/* Portfolio Items List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {workerProfile?.portfolioItems && workerProfile.portfolioItems.length > 0 ? (
                workerProfile.portfolioItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-semibold text-white">{item.title}</h5>
                        <button
                          onClick={() => handleDeletePortfolioItem(item.id)}
                          className="text-slate-400 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                    </div>

                    {item.projectUrl && (
                      <a
                        href={item.projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 text-xs inline-flex items-center space-x-1 pt-1"
                      >
                        <span>Visit Demo</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic col-span-2">No portfolio items posted yet.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
