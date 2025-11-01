'use client';

import { useEffect, useState } from 'react';

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading'|'allowed'|'denied'>('loading');
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/check', { cache: 'no-store' });
        if (!cancelled) {
          if (res.ok) {
            setState('allowed');
          } else {
            const j = await res.json().catch(() => ({}));
            setInfo(j);
            setState('denied');
          }
        }
      } catch (e) {
        if (!cancelled) {
          setInfo({ error: String(e) });
          setState('denied');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === 'loading') {
    return <div className="p-6 opacity-70">A verificar permissões…</div>;
  }
  if (state === 'denied') {
    return (
      <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold mb-2">Acesso restrito</h2>
        <p className="opacity-80 mb-3">
          Esta área é exclusiva para administradores. Se achas que é um erro, contacta um admin.
        </p>
        <pre className="text-xs opacity-60">{JSON.stringify(info ?? {}, null, 2)}</pre>
      </div>
    );
  }
  return <>{children}</>;
}
