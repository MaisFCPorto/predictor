'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { HubNewsItem } from '@/features/hub/types';

export type SummaryCommand = { type: 'context' | 'summary' | 'summaries'; payload: Record<string, unknown> };
export const summaryMessages: Record<string, string> = {
  disabled: 'A geração de resumos está desligada no Worker.', missing_key: 'Falta configurar a chave OpenAI no Worker.',
  daily_limit: 'O limite diário de pedidos de IA foi atingido. Os restantes ficam para o próximo dia.',
  not_due: 'Não há notícias com contexto suficiente por resumir.', insufficient_context: 'A fonte não tem informação suficiente para um resumo.',
  attempt_limit: 'Esta versão atingiu o limite de tentativas. Revê o contexto antes de pedir uma nova síntese.',
  invalid_key: 'A chave OpenAI foi recusada. Confirma a configuração do Worker.', provider_limit: 'A OpenAI indicou um limite de utilização ou de créditos.',
  provider_error: 'A OpenAI está temporariamente indisponível.', request_failed: 'A geração foi interrompida. Podes tentar novamente, dentro do limite diário.',
  interrupted: 'O pedido foi interrompido. A repetição precisa de ser iniciada aqui para evitar consumo duplicado.',
  storage_failed: 'O resultado ficou guardado e será recuperado sem outro pedido à IA.',
  invalid_response: 'O texto gerado não passou a validação. Revê o contexto antes de tentar novamente.',
  incomplete_response: 'A resposta ficou incompleta. Revê o contexto antes de tentar novamente.',
  unsupported_numbers: 'O texto incluiu números que não constam do contexto. Não foi publicado.',
  too_similar: 'O texto ficou demasiado próximo da fonte. Não foi publicado.', refused: 'Não foi possível gerar este resumo.',
  input_changed: 'O contexto foi alterado durante a geração. A lista foi atualizada.',
};

const labels = { queued: 'Por gerar', processing: 'A gerar', draft: 'Para revisão', approved: 'Publicado', rejected: 'Retirado', failed: 'Precisa de atenção', insufficient: 'Falta contexto' };

export default function SummaryEditor({ article, disabled, canGenerate, onSubmit }: {
  article: HubNewsItem; disabled: boolean; canGenerate: boolean; onSubmit: (command: SummaryCommand) => Promise<boolean>;
}) {
  const [context, setContext] = useState(article.sourceExcerpt ?? '');
  const [title, setTitle] = useState(article.summaryTitle ?? '');
  const [text, setText] = useState(article.summaryText ?? '');
  const dirtyContext = context.trim() !== (article.sourceExcerpt ?? '').trim();
  const contextReady = (article.sourceExcerpt?.length ?? 0) >= 160 && (article.sourceExcerpt?.trim().split(/\s+/).length ?? 0) >= 25;
  const copyReady = title.trim().length >= 8 && text.trim().split(/\s+/).length >= 25;
  const state = article.summaryState;
  const canRequest = article.status !== 'rejected' && (!state || state === 'queued' || state === 'failed');
  const payload = { id: article.id, revision: article.revision };
  const button = 'rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/5 disabled:opacity-40';

  return <details open={state === 'draft' || state === 'failed'} className="w-full basis-full rounded-xl border border-white/10 bg-black/10 px-3 py-3">
    <summary className="cursor-pointer text-sm font-semibold text-sky-100">Resumo no Hub · {state ? labels[state] : contextReady ? 'Por gerar' : 'Falta contexto'}</summary>
    <div className="mt-4 space-y-4">
      <label className="grid gap-2 text-sm">
        Contexto factual da fonte
        <textarea value={context} onChange={(event) => setContext(event.target.value)} rows={4} maxLength={6000}
          className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm leading-relaxed"
          placeholder="Informação disponibilizada no feed ou factos verificados na publicação original." />
      </label>
      <p className="text-xs leading-relaxed text-white/55">O resumo usa apenas este contexto e o título. Nos feeds que só trazem títulos, acrescenta aqui os factos verificados. Alterar o contexto retira o resumo anterior para nova revisão.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={disabled || !dirtyContext}
          onClick={() => void onSubmit({ type: 'context', payload: { ...payload, context } })}>Guardar contexto</button>
        {canRequest && <button type="button" className={button} disabled={disabled || !canGenerate || !contextReady || dirtyContext}
          onClick={() => void onSubmit({ type: 'summaries', payload: { id: article.id } })}>{state === 'failed' ? 'Tentar novamente' : 'Gerar resumo'}</button>}
        {state === 'approved' && <Link href={'/hub/noticias/' + article.id} className={button}>Ver resumo no Hub</Link>}
      </div>
      {dirtyContext && <p className="text-xs text-amber-200">Guarda o contexto antes de gerar ou publicar o resumo.</p>}
      {article.summaryError && <p className="text-xs leading-relaxed text-amber-200" role="status">{summaryMessages[article.summaryError] ?? 'Não foi possível concluir o resumo.'}</p>}
      {(article.summaryText || article.summaryTitle) && <div className="space-y-3 border-t border-white/10 pt-4">
        <label className="grid gap-1 text-sm">Título do resumo
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} className="rounded-lg border border-white/15 bg-black/25 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">Resumo
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={6} maxLength={1400}
            className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm leading-relaxed" />
        </label>
        <p className="text-xs text-white/55">Confirma nomes, números, datas e atribuições na fonte antes de publicar. O resumo deve ter entre 25 e 110 palavras.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={disabled || dirtyContext || !copyReady}
            onClick={() => void onSubmit({ type: 'summary', payload: { ...payload, title, text, decision: 'draft' } })}>Guardar rascunho</button>
          <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-500 disabled:opacity-40"
            disabled={disabled || dirtyContext || !copyReady}
            onClick={() => void onSubmit({ type: 'summary', payload: { ...payload, title, text, decision: 'approved' } })}>Publicar notícia e resumo</button>
          {state !== 'rejected' && <button type="button" className={button} disabled={disabled}
            onClick={() => void onSubmit({ type: 'summary', payload: { ...payload, decision: 'rejected' } })}>{state === 'approved' ? 'Retirar resumo' : 'Rejeitar resumo'}</button>}
        </div>
      </div>}
    </div>
  </details>;
}
