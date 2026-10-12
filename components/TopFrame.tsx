'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { toast } from 'sonner';

interface TopFrameProps {
  className?: string;
}

export const TopFrame: React.FC<TopFrameProps> = ({ className = '' }) => {
  const [version, setVersion] = useState<string>('1.0.0');
  const [isElectron, setIsElectron] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // Communicate with Electron app to check application version
  const checkElectronVersion = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      if (window.electron && typeof window.electron.getVersion === 'function') {
        const electronVer = await window.electron.getVersion();
        if (electronVer) {
          setVersion(electronVer);
          setIsElectron(true);
          return electronVer;
        }
      }

      if (window.teaderDesktop) {
        setIsElectron(true);
        if (typeof window.teaderDesktop.getVersion === 'function') {
          const v = await window.teaderDesktop.getVersion();
          if (v) {
            setVersion(v);
            return v;
          }
        }
        if (window.teaderDesktop.version) {
          setVersion(window.teaderDesktop.version);
          return window.teaderDesktop.version;
        }
      }
    } catch (err) {
      console.warn('Error checking version with Electron:', err);
    }
    return '1.0.0';
  }, []);

  useEffect(() => {
    checkElectronVersion();

    // Listen for maximized state changes from Electron
    if (typeof window !== 'undefined') {
      const electronObj = window.electron || window.electronWindow;
      if (electronObj && typeof electronObj.isMaximized === 'function') {
        electronObj.isMaximized().then((max) => setIsMaximized(Boolean(max)));
      }

      if (electronObj && typeof electronObj.onMaximizedChange === 'function') {
        const cleanup = electronObj.onMaximizedChange((max) => {
          setIsMaximized(max);
        });
        return cleanup;
      }
    }
  }, [checkElectronVersion]);

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      if (window.electron?.minimize) {
        window.electron.minimize();
      } else if (window.electronWindow?.minimize) {
        window.electronWindow.minimize();
      } else {
        toast('Window minimize is available in the desktop client', {
          description: 'Running in web viewer browser mode',
        });
      }
    }
  };

  const handleToggleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      if (window.electron?.toggleMaximize) {
        window.electron.toggleMaximize();
      } else if (window.electronWindow?.toggleMaximize) {
        window.electronWindow.toggleMaximize();
      } else {
        toast('Window maximize is available in the desktop client', {
          description: 'Running in web viewer browser mode',
        });
      }
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      if (window.electron?.close) {
        window.electron.close();
      } else if (window.electronWindow?.close) {
        window.electronWindow.close();
      } else {
        toast('Window close is available in the desktop client', {
          description: 'Running in web viewer browser mode',
        });
      }
    }
  };

  const handleCheckVersionClick = async () => {
    const checked = await checkElectronVersion();
    toast(`Version: v${checked}`, {
      description: isElectron
        ? 'Communicated with Electron Desktop App'
        : 'Web Application Client Runtime',
    });
  };

  return (
    <header
      role="banner"
      aria-label="Application Top Frame"
      className={`w-full flex items-center justify-between select-none ${className}`}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* ─── Left Section: Teader App Title & Version Badge ──────────── */}
      <div
        className="flex items-center gap-2.5 shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <img
          src="/logo.svg"
          alt="Teader"
          className="w-4 h-4 object-contain shrink-0"
        />
        <span className="text-[17px] sm:text-[18px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          Teader App
        </span>
        <span
          onClick={handleCheckVersionClick}
          title="Click to verify communication with Electron app"
          className="text-[13px] font-normal text-[var(--text-secondary)] tracking-normal leading-none cursor-pointer hover:text-[var(--accent)] transition-colors"
        >
          v{version}
        </span>
      </div>

      {/* ─── Center Draggable Bar Space ──────────────────────────────── */}
      <div className="flex-1 h-full min-h-[28px]" />

      {/* ─── Right Section: Window Control Icons (Minimize, Maximize, Close) ─ */}
      <div
        className="flex items-center gap-1 shrink-0 text-[var(--text-primary)]"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={handleMinimize}
          aria-label="Minimize application window"
          title="Minimize"
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-primary)] active:bg-[var(--bg-active)] transition-colors cursor-pointer focus:outline-none"
        >
          <Minus size={14} className="stroke-[2]" />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          aria-label={isMaximized ? 'Restore application window' : 'Maximize application window'}
          title={isMaximized ? 'Restore' : 'Maximize'}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-primary)] active:bg-[var(--bg-active)] transition-colors cursor-pointer focus:outline-none"
        >
          {isMaximized ? (
            <Copy size={12} className="rotate-90 stroke-[1.75]" />
          ) : (
            <Square size={12} className="stroke-[1.75]" />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Close application window"
          title="Close"
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-primary)] active:bg-[var(--bg-active)] transition-colors cursor-pointer focus:outline-none"
        >
          <X size={14} className="stroke-[2]" />
        </button>
      </div>
    </header>
  );
};
