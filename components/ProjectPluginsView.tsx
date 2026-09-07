'use client';

import React, { useState } from 'react';
import { Search, Blocks, X, CheckCircle2 } from 'lucide-react';

export interface PluginItem {
  id: string;
  name: string;
  iconBg: string;
  iconColor: string;
  badge?: string;
  description?: string;
}

const PLUGINS: PluginItem[] = [
  {
    id: 'github',
    name: 'Github',
    iconBg: 'bg-[#24292F]/20 border-[#30363D]',
    iconColor: 'text-white',
    badge: 'Version Control',
    description: 'Connect GitHub repositories, sync commits, and track pull requests directly within tasks.'
  },
  {
    id: 'unity-version-control',
    name: 'Unity Version Control',
    iconBg: 'bg-[#000000]/40 border-[#2A2C30]',
    iconColor: 'text-white',
    badge: 'Plastic SCM',
    description: 'Track Plastic SCM changesets, sync branch explorer history, and view Unity asset modifications.'
  }
];

function GithubIcon({ size = 44, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Github Logo"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function UnityVersionControlIcon({ size = 44, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Unity Version Control Logo"
    >
      <path d="M10.407 2.054v3.639l3.054 1.764-3.054 1.763v3.64l6.305-3.641V5.695l-6.305-3.641zm-1.815 1.048L2.287 6.743v7.282l6.305 3.641v-3.64l-3.054-1.764 3.054-1.763V3.102zm8.799 8.688l-3.054 1.763v3.64l6.305-3.641V6.993l-3.251 1.878v2.919zm-6.984 4.757l3.054 1.764-3.054 1.763-3.054-1.763 3.054-1.764zm0-2.428l-6.305 3.641 6.305 3.641 6.305-3.641-6.305-3.641z" />
    </svg>
  );
}

interface ProjectPluginsViewProps {
  projectId: number | string;
  projectName?: string;
  projectKey?: string;
}

export function ProjectPluginsView({ projectId, projectName }: ProjectPluginsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState<PluginItem | null>(null);

  const filteredPlugins = PLUGINS.filter((plugin) =>
    plugin.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0D0E11] overflow-hidden select-none">
      {/* ── Header Bar ─────────────────────────────────────────── */}
      <div className="h-14 px-6 border-b border-[#2A2C30] flex items-center justify-between shrink-0 bg-[#141517]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#DCB001]/10 border border-[#DCB001]/30 flex items-center justify-center text-[#DCB001]">
            <Blocks size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">Plugins</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2A2C30] text-[#DCB001] font-mono font-medium">
                {PLUGINS.length}
              </span>
            </div>
            <p className="text-[11px] text-[#787C83]">
              Project developer integrations &amp; version control tools
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-64 max-w-full">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#787C83]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plugins..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#1B1C20] border border-[#2A2C30] rounded-xl text-xs text-white placeholder-[#787C83] focus:outline-none focus:border-[#DCB001]/60 focus:ring-1 focus:ring-[#DCB001]/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#787C83] hover:text-white cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Main Catalog: Initially Shows List of Only Icon and Name ── */}
      <div className="flex-1 flex flex-col items-center justify-center h-full min-h-0 overflow-y-auto p-6 md:p-12 custom-scrollbar">
        {filteredPlugins.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-8 max-w-2xl w-full">
            {filteredPlugins.map((plugin) => (
              <button
                key={plugin.id}
                onClick={() => setSelectedPlugin(plugin)}
                className="flex flex-col items-center justify-center p-8 rounded-3xl bg-[#1B1C20] hover:bg-[#2A2C30] border border-[#2A2C30] hover:border-[#DCB001]/50 transition-all duration-200 hover:scale-105 hover:shadow-2xl w-56 h-56 cursor-pointer group shadow-md"
                title={`Open ${plugin.name}`}
              >
                {/* Plugin Icon */}
                <div
                  className={`w-24 h-24 rounded-2xl flex items-center justify-center border ${plugin.iconBg} ${plugin.iconColor} mb-4 transition-transform group-hover:scale-110 shadow-lg`}
                >
                  {plugin.id === 'github' ? (
                    <GithubIcon size={52} />
                  ) : (
                    <UnityVersionControlIcon size={52} />
                  )}
                </div>

                {/* Plugin Name Only */}
                <span className="text-base font-semibold text-white group-hover:text-[#DCB001] transition-colors text-center">
                  {plugin.name}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 text-[#787C83]">
            <Blocks size={32} className="mb-2 opacity-40" />
            <p className="text-sm font-medium text-white mb-1">No plugins found</p>
            <p className="text-xs">No plugin matched &quot;{searchQuery}&quot;</p>
          </div>
        )}
      </div>

      {/* ── Plugin Detail Modal ─────────────────────────────────── */}
      {selectedPlugin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#18191E] border border-[#2A2C30] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 relative">
            <button
              onClick={() => setSelectedPlugin(null)}
              className="absolute top-4 right-4 text-[#787C83] hover:text-white p-1 rounded-lg hover:bg-[#2A2C30] transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center text-center pt-2">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center border ${selectedPlugin.iconBg} ${selectedPlugin.iconColor} mb-4 shadow-md`}
              >
                {selectedPlugin.id === 'github' ? (
                  <GithubIcon size={44} />
                ) : (
                  <UnityVersionControlIcon size={44} />
                )}
              </div>

              <h3 className="text-lg font-bold text-white mb-1">{selectedPlugin.name}</h3>
              {selectedPlugin.badge && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#DCB001]/10 text-[#DCB001] border border-[#DCB001]/20 font-medium mb-3">
                  {selectedPlugin.badge}
                </span>
              )}

              <p className="text-xs text-[#9DA4AE] leading-relaxed mb-6 max-w-xs">
                {selectedPlugin.description}
              </p>

              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setSelectedPlugin(null)}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-[#CFD4DD] bg-[#222428] hover:bg-[#2A2C30] border border-[#2A2C30] rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => setSelectedPlugin(null)}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-black bg-[#DCB001] hover:bg-[#E5B800] rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <CheckCircle2 size={13} />
                  <span>Configure</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
