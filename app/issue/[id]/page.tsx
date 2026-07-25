'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { IssueDetailView } from '@/components/IssueDetailView';
import { Issue, Status } from '@/lib/types';
import { MOCK_ISSUES } from '@/lib/mock-data';
import { toast } from 'sonner';

export default function SingleIssuePage() {
  const params = useParams();
  const router = useRouter();
  const issueId = params?.id as string;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!issueId) return;

    fetch('/api/issues')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const found = data.find((i: Issue) => i.id === issueId || i.key === issueId);
          if (found) {
            setIssue(found);
          } else {
            const fallback = MOCK_ISSUES.find((i) => i.id === issueId || i.key === issueId);
            setIssue(fallback || MOCK_ISSUES[0]);
          }
        }
      })
      .catch(() => {
        const fallback = MOCK_ISSUES.find((i) => i.id === issueId || i.key === issueId);
        setIssue(fallback || MOCK_ISSUES[0]);
      })
      .finally(() => setLoading(false));
  }, [issueId]);

  const handleUpdateStatus = async (newStatus: Status) => {
    if (!issue) return;
    setIssue({ ...issue, status: newStatus });

    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(`Updated status in database to ${newStatus.replace('_', ' ')}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleUpdateIssue = (updatedIssue: Issue) => {
    setIssue(updatedIssue);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center bg-[#131415] text-[#787C83] font-mono text-xs">
          Loading task details...
        </div>
      </AppLayout>
    );
  }

  if (!issue) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center bg-[#131415] text-[#787C83] font-mono text-xs space-y-3">
          <span>Task not found</span>
          <button
            onClick={() => router.push('/projects')}
            className="px-3 py-1.5 bg-[#1E1E1E] hover:bg-[#2A2C30] text-[#CFD4DD] border border-[#3B3D41] rounded"
          >
            ← Back to Projects Board
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top Header with Back link & status selector */}
        <div className="px-4 py-2 bg-[#131415] border-b border-[#2A2C30] flex items-center justify-between shrink-0">
          <button
            onClick={() => router.push('/projects')}
            className="text-xs text-[#787C83] hover:text-[#CFD4DD] font-mono flex items-center gap-1"
          >
            ← Back to Projects Board
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#787C83]">Status:</span>
            <select
              value={issue.status}
              onChange={(e) => handleUpdateStatus(e.target.value as Status)}
              className="bg-[#1A1B1D] text-xs text-[#DCB001] border border-[#2A2C30] rounded px-2.5 py-1 outline-none cursor-pointer font-semibold"
            >
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="needs_review">Needs Review</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        <IssueDetailView
          issue={issue}
          onUpdateIssue={handleUpdateIssue}
          onOpenDiffModal={() => {}}
        />
      </div>
    </AppLayout>
  );
}
