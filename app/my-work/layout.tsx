import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Work & Assigned Tasks',
  description:
    'Track your personal deliverables, assigned issues, pending reviews, and sprint tasks across all active projects in Teader.',
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

export default function MyWorkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
