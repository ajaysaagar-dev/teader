'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — wraps any section of the UI.
 * On crash: shows a friendly error card with a Retry button.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
    this.props.onError?.(error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex-1 flex items-center justify-center bg-[#131415] p-8">
          <div className="max-w-sm w-full bg-[#1B1C1F] border border-[#C0393B]/30 rounded-xl p-6 text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle size={32} className="text-[#C0393B]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#CFD4DD]">Something went wrong</h3>
              {this.state.error && (
                <p className="text-xs text-[#787C83] mt-1 font-mono break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#0F1011] bg-[#DCB001] hover:bg-[#c49c00] rounded-lg transition-colors"
            >
              <RefreshCw size={13} />
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Lightweight functional wrapper for convenience */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const Wrapped = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return Wrapped;
}
