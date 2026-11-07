import React, { useState } from 'react';
import { apiService } from '../services/api';
import { WorkerProfileDto } from '@trustpay/shared';
import { X, Send, AlertCircle, FileText } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl max-w-xl w-full p-6 space-y-5 dark:text-[#E8EAE6] text-[#111827] shadow-2xl">
        <div className="flex items-start justify-between border-b dark:border-[#272B38] border-[#E2E8F0] pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl dark:bg-[#191D2A] bg-[#EFF6FF] border dark:border-[rgba(31,97,239,0.2)] border-[#DBEAFE] flex items-center justify-center dark:text-[#8FB5FF] text-[#2563EB]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold dark:text-[#E8EAE6] text-[#111827]">Send Hiring Proposal</h3>
              <p className="text-xs dark:text-[#9AA4B8] text-[#64748B] mt-0.5">
                Target Specialist: <span className="dark:text-[#8FB5FF] text-[#5046E5] font-semibold">{workerName}</span> ({worker.headline || 'Specialist'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="dark:text-[#9AA4B8] text-[#64748B] hover:dark:text-[#E8EAE6] hover:text-[#111827] p-1.5 rounded-lg dark:bg-[#191D2A] bg-[#F1F5F9] border dark:border-[#272B38] border-[#CBD5E1] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] mb-1">Project Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Enterprise Fullstack React & PostgreSQL Architecture"
              className="w-full px-3 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F8FAFC] border dark:border-[#272B38] border-[#CBD5E1] text-xs dark:text-[#E8EAE6] text-[#111827] placeholder:text-[#6A6F68] focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] mb-1">
              Project Scope &amp; Deliverables *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Provide clear specifications, technical stack, deliverable requirements..."
              className="w-full px-3 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F8FAFC] border dark:border-[#272B38] border-[#CBD5E1] text-xs dark:text-[#E8EAE6] text-[#111827] placeholder:text-[#6A6F68] focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] transition leading-relaxed"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] mb-1">
                Proposed Budget ($ USD) *
              </label>
              <input
                type="number"
                step="0.01"
                value={proposedBudget}
                onChange={(e) => setProposedBudget(e.target.value)}
                placeholder="e.g. 2500"
                className="w-full px-3 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F8FAFC] border dark:border-[#272B38] border-[#CBD5E1] text-xs dark:text-[#8FB5FF] text-[#5046E5] focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] font-mono tabular-nums transition font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] mb-1">
                Required Skills (comma-separated)
              </label>
              <input
                type="text"
                value={requiredSkills}
                onChange={(e) => setRequiredSkills(e.target.value)}
                placeholder="e.g. React, TypeScript, Node.js"
                className="w-full px-3 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F8FAFC] border dark:border-[#272B38] border-[#CBD5E1] text-xs dark:text-[#E8EAE6] text-[#111827] placeholder:text-[#6A6F68] focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] mb-1">Proposed Start Date</label>
              <input
                type="date"
                value={proposedStartDate}
                onChange={(e) => setProposedStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F8FAFC] border dark:border-[#272B38] border-[#CBD5E1] text-xs dark:text-[#E8EAE6] text-[#111827] focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] font-mono transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] mb-1">Expected Completion Date</label>
              <input
                type="date"
                value={expectedCompletionDate}
                onChange={(e) => setExpectedCompletionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F8FAFC] border dark:border-[#272B38] border-[#CBD5E1] text-xs dark:text-[#E8EAE6] text-[#111827] focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] font-mono transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] mb-1">Message to Specialist</label>
            <textarea
              value={clientMessage}
              onChange={(e) => setClientMessage(e.target.value)}
              rows={2}
              placeholder="Introduce your project context and any specific timeline expectations..."
              className="w-full px-3 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F8FAFC] border dark:border-[#272B38] border-[#CBD5E1] text-xs dark:text-[#E8EAE6] text-[#111827] placeholder:text-[#6A6F68] focus:outline-none dark:focus:border-[#1F61EF] focus:border-[#5046E5] transition leading-relaxed"
            />
          </div>

          <div className="pt-4 border-t dark:border-[#272B38] border-[#E2E8F0] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl dark:bg-[#191D2A] bg-[#F1F5F9] dark:hover:bg-[#1C2740] hover:bg-[#E2E8F0] text-xs font-semibold dark:text-[#E8EAE6] text-[#111827] border dark:border-[#272B38] border-[#CBD5E1] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] hover:dark:bg-[#A3FF50] hover:bg-[#4338CA] disabled:opacity-50 text-xs font-bold dark:text-white text-white flex items-center space-x-1.5 dark:shadow-[0_0_15px_rgba(31,97,239,0.15)] shadow-md shadow-[#5046E5]/25 transition active:scale-95 cursor-pointer"
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
