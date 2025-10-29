'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabasePKCE } from '@/utils/supabase/client';

export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState<boolean>(false);
  const [ok, setOk] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    // 1) sessão inicial
    supabasePKCE.auth
      .getSession()
      .then(
        ({
          data: { session },
        }: {
          data: { session: Session | null };
        }) => {
          if (cancelled) return;
          if (!session) {
            setOk(false);
            setReady(true);
            router.replace('/auth');
          } else {
            setOk(true);
            setReady(true);
          }
        }
      );

    // 2) mudanças subsequentes
    const { data: sub } = supabasePKCE.auth.onAuthStateChange(
      (event: AuthChangeEvent, sess: Session | null) => {
        if (cancelled) return;
        if (!sess) {
          setOk(false);
          setReady(true);
          router.replace('/auth');
        } else {
          setOk(true);
          setReady(true);
        }
      }
    );

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="opacity-70 p-4">
        A verificar sessão…
      </div>
    );
  }

  if (!ok) return null;
  return <>{children}</>;
}
