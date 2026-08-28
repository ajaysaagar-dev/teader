import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Initiatives & Roadmaps',
  description:
    'Plan multi-project roadmaps, track strategic milestones, and align engineering sprints with team initiatives in Teader.',
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

export default function InitiativesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
