'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatHubNewsDate } from '@/features/hub/news-date';
import type { HubNewsItem, HubNewsPage, HubNewsStatus, HubNewsSync } from '@/features/hub/types';
import { supabasePKCE } from '@/utils/supabase/client';

type ListState = { phase: 'loading' | 'denied' | 'failed' } | { phase: 'ready'; result: HubNewsPage };
type Decision = Pick<HubNewsItem, 'id' | 'revision'> & { status: 'approved' | 'rejected' };

const tabs: { status: HubNewsStatus; label: string; empty: string }[] = [
  { status: 'pending', label: 'Pendentes', empty: 'Não há notícias por aprovar nesta página.' },
  { status: 'approved', label: 'No hub', empty: 'Não há notícias aprovadas nesta página.' },
  { status: 'rejected', label: 'Rejeitadas', empty: 'Não há notícias rejeitadas nesta página.' },
];

async function requestNews(query = '', init: RequestInit = {}) {
  const { data: { session } } = await supabasePKCE.auth.getSession();
  if (!session) return new Response(null, { status: 404 });

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  return fetch(`/api/admin/hub-news${query}`, { ...init, headers, cache: 'no-store' });
}

export default function NewsDesk() {
  const [query, setQuery] = useState<{ status: HubNewsStatus; page: number }>({ status: 'pending', page: 1 });
  const [list, setList] = useState<ListState>({ phase: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [action, setAction] = useState<'sync' | 'decision' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void requestNews(`?status=${query.status}&page=${query.page}`, { signal })
      .then(async (response) => {
        if (signal.aborted) return;
        if (response.status === 404) {
          setList({ phase: 'denied' });
          return;
        }
        if (!response.ok) throw new Error('News queue unavailable');
        const result: HubNewsPage = await response.json();
        if (!signal.aborted) setList({ phase: 'ready', result });
      })
      .catch(() => {
        if (!signal.aborted) setList({ phase: 'failed' });
      });
    return () => controller.abort();
  }, [query, refresh]);

  function reload() {
    setList({ phase: 'loading' });
    setRefresh((version) => version + 1);
  }

  function navigate(status: HubNewsStatus, page: number) {
    setList({ phase: 'loading' });
    setNotice(null);
    setQuery({ status, page });
  }

  async function submit(decision?: Decision) {
    if (action || list.phase !== 'ready') return;
    setAction(decision ? 'decision' : 'sync');
    setNotice(null);

    try {
      const response = await requestNews('', decision
        ? { method: 'PATCH', body: JSON.stringify(decision) }
        : { method: 'POST' });

      if (response.status === 409) {
        setNotice('A notícia foi alterada entretanto. A lista foi atualizada.');
        reload();
        return;
      }
      if (!response.ok) throw new Error('News action failed');

      if (decision) {
        setNotice(decision.status === 'approved'
          ? 'Notícia aprovada e disponível no hub.'
          : query.status === 'approved' ? 'Notícia retirada do hub.' : 'Notícia rejeitada.');
      } else {
        const result: HubNewsSync = await response.json();
        const count = result.added === 1 ? '1 notícia nova' : `${result.added} notícias novas`;
        const failures = result.failedSources.length
          ? ` Fontes indisponíveis: ${result.failedSources.join(', ')}.`
          : '';
        setNotice(`Sincronização concluída. ${count} por aprovar.${failures}`);
      }
      reload();
    } catch {
      setNotice(decision ? 'Não foi possível guardar a decisão.' : 'Não foi possível sincronizar as notícias.');
    } finally {
      setAction(null);
    }
  }

  if (list.phase === 'denied') {
    return (
      <main className="mx-auto max-w-lg space-y-3 px-4 py-10">
        <h1 className="text-2xl font-bold">Acesso restrito</h1>
        <p className="text-sm text-white/70">Entra com uma conta de administrador do Predictor.</p>
        <Link href="/auth" className="text-sm font-semibold text-sky-200 hover:underline">Entrar</Link>
      </main>
    );
  }

  const ready = list.phase === 'ready';
  const disabled = !ready || action !== null;
  const activeTab = tabs.find((tab) => tab.status === query.status);

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6" aria-busy={list.phase === 'loading' || action !== null}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Link href="/admin" className="text-sm font-semibold text-sky-200 hover:underline">← Backoffice</Link>
          <h1 className="text-3xl font-bold tracking-tight">Notícias do hub</h1>
          <p className="text-sm text-white/65">O sync corre a cada três horas. A aprovação publica a notícia no hub.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/hub" className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/5">Ver hub</Link>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void submit()}
            className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-45"
          >
            {action === 'sync' ? 'A sincronizar…' : 'Sincronizar agora'}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Estado das notícias">
        {tabs.map((tab) => (
          <button
            key={tab.status}
            type="button"
            aria-pressed={tab.status === query.status}
            disabled={action !== null}
            onClick={() => navigate(tab.status, 1)}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/5 aria-pressed:border-sky-300/30 aria-pressed:bg-sky-400/15"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice && <p className="rounded-xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100" role="status">{notice}</p>}
      {list.phase === 'loading' && <p className="text-sm text-white/60" role="status">A carregar notícias…</p>}
      {list.phase === 'failed' && (
        <div className="rounded-xl border border-white/10 p-4 text-sm">
          <p role="alert">Não foi possível carregar a fila de notícias.</p>
          <button type="button" onClick={reload} className="mt-2 font-semibold text-sky-200 hover:underline">Tentar novamente</button>
        </div>
      )}
      {ready && (
        <>
          {list.result.items.length === 0 ? (
            <p className="rounded-xl border border-white/10 p-4 text-sm text-white/65">{activeTab?.empty}</p>
          ) : (
            <ul className="space-y-2">
              {list.result.items.map((article) => (
                <li key={article.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.025] p-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold text-sky-200">
                      {article.source} · <time dateTime={article.publishedAt}>{formatHubNewsDate(article.publishedAt)}</time>
                    </p>
                    <h2 className="font-semibold">{article.title}</h2>
                    <a href={article.url} target="_blank" rel="noreferrer" className="text-xs text-sky-200 hover:underline">Ler na fonte ↗</a>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {article.status !== 'approved' && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void submit({ id: article.id, revision: article.revision, status: 'approved' })}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-45"
                      >
                        Aprovar
                      </button>
                    )}
                    {article.status !== 'rejected' && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void submit({ id: article.id, revision: article.revision, status: 'rejected' })}
                        className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-45"
                      >
                        {article.status === 'approved' ? 'Retirar do hub' : 'Rejeitar'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {(query.page > 1 || list.result.hasMore) && (
            <nav className="flex items-center gap-3 text-sm" aria-label="Paginação das notícias">
              <button type="button" disabled={disabled || query.page === 1} onClick={() => navigate(query.status, query.page - 1)} className="text-sky-200 disabled:opacity-40">Anterior</button>
              <span className="text-white/65">Página {query.page}</span>
              <button type="button" disabled={disabled || !list.result.hasMore} onClick={() => navigate(query.status, query.page + 1)} className="text-sky-200 disabled:opacity-40">Seguinte</button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
