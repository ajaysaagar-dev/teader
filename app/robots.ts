import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteConfig.url;

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/docs'],
        disallow: [
          '/api/',
          '/dashboard',
          '/dashboard/',
          '/projects',
          '/projects/',
          '/conversations',
          '/conversations/',
          '/my-work',
          '/my-work/',
          '/initiatives',
          '/initiatives/',
          '/issue/',
          '/task/',
          '/login',
          '/register',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
