'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PublicLanding from '@/components/PublicLanding';
import { supabasePKCE } from '@/utils/supabase/client';

export default function Home() {
  const router = useRouter();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveHome() {
      try {
        const { data } = await supabasePKCE.auth.getUser();
        if (cancelled) return;

        if (data.user) {
          router.replace('/jogos');
          return;
        }
      } catch (error) {
        console.error('Erro a verificar sessão Supabase:', error);
      }

      if (!cancelled) setShowLanding(true);
    }

    void resolveHome();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!showLanding) {
    return <div className="min-h-screen bg-[#061026]" aria-busy="true" />;
  }

  return <PublicLanding />;
}
