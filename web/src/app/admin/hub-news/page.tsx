import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hubBetaEnabled } from '@/features/hub/access';
import NewsDesk from './news-desk';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Notícias do hub · Backoffice',
  robots: { index: false, follow: false },
};

export default function HubNewsPage() {
  if (!hubBetaEnabled()) notFound();
  return <NewsDesk />;
}
