import type { Metadata } from 'next';
import { getDocsBreadcrumbSchema, siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'API Documentation & OpenAPI Specification',
  description:
    'Explore interactive OpenAPI 3.0 specification and developer reference for Teader REST endpoints, project management schemas, and automation APIs.',
  alternates: {
    canonical: '/docs',
  },
  openGraph: {
    title: 'Teader API Documentation & OpenAPI Specification',
    description:
      'Interactive OpenAPI 3.0 specification and developer reference for Teader REST endpoints and workspace APIs.',
    url: `${siteConfig.url}/docs`,
    siteName: siteConfig.name,
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Teader API Documentation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Teader API Documentation & OpenAPI Specification',
    description:
      'Interactive OpenAPI 3.0 specification and developer reference for Teader REST endpoints and workspace APIs.',
    images: ['/og-image.png'],
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const breadcrumbSchema = getDocsBreadcrumbSchema();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
