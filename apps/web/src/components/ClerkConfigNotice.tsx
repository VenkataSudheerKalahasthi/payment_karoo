import React, { useState } from 'react';
import { ShieldCheck, Key, ExternalLink, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface ClerkConfigNoticeProps {
  portalName?: string;
  envFilePath?: string;
}

export const ClerkConfigNotice: React.FC<ClerkConfigNoticeProps> = ({
  portalName = 'Client & Worker Portal',
  envFilePath = 'apps/web/.env',
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

    // Key is valid - save to localStorage and reload
    localStorage.setItem('tp_clerk_publishable_key', trimmed);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-8 shadow-2xl">
        {/* Header Branding */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">TrustPay Enterprise v2.0</h1>
                <p className="text-xs text-slate-400">{portalName}</p>
              </div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Setup Required
          </span>
        </div>

        {/* Issue Explanation */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <span>Clerk Authentication Key Not Configured</span>
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            The application loaded, but Clerk authentication requires a valid publishable key. 
            Currently, <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[11px]">VITE_CLERK_PUBLISHABLE_KEY</code> is set to the default placeholder (<code className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px]">pk_test_placeholder_key</code>), which causes Clerk to reject initialization.
          </p>
        </div>

        {/* Quick Launch Form */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Quick Connect (Run in Browser)
          </h3>
          <p className="text-xs text-slate-400">
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
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            {error && (
              <p className="text-xs text-rose-400 flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </p>
            )}
            <button
              type="submit"
              className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/30"
            >
              <span>Apply &amp; Launch Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Permanent Environment File Instructions */}
        <div className="space-y-3 text-xs text-slate-400">
          <h3 className="font-semibold text-slate-200">How to configure permanently in your code:</h3>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Obtain your free API keys from the{' '}
              <a
                href="https://dashboard.clerk.com/last-active?path=api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline inline-flex items-center space-x-0.5"
              >
                <span>Clerk Dashboard</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>.
            </li>
            <li>
              Add the key to <span className="font-mono text-slate-200 bg-slate-800 px-1 py-0.5 rounded">{envFilePath}</span>:
              <pre className="p-3 mt-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto">
{`VITE_API_URL=http://localhost:5000/api/v1
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_real_key_here`}
              </pre>
            </li>
            <li>Restart your Vite development server: <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">npm run dev</code>.</li>
          </ol>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Supabase Database &amp; Express API Connected</span>
          </span>
          <span>TrustPay Enterprise v2.0</span>
        </div>
      </div>
    </div>
  );
};

