'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CheckSquare,
  Layers,
  MessageSquare,
  BookOpen,
  FolderKanban,
  Settings,
  Keyboard,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Cpu
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from './ui/Avatar';
import { getDesktopInfo } from '@/lib/desktop';

interface ProjectItem {
  id: string | number;
  key?: string;
  name: string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenNewIssue?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcuts?: () => void;
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
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
    fetch('/api/projects')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      try {
        localStorage.removeItem('teader_user');
        localStorage.removeItem('teader_token');
      } catch {}
      toast.success('Logged out successfully');
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Logout failed');
    }
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/my-work', label: 'My Work', icon: CheckSquare },
    { href: '/initiatives', label: 'Initiatives', icon: Layers },
    { href: '/conversations', label: 'Conversations', icon: MessageSquare },
    { href: '/documentation', label: 'Documentation', icon: BookOpen },
  ];

  return (
    <aside
      className={`h-full bg-[var(--bg-sidebar)] text-[var(--text-secondary)] flex flex-col justify-between select-none transition-all duration-150 ${
        collapsed ? 'w-14' : 'w-60'
      } shrink-0 overflow-hidden text-xs font-sans border-r border-[var(--border-primary)] z-30`}
    >
      {/* Top Header & Links */}
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {/* Workspace Brand Row */}
        <div className="h-11 px-3 border-b border-[var(--border-primary)] flex items-center justify-between shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-white font-semibold tracking-tight hover:opacity-80 transition-opacity min-w-0"
            title="Teader Workspace"
          >
            <div className="w-6 h-6 rounded bg-white text-black font-bold flex items-center justify-center shrink-0 text-xs">
              T
            </div>
            {!collapsed && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate text-xs font-semibold text-white">Teader</span>
                {desktopInfo.isDesktop && desktopInfo.version && (
                  <span className="text-[11px] text-[var(--text-muted)] font-normal">
                    v{desktopInfo.version}
                  </span>
                )}
              </div>
            )}
          </Link>

          <button
            onClick={onToggleCollapse}
            className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-colors shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>

        {/* Quick Action: New Issue */}
        {onOpenNewIssue && (
          <div className="p-2 shrink-0">
            <button
              onClick={onOpenNewIssue}
              className={`w-full flex items-center gap-2 rounded px-2.5 py-1.5 bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] transition-colors font-medium text-xs ${
                collapsed ? 'justify-center px-0' : ''
              }`}
              title="New Issue (C)"
            >
              <Plus size={14} className="shrink-0" />
              {!collapsed && <span>New Issue</span>}
            </button>
          </div>
        )}

        {/* Primary Navigation Links */}
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
                    ? 'bg-white/10 text-white font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-white'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={item.label}
              >
                <Icon size={14} className={isActive ? 'text-white shrink-0' : 'text-[var(--text-muted)] shrink-0'} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Projects Section */}
        <div className="px-2 pt-2 pb-1 border-t border-[var(--border-subtle)] flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] shrink-0">
            {!collapsed && <span>Projects</span>}
            <Link
              href="/projects"
              className="text-[var(--text-muted)] hover:text-white transition-colors"
              title="View all projects"
            >
              <FolderKanban size={13} />
            </Link>
          </div>

          <div className="space-y-0.5 overflow-y-auto flex-1 pr-0.5">
            {projects.map((proj) => {
              const projHref = `/projects/${proj.id}`;
              const isProjActive = pathname.startsWith(projHref);
              return (
                <Link
                  key={proj.id}
                  href={projHref}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors relative ${
                    isProjActive
                      ? 'bg-white/10 text-white font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-white'
                      : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
                  } ${collapsed ? 'justify-center px-0' : ''}`}
                  title={proj.name}
                >
                  <span className={`w-4 h-4 rounded ${isProjActive ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-300'} flex items-center justify-center font-mono text-[9px] font-bold shrink-0`}>
                    {proj.key ? proj.key.slice(0, 2) : 'P'}
                  </span>
                  {!collapsed && <span className="truncate">{proj.name}</span>}
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
              collapsed ? 'justify-center px-0' : ''
            }`}
            title="Settings"
          >
            <Settings size={14} className="shrink-0 text-[var(--text-muted)]" />
            {!collapsed && <span>Settings</span>}
          </button>
        )}

        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[var(--text-secondary)] hover:text-white hover:bg-[var(--ramp-1)] transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard size={14} className="shrink-0 text-[var(--text-muted)]" />
            {!collapsed && <span>Shortcuts</span>}
          </button>
        )}

        {currentUser && (
          <div
            className={`flex items-center gap-2 p-1.5 rounded hover:bg-[var(--ramp-1)] transition-colors ${
              collapsed ? 'justify-center p-1' : 'justify-between'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Avatar user={currentUser} size="xs" />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate leading-tight">
                    {currentUser.name || 'User'}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate leading-tight">
                    {currentUser.role || 'Member'}
                  </p>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                onClick={handleLogout}
                className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-white transition-colors"
                title="Sign out"
              >
                <LogOut size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
