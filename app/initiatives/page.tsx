'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { TimelineView } from '@/components/TimelineView';
import { Issue, Status } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useRealtimeSubscription, RealtimeEvent } from '@/lib/useRealtime';

export default function InitiativesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const router = useRouter();

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch('/api/issues');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setIssues(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Real-time WebSocket synchronization
  useRealtimeSubscription({
    onEvent: useCallback((event: RealtimeEvent) => {
      switch (event.type) {
        case 'TASK_CREATED': {
          const newTask = event.payload;
          if (newTask) {
            setIssues((prev) => {
              const existingIdx = prev.findIndex(
                (i) => i.id === newTask.id || (String(i.id).startsWith('temp_') && (i.title === newTask.title || i.key === newTask.key))
              );
              if (existingIdx !== -1) {
                const next = [...prev];
                next[existingIdx] = newTask;
                return next;
              }
              return [newTask, ...prev];
            });
          }
          break;
        }

        case 'TASK_UPDATED': {
          const updated = event.payload;
          if (updated && updated.id) {
            setIssues((prev) =>
              prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
            );
          }
          break;
        }

        case 'TASKS_REORDERED': {
          const items: Array<{ id: string; orderIndex: number; status?: Status }> = event.payload?.items || [];
          if (items.length > 0) {
            const map = new Map(items.map((it) => [it.id, it]));
            setIssues((prev) =>
              prev.map((iss) => {
                const update = map.get(iss.id);
                if (update) {
                  return {
                    ...iss,
                    orderIndex: update.orderIndex,
                    status: update.status || iss.status,
                  };
                }
                return iss;
              })
            );
          }
          break;
        }

        case 'TASK_DELETED': {
          const deletedId = event.payload?.id;
          if (deletedId) {
            setIssues((prev) => prev.filter((i) => i.id !== deletedId));
          }
          break;
        }

        default:
          break;
      }
    }, []),
  });

  return (
    <AppLayout>
      <TimelineView
        issues={issues}
        onSelectIssue={(id) => {
          if (id) router.push(`/task/${id}/details`);
        }}
      />
    </AppLayout>
  );
}
