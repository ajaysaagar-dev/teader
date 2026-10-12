'use client';

import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { getDesktopInfo, compareVersions } from '@/lib/desktop';

const TARGET_VERSION = '1.0.0';
const TARGET_DISPLAY_VERSION = '1.0.0 Alpha';
const INSTALLER_URL = '/releases/Teader-Workspace-Setup.exe';

export const DesktopUpdateModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('0.0.1');
  const [status, setStatus] = useState<'idle' | 'downloading' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Delay slightly to ensure window.teaderDesktop is injected by Electron preload
    const timer = setTimeout(() => {
      const info = getDesktopInfo();
      if (info.isDesktop && info.version) {
        setCurrentVersion(info.version);
        if (compareVersions(info.version, TARGET_VERSION) < 0) {
          setIsOpen(true);
        }
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  if (!isOpen) return null;

  const handleStartUpdate = async () => {
    setStatus('downloading');
    setProgress(5);
    setErrorMessage('');

    try {
      // Primary Path: Use Electron's native updater IPC if available
      if (typeof window !== 'undefined' && window.teaderDesktop?.downloadAndInstallUpdate) {
        if (window.teaderDesktop.onUpdateProgress) {
          window.teaderDesktop.onUpdateProgress((p) => {
            if (p.percent) setProgress(p.percent);
          });
        }

        const fullUrl = new URL(INSTALLER_URL, window.location.origin).href;
        await window.teaderDesktop.downloadAndInstallUpdate(fullUrl);
        setProgress(100);
        setStatus('completed');
        return;
      }

      // Secondary Path: Trigger download URL directly (Electron will-download intercepts without Save As dialog and auto-starts)
      window.location.assign(INSTALLER_URL);
      setProgress(100);
      setStatus('completed');
    } catch (err: any) {
      console.warn('Native IPC failed, attempting direct download stream:', err);
      try {
        window.location.assign(INSTALLER_URL);
        setProgress(100);
        setStatus('completed');
      } catch (fallbackErr: any) {
        console.error('Update failed:', fallbackErr);
        setStatus('error');
        setErrorMessage(err.message || fallbackErr.message || 'Failed to download installer');
      }
    }
  };

  const handleCloseElectron = () => {
    if (typeof window !== 'undefined' && window.electronWindow?.close) {
      window.electronWindow.close();
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-2xl p-6 shadow-2xl relative text-left">
        {/* Header Icon */}
        <div className="w-12 h-12 rounded-xl bg-white text-black/10 border border-[var(--border-secondary)] flex items-center justify-center text-white mb-4">
          <Download className="w-6 h-6 animate-bounce" />
        </div>

        {/* Title */}
        <h2 className="text-lg font-bold text-white tracking-tight mb-1">
          Update Required to Enter
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Teader Workspace <span className="text-white font-semibold">v{TARGET_DISPLAY_VERSION}</span> is required to enter. Please update to proceed. (Currently running v{currentVersion})
        </p>

        {/* Release details card */}
        <div className="bg-[#000000] border border-[#262626] rounded-xl p-3 mb-5 text-xs space-y-1.5 text-[var(--text-secondary)]">
          <div className="flex items-center gap-2 text-white font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--ramp-3)]" />
            What&apos;s new in v{TARGET_DISPLAY_VERSION}:
          </div>
          <p className="text-[var(--text-secondary)] pl-4">• Stable desktop rendering with native DirectWrite typography.</p>
          <p className="text-[var(--text-secondary)] pl-4">• AI voice denoise & extreme neural spectral isolation.</p>
          <p className="text-[var(--text-secondary)] pl-4">• Unthrottled background meeting audio during multitasking and screen sharing.</p>
          <p className="text-[var(--text-secondary)] pl-4">• Direct webview support and external framing restriction bypass.</p>
          <p className="text-[var(--text-secondary)] pl-4">• Automatic download and installation engine.</p>
        </div>

        {/* Progress Bar / Status during download */}
        {status === 'downloading' && (
          <div className="mb-5 space-y-2">
            <div className="flex justify-between items-center text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5 text-white">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                Downloading installer...
              </span>
              <span className="font-mono text-white">{progress}%</span>
            </div>
            <div className="w-full bg-[#262626] rounded-full h-2 overflow-hidden">
              <div
                className="bg-white text-black h-full transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Completion Notice */}
        {status === 'completed' && (
          <div className="mb-5 p-3 rounded-xl bg-[var(--ramp-3)]/10 border border-[var(--border-secondary)] text-xs text-white flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-white">Installer Downloaded!</p>
              <p className="text-[var(--text-secondary)] mt-0.5">
                Launching installer now. Closing Teader to finish update...
              </p>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {status === 'error' && (
          <div className="mb-5 p-3 rounded-xl bg-[var(--ramp-3)]/10 border border-[var(--border-secondary)] text-xs text-white flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-white">Update Error</p>
              <p className="text-white mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Action Buttons - Only Update Now is shown, no Later button */}
        <div className="pt-2">
          {status === 'idle' && (
            <button
              type="button"
              onClick={handleStartUpdate}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-bold text-black bg-white text-black hover:bg-[#FFFFFF] active:scale-[0.98] rounded-xl shadow-lg transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Update Now to v{TARGET_DISPLAY_VERSION}
            </button>
          )}

          {status === 'downloading' && (
            <div className="text-center text-xs text-[var(--text-muted)] italic py-2">
              Please wait while update downloads and installs...
            </div>
          )}

          {status === 'completed' && (
            <button
              type="button"
              onClick={handleCloseElectron}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-bold text-white bg-[#FFFFFF] hover:bg-[#FFFFFF] rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Close Teader Now
            </button>
          )}

          {status === 'error' && (
            <button
              type="button"
              onClick={handleStartUpdate}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-bold text-black bg-white text-black hover:bg-[#FFFFFF] rounded-xl shadow-lg transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Update Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
