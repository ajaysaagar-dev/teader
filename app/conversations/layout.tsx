import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team Conversations & Channels',
  description:
    'Real-time developer team channels, issue discussions, and async project communications in Teader.',
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

export default function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
