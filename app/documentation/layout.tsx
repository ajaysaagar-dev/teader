import type { Metadata } from 'next';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Teader Documentation | Platform Guide & Reference',
  description:
    'Complete platform guide and API reference for Teader — the high-velocity project management platform for software engineering teams. Learn about the Kanban Board, Branch Explorer, Hierarchical Tasks, Real-Time Sync, and all 20+ features.',
  keywords: [
    'Teader documentation',
    'Teader guide',
    'project management docs',
    'kanban board',
    'branch explorer',
    'hierarchical subtasks',
    'API reference',
    'real-time sync',
    'developer guide',
  ],
  alternates: {
    canonical: '/documentation',
  },
  openGraph: {
    title: 'Teader Documentation | Platform Guide & Reference',
    description:
      'Complete platform guide and API reference for Teader — the high-velocity project management platform for software engineering teams.',
    url: `${siteConfig.url}/documentation`,
    siteName: siteConfig.name,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Teader Documentation',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Teader Documentation | Platform Guide & Reference',
    description:
      'Complete platform guide and API reference for Teader — the high-velocity project management platform for software engineering teams.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
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
