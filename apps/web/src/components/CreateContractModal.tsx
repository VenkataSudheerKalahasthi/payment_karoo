import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { WorkerProfileDto } from '@trustpay/shared';
import { Plus, Trash2, ShieldCheck, X, FileText } from 'lucide-react';

interface CreateContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialWorkerId?: string;
}

export const CreateContractModal: React.FC<CreateContractModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialWorkerId,
}) => {
  const [workers, setWorkers] = useState<WorkerProfileDto[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState(initialWorkerId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [currency] = useState('USD');
  const [milestones, setMilestones] = useState<
    { title: string; description: string; amount: number }[]
  >([{ title: 'Phase 1 - Initial Deliverable', description: 'Core functional requirements', amount: 500 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      apiService.listWorkers({ limit: 50 }).then((res) => {
        if (res.success && res.data) {
          setWorkers(res.data.items);
          if (!selectedWorkerId && res.data.items.length > 0) {
            setSelectedWorkerId(res.data.items[0].userId);
          }
        }
      });
    }
  }, [isOpen, selectedWorkerId]);

  if (!isOpen) return null;

  const totalAmount = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

  const handleAddMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      {
        title: `Milestone ${prev.length + 1}`,
        description: 'Deliverable details',
        amount: 500,
      },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    if (milestones.length <= 1) return;
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMilestoneChange = (
    index: number,
    field: 'title' | 'description' | 'amount',
    val: string | number,
  ) => {
    setMilestones((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: val } : m)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId) {
      setError('Please select an active worker');
      return;
    }
    if (totalAmount <= 0) {
      setError('Contract total amount must exceed zero');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiService.createContract({
        workerId: selectedWorkerId,
        title,
        description,
        currency,
        milestones: milestones.map((m, idx) => ({
          title: m.title,
          description: m.description,
          amount: Number(m.amount),
          order: idx + 1,
        })),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error?.message || 'Failed to initialize contract');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to propose digital contract';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl dark:text-[#CDCBCA] text-[#242424]">
        <div className="flex items-center justify-between border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg dark:bg-[#202020] bg-[#EEF2FF] border dark:border-[rgba(205,203,202,0.18)] border-[#C7D2FE] flex items-center justify-center text-[#5046E5]">
              <ShieldCheck className="w-5 h-5 text-[#5046E5]" />
            </div>
            <div>
              <h3 className="text-base font-bold dark:text-[#CDCBCA] text-[#242424]">Create Digital Escrow Agreement</h3>
              <p className="text-xs dark:text-[#A5A5A5] text-[#64748B]">
                Define terms, milestone deliverable phases, and escrow allocation values.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="dark:text-[#777777] text-[#64748B] hover:dark:text-[#CDCBCA] hover:text-[#242424] p-1.5 rounded-lg dark:bg-[#202020] bg-[#F1F5F9] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold dark:text-[#CDCBCA] text-[#242424] mb-1">
              Select Specialist Counterparty
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg dark:bg-[#202020] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5046E5] transition"
              required
            >
              {workers.length === 0 && <option value="">No registered specialists found</option>}
              {workers.map((w) => (
                <option key={w.userId} value={w.userId}>
                  Specialist {w.user?.firstName || w.userId.slice(0, 8)} — {w.headline || 'Technical Consultant'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold dark:text-[#CDCBCA] text-[#242424] mb-1">Contract Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Enterprise Security Hardening & Penetration Verification"
              required
              className="w-full px-3 py-2 rounded-lg dark:bg-[#202020] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1] text-xs dark:text-[#CDCBCA] text-[#242424] placeholder:dark:text-[#777777] placeholder:text-[#94A3B8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5046E5] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold dark:text-[#CDCBCA] text-[#242424] mb-1">Scope of Work</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of objectives, deliverables, acceptance criteria..."
              required
              rows={3}
              className="w-full px-3 py-2 rounded-lg dark:bg-[#202020] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1] text-xs dark:text-[#CDCBCA] text-[#242424] placeholder:dark:text-[#777777] placeholder:text-[#94A3B8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5046E5] transition leading-relaxed"
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold dark:text-[#CDCBCA] text-[#242424] uppercase tracking-wider">
                Milestones &amp; Funding Allocation
              </label>
              <button
                type="button"
                onClick={handleAddMilestone}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg dark:bg-[#202020] bg-[#EEF2FF] hover:dark:bg-[#303030] hover:bg-[#C7D2FE] text-xs font-medium text-[#5046E5] border dark:border-[rgba(205,203,202,0.18)] border-[#C7D2FE] transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Milestone</span>
              </button>
            </div>

            <div className="space-y-3">
              {milestones.map((m, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl dark:bg-[#202020] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-y-2.5"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold dark:text-[#777777] text-[#94A3B8] font-mono">#{idx + 1}</span>
                    <input
                      type="text"
                      value={m.title}
                      onChange={(e) => handleMilestoneChange(idx, 'title', e.target.value)}
                      placeholder="Milestone title"
                      required
                      className="flex-1 px-3 py-1.5 rounded-lg dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1] text-xs dark:text-[#CDCBCA] text-[#242424] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5046E5] transition"
                    />
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1.5 text-xs dark:text-[#777777] text-[#94A3B8]">$</span>
                      <input
                        type="number"
                        min="1"
                        value={m.amount}
                        onChange={(e) => handleMilestoneChange(idx, 'amount', Number(e.target.value))}
                        required
                        className="w-full pl-6 pr-2.5 py-1.5 rounded-lg dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1] text-xs dark:text-[#CDCBCA] text-[#242424] text-right font-mono tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5046E5] transition"
                      />
                    </div>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMilestone(idx)}
                        className="p-1.5 dark:text-[#777777] text-[#94A3B8] hover:text-rose-500 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={m.description}
                    onChange={(e) => handleMilestoneChange(idx, 'description', e.target.value)}
                    placeholder="Deliverable specifications and acceptance criteria"
                    className="w-full px-3 py-1.5 rounded-lg dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1] text-xs dark:text-[#CDCBCA] text-[#334155] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5046E5] transition"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex items-center justify-between">
            <div>
              <span className="text-xs dark:text-[#A5A5A5] text-[#64748B]">Calculated Escrow Total:</span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                ${totalAmount.toLocaleString()} <span className="text-xs font-normal dark:text-[#A5A5A5] text-[#64748B]">{currency}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg dark:bg-[#202020] bg-[#F1F5F9] dark:hover:bg-[#303030] hover:bg-[#E2E8F0] text-xs font-medium dark:text-[#CDCBCA] text-[#242424] border dark:border-[rgba(205,203,202,0.18)] border-[#CBD5E1] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-[#5046E5] hover:bg-[#4338CA] disabled:opacity-50 text-xs font-semibold text-white shadow-sm flex items-center space-x-1.5 transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Proposing Agreement...' : 'Initialize Contract'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
