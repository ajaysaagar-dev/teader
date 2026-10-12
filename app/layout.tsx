import type { Metadata, Viewport } from "next";
import { Inter, Geist, Geist_Mono, Space_Grotesk, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ConsoleBranding } from "@/components/ConsoleBranding";
import { DesktopVersionIndicator } from "@/components/DesktopVersionIndicator";
import { DesktopUpdateModal } from "@/components/DesktopUpdateModal";
import { UIScaleInitializer } from "@/components/UIScaleInitializer";
import { LegacyThemeCleanup } from "@/components/LegacyThemeCleanup";
import {
  siteConfig,
  getOrganizationSchema,
  getSoftwareApplicationSchema,
  getWebSiteSchema,
  getFAQSchema,
} from "@/lib/site-config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Teader | AI-Native High-Velocity Project Management Platform",
    template: "%s | Teader",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: siteConfig.keywords,
  authors: siteConfig.authors,
  creator: siteConfig.creator,
  publisher: siteConfig.publisher,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: "Teader | AI-Native High-Velocity Project Management Platform",
    description: siteConfig.description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Teader - AI-Native High-Velocity Project Management Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Teader | AI-Native High-Velocity Project Management Platform",
    description: siteConfig.description,
    images: ["/og-image.png"],
    creator: "@teader",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  ...(siteConfig.googleSiteVerification
    ? {
        verification: {
          google: siteConfig.googleSiteVerification,
        },
      }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgSchema = getOrganizationSchema();
  const appSchema = getSoftwareApplicationSchema();
  const websiteSchema = getWebSiteSchema();
  const faqSchema = getFAQSchema();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${geist.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${sora.variable} h-full h-[100dvh] w-full overflow-hidden overscroll-none antialiased dark`}
    >
      <head>
        {/* Structured Data JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </head>
      <body className="h-full h-[100dvh] max-h-[100dvh] w-full overflow-hidden overscroll-none bg-[var(--bg-main)] text-[var(--text-primary)] selection:bg-[var(--accent)] selection:text-[var(--text-inverse)] font-sans">
        <ConsoleBranding />
        {children}

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-primary)",
              borderRadius: "8px",
              fontSize: "13px",
            },
          }}
        />
        <DesktopVersionIndicator />
        <DesktopUpdateModal />
        <UIScaleInitializer />
        <LegacyThemeCleanup />
      </body>
    </html>
  );
}

