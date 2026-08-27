import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Teader | AI-Native Project Management Platform",
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
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="h-full bg-[#0E0F12] text-[#F5F5F7] selection:bg-purple-500/30 selection:text-purple-200 font-sans">
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
