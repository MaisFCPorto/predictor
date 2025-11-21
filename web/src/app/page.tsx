// web/src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // ajusta o nome da key se for diferente
    const token = window.localStorage.getItem('session');

    if (token) {
      router.replace('/jogos');
    } else {
      router.replace('/auth');
    }
  }, [router]);

  // não precisa renderizar nada, só redireciona
  return null;
}
