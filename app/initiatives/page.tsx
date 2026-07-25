'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { TimelineView } from '@/components/TimelineView';
import { MOCK_ISSUES } from '@/lib/mock-data';
import { Issue } from '@/lib/types';
import { useRouter } from 'next/navigation';

export default function InitiativesPage() {
  const [issues] = useState<Issue[]>(MOCK_ISSUES);
  const router = useRouter();

  return (
    <AppLayout>
      <TimelineView
        issues={issues}
        onSelectIssue={() => {
          router.push('/dashboard');
        }}
      />
    </AppLayout>
  );
}
