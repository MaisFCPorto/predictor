'use client';

import { useEffect, useRef, useState } from 'react';
import { supabasePKCE } from '@/utils/supabase/client';

type Preview = { status: 'checking' | 'denied' } | { status: 'ready'; html: string };

export default function CadernetaPreview() {
  const [preview, setPreview] = useState<Preview>({ status: 'checking' });
  const [height, setHeight] = useState(760);
  const [revision, setRevision] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let request: AbortController | undefined;
    let userId: string | null | undefined;
    let token: string | undefined;
    let hasDocument = false;

    const { data } = supabasePKCE.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      const nextToken = session?.access_token;
      if (nextUserId === userId && (hasDocument || nextToken === token)) return;

      userId = nextUserId;
      token = nextToken;
      hasDocument = false;
      request?.abort();

      if (!nextToken) {
        setPreview({ status: 'denied' });
        return;
      }

      request = new AbortController();
      const { signal } = request;
      setPreview({ status: 'checking' });

      void fetch('/api/caderneta', {
        headers: { Authorization: `Bearer ${nextToken}` },
        cache: 'no-store',
        signal,
      })
        .then((response) => (response.ok ? response.text() : null))
        .then((html) => {
          if (signal.aborted) return;
          hasDocument = html !== null;
          setPreview(html === null ? { status: 'denied' } : { status: 'ready', html });
        })
        .catch(() => {
          if (!signal.aborted) setPreview({ status: 'denied' });
        });
    });

    return () => {
      request?.abort();
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const iframe = frame.current;
      if (!iframe || event.source !== iframe.contentWindow || event.origin !== 'null') return;

      const message = event.data;
      if (message?.source !== 'predictor-caderneta') return;
      if (message.kind === 'reset') {
        setRevision((previous) => previous + 1);
        return;
      }

      const value = message.value;
      if (typeof value !== 'number' || !Number.isFinite(value)) return;
      if (message.kind === 'resize') {
        setHeight(Math.max(320, Math.min(4000, Math.ceil(value))));
      } else if (message.kind === 'scroll' || message.kind === 'reveal') {
        const rect = iframe.getBoundingClientRect();
        const top = rect.top + Math.max(0, Math.min(value, rect.height));
        if (
          message.kind === 'reveal' &&
          typeof message.height === 'number' &&
          top >= 76 &&
          top + message.height <= window.innerHeight
        ) return;

        window.scrollTo({ top: Math.max(0, window.scrollY + top - 76) });
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (preview.status === 'denied') {
    return (
      <section className="py-20 text-center">
        <h1 className="text-3xl font-bold">404</h1>
        <p className="mt-2 text-white/60">Página indisponível.</p>
      </section>
    );
  }

  if (preview.status !== 'ready') {
    return <p className="py-12 text-center text-sm text-white/60" role="status">A verificar acesso…</p>;
  }

  return (
    <iframe
      key={revision}
      ref={frame}
      title="Caderneta +FCPorto"
      srcDoc={preview.html}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      className="mx-auto block w-full max-w-[1120px] border-0"
      style={{ height }}
    />
  );
}
