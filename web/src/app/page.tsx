// web/src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabasePKCE } from '@/utils/supabase/client';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const { data } = await supabasePKCE.auth.getSession();
        const hasSession = !!data.session;

        if (cancelled) return;

        if (hasSession) {
          router.replace('/jogos');    // 👉 landing para utilizadores logados
        } else {
          router.replace('/auth');     // 👉 convidados vão para login/registo
        }
      } catch (err) {
        console.error('Erro a verificar sessão Supabase:', err);
        if (!cancelled) {
          router.replace('/auth');
        }
      }
    };

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // não precisa renderizar nada
  return null;
}
