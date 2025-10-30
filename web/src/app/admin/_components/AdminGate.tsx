'use client';

import { useEffect, useState } from 'react';
import { supabasePKCE } from '@/utils/supabase/client'; // usa o helper que já tens
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_BASE!;

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) sessão supabase
      const { data: { user }, error } = await supabasePKCE.auth.getUser();
      if (error || !user) {
        window.location.href = '/'; // sem sessão -> volta à landing
        return;
      }

      // 2) buscar role na D1
      try {
        const { data } = await axios.get<{ role: string | null }>(`${API}/api/users/${user.id}/role`, {
          // evita cache agressiva
          headers: { 'Cache-Control': 'no-store' },
        });

        if (!cancelled) {
          setAllowed(data?.role === 'admin');
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setAllowed(false);
          setReady(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!ready) return <main className="p-6">A verificar permissões…</main>;
  if (!allowed) {
    return (
      <main className="p-8 max-w-lg mx-auto">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold mb-2">Acesso restrito</h2>
          <p className="text-white/70">Esta área é exclusiva para administradores.</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
