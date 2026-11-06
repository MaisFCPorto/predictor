import { notFound } from 'next/navigation';
import { cadernetaBetaEnabled } from '@/features/caderneta/access';
import CadernetaPreview from './preview';

export const dynamic = 'force-dynamic';

export default function CadernetaPage() {
  if (!cadernetaBetaEnabled()) notFound();

  return <CadernetaPreview />;
}
