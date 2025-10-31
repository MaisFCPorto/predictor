'use client';

import { useEffect, useState } from 'react';

/**
 * Este gate assume que existe um endpoint GET /api/auth/me
 * que responde:
 *   200 { id, email, role: 'admin' | 'user' | ... }
 *   401 quando não há sessão válida
 */
type Me = { id: string; email: string; role?: string };

type State = 'checking' | 'no-session' | 'denied' | 'allowed';

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        const r = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include', // envia cookies (sessão)
          headers: { 'Accept': 'application/json' },
        });

        if (r.status === 401) {
          if (alive) setState('no-session');
          return;
        }
        if (!r.ok) {
          if (alive) setState('denied'); // qualquer erro ≈ não autorizado
          return;
        }

        const me: Me = await r.json();
        if ((me.role || '').toLowerCase() === 'admin') {
          if (alive) setState('allowed');
        } else {
          if (alive) setState('denied');
        }
      } catch {
        if (alive) setState('denied');
      }
    }

    check();
    return () => { alive = false; };
  }, []);

  if (state === 'checking') {
    return <main className="p-6">A verificar permissões…</main>;
  }

  if (state === 'no-session') {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <div className="text-lg font-semibold mb-2">Sessão necessária</div>
          <p className="text-sm opacity-70 mb-4">Para aceder a esta área tens de iniciar sessão.</p>
          <a
            href="/auth"
            className="inline-block rounded-xl bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/20"
          >
            Ir para login
          </a>
        </div>
      </main>
    );
  }

  if (state === 'denied') {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">Acesso restrito</div>
          <p className="mt-2 text-sm opacity-70">
            Esta área é exclusiva para administradores. Se achas que é um erro, contacta um admin.
          </p>
        </div>
      </main>
    );
  }

  // allowed
  return <>{children}</>;
}
