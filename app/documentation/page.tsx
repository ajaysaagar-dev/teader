'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Search,
  Terminal,
  GitFork,
  Layers,
  LayoutGrid,
  FolderTree,
  Calendar,
  Zap,
  Database,
  ShieldCheck,
  MessageSquare,
  FileText,
  Cpu,
  Users,
  Map,
  Keyboard,
  ArrowRight,
  Info,
  AlertTriangle,
  Copy,
  Check,
  Home,
  ExternalLink,
  Menu,
  X,
  Sparkles,
  Download,
  FolderKanban,
  CheckCircle2,
  Lock,
  ListOrdered
} from 'lucide-react';
import { BUILD_NUMBER } from '@/lib/build-info';

interface DocSectionItem {
  id: string;
  title: string;
}

interface DocCategory {
  id: string;
  title: string;
  icon: React.ElementType;
  items: DocSectionItem[];
}

const DOC_CATEGORIES: DocCategory[] = [
  {
    id: 'getting-started',
    title: '1. Getting Started',
    icon: Sparkles,
    items: [
      { id: 'what-is-teader', title: 'What is Teader?' },
      { id: 'quick-start', title: 'Quick Start Guide' },
      { id: 'system-requirements', title: 'System Requirements' },
      { id: 'installation', title: 'Installation & Setup' },
      { id: 'demo-credentials', title: 'Demo Credentials' },
    ],
  },
  {
    id: 'authentication',
    title: '2. Authentication & Security',
    icon: ShieldCheck,
    items: [
      { id: 'auth-overview', title: 'Authentication Architecture' },
      { id: 'jwt-sessions', title: 'JWT & HttpOnly Cookies' },
      { id: 'password-hashing', title: 'Password Hashing & Bcrypt' },
      { id: 'rate-limiting', title: 'Rate Limiting Protection' },
    ],
  },
  {
    id: 'dashboard',
    title: '3. Workspace Dashboard',
    icon: LayoutGrid,
    items: [
      { id: 'dashboard-overview', title: 'Dashboard Overview' },
      { id: 'velocity-metrics', title: 'Sprint & Velocity Metrics' },
      { id: 'workspace-navigation', title: 'Workspace Navigation' },
    ],
  },
  {
    id: 'projects',
    title: '4. Projects & Workspaces',
    icon: FolderKanban,
    items: [
      { id: 'create-project', title: 'Creating a Project' },
      { id: 'project-keys', title: 'Project Keys & Unique IDs' },
      { id: 'joining-projects', title: 'Joining via Project Key' },
      { id: 'member-roles', title: 'Member Roles & Permissions' },
      { id: 'project-exports', title: 'Encrypted Project Dumps' },
    ],
  },
  {
    id: 'kanban',
    title: '5. Kanban Board View',
    icon: Layers,
    items: [
      { id: 'kanban-overview', title: 'Board Columns & States' },
      { id: 'drag-and-drop', title: 'Drag & Drop Reordering' },
      { id: 'optimistic-board', title: '0ms Optimistic Mutations' },
      { id: 'creator-guards', title: 'Done-State Creator Protection' },
    ],
  },
  {
    id: 'hierarchy',
    title: '6. Hierarchical View',
    icon: ListOrdered,
    items: [
      { id: 'hierarchy-overview', title: 'Epics, Tasks & Subtasks' },
      { id: 'tree-grouping', title: 'Grouping & Sorting Modes' },
      { id: 'progress-rollup', title: 'Subtask Progress Rollup' },
    ],
  },
  {
    id: 'tree-view',
    title: '7. Tree View & Folders',
    icon: FolderTree,
    items: [
      { id: 'tree-overview', title: 'Recursive Folder Explorer' },
      { id: 'reparenting', title: 'Drag-and-Drop Reparenting' },
      { id: 'folder-management', title: 'Creating & Managing Folders' },
    ],
  },
  {
    id: 'branch-explorer',
    title: '8. Branch Explorer Graph',
    icon: GitFork,
    items: [
      { id: 'branch-overview', title: 'Unity VCS Graph Concept' },
      { id: 'bezier-splines', title: 'Cubic Bezier Spline Engine' },
      { id: 'blocking-links', title: 'Dependencies & Merge Points' },
      { id: 'graph-controls', title: 'Drag-to-Pan & Scroll Controls' },
    ],
  },
  {
    id: 'dev-stream',
    title: '9. Dev Stream Workstation',
    icon: Terminal,
    items: [
      { id: 'devstream-overview', title: 'Developer Workstation Mode' },
      { id: 'git-command-generator', title: 'Automated Git Generator' },
      { id: 'branch-naming', title: 'Branch Naming Conventions' },
      { id: 'task-checklists', title: 'Interactive Task Checklists' },
    ],
  },
  {
    id: 'calendar',
    title: '10. Calendar & Sprints',
    icon: Calendar,
    items: [
      { id: 'calendar-overview', title: 'Sprint Calendar & Timeline' },
      { id: 'scheduling-tasks', title: 'Due Date Management' },
      { id: 'ics-export', title: 'iCalendar (.ics) Subscriptions' },
    ],
  },
  {
    id: 'dependency-graph',
    title: '11. Dependency DAG Graph',
    icon: GitFork,
    items: [
      { id: 'dag-overview', title: 'Directed Acyclic Graphs' },
      { id: 'blocking-rules', title: 'Blocking vs Blocked By' },
      { id: 'cycle-detection', title: 'Cycle Prevention Engine' },
    ],
  },
  {
    id: 'tasks-issues',
    title: '12. Tasks & Issues Engine',
    icon: CheckCircle2,
    items: [
      { id: 'issue-fields', title: 'Task Fields & Data Model' },
      { id: 'priority-levels', title: 'Priority Hierarchy (Urgent to Low)' },
      { id: 'inline-editing', title: 'Instant In-Place Editing' },
      { id: 'issue-deletion', title: 'Task Archiving & Deletion' },
    ],
  },
  {
    id: 'subtasks',
    title: '13. Subtask Hierarchy',
    icon: FolderTree,
    items: [
      { id: 'subtask-structure', title: 'Relational Subtask Model' },
      { id: 'subtask-creation', title: 'Adding & Nesting Subtasks' },
      { id: 'subtask-completion', title: 'Completion Cascades' },
    ],
  },
  {
    id: 'project-docs',
    title: '14. Live Markdown Specs',
    icon: FileText,
    items: [
      { id: 'docs-overview', title: 'Live Technical Documentation' },
      { id: 'markdown-editor', title: 'Split-Screen Markdown Editor' },
      { id: 'autosave', title: 'Instant Ctrl+S Persistence' },
    ],
  },
  {
    id: 'conversations',
    title: '15. Team Conversations',
    icon: MessageSquare,
    items: [
      { id: 'channels-overview', title: 'Real-Time Team Channels' },
      { id: 'issue-discussions', title: 'Contextual Issue Threads' },
    ],
  },
  {
    id: 'my-work',
    title: '16. My Work & Triage',
    icon: Users,
    items: [
      { id: 'my-work-overview', title: 'Personal Deliverables View' },
      { id: 'assigned-triage', title: 'Assigned Tasks & Code Reviews' },
    ],
  },
  {
    id: 'initiatives',
    title: '17. Strategic Initiatives',
    icon: Map,
    items: [
      { id: 'initiatives-overview', title: 'Multi-Project Portfolios' },
      { id: 'milestone-tracking', title: 'Milestones & Strategic Goals' },
    ],
  },
  {
    id: 'realtime-sync',
    title: '18. Real-Time Synchronization',
    icon: Zap,
    items: [
      { id: 'sse-architecture', title: 'Server-Sent Events (SSE)' },
      { id: 'cache-reconciliation', title: 'In-Memory Client Cache' },
      { id: 'smart-polling', title: 'Smart Polling & Tab Visibility' },
    ],
  },
  {
    id: 'api-reference',
    title: '19. REST API & OpenAPI',
    icon: Database,
    items: [
      { id: 'api-overview', title: 'API Endpoints & Format' },
      { id: 'api-auth', title: 'Authentication Endpoints' },
      { id: 'api-projects', title: 'Projects Endpoints' },
      { id: 'api-issues', title: 'Issues & Tasks Endpoints' },
      { id: 'api-docs', title: 'Documentation Endpoints' },
    ],
  },
  {
    id: 'keyboard-shortcuts',
    title: '20. Keyboard Shortcuts',
    icon: Keyboard,
    items: [
      { id: 'global-shortcuts', title: 'Global Shortcuts Cheatsheet' },
      { id: 'board-shortcuts', title: 'Board & View Shortcuts' },
    ],
  },
];

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-[#16181D] border border-[#2A2C30] rounded-t-xl text-[11px] font-mono text-[#8E939D]">
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 bg-[#1F2126] hover:bg-[#2A2C30] text-[#CFD4DD] hover:text-white rounded border border-[#2E3138] transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={12} className="text-[#22C55E]" />
              <span className="text-[#22C55E]">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="bg-[#0D0E11] border-x border-b border-[#2A2C30] rounded-b-xl p-4 text-xs font-mono text-[#06B6D4] overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function NoteCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 bg-[#DCB001]/10 border border-[#DCB001]/30 rounded-xl p-4 flex gap-3 text-xs text-[#E5E7EB] leading-relaxed">
      <Info size={16} className="text-[#DCB001] shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

function WarningCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 flex gap-3 text-xs text-[#FCA5A5] leading-relaxed">
      <AlertTriangle size={16} className="text-[#EF4444] shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

export default function DocumentationPage() {
  const [activeSection, setActiveSection] = useState<string>('what-is-teader');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    DOC_CATEGORIES.forEach((cat) => {
      state[cat.id] = true;
    });
    return state;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return DOC_CATEGORIES;
    const query = searchQuery.toLowerCase();
    return DOC_CATEGORIES.map((cat) => {
      const matchingItems = cat.items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          cat.title.toLowerCase().includes(query)
      );
      return {
        ...cat,
        items: matchingItems,
      };
    }).filter((cat) => cat.items.length > 0);
  }, [searchQuery]);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  // IntersectionObserver to auto-highlight active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('section[data-doc-id]');
      let currentActive = 'what-is-teader';
      sections.forEach((section) => {
        const top = section.getBoundingClientRect().top;
        if (top <= 120 && top >= -500) {
          const id = section.getAttribute('data-doc-id');
          if (id) currentActive = id;
        }
      });
      setActiveSection(currentActive);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#CFD4DD] font-sans selection:bg-[#DCB001]/30 selection:text-[#DCB001]">
      {/* ─── Top Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A0B0D]/90 border-b border-[#222428]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group" aria-label="Teader Home">
              <span className="font-extrabold text-xl text-white tracking-tight flex items-center gap-1.5 font-prompt">
                teader
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-[#1F2126] text-[#DCB001] rounded border border-[#2E3138]">
                  {BUILD_NUMBER}
                </span>
              </span>
            </Link>
            <span className="text-xs font-mono text-[#787C83] hidden sm:inline-block">/</span>
            <span className="text-xs font-semibold text-white font-mono hidden sm:inline-block">
              PLATFORM DOCUMENTATION & USER MANUAL
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16181C] hover:bg-[#1E2025] text-[#CFD4DD] hover:text-white border border-[#2A2C30] text-xs font-medium transition-colors"
            >
              <Home size={13} className="text-[#06B6D4]" />
              <span>Back to Home</span>
            </Link>

            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#DCB001] hover:bg-[#E5B800] text-[#0A0B0D] font-bold text-xs transition-all shadow-sm"
            >
              <span>Launch App</span>
              <ArrowRight size={13} />
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-[#8E939D] hover:text-white rounded-lg bg-[#16181C] border border-[#2A2C30]"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content Container ────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex">
        {/* ─── Left Sidebar Navigation ─────────────────────────── */}
        <aside
          className={`
            fixed lg:sticky top-16 z-40 w-72 h-[calc(100vh-64px)] overflow-y-auto shrink-0 bg-[#0F1011] lg:bg-transparent border-r border-[#222428] py-6 pr-4 pl-2 transition-transform duration-200
            ${mobileMenuOpen ? 'translate-x-0 left-0 shadow-2xl bg-[#0F1011]' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Search Box */}
          <div className="relative mb-5 px-2">
            <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#787C83]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documentation..."
              className="w-full pl-9 pr-3 py-2 bg-[#16181D] border border-[#2A2C30] focus:border-[#DCB001]/50 rounded-xl text-xs text-white placeholder-[#787C83] outline-none transition-all"
            />
          </div>

          {/* Categories & Items Tree */}
          <nav className="space-y-4">
            {filteredCategories.map((category) => {
              const Icon = category.icon;
              const isOpen = openCategories[category.id] !== false;

              return (
                <div key={category.id} className="space-y-1">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-mono font-bold text-[#8E939D] hover:text-white uppercase tracking-wider rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={13} className="text-[#DCB001] group-hover:scale-110 transition-transform" />
                      <span>{category.title}</span>
                    </div>
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>

                  {isOpen && (
                    <div className="pl-6 space-y-0.5 border-l border-[#222428] ml-3.5 my-1">
                      {category.items.map((item) => {
                        const isActive = activeSection === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => scrollToSection(item.id)}
                            className={`
                              w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between
                              ${
                                isActive
                                  ? 'bg-[#DCB001]/15 text-[#DCB001] font-semibold border-l-2 border-[#DCB001]'
                                  : 'text-[#8E939D] hover:text-[#CFD4DD] hover:bg-[#16181D]'
                              }
                            `}
                          >
                            <span className="truncate">{item.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* ─── Right Content Area ──────────────────────────────── */}
        <main className="flex-1 min-w-0 py-8 lg:pl-10 max-w-4xl">
          {/* Header Banner */}
          <div className="mb-12 p-8 rounded-2xl bg-gradient-to-br from-[#16181D] via-[#111215] to-[#0D0E11] border border-[#2A2C30] relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-64 h-64 bg-[#DCB001]/5 blur-[80px] rounded-full pointer-events-none" />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1F2126] border border-[#2E3138] text-[11px] text-[#DCB001] font-mono mb-4">
              <Sparkles size={12} />
              <span>Official Step-by-Step Technical Manual</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-prompt mb-3">
              Teader Platform Documentation
            </h1>
            <p className="text-sm text-[#8E939D] leading-relaxed max-w-2xl">
              Welcome to the official developer manual for Teader. Learn how to configure workspaces, manage high-velocity Kanban boards, inspect Unity VCS branch explorer graphs, write real-time Markdown docs, and interact with the REST API.
            </p>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 1: GETTING STARTED
          ══════════════════════════════════════════════════════════════ */}
          <div className="space-y-16">
            <section data-doc-id="what-is-teader" id="what-is-teader" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001] uppercase tracking-wider">
                <Sparkles size={14} />
                <span>1. Getting Started</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">What is Teader?</h2>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Teader is an AI-native, high-velocity project management platform engineered specifically for software engineering teams and autonomous AI coding agents. Unlike conventional ticketing systems, Teader delivers <strong>0ms perceived UI latency</strong> through optimistic mutations, in-memory client caches, and instant visual feedback.
              </p>
              <p className="text-sm text-[#8E939D] leading-relaxed">
                It combines the fluidity of modern issue boards with deep developer workflows: Unity VCS-style branch dependency graphs, infinite recursive task trees, developer workstation Git generators, and live Markdown technical specifications.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-[#141519] border border-[#24262B] space-y-2">
                  <div className="flex items-center gap-2 text-[#DCB001] font-semibold text-xs font-mono">
                    <Zap size={14} />
                    <span>0ms Optimistic UI</span>
                  </div>
                  <p className="text-xs text-[#8E939D] leading-relaxed">
                    Mutations apply to the local DOM immediately with referential equality caching, syncing with the PostgreSQL database in the background.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#141519] border border-[#24262B] space-y-2">
                  <div className="flex items-center gap-2 text-[#06B6D4] font-semibold text-xs font-mono">
                    <GitFork size={14} />
                    <span>Unity VCS Graph</span>
                  </div>
                  <p className="text-xs text-[#8E939D] leading-relaxed">
                    Cubic Bezier curve engine visually plots branch timelines, task dependencies, merge points, and blocking links in real time.
                  </p>
                </div>
              </div>
            </section>

            <section data-doc-id="quick-start" id="quick-start" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Quick Start Guide</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Getting started with Teader takes less than two minutes. Follow this step-by-step sequence to clone, configure, seed, and launch your local instance:
              </p>

              <CodeBlock
                language="bash"
                code={`# 1. Clone the repository
git clone https://github.com/ajaysaagar-dev/teader.git
cd teader/teader-web

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Initialize database schema & demo records
npm run db:setup

# 5. Start development server with Turbopack
npm run dev`}
              />

              <p className="text-xs text-[#8E939D]">
                Once running, visit <code className="text-[#DCB001]">http://localhost:3000</code> in your browser.
              </p>
            </section>

            <section data-doc-id="system-requirements" id="system-requirements" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">System Requirements</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse border border-[#24262B] rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-[#16181D] text-[#8E939D] border-b border-[#24262B]">
                      <th className="p-3 font-mono">Requirement</th>
                      <th className="p-3 font-mono">Minimum Version</th>
                      <th className="p-3 font-mono">Recommended</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#24262B] bg-[#111215] text-[#CFD4DD]">
                    <tr>
                      <td className="p-3 font-semibold text-white">Node.js Runtime</td>
                      <td className="p-3 font-mono text-[#06B6D4]">v20.10.0 LTS</td>
                      <td className="p-3 font-mono text-[#DCB001]">v22.x LTS</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-white">Database Engine</td>
                      <td className="p-3 font-mono text-[#06B6D4]">PostgreSQL 14+ / MySQL 8+</td>
                      <td className="p-3 font-mono text-[#DCB001]">PostgreSQL 16</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-white">Package Manager</td>
                      <td className="p-3 font-mono text-[#06B6D4]">npm v10+</td>
                      <td className="p-3 font-mono text-[#DCB001]">npm v10+ / pnpm v9+</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-white">Web Browser</td>
                      <td className="p-3 font-mono text-[#06B6D4]">Chromium 110+, Firefox 115+, Safari 17+</td>
                      <td className="p-3 font-mono text-[#DCB001]">Latest Chromium / Desktop App</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section data-doc-id="installation" id="installation" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Installation & Setup</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Generate a cryptographically secure 64-byte random secret for JWT token signing before starting the server:
              </p>
              <CodeBlock
                language="bash"
                code={`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`}
              />
              <p className="text-sm text-[#8E939D] leading-relaxed">
                Paste the resulting string into your <code className="text-[#06B6D4]">.env</code> file under the <code className="text-[#DCB001]">JWT_SECRET</code> key.
              </p>
            </section>

            <section data-doc-id="demo-credentials" id="demo-credentials" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Demo Credentials</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                When you run <code className="text-[#06B6D4]">npm run db:setup</code>, the database seeds the following sample accounts for immediate testing:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#141519] border border-[#24262B] space-y-1.5 font-mono text-xs">
                  <div className="text-[#DCB001] font-bold">Admin Account</div>
                  <div className="text-white">Email: <span className="text-[#06B6D4]">ajaysaagar@teader.io</span></div>
                  <div className="text-white">Password: <span className="text-[#06B6D4]">password123</span></div>
                  <div className="text-[#787C83] text-[10px]">Full owner permissions across demo projects.</div>
                </div>
                <div className="p-4 rounded-xl bg-[#141519] border border-[#24262B] space-y-1.5 font-mono text-xs">
                  <div className="text-[#DCB001] font-bold">Developer Account</div>
                  <div className="text-white">Email: <span className="text-[#06B6D4]">karri@teader.io</span></div>
                  <div className="text-white">Password: <span className="text-[#06B6D4]">password123</span></div>
                  <div className="text-[#787C83] text-[10px]">Member contributor role with task edit rights.</div>
                </div>
              </div>
            </section>

            <div className="border-b border-[#222428]" />

            {/* ══════════════════════════════════════════════════════════════
                SECTION 2: AUTHENTICATION & SECURITY
            ══════════════════════════════════════════════════════════════ */}
            <section data-doc-id="auth-overview" id="auth-overview" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001] uppercase tracking-wider">
                <ShieldCheck size={14} />
                <span>2. Authentication & Security</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Authentication Architecture</h2>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Teader enforces enterprise-grade security primitives across all endpoints. Authentication is entirely stateless and handled via JSON Web Tokens signed with HMAC-SHA256, sealed inside secure, SameSite cookies.
              </p>
            </section>

            <section data-doc-id="jwt-sessions" id="jwt-sessions" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">JWT & HttpOnly Cookies</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Upon successful login via <code className="text-[#06B6D4]">/api/auth/login</code>, the server responds with a signed cookie named <code className="text-[#DCB001]">teader_session</code> configured with:
              </p>
              <ul className="list-disc pl-5 text-xs text-[#8E939D] space-y-1.5">
                <li><strong className="text-white">HttpOnly: true</strong> — Immune to client-side XSS cookie extraction.</li>
                <li><strong className="text-white">SameSite: Lax</strong> — Protects against Cross-Site Request Forgery (CSRF).</li>
                <li><strong className="text-white">Max-Age: 7 Days</strong> — Persistent session validity with seamless refresh.</li>
              </ul>
            </section>

            <section data-doc-id="password-hashing" id="password-hashing" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Password Hashing & Bcrypt</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                All user passwords are encrypted using Bcrypt with a work factor of <strong>12 rounds</strong>. During authentication, legacy SHA-256 password records are transparently migrated to Bcrypt on first successful login without disrupting user sessions.
              </p>
            </section>

            <section data-doc-id="rate-limiting" id="rate-limiting" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Rate Limiting Protection</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                To prevent brute-force credential stuffing, authentication routes employ an in-memory sliding window rate limiter:
              </p>
              <NoteCallout>
                <strong>Rate Limit Rule:</strong> Maximum of <strong>10 attempts per 15-minute window</strong> per combined client IP address and email identity. Exceeding this limit returns HTTP 429 Too Many Requests with a retry countdown.
              </NoteCallout>
            </section>

            <div className="border-b border-[#222428]" />

            {/* ══════════════════════════════════════════════════════════════
                SECTION 3: WORKSPACE DASHBOARD
            ══════════════════════════════════════════════════════════════ */}
            <section data-doc-id="dashboard-overview" id="dashboard-overview" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001] uppercase tracking-wider">
                <LayoutGrid size={14} />
                <span>3. Workspace Dashboard</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Dashboard Overview</h2>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                The Dashboard (<code className="text-[#06B6D4]">/dashboard</code>) is your operational command center. It aggregates real-time metrics across all active projects, highlighting urgent blockers, recent commits, personal assignments, and sprint velocity.
              </p>
            </section>

            <section data-doc-id="velocity-metrics" id="velocity-metrics" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Sprint & Velocity Metrics</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                The dashboard automatically computes:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3.5 bg-[#141519] border border-[#24262B] rounded-xl text-center space-y-1">
                  <div className="text-[10px] font-mono text-[#787C83] uppercase">Cycle Velocity</div>
                  <div className="text-xl font-bold text-[#22C55E]">94.2%</div>
                  <div className="text-[10px] text-[#8E939D]">Sprint on-time completion</div>
                </div>
                <div className="p-3.5 bg-[#141519] border border-[#24262B] rounded-xl text-center space-y-1">
                  <div className="text-[10px] font-mono text-[#787C83] uppercase">Active Issues</div>
                  <div className="text-xl font-bold text-[#DCB001]">38 Tasks</div>
                  <div className="text-[10px] text-[#8E939D]">Across 4 repositories</div>
                </div>
                <div className="p-3.5 bg-[#141519] border border-[#24262B] rounded-xl text-center space-y-1">
                  <div className="text-[10px] font-mono text-[#787C83] uppercase">Blocked Nodes</div>
                  <div className="text-xl font-bold text-[#EF4444]">2 Critical</div>
                  <div className="text-[10px] text-[#8E939D]">Awaiting upstream merge</div>
                </div>
              </div>
            </section>

            <section data-doc-id="workspace-navigation" id="workspace-navigation" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Workspace Navigation</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Press <kbd className="px-2 py-0.5 text-[10px] font-mono bg-[#1B1C1F] border border-[#2A2C30] rounded text-[#CFD4DD]">⌘K</kbd> or <kbd className="px-2 py-0.5 text-[10px] font-mono bg-[#1B1C1F] border border-[#2A2C30] rounded text-[#CFD4DD]">Ctrl+K</kbd> anywhere in the application to launch Quick Search and jump directly to any project, task key, or Markdown doc.
              </p>
            </section>

            <div className="border-b border-[#222428]" />

            {/* ══════════════════════════════════════════════════════════════
                SECTION 4: PROJECTS & WORKSPACES
            ══════════════════════════════════════════════════════════════ */}
            <section data-doc-id="create-project" id="create-project" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001] uppercase tracking-wider">
                <FolderKanban size={14} />
                <span>4. Projects & Workspaces</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Creating a Project</h2>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                To create a new workspace project, navigate to <code className="text-[#06B6D4]">/projects</code> and click <strong>+ New Project</strong>. Provide a project name, description, and key prefix.
              </p>
            </section>

            <section data-doc-id="project-keys" id="project-keys" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Project Keys & Unique IDs</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Every project generates a unique uppercase key (e.g. <code className="text-[#DCB001]">TED</code>, <code className="text-[#DCB001]">CORE</code>, <code className="text-[#DCB001]">GRAPH</code>). All child tasks inherit this key prefix followed by an auto-incrementing serial number (e.g., <code className="text-[#06B6D4]">TED-104</code>).
              </p>
            </section>

            <section data-doc-id="joining-projects" id="joining-projects" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Joining via Project Key</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Teammates can join any existing workspace without invitation links by entering the Project Key in the <strong>Join Project</strong> modal. Once verified, the project immediately appears on their dashboard.
              </p>
            </section>

            <section data-doc-id="member-roles" id="member-roles" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Member Roles & Permissions</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border border-[#24262B] rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-[#16181D] text-[#8E939D] border-b border-[#24262B]">
                      <th className="p-3 font-mono">Role</th>
                      <th className="p-3 font-mono">Create Tasks</th>
                      <th className="p-3 font-mono">Move to Done</th>
                      <th className="p-3 font-mono">Delete Project</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#24262B] bg-[#111215] text-[#CFD4DD]">
                    <tr>
                      <td className="p-3 font-semibold text-[#DCB001]">Owner / Creator</td>
                      <td className="p-3 text-[#22C55E]">✓ Allowed</td>
                      <td className="p-3 text-[#22C55E]">✓ Allowed</td>
                      <td className="p-3 text-[#22C55E]">✓ Allowed</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-white">Joined Member</td>
                      <td className="p-3 text-[#22C55E]">✓ Allowed</td>
                      <td className="p-3 text-[#EF4444]">✗ Creator Only</td>
                      <td className="p-3 text-[#EF4444]">✗ Creator Only</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section data-doc-id="project-exports" id="project-exports" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Encrypted Project Dumps (.teaderdumpfile)</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Export an entire workspace including all tasks, subtask hierarchies, Markdown specs, and member mappings into an encrypted binary bundle with AES-256-GCM cipher and SHA-256 integrity checksums.
              </p>
            </section>

            <div className="border-b border-[#222428]" />

            {/* ══════════════════════════════════════════════════════════════
                SECTION 5: KANBAN BOARD VIEW
            ══════════════════════════════════════════════════════════════ */}
            <section data-doc-id="kanban-overview" id="kanban-overview" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001] uppercase tracking-wider">
                <Layers size={14} />
                <span>5. Kanban Board View</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Board Columns & States</h2>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                The Kanban Board organizes work across four progressive lifecycle states:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-3 bg-[#16181D] border border-[#2A2C30] rounded-xl text-center">
                  <div className="text-[#8E939D]">1. TODO</div>
                  <div className="text-[10px] text-[#787C83]">Backlog items</div>
                </div>
                <div className="p-3 bg-[#16181D] border border-[#2A2C30] rounded-xl text-center">
                  <div className="text-[#06B6D4]">2. IN PROGRESS</div>
                  <div className="text-[10px] text-[#787C83]">Active development</div>
                </div>
                <div className="p-3 bg-[#16181D] border border-[#2A2C30] rounded-xl text-center">
                  <div className="text-[#A855F7]">3. IN REVIEW</div>
                  <div className="text-[10px] text-[#787C83]">Code review & QA</div>
                </div>
                <div className="p-3 bg-[#16181D] border border-[#2A2C30] rounded-xl text-center">
                  <div className="text-[#22C55E]">4. DONE</div>
                  <div className="text-[10px] text-[#787C83]">Verified & shipped</div>
                </div>
              </div>
            </section>

            <section data-doc-id="drag-and-drop" id="drag-and-drop" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Drag & Drop Reordering</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Cards support smooth drag-and-drop using hardware-accelerated pointer events. Moving a card immediately calculates the new sequence index and dispatches a bulk reorder payload to <code className="text-[#06B6D4]">/api/issues/reorder</code> in the background.
              </p>
            </section>

            <section data-doc-id="optimistic-board" id="optimistic-board" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">0ms Optimistic Mutations</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                When you drag a task between columns, the UI reparents the DOM element instantaneously (0ms lag). If a network failure occurs, the state engine rolls back to the cached snapshot and displays a notification.
              </p>
            </section>

            <section data-doc-id="creator-guards" id="creator-guards" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Done-State Creator Protection</h3>
              <WarningCallout>
                <strong>Permission Guard:</strong> To maintain delivery governance, only the <strong>Project Creator</strong> can move tasks into the <strong>Done</strong> column. If a contributor attempts to mark a task as Done, the system prompts them to move it to <strong>In Review</strong> instead.
              </WarningCallout>
            </section>

            <div className="border-b border-[#222428]" />

            {/* ══════════════════════════════════════════════════════════════
                SECTION 8: BRANCH EXPLORER GRAPH
            ══════════════════════════════════════════════════════════════ */}
            <section data-doc-id="branch-overview" id="branch-overview" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001] uppercase tracking-wider">
                <GitFork size={14} />
                <span>8. Branch Explorer Graph</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Unity VCS Graph Concept</h2>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                The Branch Explorer is a visual version control timeline modeled after Unity Version Control (Plastic SCM). It plots branches as horizontal subway-style lines that diverge from the main branch and converge upon merge completion.
              </p>
            </section>

            <section data-doc-id="bezier-splines" id="bezier-splines" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Cubic Bezier Spline Engine</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Connections between parent tasks, child branches, and dependency nodes are drawn using SVG cubic Bezier curves (<code className="text-[#06B6D4]">M x1 y1 C cx1 cy1, cx2 cy2, x2 y2</code>) with ease-in-ease-out smoothing.
              </p>
            </section>

            <section data-doc-id="graph-controls" id="graph-controls" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Drag-to-Pan & Scroll Controls</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Navigate massive dependency graphs effortlessly:
              </p>
              <ul className="list-disc pl-5 text-xs text-[#8E939D] space-y-1">
                <li><strong>Click & Drag Canvas:</strong> Pan the graph horizontally and vertically.</li>
                <li><strong>Trackpad Two-Finger Swipe:</strong> Smooth momentum panning.</li>
                <li><strong>Pan Buttons:</strong> Dedicated left and right navigation buttons on the graph toolbar.</li>
              </ul>
            </section>

            <div className="border-b border-[#222428]" />

            {/* ══════════════════════════════════════════════════════════════
                SECTION 9: DEV STREAM WORKSTATION
            ══════════════════════════════════════════════════════════════ */}
            <section data-doc-id="devstream-overview" id="devstream-overview" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001] uppercase tracking-wider">
                <Terminal size={14} />
                <span>9. Dev Stream Workstation</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Developer Workstation Mode</h2>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Dev Stream transforms Teader into a focused workstation HUD for active coding. Selecting any task displays generated Git terminal commands, branch suggestions, and checklist steps.
              </p>
            </section>

            <section data-doc-id="git-command-generator" id="git-command-generator" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Automated Git Command Generator</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                With a single click, copy standard Git commands formatted with the active task key and title slug:
              </p>
              <CodeBlock
                language="bash"
                code={`# Generated for Task TED-104: Add OAuth2 Provider
git checkout -b feature/TED-104-add-oauth2-provider
git add .
git commit -m "feat(auth): implement oauth2 provider flow [TED-104]"
git push origin feature/TED-104-add-oauth2-provider`}
              />
            </section>

            <div className="border-b border-[#222428]" />

            {/* ══════════════════════════════════════════════════════════════
                SECTION 14: LIVE MARKDOWN PROJECT DOCS
            ══════════════════════════════════════════════════════════════ */}
            <section data-doc-id="docs-overview" id="docs-overview" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001] uppercase tracking-wider">
                <FileText size={14} />
                <span>14. Live Markdown Specs</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Live Technical Documentation</h2>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Teader features a built-in technical wiki for architecture specs, RFCs, and API documentation directly within each workspace.
              </p>
            </section>

            <section data-doc-id="markdown-editor" id="markdown-editor" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Split-Screen Markdown Editor</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Write in GitHub-flavored Markdown with support for code syntax highlighting, tables, task lists, and mathematical notation. Preview changes side-by-side in real time.
              </p>
            </section>

            <section data-doc-id="autosave" id="autosave" className="scroll-mt-24 space-y-4">
              <h3 className="text-xl font-bold text-white">Instant Ctrl+S Persistence</h3>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Press <kbd className="px-2 py-0.5 text-[10px] font-mono bg-[#1B1C1F] border border-[#2A2C30] rounded text-[#CFD4DD]">Ctrl+S</kbd> to persist changes immediately to PostgreSQL. A floating indicator confirms database synchronization status.
              </p>
            </section>

            <div className="border-b border-[#222428]" />

            {/* ══════════════════════════════════════════════════════════════
                SECTION 18: REAL-TIME SYNCHRONIZATION
            ══════════════════════════════════════════════════════════════ */}
            <section data-doc-id="sse-architecture" id="sse-architecture" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001] uppercase tracking-wider">
                <Zap size={14} />
                <span>18. Real-Time Synchronization</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Server-Sent Events (SSE)</h2>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Teader establishes an HTTP persistent stream over <code className="text-[#06B6D4]">/api/realtime/stream</code>. Team updates dispatch event payloads including:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="p-2.5 bg-[#16181D] border border-[#2A2C30] rounded-lg text-[#06B6D4]">TASK_CREATED</div>
                <div className="p-2.5 bg-[#16181D] border border-[#2A2C30] rounded-lg text-[#22C55E]">TASK_UPDATED</div>
                <div className="p-2.5 bg-[#16181D] border border-[#2A2C30] rounded-lg text-[#DCB001]">TASKS_REORDERED</div>
                <div className="p-2.5 bg-[#16181D] border border-[#2A2C30] rounded-lg text-[#EF4444]">TASK_DELETED</div>
                <div className="p-2.5 bg-[#16181D] border border-[#2A2C30] rounded-lg text-[#A855F7]">SUBTASK_UPDATED</div>
                <div className="p-2.5 bg-[#16181D] border border-[#2A2C30] rounded-lg text-[#3B82F6]">PROJECT_UPDATED</div>
              </div>
            </section>

            <div className="border-b border-[#222428]" />

            {/* ══════════════════════════════════════════════════════════════
                SECTION 19: REST API & OPENAPI
            ══════════════════════════════════════════════════════════════ */}
            <section data-doc-id="api-overview" id="api-overview" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001] uppercase tracking-wider">
                <Database size={14} />
                <span>19. REST API & OpenAPI</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">REST API & Endpoints</h2>
              <p className="text-sm text-[#CFD4DD] leading-relaxed">
                Teader provides a comprehensive REST API for automation, CI/CD pipelines, and autonomous AI agents to manage projects, tasks, comments, and real-time state.
              </p>

              <div className="space-y-3 pt-2">
                <div className="p-3 rounded-xl bg-[#141519] border border-[#24262B] font-mono text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#22C55E]/15 text-[#22C55E] font-bold">GET</span>
                    <span className="text-white">/api/projects</span>
                  </div>
                  <span className="text-[#787C83] text-[11px]">List user projects</span>
                </div>
                <div className="p-3 rounded-xl bg-[#141519] border border-[#24262B] font-mono text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#3B82F6]/15 text-[#3B82F6] font-bold">POST</span>
                    <span className="text-white">/api/issues</span>
                  </div>
                  <span className="text-[#787C83] text-[11px]">Create new task</span>
                </div>
                <div className="p-3 rounded-xl bg-[#141519] border border-[#24262B] font-mono text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#DCB001]/15 text-[#DCB001] font-bold">PATCH</span>
                    <span className="text-white">/api/issues/:id</span>
                  </div>
                  <span className="text-[#787C83] text-[11px]">Update task fields</span>
                </div>
                <div className="p-3 rounded-xl bg-[#141519] border border-[#24262B] font-mono text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#EF4444]/15 text-[#EF4444] font-bold">DELETE</span>
                    <span className="text-white">/api/issues/:id</span>
                  </div>
                  <span className="text-[#787C83] text-[11px]">Delete task record</span>
                </div>
              </div>
            </section>

            <div className="border-b border-[#222428]" />

            {/* ══════════════════════════════════════════════════════════════
                SECTION 20: KEYBOARD SHORTCUTS
            ══════════════════════════════════════════════════════════════ */}
            <section data-doc-id="global-shortcuts" id="global-shortcuts" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001] uppercase tracking-wider">
                <Keyboard size={14} />
                <span>20. Keyboard Shortcuts</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Global Shortcuts Cheatsheet</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border border-[#24262B] rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-[#16181D] text-[#8E939D] border-b border-[#24262B]">
                      <th className="p-3 font-mono">Shortcut</th>
                      <th className="p-3 font-mono">Action</th>
                      <th className="p-3 font-mono">Scope</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#24262B] bg-[#111215] text-[#CFD4DD] font-mono">
                    <tr>
                      <td className="p-3 text-[#DCB001]">⌘K / Ctrl+K</td>
                      <td className="p-3 text-white">Open Quick Search & Command Palette</td>
                      <td className="p-3 text-[#8E939D]">Global</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-[#DCB001]">?</td>
                      <td className="p-3 text-white">Open Keyboard Shortcuts Modal</td>
                      <td className="p-3 text-[#8E939D]">Global</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-[#DCB001]">Escape</td>
                      <td className="p-3 text-white">Close modals, panels & deselect tasks</td>
                      <td className="p-3 text-[#8E939D]">Global</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-[#DCB001]">Ctrl+S</td>
                      <td className="p-3 text-white">Save technical documentation changes</td>
                      <td className="p-3 text-[#8E939D]">Docs View</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-[#DCB001]">N</td>
                      <td className="p-3 text-white">Create new task in active column</td>
                      <td className="p-3 text-[#8E939D]">Board View</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
