'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { IssueDetailView } from '@/components/IssueDetailView';
import { Issue, Status } from '@/lib/types';
import { MOCK_ISSUES } from '@/lib/mock-data';
import { RandomLoadingText } from '@/components/ui/RandomLoadingText';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Check } from 'lucide-react';

export default function TaskDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const issueId = params?.id as string;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [project, setProject] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    // 1. Fetch current user
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setCurrentUser(data.user);
      })
      .catch(() => {});

    // 2. Fetch issue data
    if (!issueId) {
      setLoading(false);
      return;
    }

    fetch('/api/issues')
      .then((res) => res.json())
      .then(async (data) => {
        let found: Issue | null = null;
        if (Array.isArray(data)) {
          found = data.find((i: Issue) => String(i.id) === String(issueId) || i.key?.toLowerCase() === issueId?.toLowerCase()) || null;
        }

        if (!found) {
          const fallback = MOCK_ISSUES.find((i) => String(i.id) === String(issueId) || i.key?.toLowerCase() === issueId?.toLowerCase());
          found = fallback || null;
        }

        setIssue(found);

        // 3. Fetch project details if projectId exists
        if (found?.projectId) {
          try {
            const pRes = await fetch(`/api/projects/${found.projectId}`);
            if (pRes.ok) {
              const pData = await pRes.json();
              setProject(pData);
            }
          } catch {}
        }
      })
      .catch(() => {
        const fallback = MOCK_ISSUES.find((i) => String(i.id) === String(issueId) || i.key?.toLowerCase() === issueId?.toLowerCase());
        setIssue(fallback || null);
      })
      .finally(() => setLoading(false));
  }, [issueId]);

  const isOwner = useMemo(() => {
    if (!project || !currentUser) return true;
    return (
      project.createdById === currentUser.id ||
      project.ownerName?.toLowerCase() === currentUser.name?.toLowerCase() ||
      project.ownerName?.toLowerCase() === currentUser.email?.toLowerCase()
    );
  }, [project, currentUser]);

  const handleUpdateStatus = async (newStatus: Status) => {
    if (!issue) return;
    setIssue({ ...issue, status: newStatus });

    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(`Updated status to ${newStatus.replace('_', ' ')}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleUpdateIssue = (updatedIssue: Issue) => {
    setIssue(updatedIssue);
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined' && issue) {
      const url = `${window.location.origin}/task/${issue.id}/details`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Task details link copied to clipboard');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleBack = () => {
    if (issue?.projectId) {
      router.push(`/projects/${issue.projectId}`);
    } else {
      router.push('/projects');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center bg-[#131415] text-[#CFD4DD] font-mono text-xs gap-3 p-6 select-none">
          <div className="w-8 h-8 rounded-full border-2 border-[#DCB001] border-t-transparent animate-spin" />
          <span className="font-bold text-white tracking-tight">Loading task details...</span>
          <RandomLoadingText />
        </div>
      </AppLayout>
    );
  }

  if (!issue) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center bg-[#131415] text-[#787C83] font-mono text-xs space-y-4">
          <div className="p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30] text-center space-y-2 max-w-sm">
            <span className="text-white font-bold block text-sm">Task Not Found</span>
            <p className="text-xs text-[#787C83]">The requested task #{issueId} could not be located or has been deleted.</p>
          </div>
          <button
            onClick={() => router.push('/projects')}
            className="px-3.5 py-2 bg-[#1E1E1E] hover:bg-[#2A2C30] text-[#CFD4DD] hover:text-white border border-[#3B3D41] rounded-lg transition-colors font-semibold text-xs flex items-center gap-1.5"
          >
            <ArrowLeft size={13} />
            <span>Back to Projects</span>
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top Header / Navigation Bar */}
        <div className="px-4 py-2 bg-[#131415] border-b border-[#2A2C30] flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBack}
              className="text-xs text-[#787C83] hover:text-[#CFD4DD] font-mono flex items-center gap-1.5 transition-colors shrink-0"
              title="Return to project board"
            >
              <ArrowLeft size={13} />
              <span>Back to {project ? project.name : 'Projects'}</span>
            </button>

            <span className="text-[#2A2C30]">/</span>

            {/* Breadcrumb info */}
            <div className="flex items-center gap-2 font-mono text-xs truncate">
              {project && (
                <button
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="text-[#787C83] hover:text-[#DCB001] transition-colors truncate max-w-[140px]"
                >
                  {project.key}
                </button>
              )}
              {project && <span className="text-[#787C83]">/</span>}
              <span className="font-bold text-[#DCB001] shrink-0">{issue.key}</span>
              <span className="text-[#787C83] truncate hidden sm:inline text-[11px] max-w-[200px]">
                {issue.title}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Copy Link Button */}
            <button
              onClick={handleCopyLink}
              className="px-2.5 py-1 text-xs font-mono bg-[#1B1C1F] hover:bg-[#2A2C30] text-[#787C83] hover:text-[#CFD4DD] border border-[#2A2C30] rounded-lg transition-colors flex items-center gap-1.5"
              title="Copy task details route link"
            >
              {copiedLink ? <Check size={12} className="text-[#22C55E]" /> : <Copy size={12} />}
              <span className="hidden md:inline">{copiedLink ? 'Copied' : 'Share Link'}</span>
            </button>

            {/* Status Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#787C83] font-mono hidden sm:inline">Status:</span>
              <select
                value={issue.status}
                onChange={(e) => handleUpdateStatus(e.target.value as Status)}
                className="bg-[#1A1B1D] text-xs text-[#DCB001] border border-[#2A2C30] rounded-lg px-2.5 py-1 outline-none cursor-pointer font-semibold hover:border-[#DCB001]/50 transition-colors"
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="needs_review">Needs Review</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
        </div>

        {/* Task Details Content View */}
        <IssueDetailView
          issue={issue}
          onUpdateIssue={handleUpdateIssue}
          onOpenDiffModal={() => {}}
          currentRole={isOwner ? 'owner' : 'member'}
        />
      </div>
    </AppLayout>
  );
}
