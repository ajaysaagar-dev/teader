import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In | Teader Workspace',
  description:
    'Sign in to access your high-velocity projects, Kanban boards, and branch explorer timeline in Teader.',
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

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
