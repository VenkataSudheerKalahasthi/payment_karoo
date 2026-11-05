import React, { useState } from 'react';
import { ShieldCheck, Key, ExternalLink, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface ClerkConfigNoticeProps {
  portalName?: string;
  envFilePath?: string;
}

export const ClerkConfigNotice: React.FC<ClerkConfigNoticeProps> = ({
  portalName = 'Admin Governance Portal',
  envFilePath = 'apps/admin/.env',
}) => {
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputKey.trim();
    if (!trimmed) {
      setError('Please enter a Clerk Publishable Key.');
      return;
    }
    if (!trimmed.startsWith('pk_test_') && !trimmed.startsWith('pk_live_')) {
      setError('Key must start with "pk_test_" or "pk_live_".');
      return;
    }
    try {
      const parts = trimmed.split('_');
      if (parts.length !== 3 || !parts[2]) {
        setError('Invalid Clerk key format. Key should have 3 segments separated by underscores.');
        return;
      }
      const decoded = atob(parts[2]);
      if (!decoded.endsWith('$')) {
        setError('Invalid Clerk key payload: decoded key does not end with $.');
        return;
      }
    } catch {
      setError('Invalid Clerk key: unable to decode base64 payload.');
      return;
    }

    localStorage.setItem('tp_clerk_publishable_key', trimmed);
    window.location.reload();
  };

  return (
    <div className="min-h-screen dark:bg-[#080808] bg-[#F5F7FA] dark:text-[#CDCBCA] text-[#242424] flex items-center justify-center p-4 transition-colors">
      <div className="max-w-2xl w-full dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] rounded-3xl p-6 sm:p-10 space-y-8 shadow-xl">
        {/* Header Branding */}
        <div className="flex items-start justify-between border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] pb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold dark:text-[#CDCBCA] text-[#242424] tracking-tight">TrustPay Enterprise v2.0</h1>
              <p className="text-xs dark:text-[#777777] text-[#64748B]">{portalName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <span className="px-3 py-1 rounded-full text-[11px] font-bold font-mono bg-amber-500/10 text-amber-500 border border-amber-500/20">
              Setup Required
            </span>
          </div>
        </div>

        {/* Issue Explanation */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold dark:text-[#CDCBCA] text-[#242424] flex items-center space-x-2">
            <Key className="w-5 h-5 text-[#2563EB]" />
            <span>Clerk Authentication Key Required</span>
          </h2>
          <p className="text-xs dark:text-[#A5A5A5] text-[#475569] leading-relaxed">
            The application loaded, but Clerk authentication requires a valid publishable key. 
            Currently, <code className="px-1.5 py-0.5 rounded dark:bg-[#202020] bg-[#F1F5F9] text-amber-500 text-[11px] font-mono">VITE_CLERK_PUBLISHABLE_KEY</code> is set to the default placeholder (<code className="px-1.5 py-0.5 rounded dark:bg-[#202020] bg-[#F1F5F9] dark:text-[#777777] text-[#64748B] text-[11px] font-mono">pk_test_placeholder_key</code>), which causes Clerk to reject initialization.
          </p>
        </div>

        {/* Quick Launch Form */}
        <div className="p-5 rounded-2xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] space-y-4">
          <h3 className="text-xs font-bold dark:text-[#CDCBCA] text-[#242424] uppercase tracking-wider font-mono">
            Quick Connect (Run in Browser)
          </h3>
          <p className="text-xs dark:text-[#777777] text-[#64748B]">
            Paste your Clerk Publishable Key below to launch the portal immediately:
          </p>
          <form onSubmit={handleSaveKey} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  setError(null);
                }}
                placeholder="pk_test_..."
                className="w-full px-4 py-2.5 rounded-xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] text-xs dark:text-[#CDCBCA] text-[#242424] placeholder-[#777777] font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB] transition"
              />
            </div>
            {error && (
              <p className="text-xs text-red-500 flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </p>
            )}
            <button
              type="submit"
              className="w-full px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-bold text-white transition flex items-center justify-center space-x-2 shadow-lg shadow-[#2563EB]/20"
            >
              <span>Apply &amp; Launch Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Permanent Environment File Instructions */}
        <div className="space-y-3 text-xs dark:text-[#777777] text-[#64748B]">
          <h3 className="font-semibold dark:text-[#CDCBCA] text-[#242424]">How to configure permanently in your code:</h3>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Obtain your free API keys from the{' '}
              <a
                href="https://dashboard.clerk.com/last-active?path=api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-[#2563EB] hover:underline inline-flex items-center space-x-0.5"
              >
                <span>Clerk Dashboard</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>.
            </li>
            <li>
              Add the key to <span className="font-mono dark:text-[#CDCBCA] text-[#242424] dark:bg-[#202020] bg-[#F1F5F9] px-1 py-0.5 rounded">{envFilePath}</span>:
              <pre className="p-3 mt-1.5 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] font-mono text-[11px] text-[#2563EB] overflow-x-auto">
{`VITE_API_URL=http://localhost:5000/api/v1
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_real_key_here`}
              </pre>
            </li>
            <li>Restart your Vite development server: <code className="dark:bg-[#202020] bg-[#F1F5F9] px-1 py-0.5 rounded dark:text-[#CDCBCA] text-[#242424]">npm run dev</code>.</li>
          </ol>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex items-center justify-between text-[11px] dark:text-[#777777] text-[#64748B]">
          <span className="flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Supabase Database &amp; Express API Connected</span>
          </span>
          <span className="font-mono">TrustPay Enterprise v2.0</span>
        </div>
      </div>
    </div>
  );
};
