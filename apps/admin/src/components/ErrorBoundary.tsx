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
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen dark:bg-[#080808] bg-[#F5F7FA] dark:text-[#CDCBCA] text-[#242424] flex items-center justify-center p-4 transition-colors">
          <div className="max-w-xl w-full dark:bg-[#171717] bg-white border dark:border-red-500/30 border-red-500/20 rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-xl font-bold dark:text-[#CDCBCA] text-[#242424]">Application Runtime Error</h2>
              <p className="text-xs dark:text-[#777777] text-[#64748B] mt-1">
                An unexpected exception was encountered while rendering the application component tree.
              </p>
            </div>

            <div className="p-4 rounded-xl dark:bg-[#080808] bg-[#F8FAFC] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] text-xs font-mono text-red-500 dark:text-red-400 break-all overflow-x-auto max-h-48">
              {this.state.error?.message || 'Unknown runtime error'}
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-semibold text-white transition flex items-center space-x-2 shadow-lg shadow-[#2563EB]/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="px-4 py-2 rounded-lg dark:bg-[#202020] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] text-xs font-medium dark:text-[#CDCBCA] text-[#242424] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] transition"
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
