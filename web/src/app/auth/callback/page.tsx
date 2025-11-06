// apps/web/app/auth/callback/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabasePKCE } from '@/utils/supabase/client';

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // força um getSession (ajuda a propagar cookies + middleware)
      await supabasePKCE.auth.getSession();
      router.replace('/jogos');
    })();
  }, [router]);

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
        <p className="text-white/80">A validar sessão…</p>
      </div>
    </main>
  );
}
