import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Issue Tracker & Discussions',
  description:
    'Manage bug reports, feature requests, code diff reviews, and issue lifecycle updates in Teader.',
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

export default function IssueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
