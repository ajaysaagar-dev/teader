import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Task Details & Subtasks Hierarchy',
  description:
    'Inspect task specifications, nested subtask trees, priority tags, branch linkages, and activity timelines in Teader.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function TaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
