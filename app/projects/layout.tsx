import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Projects Directory',
  description:
    'Browse, create, and manage your development projects, task repositories, and workspace boards with 0ms latency in Teader.',
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

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
