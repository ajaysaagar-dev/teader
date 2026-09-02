import type { Metadata, Viewport } from "next";
import { Inter, Geist, Geist_Mono, Space_Grotesk, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ConsoleBranding } from "@/components/ConsoleBranding";
import { DesktopVersionIndicator } from "@/components/DesktopVersionIndicator";
import { UIScaleInitializer } from "@/components/UIScaleInitializer";
import { ThemeInitializer } from "@/components/ThemeInitializer";
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
  themeColor: "#DCB001",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
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
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
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
      className={`${inter.variable} ${geist.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${sora.variable} h-full w-full antialiased dark`}
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
      <body className="min-h-full w-full bg-[#0E0F12] text-[#F5F5F7] selection:bg-purple-500/30 selection:text-purple-200 font-sans">
        <ConsoleBranding />
        {children}

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#141518",
              color: "#F5F5F7",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              fontSize: "13px",
            },
          }}
        />
        <DesktopVersionIndicator />
        <UIScaleInitializer />
        <ThemeInitializer />
      </body>
    </html>
  );
}

