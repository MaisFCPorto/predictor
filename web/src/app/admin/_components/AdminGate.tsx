'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type GateState = 'checking' | 'no-session' | 'denied' | 'allowed';

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('checking');
  const [debug, setDebug] = useState<{ where?: string; status?: number; msg?: string; role?: string | null }>({});

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // A) tentar via Supabase (mais rápido e sem chamadas de rede)
        const { data } = await supabase.auth.getSession();
        const session = data.session || null;
        if (!session) {
          setDebug({ where: 'supabase', msg: 'no session' });
          setState('no-session');
          return;
        }

        const meta = (session.user?.user_metadata as any) ?? {};
        const appm = (session.user?.app_metadata as any) ?? {};
        const roleFromSupabase =
          meta?.role ??
          appm?.role ??
          meta?.claims?.role ??
          appm?.claims?.role ??
          null;

        if (roleFromSupabase) {
          setDebug({ where: 'supabase', role: String(roleFromSupabase) });
        }

        if (roleFromSupabase && String(roleFromSupabase).toLowerCase() === 'admin') {
          if (!cancelled) setState('allowed');
          return;
        }

        // B) fallback: perguntar ao teu endpoint, COM COOKIES
        const r = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include', // <- essencial em prod p/ mandar cookies
          headers: { 'cache-control': 'no-store' },
        });

        if (r.status === 401) {
          setDebug({ where: '/api/auth/me', status: 401, msg: 'unauthorized' });
          setState('no-session');
          return;
        }

        if (r.status === 403) {
          setDebug({ where: '/api/auth/me', status: 403, msg: 'forbidden' });
          setState('denied');
          return;
        }

        if (!r.ok) {
          setDebug({ where: '/api/auth/me', status: r.status, msg: 'unexpected' });
          setState('denied');
          return;
        }

        const j = await r.json().catch(() => ({}));
        const apiRole = (j?.role ?? j?.user?.role ?? j?.data?.role ?? null) as string | null;

        setDebug(prev => ({ ...prev, where: '/api/auth/me', role: apiRole || prev.role }));

        if (apiRole && String(apiRole).toLowerCase() === 'admin') {
          if (!cancelled) setState('allowed');
        } else {
          if (!cancelled) setState('denied');
        }
      } catch (e: any) {
        setDebug(prev => ({ ...prev, msg: e?.message ?? 'unknown error', where: prev.where ?? 'unknown' }));
        if (!cancelled) setState('denied');
      }
    }

    run();
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
          <div className="text-lg font-semibold mb-2">Sessão necessária</div>
          <p className="mb-4 text-sm text-white/70">Para aceder a esta área tens de iniciar sessão.</p>
          <a
            href="/auth"
            className="inline-block rounded-xl bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/20"
          >
            Ir para login
          </a>

          {/* debug leve (remove quando estiver OK) */}
          <pre className="mt-4 text-xs opacity-60">{JSON.stringify(debug, null, 2)}</pre>
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

          {/* debug leve (remove quando estiver OK) */}
          <pre className="mt-4 text-xs opacity-60">{JSON.stringify(debug, null, 2)}</pre>
        </div>
      </main>
    );
  }

  // allowed
  return <>{children}</>;
}
