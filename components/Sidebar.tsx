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
  User
} from 'lucide-react';
import { toast } from 'sonner';

interface SidebarProps {
  onOpenNewIssue?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcuts?: () => void;
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed = false }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('teader_user');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });

  useEffect(() => {
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
    { href: '/initiatives', label: 'Initiatives', icon: Layers },
    { href: '/projects', label: 'Projects', icon: FolderKanban },
    { href: '/docs', label: 'API Docs (Swagger)', icon: FileCode },
  ];

  return (
    <aside
      className={`h-full bg-[#0F1011] text-[#9499A0] flex flex-col justify-between select-none transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      } shrink-0 overflow-hidden text-xs font-sans border-r border-[#2A2C30]`}
    >
      <div className="flex flex-col p-2 space-y-4">
        {/* Top App Header */}
        <div className="flex items-center justify-between px-2 py-2 border-b border-[#2A2C30]/50">
          <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer hover:text-[#CFD4DD]">
            <div className="w-5 h-5 rounded bg-[#DCB001] text-[#0F1011] flex items-center justify-center font-bold text-[11px] shrink-0">
              T
            </div>
            {!collapsed && (
              <span className="font-bold text-sm text-[#CFD4DD] flex items-center gap-1">
                Teader <ChevronDown size={12} className="text-[#787C83]" />
              </span>
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
                    ? 'bg-[#222427] text-[#CFD4DD] border border-[#2A2C30]'
                    : 'hover:bg-[#1A1B1D] hover:text-[#CFD4DD]'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-[#DCB001]' : 'text-[#787C83]'} />
                {!collapsed && <span>{page.label}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Logged in User Profile Footer */}
      {currentUser && (
        <div className="p-3 border-t border-[#2A2C30] bg-[#131415] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-[#DCB001] text-[#0F1011] font-bold text-xs flex items-center justify-center shrink-0">
                {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-[#CFD4DD] truncate">{currentUser.name}</span>
                  <span className="text-[10px] text-[#787C83] font-mono capitalize flex items-center gap-1">
                    {currentUser.role === 'owner' ? (
                      <ShieldCheck size={10} className="text-[#22C55E]" />
                    ) : (
                      <User size={10} className="text-[#DCB001]" />
                    )}
                    {currentUser.role === 'owner' ? 'Project Owner' : 'Team Member'}
                  </span>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                onClick={handleLogout}
                className="p-1.5 text-[#787C83] hover:text-[#C0393B] hover:bg-[#1B1C1F] rounded-lg transition-colors"
                title="Log Out"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
