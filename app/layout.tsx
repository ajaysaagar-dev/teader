import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Prompt } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ConsoleBranding } from "@/components/ConsoleBranding";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const promptFont = Prompt({
  variable: "--font-prompt",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "teader | AI-Native Project Management Platform",
  description: "Next-generation project management engineered for high-performance software teams and autonomous AI coding agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${promptFont.variable} h-full antialiased dark`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Prompt:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-[#0E0F12] text-[#F5F5F7] selection:bg-purple-500/30 selection:text-purple-200 font-sans">
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
      </body>
    </html>
  );
}
