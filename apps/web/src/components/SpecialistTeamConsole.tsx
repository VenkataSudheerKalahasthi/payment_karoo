import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Briefcase,
  Layers,
  Award,
} from 'lucide-react';
import { apiService } from '../services/api';

export const SpecialistTeamConsole: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [myInvitations, setMyInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active view tab: 'my-teams' | 'invitations'
  const [activeTab, setActiveTab] = useState<'my-teams' | 'invitations'>('my-teams');

  // Create Team Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Full-Stack Development');
  const [maxMembers, setMaxMembers] = useState(5);
  const [teamSkills, setTeamSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [creating, setCreating] = useState(false);

  // Invite Member Modal
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState(''); // user id or email
  const [inviteRole, setInviteRole] = useState('Senior Specialist');
  const [workloadAllocation, setWorkloadAllocation] = useState(30);
  const [inviting, setInviting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [teamsRes, invitesRes] = await Promise.all([
        apiService.listMyTeams(),
        apiService.listTeamInvitations(),
      ]);

      if (teamsRes.success && teamsRes.data) {
        setTeams(teamsRes.data);
      }
      if (invitesRes.success && invitesRes.data) {
        setMyInvitations(invitesRes.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSkill = () => {
    if (skillInput.trim() && !teamSkills.includes(skillInput.trim())) {
      setTeamSkills([...teamSkills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setTeamSkills(teamSkills.filter((s) => s !== skill));
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    try {
      setCreating(true);
      const res = await apiService.createTeam({
        name: teamName.trim(),
        description: description.trim() || undefined,
        category,
        maxMembers,
        skills: teamSkills,
      });

      if (res.success) {
        setShowCreateModal(false);
        setTeamName('');
        setDescription('');
        setTeamSkills([]);
        fetchData();
      } else {
        alert(res.error?.message || 'Failed to create team');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Error creating team');
    } finally {
      setCreating(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !inviteIdentifier.trim()) return;

    try {
      setInviting(true);
      const res = await apiService.inviteTeamMember(selectedTeam.id, {
        workerId: inviteIdentifier.trim(),
        role: 'MEMBER',
        message: `Role: ${inviteRole.trim() || 'Specialist'} - Workload: ${workloadAllocation}%`,
      });

      if (res.success) {
        setShowInviteModal(false);
        setInviteIdentifier('');
        fetchData();
      } else {
        alert(res.error?.message || 'Failed to send invitation');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Error sending invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRespondInvitation = async (invitationId: string, action: 'ACCEPTED' | 'DECLINED') => {
    try {
      const res = await apiService.respondTeamInvitation(invitationId, action);
      if (res.success) {
        fetchData();
      } else {
        alert(res.error?.message || 'Failed to update invitation');
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Error responding to invitation');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] flex items-center justify-center">
            <Users className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold dark:text-white text-slate-900 tracking-tight">
              Specialist Teams & Consortiums
            </h1>
            <p className="text-sm dark:text-zinc-400 text-slate-500">
              Form cross-functional specialist teams, manage verified consent, and bid jointly on large enterprise contracts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white hover:opacity-90 font-bold text-xs transition shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Create Team
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl dark:bg-[#191D2A] bg-slate-100 border dark:border-[#272B38] border-slate-200 text-slate-600 dark:text-zinc-400 hover:dark:text-white hover:text-slate-900 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b dark:border-[#272B38] border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('my-teams')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'my-teams'
              ? 'dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white'
              : 'dark:bg-[#191B25] bg-slate-100 dark:text-zinc-300 text-slate-700'
          }`}
        >
          My Teams ({teams.length})
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            activeTab === 'invitations'
              ? 'dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white'
              : 'dark:bg-[#191B25] bg-slate-100 dark:text-zinc-300 text-slate-700'
          }`}
        >
          Pending Invitations
          {myInvitations.filter((i) => i.status === 'PENDING').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-500 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === 'my-teams' ? (
        loading ? (
          <div className="p-12 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 text-center flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 dark:text-[#8FB5FF] text-[#5046E5] animate-spin mb-3" />
            <p className="text-xs dark:text-zinc-400 text-slate-500">Loading your teams...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="p-12 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 text-center">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold dark:text-white text-slate-900">No teams created yet</h3>
            <p className="text-xs dark:text-zinc-400 text-slate-500 mt-1 max-w-md mx-auto">
              Create a specialist team to pool expertise, assign workload shares, and apply jointly to enterprise client job postings.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white font-bold text-xs transition"
            >
              Create Your First Team
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {teams.map((team) => (
              <div
                key={team.id}
                className="p-5 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full dark:bg-[#1C2740] bg-[#EEF2FF] dark:text-[#8FB5FF] text-[#5046E5] border dark:border-[#1F61EF]/30 border-[#C7D2FE]">
                        {team.category || 'General Consortium'}
                      </span>
                      <h3 className="text-base font-bold dark:text-white text-slate-900 mt-1">{team.name}</h3>
                      {team.description && (
                        <p className="text-xs dark:text-zinc-400 text-slate-600 mt-1 line-clamp-2">{team.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold dark:text-zinc-300 text-slate-700">
                      {team.members?.length || 0} / {team.maxMembers} Members
                    </span>
                  </div>

                  {/* Skills */}
                  {team.skills && team.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {team.skills.map((s: string, idx: number) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded dark:bg-[#191B25] bg-slate-100 dark:text-zinc-300 text-slate-700 border dark:border-[#272B38] border-slate-200"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Member Roster with Consent Status */}
                  <div className="space-y-2 pt-2 border-t dark:border-[#272B38] border-slate-200">
                    <p className="text-[11px] font-semibold dark:text-zinc-400 text-slate-500 uppercase">
                      Member Roster & Consent
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {team.members?.map((m: any) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2 rounded-xl dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-200 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full dark:bg-[#222522] bg-slate-200 flex items-center justify-center font-bold text-[10px]">
                              {m.specialist?.fullName?.[0] || 'S'}
                            </div>
                            <div>
                              <p className="font-semibold dark:text-white text-slate-900">
                                {m.specialist?.fullName || 'Specialist'} {m.isLead && <span className="dark:text-[#8FB5FF] text-[#5046E5]">(Lead)</span>}
                              </p>
                              <p className="text-[10px] dark:text-zinc-400 text-slate-500">
                                {m.roleInTeam || 'Member'} • {m.workloadAllocation}% Workload
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              m.consentStatus === 'ACCEPTED'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                                : m.consentStatus === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                            }`}
                          >
                            {m.consentStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t dark:border-[#272B38] border-slate-200 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedTeam(team);
                      setShowInviteModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] dark:text-[#8FB5FF] text-[#5046E5] text-xs font-bold transition hover:opacity-80"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Invite Specialist
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Pending Invitations View */
        myInvitations.length === 0 ? (
          <div className="p-12 rounded-2xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 text-center">
            <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold dark:text-white text-slate-900">No pending team invitations</h3>
            <p className="text-xs dark:text-zinc-400 text-slate-500 mt-1 max-w-md mx-auto">
              When other specialists invite you to join their consortiums or teams, the requests will appear here for your review and consent.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {myInvitations.map((inv) => (
              <div
                key={inv.id}
                className="p-4 rounded-xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold dark:text-white text-slate-900">{inv.team?.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded dark:bg-[#191B25] bg-slate-100 dark:text-zinc-400 text-slate-600">
                      {inv.roleInTeam || 'Specialist Member'}
                    </span>
                  </div>
                  <p className="text-xs dark:text-zinc-400 text-slate-500 mt-1">
                    Invited by <span className="font-semibold">{inv.team?.teamLead?.fullName || 'Team Lead'}</span> • Workload Allocation: {inv.workloadAllocation}%
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {inv.status === 'PENDING' ? (
                    <>
                      <button
                        onClick={() => handleRespondInvitation(inv.id, 'ACCEPTED')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/20 transition flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Consent & Join
                      </button>
                      <button
                        onClick={() => handleRespondInvitation(inv.id, 'DECLINED')}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/30 text-xs font-bold hover:bg-rose-500/20 transition flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Decline
                      </button>
                    </>
                  ) : (
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        inv.status === 'ACCEPTED'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-rose-500/10 text-rose-500'
                      }`}
                    >
                      {inv.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 rounded-2xl p-6 shadow-2xl space-y-5">
            <h2 className="text-lg font-bold dark:text-white text-slate-900">Create Specialist Team</h2>
            <form onSubmit={handleCreateTeam} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold dark:text-zinc-300 text-slate-700">Team Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Apex Engineering Consortium"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold dark:text-zinc-300 text-slate-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900"
                >
                  <option value="Full-Stack Development">Full-Stack Development</option>
                  <option value="Smart Contracts & Escrow">Smart Contracts & Escrow</option>
                  <option value="UI/UX & Frontend">UI/UX & Frontend</option>
                  <option value="Backend & Cloud Systems">Backend & Cloud Systems</option>
                </select>
              </div>

              <div>
                <label className="font-semibold dark:text-zinc-300 text-slate-700">Description</label>
                <textarea
                  rows={2}
                  placeholder="Summary of combined specializations and joint offerings..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold dark:text-zinc-300 text-slate-700">Team Skills</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    placeholder="e.g. TypeScript, Solidity, Figma..."
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-3 py-1.5 rounded-lg dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white font-bold"
                  >
                    Add
                  </button>
                </div>
                {teamSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {teamSkills.map((s) => (
                      <span
                        key={s}
                        onClick={() => handleRemoveSkill(s)}
                        className="px-2 py-0.5 rounded cursor-pointer dark:bg-[#191B25] bg-slate-100 border dark:border-[#272B38] border-slate-200 text-slate-700 dark:text-zinc-300"
                      >
                        {s} &times;
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-[#272B38] border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl dark:bg-[#191B25] bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white font-bold"
                >
                  {creating ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold dark:text-white text-slate-900">Invite Specialist to Team</h2>
            <p className="text-xs dark:text-zinc-400 text-slate-500">
              Team: <span className="font-semibold text-slate-900 dark:text-white">{selectedTeam.name}</span>
            </p>

            <form onSubmit={handleInviteMember} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold dark:text-zinc-300 text-slate-700">
                  Specialist ID or User Identifier *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Specialist User ID"
                  value={inviteIdentifier}
                  onChange={(e) => setInviteIdentifier(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold dark:text-zinc-300 text-slate-700">Role in Team</label>
                <input
                  type="text"
                  placeholder="e.g. Lead Smart Contract Auditor"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold dark:text-zinc-300 text-slate-700">
                  Workload Allocation (%): {workloadAllocation}%
                </label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={workloadAllocation}
                  onChange={(e) => setWorkloadAllocation(Number(e.target.value))}
                  className="w-full mt-1 accent-[#5046E5] dark:accent-[#1F61EF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-[#272B38] border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl dark:bg-[#191B25] bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white font-bold"
                >
                  {inviting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
