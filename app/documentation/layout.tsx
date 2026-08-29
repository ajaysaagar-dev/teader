import type { Metadata } from 'next';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Platform Documentation & User Manual',
  description:
    'Comprehensive step-by-step developer manual and user guide for Teader. Learn how to manage high-velocity projects, Kanban boards, Unity VCS branch explorer graphs, live Markdown specs, and real-time state synchronization.',
  keywords: [
    'Teader documentation',
    'Teader guide',
    'project management manual',
    'kanban board guide',
    'branch explorer graph',
    'hierarchical subtasks',
    'real-time sync',
    'developer workstation',
  ],
  alternates: {
    canonical: '/documentation',
  },
  openGraph: {
    title: 'Teader Documentation | Platform Guide & Reference',
    description:
      'Comprehensive step-by-step developer manual and user guide for Teader. Master boards, task trees, branch timelines, and real-time state synchronization.',
    url: `${siteConfig.url}/documentation`,
    siteName: siteConfig.name,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Teader Documentation - Platform Guide',
      },
    ],
    locale: 'en_US',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Teader Documentation | Platform Guide & Reference',
    description:
      'Comprehensive step-by-step developer manual and user guide for Teader.',
    images: ['/og-image.png'],
    creator: '@teader',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function DocumentationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
