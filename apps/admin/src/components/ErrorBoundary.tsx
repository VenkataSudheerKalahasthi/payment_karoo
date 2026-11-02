import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by Admin ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Admin Portal Runtime Error</h2>
              <p className="text-xs text-slate-400 mt-1">
                An unexpected exception was encountered while rendering the administration dashboard.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-rose-300 break-all overflow-x-auto max-h-48">
              {this.state.error?.message || 'Unknown runtime error'}
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition flex items-center space-x-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition"
              >
                Clear Cache &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

