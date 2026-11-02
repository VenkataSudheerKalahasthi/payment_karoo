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
  const [activeTab, setActiveTab] = useState<'milestones' | 'review' | 'activity'>('milestones');

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

  // Client approves deliverable (Financial safety: deliverable accepted, no real money movement)
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Projects & Milestones Workspace</h1>
              <p className="text-xs text-slate-400">
                End-to-end milestone lifecycle management, deliverable submissions, and immutable progress audit.
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
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center space-x-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDetails ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh State</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Grid: Project Selector & Project Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Projects List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Active Projects ({projects.length})
            </h2>

            {isLoadingList ? (
              <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Loading projects...</span>
              </div>
            ) : projects.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800/60">
                No active projects found. Projects are automatically provisioned when digital contracts reach mutual acceptance.
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => {
                  const isSelected = p.id === selectedProjectId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProjectId(p.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition flex flex-col space-y-2 ${
                        isSelected
                          ? 'bg-slate-800/90 border-emerald-500/60 shadow-lg'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white line-clamp-1">{p.title}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            p.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-2">{p.description}</p>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                        <span>Milestones: {p.milestones?.length || 0}</span>
                        <span className="font-semibold text-emerald-400">{p.progressPercentage}% Complete</span>
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedProject.title}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Contract Ref: <span className="font-mono text-emerald-400">#{selectedProject.contract?.contractNumber}</span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400">Parties:</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                      Client: {selectedProject.client?.firstName || selectedProject.client?.email}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                      Specialist: {selectedProject.worker?.firstName || selectedProject.worker?.email}
                    </span>
                  </div>
                </div>

                {/* Scope & Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400">Project Scope</span>
                    <p className="text-slate-200 leading-relaxed">{selectedProject.scope || selectedProject.description}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center space-x-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Start Date:</span>
                      </span>
                      <span>{selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString() : 'Immediate'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center space-x-1.5 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Expected Completion:</span>
                      </span>
                      <span>{selectedProject.expectedCompletionDate ? new Date(selectedProject.expectedCompletionDate).toLocaleDateString() : 'Open-ended'}</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Financial Breakdown in Minor Units */}
                {summary && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300">Milestone Completion Progress</span>
                        <span className="font-bold text-emerald-400">{summary.progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${summary.progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Agreed Value</span>
                        <p className="text-sm font-bold text-white mt-0.5">
                          {formatCurrencyMinor(summary.totalValueMinor, summary.currency)}
                        </p>
                        <span className="text-[10px] text-slate-400">{summary.totalMilestones} Milestones</span>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <span className="text-[10px] uppercase font-bold text-emerald-400">Approved</span>
                        <p className="text-sm font-bold text-emerald-400 mt-0.5">
                          {formatCurrencyMinor(summary.approvedValueMinor, summary.currency)}
                        </p>
                        <span className="text-[10px] text-slate-400">{summary.completedMilestones} Completed</span>
                      </div>

                      <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                        <span className="text-[10px] uppercase font-bold text-blue-400">Pending Review</span>
                        <p className="text-sm font-bold text-blue-400 mt-0.5">
                          {formatCurrencyMinor(summary.pendingValueMinor, summary.currency)}
                        </p>
                        <span className="text-[10px] text-slate-400">{summary.inProgressMilestones + summary.inRevisionMilestones} In Progress</span>
                      </div>

                      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <span className="text-[10px] uppercase font-bold text-amber-400">Remaining</span>
                        <p className="text-sm font-bold text-amber-400 mt-0.5">
                          {formatCurrencyMinor(summary.remainingUnapprovedValueMinor, summary.currency)}
                        </p>
                        <span className="text-[10px] text-slate-400">{summary.pendingMilestones} Not Started</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="flex border-b border-slate-800 space-x-6 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('milestones')}
                  className={`pb-3 transition flex items-center space-x-2 border-b-2 ${
                    activeTab === 'milestones'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Milestones & Deliverables ({selectedProject.milestones?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('activity')}
                  className={`pb-3 transition flex items-center space-x-2 border-b-2 ${
                    activeTab === 'activity'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-white'
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
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 transition hover:border-slate-700"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center space-x-3">
                            <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 flex items-center justify-center">
                              #{m.order}
                            </span>
                            <div>
                              <h3 className="text-sm font-bold text-white">{m.title}</h3>
                              <p className="text-xs text-slate-400">{m.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-bold text-emerald-400">
                              {formatCurrencyMinor(
                                BigInt(Math.round(Number(m.amount) * 100)).toString(),
                                selectedProject.contract?.currency || 'USD',
                              )}
                            </span>

                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                isCompleted
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : isSubmitted
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  : isInRevision
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                        </div>

                        {/* Submission and Deliverable Details if present */}
                        {latestSubmission && (
                          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5 text-xs">
                            <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/60 pb-2">
                              <span>
                                Submitted by {latestSubmission.worker?.firstName || 'Specialist'} on{' '}
                                {new Date(latestSubmission.submittedAt).toLocaleString()}
                              </span>
                              <span className="font-semibold text-slate-300">
                                Status: {latestSubmission.status}
                              </span>
                            </div>

                            <p className="text-slate-200">{latestSubmission.notes}</p>

                            {latestSubmission.attachmentUrls && latestSubmission.attachmentUrls.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] uppercase font-bold text-slate-500">
                                  Deliverable Evidence Attachments:
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {latestSubmission.attachmentUrls.map((att, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleDownloadAttachment(att)}
                                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] border border-slate-700 transition"
                                    >
                                      <Download className="w-3 h-3 text-emerald-400" />
                                      <span>{att.split('/').pop() || 'Attachment'}</span>
                                      <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Show Revision Feedback if in revision */}
                            {latestSubmission.revisionRequests && latestSubmission.revisionRequests.length > 0 && (
                              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1 mt-2">
                                <span className="font-bold flex items-center space-x-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
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
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition shadow"
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
                              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition shadow"
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
                              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition shadow"
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
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-400 border border-amber-500/30 flex items-center space-x-1.5 transition"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Request Revision</span>
                              </button>

                              <button
                                onClick={() => handleApproveMilestone(m)}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center space-x-1.5 transition shadow-lg shadow-emerald-900/30"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve Deliverable</span>
                              </button>
                            </div>
                          )}

                          {isCompleted && (
                            <span className="text-xs text-emerald-400 font-semibold flex items-center space-x-1">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Deliverable Approved</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab 2: Activity Audit Log */}
              {activeTab === 'activity' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <History className="w-4 h-4 text-emerald-400" />
                    <span>Chronological Milestone Activity Log</span>
                  </h3>

                  {activities.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No activity records recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((a) => (
                        <div
                          key={a.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-4 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-200">{a.action}</span>
                              {a.previousState && a.newState && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                                  {a.previousState} ➔ {a.newState}
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400 text-[11px]">
                              Actor: {a.actor?.firstName || a.actor?.email} ({a.actorRole})
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-500 flex-shrink-0">
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
            <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-3">
              <FolderKanban className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">Select a Project</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Choose a project from the list on the left to inspect milestones, deliverable submissions, and progress tracking.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Worker Milestone Submission Modal */}
      {submissionModalOpen && selectedMilestone && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Send className="w-5 h-5 text-emerald-400" />
                <span>Submit Deliverable: {selectedMilestone.title}</span>
              </h3>
              <button onClick={() => setSubmissionModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Completion Notes & Summary *</label>
                <textarea
                  rows={4}
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="Detail completed deliverables, implementation highlights, and testing notes..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-slate-300">Deliverable Evidence (PDF, PNG, JPG, ZIP)</label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-emerald-400 hover:file:bg-slate-700 cursor-pointer"
                />
                {isUploading && (
                  <p className="text-[11px] text-emerald-400 flex items-center space-x-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Authorizing secure storage upload...</span>
                  </p>
                )}
                {uploadError && <p className="text-[11px] text-rose-400">{uploadError}</p>}

                {submissionAttachmentUrls.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Attached Evidence:</span>
                    {submissionAttachmentUrls.map((att, idx) => (
                      <div key={idx} className="p-1.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
                        <span className="truncate">{att.split('/').pop()}</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">Attached</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSubmissionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || isUploading || !submissionNotes.trim()}
                onClick={handleSubmitDeliverable}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white transition flex items-center space-x-2"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <span>Request Revision: {selectedMilestone.title}</span>
              </h3>
              <button onClick={() => setRevisionModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                Provide constructive feedback indicating specific acceptance criteria deficiencies or required adjustments.
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Revision Reason & Deficiencies *</label>
                <textarea
                  rows={4}
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  placeholder="Detail the specific corrections required before approval..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRevisionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || !revisionReason.trim()}
                onClick={handleRequestRevision}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-bold text-white transition flex items-center space-x-2"
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

