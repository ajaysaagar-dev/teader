import type { Metadata } from 'next';
import LandingPageClient from '@/components/LandingPageClient';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Teader | AI-Native High-Velocity Project Management Platform',
  description:
    'Next-generation project management engineered for high-performance software teams and autonomous AI coding agents. Instant 0ms optimistic UI, Unity VCS branch explorer, and real-time docs.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Teader | AI-Native High-Velocity Project Management Platform',
    description:
      'High-velocity project management platform engineered for software engineering teams and autonomous AI coding agents.',
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Teader - High-Velocity Project Management',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Teader | AI-Native High-Velocity Project Management Platform',
    description:
      'High-velocity project management platform engineered for software engineering teams and autonomous AI coding agents.',
    images: ['/og-image.png'],
  },
};

export default function Page() {
  return <LandingPageClient />;
}
