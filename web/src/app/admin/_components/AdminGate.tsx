'use client';

import { useEffect, useState } from 'react';

type GateState = 'checking' | 'no-session' | 'denied' | 'allowed';

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('checking');
  const [debug, setDebug] = useState<{ where?: string; status?: number; msg?: string; role?: string | null }>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Pergunta SEMPRE ao teu backend (ou ao proxy local) e envia cookies do browser
        const r = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',        // <— ESSENCIAL em produção
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        });

        if (r.status === 401) {
          if (!cancelled) {
            setDebug({ where: '/api/auth/me', status: 401, msg: 'unauthorized (no session)' });
            setState('no-session');
          }
          return;
        }

        if (r.status === 403) {
          if (!cancelled) {
            setDebug({ where: '/api/auth/me', status: 403, msg: 'forbidden' });
            setState('denied');
          }
          return;
        }

        if (!r.ok) {
          if (!cancelled) {
            setDebug({ where: '/api/auth/me', status: r.status, msg: 'unexpected status' });
            setState('denied');
          }
          return;
        }

        const j = await r.json().catch(() => ({}));
        const role =
          (j?.role ?? j?.user?.role ?? j?.data?.role ?? null) as string | null;

        setDebug({ where: '/api/auth/me', status: r.status, role: role ?? null });

        if (role && String(role).toLowerCase() === 'admin') {
          if (!cancelled) setState('allowed');
        } else {
          if (!cancelled) setState('denied');
        }
      } catch (e: any) {
        if (!cancelled) {
          setDebug({ where: 'client', msg: e?.message ?? 'network error' });
          setState('denied');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (state === 'checking') return <main className="p-6">A verificar permissões…</main>;

  if (state === 'no-session') {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <div className="text-lg font-semibold mb-2">Sessão necessária</div>
          <p className="mb-4 text-sm text-white/70">Para aceder a esta área tens de iniciar sessão.</p>
          <a href="/auth" className="inline-block rounded-xl bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/20">
            Ir para login
          </a>
          <pre className="mt-4 text-xs opacity-60">{JSON.stringify(debug, null, 2)}</pre>
        </div>
      </main>
    );
  }

  if (state === 'denied') {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">Acesso restrito</div>
          <p className="mt-2 text-sm text-white/70">
            Esta área é exclusiva para administradores. Se achas que é um erro, contacta um admin.
          </p>
          <pre className="mt-4 text-xs opacity-60">{JSON.stringify(debug, null, 2)}</pre>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
