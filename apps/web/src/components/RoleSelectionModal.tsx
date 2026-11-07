import React, { useState } from 'react';
import {
  Briefcase,
  Compass,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Receipt,
  FileCheck,
} from 'lucide-react';
import { TrustPayLogo } from './TrustPayLogo';
import { UserRole } from '@trustpay/shared';

interface RoleSelectionModalProps {
  isOpen: boolean;
  onSelectRole: (role: 'CLIENT' | 'WORKER') => Promise<void> | void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
  actionType?: 'register' | 'login' | 'sync' | 'switch';
  onToggleActionType?: (type: 'register' | 'login') => void;
}

export const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
  isOpen,
  onSelectRole,
  isSubmitting = false,
  errorMessage = null,
  onCancel,
  title,
  subtitle,
  actionType = 'sync',
  onToggleActionType,
}) => {
  const [selectedRole, setSelectedRole] = useState<'CLIENT' | 'WORKER'>('CLIENT');

  if (!isOpen) return null;

  const defaultTitle =
    actionType === 'register'
      ? 'Join TrustPay Enterprise'
      : actionType === 'login'
      ? 'Sign In to TrustPay'
      : actionType === 'switch'
      ? 'Switch Portal Workspace'
      : 'Choose Your Account Role';

  const defaultSubtitle =
    actionType === 'register'
      ? 'Select how you want to participate in TrustPay to set up your account.'
      : actionType === 'login'
      ? 'Select your workspace portal to proceed to authentication.'
      : actionType === 'switch'
      ? 'Select an active role below to switch your workspace and features.'
      : 'Select how you would like to participate in the TrustPay Enterprise contract & escrow ecosystem.';

  const resolvedTitle = title || defaultTitle;
  const resolvedSubtitle = subtitle || defaultSubtitle;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSelectRole(selectedRole);
  };

  const submitButtonText = () => {
    if (isSubmitting) return 'Configuring Workspace...';
    if (actionType === 'register') {
      return `Register as ${selectedRole === 'CLIENT' ? 'Client' : 'Specialist'}`;
    }
    if (actionType === 'login') {
      return `Log In as ${selectedRole === 'CLIENT' ? 'Client' : 'Specialist'}`;
    }
    if (actionType === 'switch') {
      return `Switch to ${selectedRole === 'CLIENT' ? 'Client' : 'Specialist'}`;
    }
    return `Enter as ${selectedRole === 'CLIENT' ? 'Client' : 'Specialist'}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-2xl dark:bg-[#0e100e] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button if onCancel is provided */}
        {onCancel && (
          <button
            onClick={onCancel}
            type="button"
            className="absolute top-5 right-5 p-2 rounded-full dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-[#9AA4B8] text-[#64748B] transition cursor-pointer"
            aria-label="Close modal"
          >
            <span className="text-base font-bold leading-none">&times;</span>
          </button>
        )}

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <TrustPayLogo size="md" />

          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight dark:text-white text-[#111827]">
              {resolvedTitle}
            </h2>
            <p className="text-xs sm:text-sm dark:text-[#9AA4B8] text-[#64748B] max-w-md mx-auto">
              {resolvedSubtitle}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Two Interactive Selection Cards */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Client */}
            <div
              onClick={() => setSelectedRole('CLIENT')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                selectedRole === 'CLIENT'
                  ? 'dark:bg-[#151a15] bg-[#EEF2FF] dark:border-[#1F61EF] border-[#5046E5] dark:shadow-[0_0_20px_rgba(31,97,239,0.12)] shadow-[0_4px_20px_rgba(80,70,229,0.12)] scale-[1.01]'
                  : 'dark:bg-[#191B25] bg-[#F8FAFC] dark:border-[#272B38] border-[#E2E8F0] hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              {selectedRole === 'CLIENT' && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full dark:bg-[#1F61EF] bg-[#5046E5] flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 dark:text-black text-white" />
                </div>
              )}

              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] flex items-center justify-center">
                  <Briefcase className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold dark:text-white text-[#111827]">Client</h3>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full dark:bg-[#1C2740] bg-[#EEF2FF] dark:text-[#8FB5FF] text-[#5046E5] font-bold">
                      Buyer
                    </span>
                  </div>
                  <p className="text-xs dark:text-zinc-400 text-zinc-600 mt-1">
                    I want to hire verified specialists, post deals, fund milestone escrow, and review deliverables.
                  </p>
                </div>

                <ul className="space-y-1.5 pt-2 text-[11px] dark:text-zinc-400 text-zinc-600 border-t dark:border-[#272B38] border-[#E2E8F0]">
                  <li className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 dark:text-[#8FB5FF] text-[#5046E5]" />
                    <span>Create &amp; sign digital contracts</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 dark:text-[#8FB5FF] text-[#5046E5]" />
                    <span>Non-custodial milestone escrow</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 dark:text-[#8FB5FF] text-[#5046E5]" />
                    <span>Official Client Office Stamp authority</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Card 2: Specialist / Worker */}
            <div
              onClick={() => setSelectedRole('WORKER')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                selectedRole === 'WORKER'
                  ? 'dark:bg-[#151a15] bg-[#EEF2FF] dark:border-[#1F61EF] border-[#5046E5] dark:shadow-[0_0_20px_rgba(31,97,239,0.12)] shadow-[0_4px_20px_rgba(80,70,229,0.12)] scale-[1.01]'
                  : 'dark:bg-[#191B25] bg-[#F8FAFC] dark:border-[#272B38] border-[#E2E8F0] hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              {selectedRole === 'WORKER' && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full dark:bg-[#1F61EF] bg-[#5046E5] flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 dark:text-black text-white" />
                </div>
              )}

              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] flex items-center justify-center">
                  <Compass className="w-5 h-5 dark:text-[#8FB5FF] text-[#5046E5]" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold dark:text-white text-[#111827]">Specialist</h3>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full dark:bg-[#1C2740] bg-[#EEF2FF] dark:text-[#8FB5FF] text-[#5046E5] font-bold">
                      Provider
                    </span>
                  </div>
                  <p className="text-xs dark:text-zinc-400 text-zinc-600 mt-1">
                    I want to discover open opportunities, submit proposals, deliver milestones, and earn secure payouts.
                  </p>
                </div>

                <ul className="space-y-1.5 pt-2 text-[11px] dark:text-zinc-400 text-zinc-600 border-t dark:border-[#272B38] border-[#E2E8F0]">
                  <li className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 dark:text-[#8FB5FF] text-[#5046E5]" />
                    <span>Browse project opportunities feed</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 dark:text-[#8FB5FF] text-[#5046E5]" />
                    <span>Submit deliverables &amp; revisions</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 dark:text-[#8FB5FF] text-[#5046E5]" />
                    <span>Guaranteed ledger escrow earnings</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t dark:border-[#272B38] border-[#E2E8F0]">
            <div>
              {onToggleActionType && actionType === 'register' ? (
                <p className="text-[11px] dark:text-[#9AA4B8] text-[#64748B]">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => onToggleActionType('login')}
                    className="dark:text-[#8FB5FF] text-[#5046E5] font-bold hover:underline cursor-pointer"
                  >
                    Sign In instead
                  </button>
                </p>
              ) : onToggleActionType && actionType === 'login' ? (
                <p className="text-[11px] dark:text-[#9AA4B8] text-[#64748B]">
                  New to TrustPay?{' '}
                  <button
                    type="button"
                    onClick={() => onToggleActionType('register')}
                    className="dark:text-[#8FB5FF] text-[#5046E5] font-bold hover:underline cursor-pointer"
                  >
                    Register free
                  </button>
                </p>
              ) : (
                <p className="text-[11px] dark:text-[#9AA4B8] text-[#64748B]">
                  You can easily switch your portal role anytime from your account settings.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl dark:bg-zinc-800 bg-slate-100 text-xs font-semibold dark:text-zinc-300 text-slate-700 hover:opacity-90 cursor-pointer"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] hover:bg-[#4338CA] dark:hover:bg-[#174EC4] dark:text-black text-white text-xs font-bold transition flex items-center justify-center gap-2 dark:shadow-[0_0_15px_rgba(31,97,239,0.25)] shadow-md shadow-[#5046E5]/25 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Configuring Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>{submitButtonText()}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
