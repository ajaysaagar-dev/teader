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

        await window.teaderDesktop.downloadAndInstallUpdate(INSTALLER_URL);
        setProgress(100);
        setStatus('completed');
        return;
      }

      // Fallback Path: For existing installations without the new IPC handler
      const res = await fetch(INSTALLER_URL);
      if (!res.ok) {
        throw new Error(`Failed to download installer (HTTP ${res.status})`);
      }

      const contentLength = res.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      if (!res.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = res.body.getReader();
      let receivedBytes = 0;
      const chunks: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          if (totalBytes > 0) {
            const percent = Math.min(98, Math.round((receivedBytes / totalBytes) * 100));
            setProgress(percent);
          }
        }
      }

      const blob = new Blob(chunks, { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = 'Teader-Workspace-Setup.exe';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setProgress(100);
      setStatus('completed');

      // Automatically close the Electron application after a short delay so user can proceed with installer
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.electronWindow?.close) {
          window.electronWindow.close();
        }
      }, 2500);
    } catch (err: any) {
      console.error('Update failed:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to download installer');
    }
  };

  const handleCloseElectron = () => {
    if (typeof window !== 'undefined' && window.electronWindow?.close) {
      window.electronWindow.close();
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-[#141518] border border-[#2A2C30] rounded-2xl p-6 shadow-2xl relative text-left">
        {/* Header Icon */}
        <div className="w-12 h-12 rounded-xl bg-[#DCB001]/10 border border-[#DCB001]/30 flex items-center justify-center text-[#DCB001] mb-4">
          <Download className="w-6 h-6 animate-bounce" />
        </div>

        {/* Title */}
        <h2 className="text-lg font-bold text-white tracking-tight mb-1">
          Update Required to Enter
        </h2>
        <p className="text-xs text-[#9BA1A6] mb-4">
          Teader Workspace <span className="text-[#DCB001] font-semibold">v{TARGET_DISPLAY_VERSION}</span> is required to enter. Please update to proceed. (Currently running v{currentVersion})
        </p>

        {/* Release details card */}
        <div className="bg-[#0E0F12] border border-[#232529] rounded-xl p-3 mb-5 text-xs space-y-1.5 text-[#CFD4DD]">
          <div className="flex items-center gap-2 text-white font-medium">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            What&apos;s new in v{TARGET_DISPLAY_VERSION}:
          </div>
          <p className="text-[#9BA1A6] pl-4">• Stable desktop rendering with native DirectWrite typography.</p>
          <p className="text-[#9BA1A6] pl-4">• AI voice denoise & extreme neural spectral isolation.</p>
          <p className="text-[#9BA1A6] pl-4">• Unthrottled background meeting audio during multitasking and screen sharing.</p>
          <p className="text-[#9BA1A6] pl-4">• Direct webview support and external framing restriction bypass.</p>
          <p className="text-[#9BA1A6] pl-4">• Automatic download and installation engine.</p>
        </div>

        {/* Progress Bar / Status during download */}
        {status === 'downloading' && (
          <div className="mb-5 space-y-2">
            <div className="flex justify-between items-center text-xs text-[#9BA1A6]">
              <span className="flex items-center gap-1.5 text-white">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#DCB001]" />
                Downloading installer...
              </span>
              <span className="font-mono text-[#DCB001]">{progress}%</span>
            </div>
            <div className="w-full bg-[#232529] rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#DCB001] h-full transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Completion Notice */}
        {status === 'completed' && (
          <div className="mb-5 p-3 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-xs text-[#22C55E] flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-white">Installer Downloaded!</p>
              <p className="text-[#9BA1A6] mt-0.5">
                Launching installer now. Closing Teader to finish update...
              </p>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {status === 'error' && (
          <div className="mb-5 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-xs text-[#EF4444] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-white">Update Error</p>
              <p className="text-[#EF4444] mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Action Buttons - Only Update Now is shown, no Later button */}
        <div className="pt-2">
          {status === 'idle' && (
            <button
              type="button"
              onClick={handleStartUpdate}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-bold text-black bg-[#DCB001] hover:bg-[#E5B800] active:scale-[0.98] rounded-xl shadow-lg transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Update Now to v{TARGET_DISPLAY_VERSION}
            </button>
          )}

          {status === 'downloading' && (
            <div className="text-center text-xs text-[#787C83] italic py-2">
              Please wait while update downloads and installs...
            </div>
          )}

          {status === 'completed' && (
            <button
              type="button"
              onClick={handleCloseElectron}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-bold text-white bg-[#C0393B] hover:bg-[#A82E30] rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Close Teader Now
            </button>
          )}

          {status === 'error' && (
            <button
              type="button"
              onClick={handleStartUpdate}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-bold text-black bg-[#DCB001] hover:bg-[#E5B800] rounded-xl shadow-lg transition-all cursor-pointer"
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
