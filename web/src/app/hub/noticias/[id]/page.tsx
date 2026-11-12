import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hubBetaEnabled } from '@/features/hub/access';
import NewsReader from './reader';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Notícias · +FCPorto', robots: { index: false, follow: false } };

export default async function NewsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hubBetaEnabled()) notFound();
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) notFound();
  return <NewsReader id={Number(id)} />;
}
