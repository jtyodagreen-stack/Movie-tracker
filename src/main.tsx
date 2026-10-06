import './utils/safeStorage';
import './utils/suppressAuthErrors';
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { NotificationProvider } from './context/NotificationContext';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ShowFlix ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#141414] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full bg-zinc-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-14 h-14 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
              ⚠️
            </div>
            <h1 className="text-xl font-bold text-white">Something went wrong</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              ShowFlix encountered an issue while loading. You can refresh or reset local cached data.
            </p>
            {this.state.error && (
              <div className="bg-zinc-950 p-3 rounded-lg text-left text-[11px] text-red-400 font-mono overflow-auto max-h-36 border border-zinc-800">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer"
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer"
              >
                Reset Data & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function mount() {
  const container = document.getElementById('root');
  if (!container) return;
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <RootErrorBoundary>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </RootErrorBoundary>
    </StrictMode>
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}

