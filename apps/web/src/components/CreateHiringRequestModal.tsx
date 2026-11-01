import React, { useState } from 'react';
import { apiService } from '../services/api';
import { WorkerProfileDto } from '@trustpay/shared';
import { X, Send, AlertCircle } from 'lucide-react';

interface CreateHiringRequestModalProps {
  worker: WorkerProfileDto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateHiringRequestModal: React.FC<CreateHiringRequestModalProps> = ({
  worker,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [proposedBudget, setProposedBudget] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [proposedStartDate, setProposedStartDate] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim() || title.length < 5) {
      setErrorMessage('Project title must be at least 5 characters');
      return;
    }

    if (!description.trim() || description.length < 20) {
      setErrorMessage('Project description must be at least 20 characters');
      return;
    }

    const budget = parseFloat(proposedBudget);
    if (isNaN(budget) || budget <= 0) {
      setErrorMessage('Proposed budget must be greater than zero');
      return;
    }

    setIsSubmitting(true);
    try {
      const skillsArray = requiredSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await apiService.createHiringRequest({
        workerId: worker.userId,
        title: title.trim(),
        description: description.trim(),
        proposedBudget: budget,
        currency: 'USD',
        requiredSkills: skillsArray,
        proposedStartDate: proposedStartDate ? new Date(proposedStartDate).toISOString() : undefined,
        expectedCompletionDate: expectedCompletionDate ? new Date(expectedCompletionDate).toISOString() : undefined,
        clientMessage: clientMessage.trim() || undefined,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error?.message || 'Failed to submit hiring request');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Network error submitting proposal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const workerName = worker.user?.firstName
    ? `${worker.user.firstName} ${worker.user.lastName || ''}`.trim()
    : `Specialist ${worker.userId.slice(0, 8)}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Send Hiring Proposal</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Specialist: <span className="text-emerald-400 font-semibold">{workerName}</span> ({worker.headline || 'Contractor'})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Project Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fullstack React & Express Development"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Project Scope &amp; Deliverables *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Provide clear specifications, technical stack, deliverable requirements..."
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Proposed Budget ($ USD) *</label>
              <input
                type="number"
                step="0.01"
                value={proposedBudget}
                onChange={(e) => setProposedBudget(e.target.value)}
                placeholder="e.g. 1500"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Required Skills (comma-separated)</label>
              <input
                type="text"
                value={requiredSkills}
                onChange={(e) => setRequiredSkills(e.target.value)}
                placeholder="e.g. React, TypeScript, Node.js"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Proposed Start Date</label>
              <input
                type="date"
                value={proposedStartDate}
                onChange={(e) => setProposedStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Expected Completion Date</label>
              <input
                type="date"
                value={expectedCompletionDate}
                onChange={(e) => setExpectedCompletionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Message to Specialist</label>
            <textarea
              value={clientMessage}
              onChange={(e) => setClientMessage(e.target.value)}
              rows={2}
              placeholder="Introduce your project and any specific timeline expectations..."
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Send Proposal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

