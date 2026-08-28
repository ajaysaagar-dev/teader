/**
 * Centralized Site and SEO Configuration for Teader
 */

export function getSiteUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'https://teader.vedipocketpc.online';

  // Strip trailing slash if present
  return envUrl.replace(/\/+$/, '');
}

export const siteConfig = {
  name: 'Teader',
  shortName: 'Teader',
  title: 'Teader | AI-Native High-Velocity Project Management Platform',
  description:
    'High-velocity project management platform engineered for software engineering teams and autonomous AI coding agents. Features 0ms optimistic UI, Unity VCS-style branch explorer timeline, hierarchical subtasks, and live markdown docs.',
  url: getSiteUrl(),
  ogImage: `${getSiteUrl()}/og-image.png`,
  keywords: [
    'Teader',
    'project management',
    'developer tools',
    'issue tracker',
    'branch explorer',
    'unity vcs style graph',
    'kanban board',
    'markdown documentation',
    'AI coding agents',
    'high-velocity project management',
    'optimistic UI',
    'hierarchical subtasks',
    'software engineering workflow',
  ],
  authors: [
    {
      name: 'Teader Team',
      url: getSiteUrl(),
    },
  ],
  creator: 'Teader',
  publisher: 'Teader',
  locale: 'en_US',
  links: {
    download: 'https://teader.vedipocketpc.online/releases/Teader-Workspace-Web-Setup.exe',
  },
  googleSiteVerification:
    process.env.GOOGLE_SITE_VERIFICATION ||
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
    '',
};

/**
 * JSON-LD Structured Data Schema Generators
 */
export function getOrganizationSchema() {
  const url = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Teader',
    url: url,
    logo: `${url}/favicon.ico`,
    description:
      'Next-generation project management engineered for high-performance software teams and autonomous AI coding agents.',
    sameAs: [
      'https://github.com/teader',
      'https://twitter.com/teader',
    ],
  };
}

export function getSoftwareApplicationSchema() {
  const url = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Teader',
    operatingSystem: 'Web, Windows',
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'ProjectManagementApplication',
    description:
      'Next-generation project management engineered for high-performance software teams and autonomous AI coding agents with 0ms optimistic UI and Unity VCS branch explorer.',
    url: url,
    downloadUrl: siteConfig.links.download,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      '0ms Optimistic UI & Local Cache',
      'Unity VCS Branch Explorer Graph',
      'Hierarchical Subtasks & Folders',
      'Live Markdown Project Docs',
      'Granular In-Place Diffing',
      'PostgreSQL Realtime Sync',
    ],
  };
}

export function getWebSiteSchema() {
  const url = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Teader',
    url: url,
    description:
      'High-velocity project management platform engineered for software engineering teams.',
    inLanguage: 'en-US',
  };
}

export function getDocsBreadcrumbSchema() {
  const url = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: url,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'API Documentation',
        item: `${url}/docs`,
      },
    ],
  };
}
