import type { Metadata } from 'next';
import LandingPageClient from '@/components/LandingPageClient';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Teader | Simple & Fast Project Management',
  description:
    'Plan tasks, track progress on clean Kanban boards, and write living docs — all in one simple, friendly workspace.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Teader | Simple & Fast Project Management',
    description:
      'Plan tasks, track progress on clean Kanban boards, and write living docs — all in one simple, friendly workspace.',
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Teader - Simple & Fast Project Management',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Teader | Simple & Fast Project Management',
    description:
      'Plan tasks, track progress on clean Kanban boards, and write living docs in one friendly workspace.',
    images: ['/og-image.png'],
  },
};

export default function Page() {
  return <LandingPageClient />;
}
