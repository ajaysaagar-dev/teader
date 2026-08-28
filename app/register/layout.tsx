import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account | Teader Workspace',
  description:
    'Register for a Teader account to manage projects, task trees, team boards, and real-time specs.',
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

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
