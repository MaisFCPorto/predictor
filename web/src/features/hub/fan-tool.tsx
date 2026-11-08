'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAdminBetaContent } from '@/utils/supabase/use-admin-beta-content';
import styles from './fan-tools.module.css';

function readJson<T>(response: Response): Promise<T> {
  return response.json();
}

export function FanTool<T>({ area, title, description, children }: {
  area: 'plantel' | 'notas';
  title: string;
  description: string;
  children: (data: T) => ReactNode;
}) {
  const content = useAdminBetaContent<T>(`/api/adeptos/${area}`, readJson);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.width}>
          <Link href="/hub" className={styles.brand}>
            <Image src="/logobranco.png" alt="+FCPorto" width={116} height={38} priority />
            <span>Hub</span>
          </Link>
          {content.status === 'ready' && (
            <nav aria-label="Apps dos adeptos">
              <Link href="/hub/onze" aria-current={area === 'plantel' ? 'page' : undefined}>Onze</Link>
              <Link href="/hub/notas" aria-current={area === 'notas' ? 'page' : undefined}>Notas</Link>
            </nav>
          )}
        </div>
      </header>
      <main className={styles.width}>
        {content.status === 'ready' ? (
          <>
            <div className={styles.intro}>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {children(content.data)}
          </>
        ) : content.status === 'checking' ? (
          <p className={styles.empty} role="status">A verificar acesso…</p>
        ) : (
          <p className={styles.empty}>Esta página está em beta para administradores do hub.</p>
        )}
      </main>
    </div>
  );
}
