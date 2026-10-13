'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Settings,
  Keyboard,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Cpu,
  Workflow
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
    { href: '/my-work', label: 'Commitments', icon: CheckSquare },
    { href: '/projects', label: 'Projects', icon: Workflow },
  ];

  return (
    <aside
      className={`h-full bg-[var(--bg-sidebar)] text-[var(--text-secondary)] flex flex-col justify-between select-none transition-all duration-150 ${
        collapsed ? 'w-14' : 'w-60'
      } shrink-0 overflow-hidden text-xs font-sans border-r border-[var(--border-primary)] z-30`}
    >
      {/* Top Header & Links */}
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden">

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
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={item.label}
              >
                <Icon size={14} className={isActive ? 'text-[var(--accent)] shrink-0' : 'text-[var(--text-muted)] shrink-0'} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Projects Section */}
        <div className="px-2 pt-2 pb-1 border-t border-[var(--border-subtle)] flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] shrink-0">
            {!collapsed && <span>Projects</span>}
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
      </div>
    </aside>
  );
};
