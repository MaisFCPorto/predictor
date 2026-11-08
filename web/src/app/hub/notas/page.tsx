import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hubBetaEnabled } from '@/features/hub/access';
import Ratings from './ratings';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Notas dos adeptos · +FCPorto', robots: { index: false, follow: false } };

export default function RatingsPage() {
  if (!hubBetaEnabled()) notFound();
  return <Ratings />;
}
