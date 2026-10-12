import type { Metadata } from 'next';
import { FrameAppView } from '@/components/FrameAppView';

export const metadata: Metadata = {
  title: 'Teader App',
  description: 'Teader App Workspace',
};

export default function Page() {
  return <FrameAppView />;
}
