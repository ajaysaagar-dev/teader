import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Issue',
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
