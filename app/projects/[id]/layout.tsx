import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Project Workspace',
  description:
    'High-velocity project workspace with Kanban boards, hierarchical subtasks tree, Unity VCS branch explorer, and real-time Markdown documentation.',
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

export default function ProjectWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
