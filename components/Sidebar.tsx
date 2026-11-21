'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CheckSquare,
  Settings,
  Keyboard,
  PanelLeftClose,
  PanelLeft,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { getDesktopInfo } from '@/lib/desktop';
import { authFetch } from '@/lib/api-client';

interface ProjectItem {
  id: string | number;
  key?: string;
  name: string;
}

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenNewIssue?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcuts?: () => void;
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = true,
  onToggleCollapse,
  onOpenNewIssue,
  onOpenShortcuts,
  onOpenSettings,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [desktopInfo, setDesktopInfo] = useState<{ isDesktop: boolean; version: string | null }>({
    isDesktop: false,
    version: null,
  });

  // Hover and Pin states for compact expandable sidebar
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    try {
      const savedPin = localStorage.getItem('teader_sidebar_pinned');
      if (savedPin === 'true') setIsPinned(true);
    } catch {}
  }, []);

  const togglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('teader_sidebar_pinned', String(next));
      } catch {}
      if (onToggleCollapse) onToggleCollapse();
      return next;
    });
  };

  const isExpanded = isPinned || isHovered;

  useEffect(() => {
    setDesktopInfo(getDesktopInfo());
    try {
      const cached = localStorage.getItem('teader_user');
      if (cached) setCurrentUser(JSON.parse(cached));
    } catch {}

    const handleUserUpdate = (e: any) => {
      if (e.detail) setCurrentUser(e.detail);
    };
    window.addEventListener('teader_user_updated', handleUserUpdate);
    return () => window.removeEventListener('teader_user_updated', handleUserUpdate);
  }, []);

  useEffect(() => {
    authFetch('/api/projects')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      })
      .catch(() => {});
  }, []);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/my-work', label: 'Commitments', icon: CheckSquare },
    { href: '/projects', label: 'Projects', icon: Workflow },
  ];

  return (
    <div
      className={`h-full relative shrink-0 transition-[width] duration-200 ease-in-out ${
        isExpanded ? 'z-[60]' : 'z-30'
      } ${
        isPinned ? 'w-60' : 'w-14'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <aside
        className={`h-full absolute top-0 left-0 bottom-0 bg-[var(--bg-sidebar)] text-[var(--text-secondary)] flex flex-col justify-between select-none transition-[width,box-shadow] duration-200 ease-in-out overflow-hidden text-xs font-sans border-r border-[var(--border-primary)] ${
          isExpanded
            ? 'w-60 shadow-[4px_0_24px_rgba(0,0,0,0.6)] z-[60]'
            : 'w-14 shadow-none z-30'
        }`}
      >
        {/* Top Brand Header */}
        <div
          className={`p-2 border-b border-[var(--border-subtle)] flex items-center ${
            isExpanded ? 'justify-between px-3' : 'justify-center'
          } h-10 shrink-0`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded bg-white text-black font-mono font-bold text-[11px] flex items-center justify-center shrink-0 shadow-sm">
              T
            </div>
            {isExpanded && (
              <span className="font-semibold text-xs tracking-tight text-white truncate">
                teader
              </span>
            )}
          </div>
          {isExpanded && (
            <button
              onClick={togglePin}
              className={`p-1 rounded hover:bg-white/10 transition-colors ${
                isPinned ? 'text-white' : 'text-[var(--text-muted)] hover:text-white'
              }`}
              title={isPinned ? 'Unpin sidebar (auto-compact on hover out)' : 'Pin sidebar open'}
            >
              {isPinned ? <PanelLeftClose size={13} /> : <PanelLeft size={13} />}
            </button>
          )}
        </div>

        {/* Primary Navigation & Projects */}
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {/* Navigation Links */}
          <div className="p-2 space-y-0.5 shrink-0">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href === '/dashboard' && pathname === '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors text-xs relative ${
                    isActive
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  } ${!isExpanded ? 'justify-center px-0' : ''}`}
                  title={item.label}
                >
                  <Icon
                    size={14}
                    className={
                      isActive
                        ? 'text-[var(--accent)] shrink-0'
                        : 'text-[var(--text-muted)] shrink-0'
                    }
                  />
                  {isExpanded && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>

          {/* Projects Section */}
          <div className="px-2 pt-2 pb-1 border-t border-[var(--border-subtle)] flex-1 min-h-0 flex flex-col">
            <div
              className={`flex items-center ${
                isExpanded ? 'justify-between px-2' : 'justify-center'
              } py-1 text-xs font-semibold text-[var(--text-secondary)] shrink-0`}
            >
              {isExpanded ? (
                <span>Projects</span>
              ) : (
                <span className="text-[9px] uppercase font-mono tracking-wider text-[var(--text-muted)]">
                  Prj
                </span>
              )}
            </div>

            <div className="space-y-0.5 overflow-y-auto flex-1 pr-0.5">
              {projects.map((proj) => {
                const projHref = `/projects/${proj.id}`;
                const isProjActive = pathname.startsWith(projHref);
                const initial = (proj.name || 'P').slice(0, 1).toUpperCase();
                return (
                  <Link
                    key={proj.id}
                    href={projHref}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors relative ${
                      isProjActive
                        ? 'bg-white/10 text-white font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-white'
                        : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
                    } ${!isExpanded ? 'justify-center px-0' : ''}`}
                    title={proj.name}
                  >
                    <span className="w-5 h-5 rounded bg-white/10 text-[10px] font-mono font-medium flex items-center justify-center shrink-0 text-white/90">
                      {initial}
                    </span>
                    {isExpanded && <span className="truncate">{proj.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Footer Section */}
        <div className="p-2 border-t border-[var(--border-primary)] bg-[var(--bg-sidebar)] space-y-1 shrink-0">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[var(--text-secondary)] hover:text-white hover:bg-[var(--ramp-1)] transition-colors ${
                !isExpanded ? 'justify-center px-0' : ''
              }`}
              title="Settings"
            >
              <Settings size={14} className="shrink-0 text-[var(--text-muted)]" />
              {isExpanded && <span>Settings</span>}
            </button>
          )}

          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[var(--text-secondary)] hover:text-white hover:bg-[var(--ramp-1)] transition-colors ${
                !isExpanded ? 'justify-center px-0' : ''
              }`}
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard size={14} className="shrink-0 text-[var(--text-muted)]" />
              {isExpanded && <span>Shortcuts</span>}
            </button>
          )}

          {isExpanded && (
            <button
              onClick={togglePin}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-colors"
              title={isPinned ? 'Unpin sidebar (auto-collapse on hover out)' : 'Pin sidebar open'}
            >
              {isPinned ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
              <span>{isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
};
