'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { formatHubNewsDate } from '@/features/hub/news-date';
import { NewsImage } from '@/features/hub/news-image';
import type { HubArticle, HubNewsChanges, HubNewsItem, HubNewsPage, HubNewsStatus, HubNewsSync, HubSummarySettings } from '@/features/hub/types';
import { supabasePKCE } from '@/utils/supabase/client';
import SummaryEditor, { summaryMessages, type SummaryCommand } from './summary-editor';

type ListState = { phase: 'loading' | 'denied' | 'failed' } | { phase: 'ready'; result: HubNewsPage };
type Decision = Pick<HubNewsItem, 'id' | 'revision'> & { status: 'approved' | 'rejected' };
type NewsAction =
  | { type: 'sync' }
  | { type: 'decision'; decision: Decision }
  | { type: 'add'; article: Omit<HubArticle, 'source'> & { sourceExcerpt?: string | null } }
  | SummaryCommand;

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
  const [action, setAction] = useState<NewsAction['type'] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [summarySettings, setSummarySettings] = useState<HubSummarySettings | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void requestNews('?action=settings', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const settings: HubSummarySettings = await response.json();
      if (!controller.signal.aborted) setSummarySettings(settings);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [refresh]);

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

  async function submit(command: NewsAction) {
    if (action || list.phase !== 'ready') return false;
    setAction(command.type);
    setNotice(null);

    try {
      const response = command.type === 'context' || command.type === 'summary' || command.type === 'summaries'
        ? await requestNews('?action=' + command.type, { method: command.type === 'summaries' ? 'POST' : 'PATCH', body: JSON.stringify(command.payload) })
        : command.type === 'add'
        ? await requestNews('?action=add', { method: 'POST', body: JSON.stringify(command.article) })
        : command.type === 'decision'
          ? await requestNews('', { method: 'PATCH', body: JSON.stringify(command.decision) })
          : await requestNews('', { method: 'POST' });

      if (command.type === 'add' && (response.status === 400 || response.status === 409)) {
        setNotice(response.status === 409
          ? 'Esta ligação já foi adicionada.'
          : 'Confirma o título, a data e as ligações HTTPS da notícia e da imagem.');
        return false;
      }

      if (response.status === 409) {
        setNotice('A notícia foi alterada entretanto. A lista foi atualizada.');
        reload();
        return false;
      }
      if (command.type === 'summaries') {
        const result: { generated?: number; reason?: string } = await response.json();
        setNotice(result.generated ? 'Resumo gerado e guardado para revisão.' : summaryMessages[result.reason ?? ''] ?? 'Não foi possível gerar o resumo.');
        reload();
        return response.ok;
      }
      if (response.status === 400 && (command.type === 'summary' || command.type === 'context')) {
        setNotice(command.type === 'context' ? 'Confirma o contexto: máximo de 6 000 caracteres.' : 'Confirma o título e o resumo: entre 25 e 110 palavras, sem HTML nem links.');
        return false;
      }
      if (!response.ok) throw new Error('News action failed');

      if (command.type === 'context') {
        setNotice('Contexto guardado. O resumo será gerado para nova revisão.');
      } else if (command.type === 'summary') {
        setNotice(command.payload.decision === 'approved' ? 'Notícia e resumo publicados no Hub.'
          : command.payload.decision === 'draft' ? 'Rascunho guardado para revisão.' : 'Resumo retirado. A ligação à fonte mantém-se se a notícia estiver aprovada.');
      } else if (command.type === 'decision') {
        setNotice(command.decision.status === 'approved'
          ? query.status === 'approved' ? 'Imagem aprovada e disponível no hub.' : 'Notícia aprovada e disponível no hub.'
          : query.status === 'approved' ? 'Notícia retirada do hub.' : 'Notícia rejeitada.');
      } else if (command.type === 'add') {
        const result: HubNewsChanges = await response.json();
        if (result.added) setQuery({ status: 'pending', page: 1 });
        setNotice(result.added ? 'Notícia adicionada aos pendentes.' : 'Imagem adicionada para aprovação.');
      } else {
        const result: HubNewsSync = await response.json();
        const count = result.added === 1 ? '1 notícia nova' : `${result.added} notícias novas`;
        const failures = result.failedSources.length
          ? ` Fontes indisponíveis: ${result.failedSources.join(', ')}.`
          : '';
        const images = result.imagesAdded === 1
          ? ' Imagem encontrada numa notícia já guardada.'
          : result.imagesAdded ? ` Imagens encontradas em ${result.imagesAdded} notícias já guardadas.` : '';
        setNotice(`Sincronização concluída. ${count} por aprovar.${images}${failures}`);
      }
      reload();
      return true;
    } catch {
      setNotice(command.type === 'sync' ? 'Não foi possível sincronizar as notícias.' : 'Não foi possível guardar a alteração.');
      return false;
    } finally {
      setAction(null);
    }
  }

  async function addFromForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const publishedAt = new Date(String(values.get('publishedAt') ?? ''));
    if (!Number.isFinite(publishedAt.getTime())) {
      setNotice('Indica a data e hora da publicação.');
      return;
    }

    const added = await submit({
      type: 'add',
      article: {
        title: String(values.get('title') ?? ''),
        url: String(values.get('url') ?? ''),
        imageUrl: String(values.get('imageUrl') ?? '').trim() || null,
        sourceExcerpt: String(values.get('sourceExcerpt') ?? '').trim() || null,
        publishedAt: publishedAt.toISOString(),
      },
    });
    if (added) form.reset();
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
  const canGenerate = !!summarySettings?.enabled && summarySettings.keyConfigured && summarySettings.usage.requests < summarySettings.dailyLimit;

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
            onClick={() => void submit({ type: 'sync' })}
            className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-45"
          >
            {action === 'sync' ? 'A sincronizar…' : 'Sincronizar agora'}
          </button>
        </div>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-300/15 bg-sky-400/5 p-4" aria-label="Geração de resumos">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-sky-100">Resumos com revisão editorial</h2>
          <p className="text-xs text-white/65">{summarySettings
            ? !summarySettings.keyConfigured ? 'Falta configurar a chave OpenAI no Worker.'
              : !summarySettings.enabled ? 'A geração automática está desligada.'
                : `${summarySettings.usage.requests} de ${summarySettings.dailyLimit} pedidos de IA hoje (UTC). Modelo: ${summarySettings.model}.`
            : 'As opções de resumos ficam disponíveis depois da atualização do Worker e da BD.'}</p>
          <p className="text-xs text-white/55">A geração corre após o sync. Títulos sem contexto suficiente mantêm a ligação à fonte. Nada é publicado sem aprovação.</p>
        </div>
        <button type="button" className="rounded-lg border border-sky-300/20 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-white/5 disabled:opacity-40"
          disabled={disabled || !canGenerate} onClick={() => void submit({ type: 'summaries', payload: {} })}>{action === 'summaries' ? 'A gerar…' : 'Gerar próximo resumo'}</button>
      </section>

      <details className="rounded-xl border border-white/10 bg-white/[.025] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-sky-200">Adicionar notícia por ligação</summary>
        <form onSubmit={addFromForm} className="mt-3 grid gap-3 sm:grid-cols-2">
          <p className="text-xs text-white/65 sm:col-span-2">
            Podes adicionar notícias do FC Porto, d’O Jogo, do Jornal de Notícias e das restantes fontes.
          </p>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Título
            <input className="rounded-lg border border-white/15 bg-black/25 px-3 py-2" name="title" required maxLength={400} />
          </label>
          <label className="grid gap-1 text-sm">
            Ligação da notícia
            <input className="rounded-lg border border-white/15 bg-black/25 px-3 py-2" name="url" type="url" required maxLength={2048} />
          </label>
          <label className="grid gap-1 text-sm">
            Data e hora da publicação
            <input className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 [color-scheme:dark]" name="publishedAt" type="datetime-local" required />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Contexto factual para o resumo (opcional)
            <textarea className="rounded-lg border border-white/15 bg-black/25 px-3 py-2" name="sourceExcerpt" rows={3} maxLength={6000} disabled={!summarySettings}
              placeholder="Factos verificados na fonte. Uma notícia só com título não é suficiente para gerar um resumo." />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Ligação HTTPS da imagem (opcional)
            <input className="rounded-lg border border-white/15 bg-black/25 px-3 py-2" name="imageUrl" type="url" maxLength={2048} />
          </label>
          <button type="submit" disabled={disabled} className="justify-self-start rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-45">
            Guardar para revisão
          </button>
        </form>
      </details>

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
                  <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto">
                    <NewsImage src={article.imageUrl} className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-white/5 [&_img]:object-cover" />
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-semibold text-sky-200">
                        {article.source} · <time dateTime={article.publishedAt}>{formatHubNewsDate(article.publishedAt)}</time>
                      </p>
                      <h2 className="font-semibold">{article.title}</h2>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-sky-200">
                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">Ler na fonte ↗</a>
                        {article.status === 'approved' && <Link href={'/hub/noticias/' + article.id} className="hover:underline">Ver no Hub</Link>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(article.status !== 'approved' || (article.imageUrl && !article.imageApproved)) && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void submit({ type: 'decision', decision: { id: article.id, revision: article.revision, status: 'approved' } })}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-45"
                      >
                        {article.status === 'approved' ? 'Aprovar imagem' : 'Aprovar'}
                      </button>
                    )}
                    {article.status !== 'rejected' && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void submit({ type: 'decision', decision: { id: article.id, revision: article.revision, status: 'rejected' } })}
                        className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-45"
                      >
                        {article.status === 'approved' ? 'Retirar do hub' : 'Rejeitar'}
                      </button>
                    )}
                  </div>
                  <SummaryEditor key={article.id + ':' + article.revision} article={article} disabled={disabled} canGenerate={canGenerate} onSubmit={submit} />
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
