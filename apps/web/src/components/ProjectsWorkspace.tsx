import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ProjectDto,
  ContractMilestoneDto,
  MilestoneStatus,
  UserRole,
  ProjectProgressSummaryDto,
  MilestoneActivityDto,
  formatCurrencyMinor,
} from '@trustpay/shared';
import { apiService } from '../services/api';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Upload,
  Download,
  RefreshCw,
  Play,
  RotateCcw,
  Send,
  Calendar,
  Lock,
  History,
  FileCheck2,
  ExternalLink,
  Briefcase,
  ChevronRight,
  Info,
  DollarSign,
  X,
} from 'lucide-react';

interface ProjectsWorkspaceProps {
  currentUserRole: UserRole;
  currentUserId: string;
}

export const ProjectsWorkspace: React.FC<ProjectsWorkspaceProps> = ({
  currentUserRole,
  currentUserId,
}) => {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDto | null>(null);
  const [summary, setSummary] = useState<ProjectProgressSummaryDto | null>(null);
  const [activities, setActivities] = useState<MilestoneActivityDto[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'milestones' | 'activity'>('milestones');

  // Milestone action modals state
  const [selectedMilestone, setSelectedMilestone] = useState<ContractMilestoneDto | null>(null);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionAttachmentUrls, setSubmissionAttachmentUrls] = useState<string[]>([]);
  const [revisionReason, setRevisionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSettlingMilestoneId, setIsSettlingMilestoneId] = useState<string | null>(null);

  const isClient = currentUserRole === UserRole.CLIENT;
  const isWorker = currentUserRole === UserRole.WORKER;

  // Load Projects List
  const loadProjects = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await apiService.listProjects();
      if (res.success && res.data?.items) {
        setProjects(res.data.items);
        if (!selectedProjectId && res.data.items.length > 0) {
          setSelectedProjectId(res.data.items[0].id);
        }
      }
    } catch {
      // Retain existing list
    } finally {
      setIsLoadingList(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load Detailed Project State
  const loadProjectDetails = useCallback(async (projectId: string) => {
    setIsLoadingDetails(true);
    try {
      const [projRes, summaryRes, actRes] = await Promise.all([
        apiService.getProject(projectId),
        apiService.getProjectSummary(projectId),
        apiService.getMilestoneActivities(projectId),
      ]);

      if (projRes.success && projRes.data) {
        setSelectedProject(projRes.data);
      }
      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }
      if (actRes.success && actRes.data) {
        setActivities(actRes.data);
      }
    } catch {
      // Handled
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectDetails(selectedProjectId);
    }
  }, [selectedProjectId, loadProjectDetails]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    if (!selectedProjectId) return;

    let socket: Socket | null = null;
    try {
      const socketUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';
      socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
      });

      socket.emit('join:project', selectedProjectId);

      socket.on('milestone:event', () => {
        loadProjectDetails(selectedProjectId);
      });

      socket.on('project:event', () => {
        loadProjectDetails(selectedProjectId);
      });
    } catch {
      // Fallback to manual refresh
    }

    return () => {
      if (socket) {
        socket.emit('leave:project', selectedProjectId);
        socket.disconnect();
      }
    };
  }, [selectedProjectId, loadProjectDetails]);

  // Worker starts work on milestone
  const handleStartMilestone = async (milestone: ContractMilestoneDto) => {
    if (!selectedProject) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiService.startMilestone(selectedProject.contractId, milestone.id);
      if (res.success) {
        setActionSuccess(`Work started on "${milestone.title}".`);
        loadProjectDetails(selectedProject.id);
      } else {
        setActionError(res.error?.message || 'Failed to start milestone');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error starting milestone');
    }
  };

  // Deliverable file upload pre-authorization
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProject || !selectedMilestone) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const authRes = await apiService.authorizeUpload({
        bucket: 'evidence',
        contractId: selectedProject.contractId,
        milestoneId: selectedMilestone.id,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type || 'application/pdf',
      });

      if (authRes.success && authRes.data) {
        setSubmissionAttachmentUrls((prev) => [...prev, authRes.data!.objectPath]);
      } else {
        setUploadError(authRes.error?.message || 'Storage upload pre-authorization failed');
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to authorize document upload');
    } finally {
      setIsUploading(false);
    }
  };

  // Worker submits deliverable
  const handleSubmitDeliverable = async () => {
    if (!selectedProject || !selectedMilestone) return;
    if (!submissionNotes.trim()) {
      setActionError('Please provide delivery notes or completion summary.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await apiService.submitMilestone(selectedProject.contractId, selectedMilestone.id, {
        notes: submissionNotes.trim(),
        attachmentUrls: submissionAttachmentUrls,
      });

      if (res.success) {
        setActionSuccess('Milestone deliverable submitted successfully for client review!');
        setSubmissionModalOpen(false);
        setSubmissionNotes('');
        setSubmissionAttachmentUrls([]);
        setSelectedMilestone(null);
        loadProjectDetails(selectedProject.id);
      } else {
        setActionError(res.error?.message || 'Failed to submit milestone deliverable');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit deliverable');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Client requests revision
  const handleRequestRevision = async () => {
    if (!selectedProject || !selectedMilestone) return;
    if (!revisionReason.trim()) {
      setActionError('Revision reason and required adjustments must be specified.');
      return;
    }

    const latestSubmission = selectedMilestone.submissions?.[0];
    if (!latestSubmission) {
      setActionError('No submission found to request revision on.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await apiService.requestRevision(selectedProject.contractId, selectedMilestone.id, {
        submissionId: latestSubmission.id,
        reason: revisionReason.trim(),
      });

      if (res.success) {
        setActionSuccess('Revision request recorded and dispatched to specialist.');
        setRevisionModalOpen(false);
        setRevisionReason('');
        setSelectedMilestone(null);
        loadProjectDetails(selectedProject.id);
      } else {
        setActionError(res.error?.message || 'Failed to request milestone revision');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to record revision');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Client approves deliverable
  const handleApproveMilestone = async (milestone: ContractMilestoneDto) => {
    if (!selectedProject) return;
    const confirmed = window.confirm(
      `Approve deliverable for "${milestone.title}"?\n\nThis certifies milestone completion and records acceptance. In accordance with platform financial safety, sandbox allocations update without moving live funds.`,
    );
    if (!confirmed) return;

    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await apiService.approveMilestone(selectedProject.contractId, milestone.id);
      if (res.success) {
        setActionSuccess(`Milestone "${milestone.title}" approved successfully!`);
        loadProjectDetails(selectedProject.id);
      } else {
        setActionError(res.error?.message || 'Failed to approve milestone');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve milestone');
    }
  };

  const handleSettleMilestone = async (milestone: ContractMilestoneDto) => {
    if (!selectedProject) return;
    const confirmed = window.confirm(
      `Initiate settlement for approved milestone "${milestone.title}"?\n\nThis executes double-entry ledger settlement, records platform commission, and credits specialist net earnings.`
    );
    if (!confirmed) return;

    setActionError(null);
    setActionSuccess(null);
    setIsSettlingMilestoneId(milestone.id);

    try {
      const res = await apiService.settleMilestone(milestone.id, 'Authorized milestone settlement');
      if (res.success && res.data) {
        setActionSuccess(
          `Settlement executed successfully! Net specialist earnings: $${res.data.specialistNet} ${res.data.currency} (Ref: ${res.data.transactionReference}).`
        );
        loadProjectDetails(selectedProject.id);
      } else {
        setActionError(res.error?.message || 'Settlement execution failed');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Settlement execution failed');
    } finally {
      setIsSettlingMilestoneId(null);
    }
  };

  // Secure download attachment
  const handleDownloadAttachment = async (objectPath: string) => {
    if (!selectedProject) return;
    try {
      const res = await apiService.authorizeDownload(selectedProject.contractId, objectPath);
      if (res.success && res.data?.downloadUrl) {
        const fullUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}${res.data.downloadUrl.replace('/api/v1', '')}`;
        window.open(fullUrl, '_blank');
      } else {
        alert(res.error?.message || 'Could not authorize attachment download');
      }
    } catch {
      alert('Failed to request authorized attachment download');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="interactive-card flex flex-col md:flex-row md:items-center justify-between gap-4 dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#5046E5]/10 border border-[#5046E5]/20 text-[#5046E5] flex items-center justify-center">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold dark:text-[#E8ECF5] text-[#242424] tracking-tight">Projects &amp; Milestones Workspace</h1>
              <p className="text-xs dark:text-[#9AA4B8] text-[#64748B]">
                End-to-end milestone lifecycle management, deliverable submissions, and ledger-verified progress tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (selectedProjectId) loadProjectDetails(selectedProjectId);
              loadProjects();
            }}
            className="px-4 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] text-xs font-semibold dark:text-[#E8ECF5] text-[#242424] border dark:border-[#272B38] border-[#E2E8F0] flex items-center space-x-2 transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDetails ? 'animate-spin text-[#5046E5]' : ''}`} />
            <span>Refresh State</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="dark:text-[#9AA4B8] text-[#64748B] hover:text-black hover:dark:text-white" aria-label="Dismiss">✕</button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="dark:text-[#9AA4B8] text-[#64748B] hover:text-black hover:dark:text-white" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Main Grid: Project Selector & Project Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Projects List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl p-4 shadow-sm space-y-3">
            <h2 className="text-xs font-bold dark:text-[#9AA4B8] text-[#64748B] uppercase tracking-wider px-1">
              Active Engagements ({projects.length})
            </h2>

            {isLoadingList ? (
              <div className="py-8 text-center text-xs dark:text-[#9AA4B8] text-[#64748B] flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#5046E5]" />
                <span>Loading projects...</span>
              </div>
            ) : projects.length === 0 ? (
              <div className="p-6 text-center text-xs dark:text-[#9AA4B8] text-[#64748B] dark:bg-[#0B0D14]/40 bg-[#F8FAFC] rounded-xl border border-dashed dark:border-[rgba(205,203,202,0.15)] border-[#E2E8F0]">
                No active projects found. Projects are automatically initialized when digital contracts achieve mutual cryptographic sign-off.
              </div>
            ) : (
              <div className="space-y-2.5">
                {projects.map((p) => {
                  const isSelected = p.id === selectedProjectId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProjectId(p.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition flex flex-col space-y-2 ${
                        isSelected
                          ? 'dark:bg-[#191D2A] bg-[#EEF2FF] border-[#5046E5] shadow-sm ring-1 ring-[#5046E5]'
                          : 'dark:bg-[#0B0D14]/40 bg-white dark:border-[rgba(205,203,202,0.15)] border-[#E2E8F0] hover:border-[#5046E5]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold dark:text-[#E8ECF5] text-[#242424] line-clamp-1">{p.title}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            p.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-[#5046E5]/10 text-[#5046E5] border border-[#5046E5]/20'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>

                      <p className="text-[11px] dark:text-[#9AA4B8] text-[#64748B] line-clamp-2 leading-relaxed">{p.description}</p>

                      <div className="flex items-center justify-between text-[10px] dark:text-[#9AA4B8] text-[#64748B] pt-1 border-t dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0]">
                        <span>Milestones: {p.milestones?.length || 0}</span>
                        <span className="font-semibold text-emerald-500 font-mono">{p.progressPercentage}% Complete</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Project Details & Milestones Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {selectedProject ? (
            <div className="space-y-6">
              {/* Project Card & Progress Metric Summary */}
              <div className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b dark:border-[#272B38] border-[#E2E8F0] pb-4">
                  <div>
                    <h2 className="text-lg font-bold dark:text-[#E8ECF5] text-[#242424]">{selectedProject.title}</h2>
                    <p className="text-xs dark:text-[#9AA4B8] text-[#64748B] mt-0.5">
                      Contract Ref: <span className="font-mono text-[#5046E5] font-semibold">#{selectedProject.contract?.contractNumber}</span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs dark:text-[#9AA4B8] text-[#64748B]">Parties:</span>
                    <span className="text-xs px-2.5 py-1 rounded-lg dark:bg-[#191D2A] bg-[#F1F5F9] border dark:border-[#272B38] border-[#E2E8F0] dark:text-[#E8ECF5] text-[#242424]">
                      Client: {selectedProject.client?.firstName || selectedProject.client?.email}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-lg dark:bg-[#191D2A] bg-[#F1F5F9] border dark:border-[#272B38] border-[#E2E8F0] dark:text-[#E8ECF5] text-[#242424]">
                      Specialist: {selectedProject.worker?.firstName || selectedProject.worker?.email}
                    </span>
                  </div>
                </div>

                {/* Scope & Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] space-y-1">
                    <span className="text-[11px] font-semibold dark:text-[#9AA4B8] text-[#475569]">Statement of Work Scope</span>
                    <p className="dark:text-[#E8ECF5] text-[#242424] leading-relaxed">{selectedProject.scope || selectedProject.description}</p>
                  </div>
                  <div className="p-3.5 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-1.5 dark:text-[#9AA4B8] text-[#64748B]">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Start Date:</span>
                      </span>
                      <span className="font-mono dark:text-[#E8ECF5] text-[#242424]">{selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString() : 'Immediate'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-1.5 dark:text-[#9AA4B8] text-[#64748B]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Expected Completion:</span>
                      </span>
                      <span className="font-mono dark:text-[#E8ECF5] text-[#242424]">{selectedProject.expectedCompletionDate ? new Date(selectedProject.expectedCompletionDate).toLocaleDateString() : 'Open-ended'}</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Financial Breakdown */}
                {summary && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold dark:text-[#9AA4B8] text-[#475569]">Overall Milestone Completion</span>
                        <span className="font-bold text-emerald-500 font-mono">{summary.progressPercentage}%</span>
                      </div>
                      <div className="w-full dark:bg-[#0B0D14] bg-[#E2E8F0] rounded-full h-2.5 overflow-hidden border dark:border-[#272B38] border-[#CBD5E1]">
                        <div
                          className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${summary.progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0]">
                        <span className="text-[10px] uppercase font-bold dark:text-[#9AA4B8] text-[#64748B]">Agreed Value</span>
                        <p className="text-sm font-bold font-mono dark:text-[#E8ECF5] text-[#242424] mt-0.5">
                          {formatCurrencyMinor(summary.totalValueMinor, summary.currency)}
                        </p>
                        <span className="text-[10px] dark:text-[#9AA4B8] text-[#64748B] font-mono">{summary.totalMilestones} Milestones</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <span className="text-[10px] uppercase font-bold text-emerald-500">Approved</span>
                        <p className="text-sm font-bold font-mono text-emerald-500 mt-0.5">
                          {formatCurrencyMinor(summary.approvedValueMinor, summary.currency)}
                        </p>
                        <span className="text-[10px] dark:text-[#9AA4B8] text-[#64748B] font-mono">{summary.completedMilestones} Completed</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#5046E5]/5 border border-[#5046E5]/20">
                        <span className="text-[10px] uppercase font-bold text-[#5046E5]">In Review</span>
                        <p className="text-sm font-bold font-mono text-[#5046E5] mt-0.5">
                          {formatCurrencyMinor(summary.pendingValueMinor, summary.currency)}
                        </p>
                        <span className="text-[10px] dark:text-[#9AA4B8] text-[#64748B] font-mono">{summary.inProgressMilestones + summary.inRevisionMilestones} In Progress</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <span className="text-[10px] uppercase font-bold text-amber-500">Pending Start</span>
                        <p className="text-sm font-bold font-mono text-amber-500 mt-0.5">
                          {formatCurrencyMinor(summary.remainingUnapprovedValueMinor, summary.currency)}
                        </p>
                        <span className="text-[10px] dark:text-[#9AA4B8] text-[#64748B] font-mono">{summary.pendingMilestones} Not Started</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="flex border-b dark:border-[#272B38] border-[#E2E8F0] space-x-6 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('milestones')}
                  className={`pb-3 transition flex items-center space-x-2 border-b-2 ${
                    activeTab === 'milestones'
                      ? 'border-[#5046E5] text-[#5046E5]'
                      : 'border-transparent dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black'
                  }`}
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Milestones &amp; Deliverables ({selectedProject.milestones?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('activity')}
                  className={`pb-3 transition flex items-center space-x-2 border-b-2 ${
                    activeTab === 'activity'
                      ? 'border-[#5046E5] text-[#5046E5]'
                      : 'border-transparent dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-white hover:text-black'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>Activity Audit Log ({activities.length})</span>
                </button>
              </div>

              {/* Tab 1: Milestones & Submissions */}
              {activeTab === 'milestones' && (
                <div className="space-y-4">
                  {selectedProject.milestones?.map((m) => {
                    const latestSubmission = m.submissions?.[0];
                    const isCompleted = m.status === MilestoneStatus.APPROVED;
                    const isSubmitted = m.status === MilestoneStatus.SUBMITTED;
                    const isInRevision = m.status === MilestoneStatus.IN_REVISION;
                    const isPending = m.status === MilestoneStatus.PENDING;

                    return (
                      <div
                        key={m.id}
                        className="interactive-card dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4 hover:border-[#5046E5]/40 transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center space-x-3">
                            <span className="w-7 h-7 rounded-lg dark:bg-[#191D2A] bg-[#F1F5F9] border dark:border-[#272B38] border-[#E2E8F0] text-xs font-mono font-bold dark:text-[#E8ECF5] text-[#242424] flex items-center justify-center">
                              #{m.order}
                            </span>
                            <div>
                              <h3 className="text-sm font-bold dark:text-[#E8ECF5] text-[#242424]">{m.title}</h3>
                              <p className="text-xs dark:text-[#9AA4B8] text-[#64748B]">{m.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-bold text-emerald-500 font-mono tabular-nums">
                              {formatCurrencyMinor(
                                BigInt(Math.round(Number(m.amount) * 100)).toString(),
                                selectedProject.contract?.currency || 'USD',
                              )}
                            </span>

                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                isCompleted
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                  : isSubmitted
                                  ? 'bg-[#5046E5]/10 text-[#5046E5] border-[#5046E5]/20'
                                  : isInRevision
                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                  : 'dark:bg-[#191D2A] bg-[#F1F5F9] dark:text-[#9AA4B8] text-[#64748B] dark:border-[#272B38] border-[#E2E8F0]'
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                        </div>

                        {/* Submission and Deliverable Details if present */}
                        {latestSubmission && (
                          <div className="p-3.5 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] space-y-2.5 text-xs">
                            <div className="flex items-center justify-between text-[11px] dark:text-[#9AA4B8] text-[#64748B] border-b dark:border-[rgba(205,203,202,0.1)] border-[#E2E8F0] pb-2">
                              <span>
                                Submitted by {latestSubmission.worker?.firstName || 'Specialist'} on{' '}
                                {new Date(latestSubmission.submittedAt).toLocaleString()}
                              </span>
                              <span className="font-semibold dark:text-[#E8ECF5] text-[#242424]">
                                Status: {latestSubmission.status}
                              </span>
                            </div>

                            <p className="dark:text-[#E8ECF5] text-[#242424] leading-relaxed">{latestSubmission.notes}</p>

                            {latestSubmission.attachmentUrls && latestSubmission.attachmentUrls.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] uppercase font-bold dark:text-[#9AA4B8] text-[#64748B]">
                                  Deliverable Evidence Attachments:
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {latestSubmission.attachmentUrls.map((att, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleDownloadAttachment(att)}
                                      className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg dark:bg-[#191D2A] bg-white hover:dark:bg-[#303030] hover:bg-[#F1F5F9] dark:text-[#E8ECF5] text-[#242424] text-[11px] border dark:border-[#272B38] border-[#E2E8F0] transition shadow-sm"
                                    >
                                      <Download className="w-3 h-3 text-[#5046E5]" />
                                      <span>{att.split('/').pop() || 'Attachment'}</span>
                                      <ExternalLink className="w-2.5 h-2.5 dark:text-[#9AA4B8] text-[#64748B]" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Show Revision Feedback if in revision */}
                            {latestSubmission.revisionRequests && latestSubmission.revisionRequests.length > 0 && (
                              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs space-y-1 mt-2">
                                <span className="font-bold flex items-center space-x-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Client Revision Request Notes:</span>
                                </span>
                                <p>{latestSubmission.revisionRequests[0].reason}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action Buttons based on Role & Status */}
                        <div className="flex items-center justify-end space-x-3 pt-2">
                          {/* Worker Actions */}
                          {isWorker && isPending && (
                            <button
                              onClick={() => handleStartMilestone(m)}
                              className="px-4 py-2 rounded-xl bg-[#5046E5] hover:bg-[#4338CA] text-xs font-semibold text-white flex items-center space-x-1.5 transition shadow-sm"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Start Work</span>
                            </button>
                          )}

                          {isWorker && (m.status === MilestoneStatus.IN_PROGRESS || isPending) && (
                            <button
                              onClick={() => {
                                setSelectedMilestone(m);
                                setSubmissionModalOpen(true);
                              }}
                              className="px-4 py-2 rounded-xl bg-[#5046E5] hover:bg-[#4338CA] text-xs font-semibold text-white flex items-center space-x-1.5 transition shadow-sm"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Submit Deliverable</span>
                            </button>
                          )}

                          {isWorker && isInRevision && (
                            <button
                              onClick={() => {
                                setSelectedMilestone(m);
                                setSubmissionModalOpen(true);
                              }}
                              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition shadow-sm"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Resubmit Corrected Deliverable</span>
                            </button>
                          )}

                          {/* Client Review Actions */}
                          {isClient && isSubmitted && (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedMilestone(m);
                                  setRevisionModalOpen(true);
                                }}
                                className="px-3.5 py-1.5 rounded-xl dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] text-xs font-semibold text-amber-500 border border-amber-500/30 flex items-center space-x-1.5 transition shadow-sm"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Request Revision</span>
                              </button>

                              <button
                                onClick={() => handleApproveMilestone(m)}
                                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve Deliverable</span>
                              </button>
                            </div>
                          )}

                          {isCompleted && (
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-emerald-500 font-semibold flex items-center space-x-1">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Approved</span>
                              </span>
                              <button
                                onClick={() => handleSettleMilestone(m)}
                                disabled={isSettlingMilestoneId === m.id}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center space-x-1.5 transition shadow-sm"
                              >
                                {isSettlingMilestoneId === m.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <DollarSign className="w-3.5 h-3.5" />
                                )}
                                <span>{isSettlingMilestoneId === m.id ? 'Settling...' : 'Settle Milestone'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab 2: Activity Audit Log */}
              {activeTab === 'activity' && (
                <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold dark:text-[#E8ECF5] text-[#242424] flex items-center space-x-2">
                    <History className="w-4 h-4 text-[#5046E5]" />
                    <span>Chronological Milestone Activity Log</span>
                  </h3>

                  {activities.length === 0 ? (
                    <p className="text-xs dark:text-[#9AA4B8] text-[#64748B] py-4 text-center">No activity records recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((a) => (
                        <div
                          key={a.id}
                          className="p-3.5 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] flex items-start justify-between gap-4 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold dark:text-[#E8ECF5] text-[#242424]">{a.action}</span>
                              {a.previousState && a.newState && (
                                <span className="text-[10px] px-2 py-0.5 rounded font-mono dark:bg-[#191D2A] bg-slate-200 dark:border-[#272B38] border-[#E2E8F0] dark:text-[#9AA4B8] text-[#64748B]">
                                  {a.previousState} ➔ {a.newState}
                                </span>
                              )}
                            </div>
                            <p className="dark:text-[#9AA4B8] text-[#64748B] text-[11px]">
                              Actor: {a.actor?.firstName || a.actor?.email} ({a.actorRole})
                            </p>
                          </div>
                          <span className="text-[10px] dark:text-[#9AA4B8] text-[#64748B] font-mono flex-shrink-0">
                            {new Date(a.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center dark:text-[#9AA4B8] text-[#64748B] dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl shadow-sm space-y-3">
              <FolderKanban className="w-10 h-10 dark:text-[#9AA4B8] text-[#94A3B8] mx-auto" />
              <h3 className="text-sm font-bold dark:text-[#E8ECF5] text-[#242424]">Select a Project</h3>
              <p className="text-xs dark:text-[#9AA4B8] text-[#64748B] max-w-sm mx-auto">
                Choose an engagement from the left to inspect milestones, deliverable submissions, and ledger-verified progress tracking.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Worker Milestone Submission Modal */}
      {submissionModalOpen && selectedMilestone && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b dark:border-[#272B38] border-[#E2E8F0] pb-3">
              <h3 className="text-base font-bold dark:text-[#E8ECF5] text-[#242424] flex items-center space-x-2">
                <Send className="w-5 h-5 text-[#5046E5]" />
                <span>Submit Deliverable: {selectedMilestone.title}</span>
              </h3>
              <button onClick={() => setSubmissionModalOpen(false)} className="dark:text-[#9AA4B8] text-[#64748B] hover:text-black hover:dark:text-white" aria-label="Close modal">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold dark:text-[#9AA4B8] text-[#475569]">Completion Notes &amp; Summary *</label>
                <textarea
                  rows={4}
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="Detail completed deliverables, implementation highlights, and testing notes..."
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] dark:text-[#E8ECF5] text-[#242424] focus:outline-none focus:border-[#5046E5] text-xs"
                />
              </div>

              <div className="space-y-2">
                <label className="font-semibold dark:text-[#9AA4B8] text-[#475569]">Deliverable Evidence (PDF, PNG, JPG, ZIP)</label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="w-full text-xs dark:text-[#9AA4B8] text-[#64748B] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#5046E5] file:text-white hover:file:bg-[#4338CA] cursor-pointer"
                />
                {isUploading && (
                  <p className="text-[11px] text-[#5046E5] flex items-center space-x-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Authorizing secure storage upload...</span>
                  </p>
                )}
                {uploadError && <p className="text-[11px] text-rose-500">{uploadError}</p>}

                {submissionAttachmentUrls.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] dark:text-[#9AA4B8] text-[#64748B] uppercase font-bold">Attached Evidence:</span>
                    {submissionAttachmentUrls.map((att, idx) => (
                      <div key={idx} className="p-2 rounded-lg dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] text-[11px] dark:text-[#E8ECF5] text-[#242424] flex items-center justify-between">
                        <span className="truncate">{att.split('/').pop()}</span>
                        <span className="text-[10px] text-emerald-500 font-semibold">Attached</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t dark:border-[#272B38] border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setSubmissionModalOpen(false)}
                className="px-4 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#475569] transition shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || isUploading || !submissionNotes.trim()}
                onClick={handleSubmitDeliverable}
                className="px-5 py-2 rounded-xl bg-[#5046E5] hover:bg-[#4338CA] disabled:opacity-50 text-xs font-bold text-white transition flex items-center space-x-2 shadow-sm"
              >
                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Submit Deliverable</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Client Revision Request Modal */}
      {revisionModalOpen && selectedMilestone && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b dark:border-[#272B38] border-[#E2E8F0] pb-3">
              <h3 className="text-base font-bold dark:text-[#E8ECF5] text-[#242424] flex items-center space-x-2">
                <RotateCcw className="w-5 h-5 text-amber-500" />
                <span>Request Revision: {selectedMilestone.title}</span>
              </h3>
              <button onClick={() => setRevisionModalOpen(false)} className="dark:text-[#9AA4B8] text-[#64748B] hover:text-black hover:dark:text-white" aria-label="Close modal">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs">
                Provide constructive feedback indicating specific acceptance criteria deficiencies or required adjustments.
              </div>

              <div className="space-y-1">
                <label className="font-semibold dark:text-[#9AA4B8] text-[#475569]">Revision Reason &amp; Deficiencies *</label>
                <textarea
                  rows={4}
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  placeholder="Detail the specific corrections required before approval..."
                  className="w-full px-3 py-2 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.2)] border-[#E2E8F0] dark:text-[#E8ECF5] text-[#242424] focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t dark:border-[#272B38] border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setRevisionModalOpen(false)}
                className="px-4 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] text-xs dark:text-[#E8ECF5] text-[#475569] transition shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || !revisionReason.trim()}
                onClick={handleRequestRevision}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-bold text-white transition flex items-center space-x-2 shadow-sm"
              >
                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Send Revision Request</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
