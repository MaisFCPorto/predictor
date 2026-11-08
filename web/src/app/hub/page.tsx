import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hubBetaEnabled } from '@/features/hub/access';
import HubPreview from './preview';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '+FCPorto · Hub',
  robots: { index: false, follow: false },
};

export default function HubPage() {
  if (!hubBetaEnabled()) notFound();

  return <HubPreview />;
}
