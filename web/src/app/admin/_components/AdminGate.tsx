'use client';

import { useEffect, useState } from 'react';

type GateState = 'checking' | 'no-session' | 'denied' | 'allowed';

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('checking');
  const [debug, setDebug] = useState<{ where?: string; status?: number; msg?: string; role?: string | null }>({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setState('checking');
        const res = await fetch('/api/admin/check', { cache: 'no-store' });
        if (!active) return;
  
        if (res.status === 200) {
          setState('allowed'); // admin
        } else if (res.status === 401) {
          setState('no-session'); // pede login
        } else if (res.status === 403) {
          setState('denied'); // não é admin
        } else {
          setState('denied');
        }
      } catch {
        if (active) setState('denied');
      }
    })();
    return () => { active = false; };
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
