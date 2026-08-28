import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Initiatives',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function InitiativesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
