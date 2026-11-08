import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cadernetaBetaEnabled } from '@/features/caderneta/access';
import CadernetaPreview from './preview';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Caderneta +FCPorto',
  robots: { index: false, follow: false },
};

export default function CadernetaPage() {
  if (!cadernetaBetaEnabled()) notFound();

  return <CadernetaPreview />;
}
