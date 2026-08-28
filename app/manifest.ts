import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site-config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Teader - AI-Native High-Velocity Project Management Platform',
    short_name: 'Teader',
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0B0D',
    theme_color: '#DCB001',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
