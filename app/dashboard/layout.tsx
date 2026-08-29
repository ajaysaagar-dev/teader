import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspace Dashboard',
  description:
    'Monitor sprint velocity, active developer tasks, project progress, and real-time activity across your Teader workspaces.',
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
