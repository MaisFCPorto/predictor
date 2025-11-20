'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabasePKCE } from '@/utils/supabase/client';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

type GateState = 'loading' | 'allowed' | 'denied';

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('loading');
  const [info, setInfo] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) ver se há utilizador loggado no Supabase
        const {
          data: { user },
        } = await supabasePKCE.auth.getUser();

        if (!user) {
          if (!cancelled) {
            setInfo({ error: 'not_logged', message: 'Utilizador não autenticado' });
            setState('denied');
          }
          return;
        }

        // 2) pedir ao Worker o role deste user
        const base = API_BASE ? API_BASE.replace(/\/+$/, '') : '';
        const url = base
          ? `${base}/api/users/${encodeURIComponent(user.id)}/role`
          : `/api/users/${encodeURIComponent(user.id)}/role`;

        const res = await fetch(url, { cache: 'no-store' });
        const json = await res.json().catch(() => ({} as any));

        if (!res.ok || json.role !== 'admin') {
          if (!cancelled) {
            setInfo({ error: 'not_admin', role: json.role ?? null });
            setState('denied');
          }
          return;
        }

        // 3) tudo ok → pode ver o backoffice
        if (!cancelled) setState('allowed');
      } catch (e) {
        if (!cancelled) {
          setInfo({ error: 'unexpected', detail: String(e) });
          setState('denied');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'loading') {
    return <div className="p-6 opacity-70">A verificar permissões…</div>;
  }

  if (state === 'denied') {
    return (
      <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-white/10 p-6 space-y-3">
        <h2 className="text-lg font-semibold mb-2">Acesso restrito</h2>
        <p className="opacity-80 mb-2 text-sm">
          Esta área é exclusiva para administradores. Faz login com uma conta de admin.
        </p>
        <button
          type="button"
          onClick={() => router.push('/auth')}
          className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
        >
          Ir para login
        </button>
        <pre className="mt-3 text-xs opacity-60 whitespace-pre-wrap">
          {JSON.stringify(info ?? {}, null, 2)}
        </pre>
      </div>
    );
  }

  return <>{children}</>;
}
