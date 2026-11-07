import React, { useState } from 'react';
import { Star, ShieldCheck, X, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { apiService } from '../services/api';

interface ContractReviewModalProps {
  contractId: string;
  contractTitle: string;
  recipientName: string;
  recipientRole: string; // 'CLIENT' or 'WORKER'
  onClose: () => void;
  onSuccess?: () => void;
}

export const ContractReviewModal: React.FC<ContractReviewModalProps> = ({
  contractId,
  contractTitle,
  recipientName,
  recipientRole,
  onClose,
  onSuccess,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [workQuality, setWorkQuality] = useState<number>(5);
  const [communication, setCommunication] = useState<number>(5);
  const [timeliness, setTimeliness] = useState<number>(5);
  const [professionalism, setProfessionalism] = useState<number>(5);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) {
      setError('Please provide written feedback for this review.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await apiService.submitVerifiedReview({
        contractId,
        feedback: feedback.trim(),
        workQuality,
        communication,
        timeliness,
        professionalism,
      });

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1200);
      } else {
        setError(res.error?.message || 'Failed to submit verified review');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Error submitting review');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (current: number, onChange: (val: number) => void, allowHover = false) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => allowHover && setHoverRating(star)}
            onMouseLeave={() => allowHover && setHoverRating(null)}
            className="p-1 focus:outline-none transition-transform hover:scale-110"
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                star <= (allowHover && hoverRating !== null ? hoverRating : current)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-300 dark:text-zinc-600'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-xl dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-start justify-between border-b dark:border-[#272B38] border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
            </div>
            <div>
              <h2 className="text-lg font-bold dark:text-white text-slate-900">Submit Verified Review</h2>
              <p className="text-xs dark:text-zinc-400 text-slate-500">
                Completed Contract: <span className="font-semibold">{contractTitle}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:dark:text-white hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-500 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
            <CheckCircle className="w-12 h-12 dark:text-[#8FB5FF] text-[#5046E5] animate-bounce" />
            <h3 className="text-base font-bold dark:text-white text-slate-900">Review Submitted Successfully!</h3>
            <p className="text-xs dark:text-zinc-400 text-slate-500">
              Your verified rating and feedback have been cryptographically linked to the completed contract.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="p-3 rounded-xl dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs dark:text-zinc-400 text-slate-500">Reviewing Counterparty</p>
                <p className="text-sm font-bold dark:text-white text-slate-900">{recipientName}</p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded dark:bg-[#191D2A] bg-white border dark:border-[#272B38] border-slate-200 dark:text-zinc-300 text-slate-700">
                {recipientRole}
              </span>
            </div>

            {/* Overall Rating */}
            <div className="space-y-1 text-center py-2 border-b dark:border-[#272B38] border-slate-200">
              <label className="text-xs font-semibold dark:text-zinc-300 text-slate-700 uppercase tracking-wider">
                Overall Experience Rating
              </label>
              <div className="flex justify-center pt-1">{renderStars(rating, setRating, true)}</div>
              <p className="text-xs font-mono dark:text-[#8FB5FF] text-[#5046E5] font-semibold">{rating} of 5 Stars</p>
            </div>

            {/* Detailed Categories */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <span className="dark:text-zinc-400 text-slate-600">Work Quality</span>
                <select
                  value={workQuality}
                  onChange={(e) => setWorkQuality(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900 text-xs"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} - {n === 5 ? 'Exceptional' : n === 4 ? 'Good' : n === 3 ? 'Average' : 'Below Average'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span className="dark:text-zinc-400 text-slate-600">Communication</span>
                <select
                  value={communication}
                  onChange={(e) => setCommunication(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900 text-xs"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} - {n === 5 ? 'Prompt & Clear' : n === 4 ? 'Good' : n === 3 ? 'Adequate' : 'Slow/Unclear'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span className="dark:text-zinc-400 text-slate-600">Timeliness</span>
                <select
                  value={timeliness}
                  onChange={(e) => setTimeliness(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900 text-xs"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} - {n === 5 ? 'Ahead of Schedule' : n === 4 ? 'On Time' : n === 3 ? 'Minor Delays' : 'Late'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span className="dark:text-zinc-400 text-slate-600">Professionalism</span>
                <select
                  value={professionalism}
                  onChange={(e) => setProfessionalism(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900 text-xs"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} - {n === 5 ? 'Exemplary' : n === 4 ? 'Professional' : n === 3 ? 'Acceptable' : 'Difficult'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Written Feedback */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold dark:text-zinc-300 text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Written Testimonial / Feedback <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your experience working on this contract, deliverables completed, and collaboration highlights..."
                className="w-full px-3 py-2 rounded-xl dark:bg-[#191B25] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none dark:focus:border-[#1F61EF]/60 focus:border-[#5046E5]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t dark:border-[#272B38] border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl dark:bg-[#191B25] bg-slate-100 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-slate-900 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Submitting Review...' : 'Publish Verified Review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
