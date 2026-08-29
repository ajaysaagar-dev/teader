import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteConfig.url;

  return {
    rules: [
      {
        userAge        a        allow: ['/', '/documentation', '/dashboard', 'register', '/login'], ,
        disallow: [
          '/api/',
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
  '/task/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
