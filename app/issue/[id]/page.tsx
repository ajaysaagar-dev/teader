'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function IssueRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/task/${id}/details`);
    } else {
      router.replace('/projects');
    }
  }, [id, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-muted)] font-mono text-xs">
      <div className="w-6 h-6 rounded-full border-2 border-[var(--border-secondary)] border-t-transparent animate-spin" />
    </div>
  );
}
