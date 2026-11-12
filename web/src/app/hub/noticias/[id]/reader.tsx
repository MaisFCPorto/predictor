'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabasePKCE } from '@/utils/supabase/client';
import { formatHubNewsDate } from '@/features/hub/news-date';
import { NewsImage } from '@/features/hub/news-image';
import type { HubSummaryArticle } from '@/features/hub/types';

type State = { phase: 'loading' | 'denied' | 'missing' | 'failed' } | { phase: 'ready'; article: HubSummaryArticle };

export default function NewsReader({ id }: { id: number }) {
  const [state, setState] = useState<State>({ phase: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'loading' });
    void (async () => {
      try {
        const { data: { session } } = await supabasePKCE.auth.getSession();
        if (controller.signal.aborted) return;
        if (!session) { setState({ phase: 'denied' }); return; }
        const response = await fetch('/api/hub-news/' + id, {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 404) { setState({ phase: 'missing' }); return; }
        if (!response.ok) throw new Error('unavailable');
        const article: HubSummaryArticle = await response.json();
        if (!controller.signal.aborted) setState({ phase: 'ready', article });
      } catch {
        if (!controller.signal.aborted) setState({ phase: 'failed' });
      }
    })();
    return () => controller.abort();
  }, [id]);

  return (
    <main className="mx-auto min-h-[65vh] max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/hub" className="text-sm font-semibold text-sky-200 hover:underline">← Voltar ao Hub</Link>
      {state.phase === 'loading' && <p className="mt-8 text-white/65" role="status">A carregar notícia…</p>}
      {state.phase === 'denied' && <div className="mt-8 space-y-3">
        <h1 className="text-2xl font-bold">Entra para continuar</h1>
        <p className="text-sm text-white/65">O Hub está disponível para as contas com acesso à versão de teste.</p>
        <Link href="/auth" className="inline-block rounded-xl bg-blue-600 px-4 py-2 font-semibold">Entrar</Link>
      </div>}
      {(state.phase === 'missing' || state.phase === 'failed') && <div className="mt-8 space-y-3" role="status">
        <h1 className="text-2xl font-bold">Resumo indisponível</h1>
        <p className="text-sm text-white/65">{state.phase === 'missing'
          ? 'Esta notícia pode estar em revisão ou já não estar disponível.'
          : 'Não foi possível carregar a notícia. Tenta novamente dentro de momentos.'}</p>
      </div>}
      {state.phase === 'ready' && <article className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
        <NewsImage src={state.article.imageUrl} size="lead" className="relative aspect-[16/9] w-full overflow-hidden bg-white/5 [&_img]:object-cover" />
        <div className="space-y-6 p-5 sm:p-8">
          <header className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-200">Síntese +FCPorto</p>
            <h1 className="break-words text-2xl font-bold leading-tight tracking-tight sm:text-4xl">{state.article.title}</h1>
            <p className="text-sm text-white/60">Fonte: {state.article.source} · <time dateTime={state.article.publishedAt}>{formatHubNewsDate(state.article.publishedAt)}</time></p>
          </header>
          <div className="space-y-4 text-base leading-relaxed text-white/90 sm:text-lg">
            {state.article.summary.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
          <footer className="space-y-4 border-t border-white/10 pt-5">
            <p className="text-xs leading-relaxed text-white/55">Resumo com apoio de IA e revisão editorial do +FCPorto, com base na publicação de {state.article.source}.</p>
            <a href={state.article.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex rounded-xl border border-sky-300/25 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-100 hover:bg-sky-400/20">
              Ler publicação original ↗
            </a>
          </footer>
        </div>
      </article>}
    </main>
  );
}
