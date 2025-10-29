// apps/web/src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabasePKCE } from '@/utils/supabase/client';

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    // 1) sessão atual
    supabasePKCE.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        if (cancelled) return;
        setSession(session ?? null);
        setChecking(false);
      });

    // 2) listener para futuras mudanças
    const { data: sub } = supabasePKCE.auth.onAuthStateChange(
      (event: AuthChangeEvent, sess: Session | null) => {
        if (cancelled) return;
        setSession(sess ?? null);
        setChecking(false);
      }
    );

    // cleanup
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return <main className="p-6">A verificar sessão…</main>;
  }

  if (!session) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Não autenticado</h1>
        <a className="underline" href="/auth">
          Entrar
        </a>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Bem-vindo, {session.user.email}</h1>
      {/* … o resto da tua home autenticada … */}
    </main>
  );
}
