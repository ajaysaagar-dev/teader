'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { IssueDetailView } from '@/components/IssueDetailView';
import { MOCK_ISSUES } from '@/lib/mock-data';
import { Issue } from '@/lib/types';

export default function DashboardPage() {
  const [issues, setIssues] = useState<Issue[]>(MOCK_ISSUES);
  const activeIssue = issues[0];

  const handleUpdateIssue = (updatedIssue: Issue) => {
    setIssues((prev) => prev.map((i) => (i.id === updatedIssue.id ? updatedIssue : i)));
  };

  return (
    <AppLayout>
      <IssueDetailView
        issue={activeIssue}
        onUpdateIssue={handleUpdateIssue}
        onOpenDiffModal={() => {}}
      />
    </AppLayout>
  );
}
