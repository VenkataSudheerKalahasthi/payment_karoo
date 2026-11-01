import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { WorkerProfileDto } from '@trustpay/shared';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';

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
    } catch {
      setError('Failed to propose digital contract');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Create Digital Escrow Agreement</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Select Worker</label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              required
            >
              {workers.length === 0 && <option value="">No registered workers found</option>}
              {workers.map((w) => (
                <option key={w.userId} value={w.userId}>
                  Worker {w.user?.firstName || w.userId.slice(0, 8)} — {w.headline || 'Specialist'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Contract Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Enterprise Web Application Security Hardening"
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Scope of Work</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of objectives, deliverables, acceptance criteria..."
              required
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Milestones &amp; Funding Allocation
              </label>
              <button
                type="button"
                onClick={handleAddMilestone}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-emerald-400"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Milestone</span>
              </button>
            </div>

            <div className="space-y-3">
              {milestones.map((m, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-500">#{idx + 1}</span>
                    <input
                      type="text"
                      value={m.title}
                      onChange={(e) => handleMilestoneChange(idx, 'title', e.target.value)}
                      placeholder="Milestone title"
                      required
                      className="flex-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200"
                    />
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1.5 text-xs text-slate-500">$</span>
                      <input
                        type="number"
                        min="1"
                        value={m.amount}
                        onChange={(e) => handleMilestoneChange(idx, 'amount', Number(e.target.value))}
                        required
                        className="w-full pl-6 pr-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 text-right"
                      />
                    </div>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMilestone(idx)}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={m.description}
                    onChange={(e) => handleMilestoneChange(idx, 'description', e.target.value)}
                    placeholder="Deliverable specifications"
                    className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400">Calculated Escrow Total:</span>
              <div className="text-lg font-bold text-emerald-400">
                ${totalAmount.toLocaleString()} {currency}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition disabled:opacity-50"
              >
                Propose Agreement
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
