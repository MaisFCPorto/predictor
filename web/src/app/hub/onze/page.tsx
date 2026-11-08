import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hubBetaEnabled } from '@/features/hub/access';
import Lineup from './lineup';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Onze do Porto · +FCPorto', robots: { index: false, follow: false } };

export default function LineupPage() {
  if (!hubBetaEnabled()) notFound();
  return <Lineup />;
}
