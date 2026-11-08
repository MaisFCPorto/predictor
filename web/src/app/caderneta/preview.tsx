'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAdminBetaContent } from '@/utils/supabase/use-admin-beta-content';

const readAlbum = (response: Response) => response.text();

export default function CadernetaPreview() {
  const preview = useAdminBetaContent('/api/caderneta', readAlbum);
  const [revision, setRevision] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const iframe = frame.current;
      if (!iframe || event.source !== iframe.contentWindow || event.origin !== 'null') return;

      const message = event.data;
      if (message?.source === 'predictor-caderneta' && message.kind === 'reset') {
        setRevision((previous) => previous + 1);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (preview.status === 'denied') {
    return (
      <main className="grid min-h-dvh place-content-center gap-2 px-4 text-center">
        <h1 className="text-3xl font-bold">404</h1>
        <p className="text-white/60">Página indisponível.</p>
        <Link href="/jogos" className="mt-3 text-sm font-semibold text-sky-200 hover:underline">
          Voltar ao Predictor
        </Link>
      </main>
    );
  }

  if (preview.status !== 'ready') {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <p className="text-sm text-white/60" role="status">A verificar acesso…</p>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#06102b]">
      <header className="shrink-0 border-b border-white/10 bg-[#050d23]">
        <div className="mx-auto flex min-h-14 w-full max-w-[1588px] items-center justify-between gap-3 px-[clamp(12px,2.5vw,44px)]">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logobranco.png"
              alt="+FCPorto"
              width={108}
              height={35}
              priority
              className="h-auto w-20 shrink-0 sm:w-[108px]"
            />
            <span className="border-l border-white/15 pl-3 text-sm font-bold text-white">Caderneta</span>
            <span className="hidden rounded-full border border-sky-300/25 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-sky-200 min-[420px]:inline">
              BETA
            </span>
          </div>
          <Link href="/jogos" className="secondary-button shrink-0 gap-2">
            <span aria-hidden="true">←</span>
            <span><span className="sr-only sm:not-sr-only">Voltar ao </span>Predictor</span>
          </Link>
        </div>
      </header>
      <main className="relative min-h-0 flex-1">
        <iframe
          key={revision}
          ref={frame}
          title="Caderneta +FCPorto"
          srcDoc={preview.data}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          className="absolute inset-0 block h-full w-full border-0"
        />
      </main>
    </div>
  );
}
