import React, { useState } from 'react';
import { X, Send, ShieldCheck, Mail, MessageSquare, HelpCircle, CheckCircle2 } from 'lucide-react';

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

export const ContactSupportModal: React.FC<ContactSupportModalProps> = ({
  isOpen,
  onClose,
  userEmail = '',
  userName = '',
}) => {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<'ESCROW' | 'MILESTONE' | 'PAYOUT' | 'TECHNICAL'>('ESCROW');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setSubject('');
        setMessage('');
        onClose();
      }, 1800);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="dark:bg-[#151715] bg-white border dark:border-[rgba(255,255,255,0.10)] border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl dark:bg-[#202220] bg-[#EFF6FF] border dark:border-[rgba(139,255,36,0.25)] border-[#DBEAFE] flex items-center justify-center text-[#8BFF24] dark:text-[#8BFF24]">
              <MessageSquare className="w-5 h-5 text-[#8BFF24]" />
            </div>
            <div>
              <h3 className="text-base font-bold dark:text-[#E8EAE6] text-[#111827]">
                TrustPay Priority Support &amp; Concierge
              </h3>
              <p className="text-xs dark:text-[#A5AAA2] text-[#64748B]">
                Direct line for escrow inquiries, contract arbitration, and assistance.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg dark:bg-[#202220] bg-[#F1F5F9] dark:text-[#A5AAA2] text-[#64748B] hover:dark:text-[#E8EAE6] hover:text-[#111827] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#8BFF24] mx-auto animate-bounce" />
            <h4 className="text-sm font-bold dark:text-[#E8EAE6] text-[#111827]">Inquiry Dispatched</h4>
            <p className="text-xs dark:text-[#A5AAA2] text-[#64748B] max-w-xs mx-auto">
              Your support ticket has been registered on the ledger. A TrustPay Escrow Officer will contact you at {userEmail || 'your email'}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold dark:text-[#CDCBCA] text-[#475569] mb-1 font-mono uppercase tracking-wider">
                Support Category
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'ESCROW', label: 'Escrow Custody' },
                  { id: 'MILESTONE', label: 'Milestone Review' },
                  { id: 'PAYOUT', label: 'Bank & Payout Rails' },
                  { id: 'TECHNICAL', label: 'Platform & Security' },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setCategory(item.id as typeof category)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition cursor-pointer text-left ${
                      category === item.id
                        ? 'dark:bg-[#8BFF24]/10 bg-[#8BFF24]/15 border-[#8BFF24] text-[#050605] dark:text-[#8BFF24] font-bold'
                        : 'dark:bg-[#202220] bg-[#F8FAFC] dark:border-[rgba(255,255,255,0.08)] border-[#E2E8F0] dark:text-[#A5AAA2] text-[#64748B]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold dark:text-[#CDCBCA] text-[#475569] mb-1">
                Subject
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of request..."
                className="w-full px-3.5 py-2.5 rounded-xl dark:bg-[#202220] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.10)] border-[#CBD5E1] dark:text-[#E8EAE6] text-[#111827] text-xs focus:outline-none focus:border-[#8BFF24]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold dark:text-[#CDCBCA] text-[#475569] mb-1">
                Details
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Include contract numbers, milestone details, or transaction references..."
                className="w-full px-3.5 py-2.5 rounded-xl dark:bg-[#202220] bg-[#F8FAFC] border dark:border-[rgba(255,255,255,0.10)] border-[#CBD5E1] dark:text-[#E8EAE6] text-[#111827] text-xs focus:outline-none focus:border-[#8BFF24]"
              />
            </div>

            <div className="pt-2 flex items-center justify-between text-[11px] dark:text-[#A5AAA2] text-[#64748B]">
              <span className="flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#8BFF24]" />
                <span>24/7 Monitored Protocol</span>
              </span>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#8BFF24] hover:bg-[#A3FF50] text-xs font-bold text-[#050605] transition flex items-center space-x-1.5 shadow-[0_0_15px_rgba(139,255,36,0.3)] cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Dispatching...' : 'Submit Inquiry'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
