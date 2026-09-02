'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Layers, 
  FolderKanban, 
  ChevronDown,
  FileCode,
  LogOut,
  ShieldCheck,
  User,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { getDesktopInfo } from '@/lib/desktop';

interface SidebarProps {
  onOpenNewIssue?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcuts?: () => void;
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed = false }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [desktopInfo, setDesktopInfo] = useState<{ isDesktop: boolean; version: string | null }>({
    isDesktop: false,
    version: null,
  });

  useEffect(() => {
    setDesktopInfo(getDesktopInfo());
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem('teader_user');
      if (cached) setCurrentUser(JSON.parse(cached));
    } catch {}

    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          try {
            localStorage.setItem('teader_user', JSON.stringify(data.user));
          } catch {}
        } else if (pathname !== '/login' && pathname !== '/register') {
          try {
            localStorage.removeItem('teader_user');
            localStorage.removeItem('teader_token');
          } catch {}
          router.push('/login');
        }
      })

      .catch(() => {
        if (pathname !== '/login' && pathname !== '/register') {
          try {
            localStorage.removeItem('teader_user');
            localStorage.removeItem('teader_token');
          } catch {}
          router.push('/login');
        }
      });
  }, [pathname, router]);

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


  const pages = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/projects', label: 'Projects', icon: FolderKanban },
  ];


  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      <aside
        className={`h-full bg-[var(--bg-sidebar)] text-[var(--text-secondary)] flex flex-col justify-between select-none transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        } shrink-0 overflow-hidden text-xs font-sans border-r border-[var(--border-primary)]`}
      >
        <div className="flex flex-col p-2 space-y-4">
          {/* Top App Header */}
          <div className="flex items-center justify-between px-2 py-2 border-b border-[var(--border-primary)]/50">
            <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer hover:text-[var(--text-primary)]">
              {!collapsed && (
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-1">
                    Teader <ChevronDown size={12} className="text-[var(--text-muted)]" />
                  </span>
                  {desktopInfo.isDesktop && desktopInfo.version && (
                    <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-[var(--accent-yellow)] border border-[var(--border-primary)]">
                      v{desktopInfo.version}
                    </span>
                  )}
                </div>
              )}
            </Link>
          </div>


        {/* Sidebar Navigation Links */}
        <div className="space-y-1">
          {pages.map((page) => {
            const Icon = page.icon;
            const isActive = pathname === page.href || (pathname === '/' && page.href === '/dashboard');
            return (
              <Link
                key={page.href}
                href={page.href}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-primary)]'
                    : 'hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-[var(--accent-yellow)]' : 'text-[var(--text-muted)]'} />
                {!collapsed && <span>{page.label}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Logged in User Profile Footer */}
      {currentUser && (
        <div className="p-3 border-t border-[var(--border-primary)] bg-[var(--bg-main)] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-[var(--accent-yellow)] text-[var(--bg-sidebar)] font-bold text-xs flex items-center justify-center shrink-0">
                {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{currentUser.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono capitalize flex items-center gap-1">
                    {currentUser.role === 'owner' ? (
                      <ShieldCheck size={10} className="text-[var(--success)]" />
                    ) : (
                      <User size={10} className="text-[var(--accent-yellow)]" />
                    )}
                    {currentUser.role === 'owner' ? 'Project Owner' : 'Team Member'}
                  </span>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                onClick={handleLogout}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-card)] rounded-lg transition-colors"
                title="Log Out"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
    </>
  );
};

