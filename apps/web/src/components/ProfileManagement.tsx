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
  Pencil,
  Eye,
  X,
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
  const [firstName, setFirstName] = useState(currentUser.firstName || '');
  const [lastName, setLastName] = useState(currentUser.lastName || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
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
  const [portfolioAttachmentUrl, setPortfolioAttachmentUrl] = useState('');
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [isAddingPortfolio, setIsAddingPortfolio] = useState(false);
  const [showPublicPreview, setShowPublicPreview] = useState(false);

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
        firstName,
        lastName,
        avatarUrl,
        bio,
        companyName,
        phoneNumber,
        country,
        timezone,
        address,
      });

      if (res.success) {
        setSuccessMessage('Profile identity and organization records saved.');
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
      const res = await apiService.updateWorkerProfileMe({
        headline,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        availability,
      });

      if (res.success) {
        setSuccessMessage('Specialist marketplace parameters updated.');
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

  const handleSavePortfolioItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolioTitle.trim() || !portfolioDescription.trim()) return;

    try {
      if (editingPortfolioId) {
        const res = await apiService.updatePortfolioItem(editingPortfolioId, {
          title: portfolioTitle.trim(),
          description: portfolioDescription.trim(),
          projectUrl: portfolioUrl.trim() || undefined,
          attachmentUrl: portfolioAttachmentUrl.trim() || undefined,
        });

        if (res.success) {
          setPortfolioTitle('');
          setPortfolioDescription('');
          setPortfolioUrl('');
          setPortfolioAttachmentUrl('');
          setEditingPortfolioId(null);
          setIsAddingPortfolio(false);
          loadWorkerData();
        } else {
          alert(res.error?.message || 'Failed to update portfolio item');
        }
      } else {
        const res = await apiService.createPortfolioItem({
          title: portfolioTitle.trim(),
          description: portfolioDescription.trim(),
          projectUrl: portfolioUrl.trim() || undefined,
          attachmentUrl: portfolioAttachmentUrl.trim() || undefined,
        });

        if (res.success) {
          setPortfolioTitle('');
          setPortfolioDescription('');
          setPortfolioUrl('');
          setPortfolioAttachmentUrl('');
          setIsAddingPortfolio(false);
          loadWorkerData();
        } else {
          alert(res.error?.message || 'Failed to add portfolio item');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEditPortfolio = (item: {
    id: string;
    title: string;
    description: string;
    projectUrl?: string | null;
    attachmentUrl?: string | null;
  }) => {
    setEditingPortfolioId(item.id);
    setPortfolioTitle(item.title);
    setPortfolioDescription(item.description);
    setPortfolioUrl(item.projectUrl || '');
    setPortfolioAttachmentUrl(item.attachmentUrl || '');
    setIsAddingPortfolio(true);
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
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      <div>
        <h3 className="text-xl font-bold dark:text-[#CDCBCA] text-[#242424] tracking-tight">Account &amp; Professional Settings</h3>
        <p className="text-xs dark:text-[#A5A5A5] text-[#64748B] mt-1">
          Manage your contact credentials, organization identity, and specialist taxonomy.
        </p>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* General Personal / Company Profile */}
      <form onSubmit={handleSaveGeneralProfile} className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center space-x-2 border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] pb-3">
          <User className="w-4 h-4 text-[#2563EB]" />
          <h4 className="text-sm font-bold dark:text-[#CDCBCA] text-[#242424]">Identity &amp; Contact Details</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium dark:text-[#A5A5A5] text-[#475569] mb-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium dark:text-[#A5A5A5] text-[#475569] mb-1">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Morgan"
              className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium dark:text-[#A5A5A5] text-[#475569] mb-1">Profile Avatar URL</label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium dark:text-[#A5A5A5] text-[#475569] mb-1">Company / Organization</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Tech Innovations"
              className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium dark:text-[#A5A5A5] text-[#475569] mb-1">Contact Phone</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium dark:text-[#A5A5A5] text-[#475569] mb-1">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. United States, Germany, India"
              className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium dark:text-[#A5A5A5] text-[#475569] mb-1">Timezone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. America/New_York, UTC"
              className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium dark:text-[#A5A5A5] text-[#475569] mb-1">Professional Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Share an overview of your organization or personal technical domain..."
            className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium dark:text-[#A5A5A5] text-[#475569] mb-1">Physical Street Address (Private)</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address (Never shared publicly)"
            className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSavingGeneral}
            className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-xs font-semibold text-white flex items-center space-x-1.5 shadow-sm transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingGeneral ? 'Saving...' : 'Save General Details'}</span>
          </button>
        </div>
      </form>

      {/* Specialist Details Form (Worker Only) */}
      {isWorker && (
        <>
          <form onSubmit={handleSaveWorkerProfile} className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] pb-3">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-[#2563EB]" />
                <h4 className="text-sm font-bold dark:text-[#CDCBCA] text-[#242424]">Specialist Marketplace Parameters</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowPublicPreview(true)}
                className="px-3.5 py-1.5 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] text-xs font-semibold dark:text-[#CDCBCA] text-[#242424] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex items-center space-x-1.5 transition shadow-sm"
              >
                <Eye className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Preview Public Profile</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium dark:text-[#A5A5A5] text-[#475569] mb-1">Professional Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Senior Fullstack Architect &amp; Distributed Systems Specialist"
                className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium dark:text-[#A5A5A5] text-[#475569] mb-1">Hourly Commercial Rate ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g. 95"
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] font-mono focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium dark:text-[#A5A5A5] text-[#475569] mb-1">Marketplace Availability Status</label>
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value as WorkerAvailability)}
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
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
                className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-xs font-semibold text-white flex items-center space-x-1.5 shadow-sm transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingWorker ? 'Saving...' : 'Update Marketplace Profile'}</span>
              </button>
            </div>
          </form>

          {/* Specialist Skills Management */}
          <div className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] pb-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#2563EB]" />
                <h4 className="text-sm font-bold dark:text-[#CDCBCA] text-[#242424]">Skills Taxonomy</h4>
              </div>
            </div>

            {/* Current Skills List */}
            <div className="flex flex-wrap gap-2">
              {workerProfile?.skills && workerProfile.skills.length > 0 ? (
                workerProfile.skills.map((ws) => (
                  <div
                    key={ws.id}
                    className="pl-3 pr-2 py-1.5 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex items-center space-x-2 text-xs"
                  >
                    <span className="dark:text-[#CDCBCA] text-[#242424] font-medium">
                      {ws.skillName || (ws as unknown as { skill?: { name: string } }).skill?.name}
                    </span>
                    <span className="text-emerald-500 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono border border-emerald-500/20">
                      {ws.yearsOfExperience}y
                    </span>
                    <button
                      onClick={() => handleRemoveSkill(ws.skillId || (ws as unknown as { skill?: { id: string } }).skill?.id || '')}
                      className="dark:text-[#777777] text-[#64748B] hover:text-rose-500 transition"
                      aria-label="Remove skill"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs dark:text-[#777777] text-[#64748B] italic">No skills attached to profile yet.</p>
              )}
            </div>

            {/* Add Skill Form */}
            <div className="pt-3 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0] flex flex-wrap items-center gap-3">
              <select
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(e.target.value)}
                className="dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB]"
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
                  className="w-16 px-2 py-1.5 rounded-xl dark:bg-[#080808] bg-[#F5F7FA] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] text-center font-mono"
                />
                <span className="dark:text-[#A5A5A5] text-[#64748B]">years</span>
              </div>

              <button
                type="button"
                onClick={handleAddSkill}
                className="px-3.5 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white flex items-center space-x-1 shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Skill</span>
              </button>
            </div>
          </div>

          {/* Specialist Portfolio Management */}
          <div className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] pb-3">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-[#2563EB]" />
                <h4 className="text-sm font-bold dark:text-[#CDCBCA] text-[#242424]">Portfolio Showcase</h4>
              </div>

              {!isAddingPortfolio && (
                <button
                  type="button"
                  onClick={() => setIsAddingPortfolio(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white flex items-center space-x-1 shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Project</span>
                </button>
              )}
            </div>

            {/* Add / Edit Portfolio Form */}
            {isAddingPortfolio && (
              <form onSubmit={handleSavePortfolioItem} className="p-4 rounded-xl dark:bg-[#202020] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h5 className="font-semibold dark:text-[#CDCBCA] text-[#242424]">
                    {editingPortfolioId ? 'Edit Portfolio Project' : 'New Portfolio Project'}
                  </h5>
                </div>

                <div>
                  <label className="block dark:text-[#A5A5A5] text-[#475569] font-medium mb-1">Project Title *</label>
                  <input
                    type="text"
                    value={portfolioTitle}
                    onChange={(e) => setPortfolioTitle(e.target.value)}
                    placeholder="e.g. Automated Escrow Smart Engine"
                    className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB]"
                    required
                  />
                </div>

                <div>
                  <label className="block dark:text-[#A5A5A5] text-[#475569] font-medium mb-1">Project Description *</label>
                  <textarea
                    value={portfolioDescription}
                    onChange={(e) => setPortfolioDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe technology stack, your key contributions, and project outcomes..."
                    className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block dark:text-[#A5A5A5] text-[#475569] font-medium mb-1">Live Project / Demo URL</label>
                    <input
                      type="url"
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                      placeholder="https://github.com/... or https://..."
                      className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>

                  <div>
                    <label className="block dark:text-[#A5A5A5] text-[#475569] font-medium mb-1">Project Image / Attachment URL</label>
                    <input
                      type="url"
                      value={portfolioAttachmentUrl}
                      onChange={(e) => setPortfolioAttachmentUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/... or https://..."
                      className="w-full px-3 py-2 rounded-xl dark:bg-[#080808] bg-white border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPortfolio(false);
                      setEditingPortfolioId(null);
                      setPortfolioTitle('');
                      setPortfolioDescription('');
                      setPortfolioUrl('');
                      setPortfolioAttachmentUrl('');
                    }}
                    className="px-3.5 py-1.5 rounded-xl dark:bg-[#303030] bg-[#E2E8F0] dark:text-[#CDCBCA] text-[#475569] hover:opacity-80 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold shadow-sm transition"
                  >
                    {editingPortfolioId ? 'Save Changes' : 'Create Project'}
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
                    className="p-4 rounded-xl dark:bg-[#202020]/50 bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      {item.attachmentUrl && (
                        <div className="h-28 w-full rounded-xl overflow-hidden dark:bg-[#080808] bg-slate-200 border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] mb-2">
                          <img
                            src={item.attachmentUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-semibold dark:text-[#CDCBCA] text-[#242424]">{item.title}</h5>
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditPortfolio(item)}
                            className="p-1 dark:text-[#777777] text-[#64748B] hover:text-[#2563EB] transition"
                            title="Edit Project"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePortfolioItem(item.id)}
                            className="p-1 dark:text-[#777777] text-[#64748B] hover:text-rose-500 transition"
                            title="Delete Project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs dark:text-[#A5A5A5] text-[#64748B] mt-1 line-clamp-3 leading-relaxed">{item.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0] text-xs">
                      {item.projectUrl ? (
                        <a
                          href={item.projectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2563EB] hover:underline text-xs inline-flex items-center space-x-1 font-medium"
                        >
                          <span>Visit Demo / Repo</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[10px] dark:text-[#777777] text-[#64748B]">Internal Project</span>
                      )}
                      {item.attachmentUrl && (
                        <a
                          href={item.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="dark:text-[#A5A5A5] text-[#64748B] hover:text-[#2563EB] text-[11px] inline-flex items-center space-x-1"
                        >
                          <span>Attachment</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs dark:text-[#777777] text-[#64748B] italic col-span-2">No portfolio items posted yet.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Public Profile Preview Modal */}
      {showPublicPreview && workerProfile && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl max-w-2xl w-full p-6 space-y-5 dark:text-[#CDCBCA] text-[#242424] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] pb-3">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-[#2563EB]" />
                <h4 className="text-sm font-bold dark:text-[#CDCBCA] text-[#242424]">Public Specialist Profile Preview</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowPublicPreview(false)}
                className="p-1 rounded-lg dark:text-[#777777] text-[#64748B] hover:dark:text-[#CDCBCA] hover:text-[#242424] hover:dark:bg-[#202020] hover:bg-[#F1F5F9] transition"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0]">
              <div className="flex items-center space-x-3.5">
                <div className="w-14 h-14 rounded-full dark:bg-[#202020] bg-slate-200 border-2 dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] overflow-hidden flex items-center justify-center dark:text-[#A5A5A5] text-[#64748B] shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold dark:text-[#CDCBCA] text-[#242424]">
                    {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Anonymous Specialist'}
                  </h3>
                  <p className="text-xs text-[#2563EB] font-medium">{headline || 'Specialist on TrustPay'}</p>
                  <p className="text-[11px] dark:text-[#777777] text-[#64748B] mt-0.5">{country || 'Remote'} • {companyName || 'Independent Consultant'}</p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold font-mono text-[#2563EB]">
                  ${hourlyRate || '0'}<span className="text-xs font-normal dark:text-[#777777] text-[#64748B]">/hr</span>
                </div>
                <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  availability === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                  availability === 'BUSY' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                  'dark:bg-[#202020] bg-slate-200 dark:text-[#777777] text-[#64748B]'
                }`}>
                  {availability}
                </span>
              </div>
            </div>

            {/* Bio */}
            {bio && (
              <div className="space-y-1">
                <span className="text-xs font-bold dark:text-[#A5A5A5] text-[#475569] uppercase tracking-wider">About Me</span>
                <p className="text-xs dark:text-[#CDCBCA] text-[#242424] dark:bg-[#080808]/70 bg-[#F8FAFC] p-3 rounded-xl border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] leading-relaxed">
                  {bio}
                </p>
              </div>
            )}

            {/* Skills */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold dark:text-[#A5A5A5] text-[#475569] uppercase tracking-wider">Verified Technical Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {workerProfile.skills && workerProfile.skills.length > 0 ? (
                  workerProfile.skills.map((s) => (
                    <span
                      key={s.id}
                      className="px-2.5 py-1 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] text-xs dark:text-[#CDCBCA] text-[#242424] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex items-center space-x-1.5"
                    >
                      <span>{s.skillName || (s as unknown as { skill?: { name: string } }).skill?.name}</span>
                      <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1 py-0.2 rounded font-mono">
                        {s.yearsOfExperience}y
                      </span>
                    </span>
                  ))
                ) : (
                  <p className="text-xs dark:text-[#777777] text-[#64748B] italic">No skills listed yet.</p>
                )}
              </div>
            </div>

            {/* Portfolio Preview */}
            <div className="space-y-2">
              <span className="text-xs font-bold dark:text-[#A5A5A5] text-[#475569] uppercase tracking-wider">
                Showcased Projects ({workerProfile.portfolioItems?.length || 0})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {workerProfile.portfolioItems && workerProfile.portfolioItems.length > 0 ? (
                  workerProfile.portfolioItems.map((item) => (
                    <div key={item.id} className="p-3.5 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-y-1.5">
                      {item.attachmentUrl && (
                        <div className="h-20 w-full rounded-lg overflow-hidden dark:bg-[#171717] bg-slate-200 border dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                          <img src={item.attachmentUrl} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <h5 className="text-xs font-semibold dark:text-[#CDCBCA] text-[#242424]">{item.title}</h5>
                      <p className="text-[11px] dark:text-[#A5A5A5] text-[#64748B] line-clamp-2">{item.description}</p>
                      {item.projectUrl && (
                        <a
                          href={item.projectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2563EB] text-[10px] inline-flex items-center space-x-1 font-medium hover:underline"
                        >
                          <span>Live Demo</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs dark:text-[#777777] text-[#64748B] italic col-span-2">No projects showcased yet.</p>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPublicPreview(false)}
                className="px-4 py-2 rounded-xl dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] text-xs font-semibold dark:text-[#CDCBCA] text-[#242424] transition shadow-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
