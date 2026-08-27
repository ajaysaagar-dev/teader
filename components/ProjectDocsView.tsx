'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Save, 
  Eye, 
  Edit3, 
  Sparkles, 
  Layers, 
  BookOpen, 
  Check 
} from 'lucide-react';
import { toast } from 'sonner';

interface ProjectDocsViewProps {
  projectId: string | number;
  projectName?: string;
  projectKey?: string;
}

export const ProjectDocsView: React.FC<ProjectDocsViewProps> = ({
  projectId,
  projectName = 'Project Workspace',
  projectKey = 'PRJ',
}) => {
  const [docContent, setDocContent] = useState<string>(() => {
    return `# ${projectName} — Architecture & Technical Specifications

## 1. Overview & System Goals
This document serves as the single source of truth for **${projectName}** (${projectKey}).
All architectural decisions, schema conventions, and milestone deliverables are maintained here.

---

## 2. Core Architecture
- **Framework**: Next.js 16 (App Router + Turbopack)
- **State & Real-time**: React 19 Client Components with Optimistic UI updates
- **Database Layer**: MySQL 8.0 Connection Pooling with high-availability in-memory fallback
- **Authentication**: JWT HttpOnly Cookies + Role-Based Access Control

---

## 3. Workflow & Branching Conventions
- Feature Branches: \`feat/${projectKey.toLowerCase()}-<id>-<name>\`
- Fix Branches: \`fix/${projectKey.toLowerCase()}-<id>-<name>\`
- Commit Message Convention: \`feat(scope): detailed message\`

---

## 4. Key Milestones & Epics
1. **MVP Launch**: Core issue tracker & Kanban board
2. **Phase 2**: Dependency DAG graph & real-time time tracking
3. **Phase 3**: Automation rules engine & cross-project "My Work" dashboard
`;
  });

  const [isPreview, setIsPreview] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    toast.success('Project documentation saved successfully!');
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#131415] text-[#CFD4DD] font-sans select-none overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-11 px-4 bg-[#17181A] border-b border-[#2A2C30] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-[#DCB001]" />
          <span className="text-xs font-bold text-white">Project Wiki & Architecture Specs</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#131415] border border-[#2A2C30] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setIsPreview(false)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                !isPreview ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm' : 'text-[#787C83] hover:text-white'
              }`}
            >
              <Edit3 size={12} />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setIsPreview(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                isPreview ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm' : 'text-[#787C83] hover:text-white'
              }`}
            >
              <Eye size={12} />
              <span>Preview</span>
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-3 py-1 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-lg text-xs font-bold shadow-sm transition-all"
          >
            {isSaved ? <Check size={13} /> : <Save size={13} />}
            <span>{isSaved ? 'Saved' : 'Save Docs'}</span>
          </button>
        </div>
      </div>

      {/* Editor & Preview Area */}
      <div className="flex-1 p-6 overflow-y-auto max-w-5xl w-full mx-auto font-sans">
        {isPreview ? (
          <div className="p-8 bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl space-y-4 text-xs sm:text-sm text-[#CFD4DD] leading-relaxed shadow-xl">
            <div className="whitespace-pre-wrap font-sans space-y-2">
              {docContent}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <textarea
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              className="flex-1 w-full min-h-[500px] p-6 bg-[#17181A] border border-[#2A2C30] focus:border-[#DCB001] rounded-2xl text-xs sm:text-sm text-white font-mono leading-relaxed outline-none resize-none transition-colors shadow-inner"
              placeholder="Write markdown documentation, specs, and architecture plans..."
            />
          </div>
        )}
      </div>
    </div>
  );
};
