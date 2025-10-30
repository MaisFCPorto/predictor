'use client';

import { useEffect, useState } from 'react';

type GateState = 'checking' | 'no-session' | 'denied' | 'allowed';

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('checking');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        // Verifica sessão no backend (Cloudflare API) com cookie de sessão
        const me = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/users/me`, {
          credentials: 'include',
        });
        if (!me.ok) {
          if (!cancelled) setState('no-session');
          return;
        }
        const data = await me.json(); // espera { role: 'admin' | 'user' | ... }
        if (!cancelled) setState(data?.role === 'admin' ? 'allowed' : 'denied');
      } catch {
        if (!cancelled) setState('no-session');
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking') {
    return <main className="p-6">A verificar permissões…</main>;
  }

  if (state === 'no-session') {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="mb-2 text-lg font-semibold">Sessão necessária</div>
          <p className="mb-4 text-sm text-white/70">
            Para aceder a esta área tens de iniciar sessão.
          </p>
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-lg font-semibold">Acesso restrito</div>
          <p className="mt-2 text-sm text-white/70">
            Esta área é exclusiva para administradores. Se achas que é um erro, contacta um admin.
          </p>
        </div>
      </main>
    );
  }

  // allowed
  return <>{children}</>;
}
