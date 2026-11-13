'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { HubNewsItem } from '@/features/hub/types';

export type SummaryCommand = { type: 'context' | 'summary' | 'summaries'; payload: Record<string, unknown> };
export const summaryMessages: Record<string, string> = {
  disabled: 'A geração de resumos está desligada no Worker.', missing_key: 'Falta configurar a chave OpenAI no Worker.',
  daily_limit: 'O limite diário de pedidos de IA foi atingido. Os restantes ficam para o próximo dia.',
  not_due: 'Não há notícias com contexto suficiente por resumir.', insufficient_context: 'A fonte não tem informação suficiente para um resumo.',
  source_unavailable: 'Não foi possível ler texto suficiente no artigo original. A IA não foi chamada. Podes acrescentar o texto verificado abaixo.',
  attempt_limit: 'Esta versão atingiu o limite de tentativas. Revê o contexto antes de pedir uma nova síntese.',
  invalid_key: 'A chave OpenAI foi recusada. Confirma a configuração do Worker.', provider_limit: 'A OpenAI indicou um limite de utilização ou de créditos.',
  provider_error: 'A OpenAI está temporariamente indisponível.', request_failed: 'A geração foi interrompida. Podes tentar novamente, dentro do limite diário.',
  interrupted: 'O pedido foi interrompido. A repetição precisa de ser iniciada aqui para evitar consumo duplicado.',
  storage_failed: 'O resultado ficou guardado e será recuperado sem outro pedido à IA.',
  invalid_response: 'A resposta não passou a validação de formato. Se houver texto guardado, podes corrigi-lo abaixo sem pedir outra versão.',
  incomplete_response: 'A resposta ficou incompleta. Revê o contexto antes de tentar novamente.',
  unsupported_numbers: 'Há um número sem correspondência automática no contexto. Confirma o valor e a forma como está escrito na fonte.',
  too_similar: 'Há um trecho de pelo menos 20 palavras igual ao original. Reescreve esse trecho no texto guardado antes de publicar.', refused: 'Não foi possível gerar este resumo.',
  saved_response_available: 'A resposta já está guardada. Podes revê-la e editá-la sem um novo pedido à IA.',
  automatic_paused: 'A geração automática está pausada. Podes gerar uma notícia manualmente.',
  headline_length: 'O título deve ter entre 8 e 180 caracteres.',
  text_too_short: 'O texto tem menos de 90 palavras ou de 450 caracteres. Revê a resposta guardada antes de publicar.',
  text_too_long: 'O texto excede 350 palavras ou 4 500 caracteres. Reduz a resposta guardada antes de publicar.',
  missing_paragraphs: 'Separa o texto em pelo menos dois parágrafos.',
  unsafe_text: 'Remove o HTML e as ligações do título e do corpo da notícia.',
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
  const wordCount = text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  const contextReady = article.contextKind !== 'feed' && (article.sourceExcerpt?.length ?? 0) >= 500 && (article.sourceExcerpt?.match(/[\p{L}\p{N}]+/gu)?.length ?? 0) >= 90;
  const canRead = ['Maisfutebol', 'Record', 'A BOLA'].includes(article.source);
  const copyReady = title.trim().length >= 8 && title.trim().length <= 180 && wordCount >= 90 && wordCount <= 350 && text.trim().length >= 450 && text.trim().length <= 4500 && text.trim().split(/\n\s*\n/).filter(Boolean).length >= 2 && !/[<>]|https?:\/\/|\]\(/i.test(title + text);
  const dirtyCopy = title !== (article.summaryTitle ?? '') || text !== (article.summaryText ?? '');
  const state = article.summaryState;
  const canRequest = article.status !== 'rejected' && (!state || ['queued', 'failed', 'insufficient', 'draft'].includes(state));
  const payload = { id: article.id, revision: article.revision };
  const button = 'rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/5 disabled:opacity-40';

  return <details open={state === 'draft' || state === 'failed'} className="w-full basis-full rounded-xl border border-white/10 bg-black/10 px-3 py-3">
    <summary className="cursor-pointer text-sm font-semibold text-sky-100">Notícia adaptada no Hub · {state ? labels[state] : contextReady || canRead ? 'Por gerar' : 'Falta texto original'}</summary>
    <div className="mt-4 space-y-4">
      {canRequest && <button type="button" className={button} disabled={disabled || !canGenerate || (!contextReady && !canRead) || dirtyContext || dirtyCopy}
        onClick={() => void onSubmit({ type: 'summaries', payload: state === 'draft' || (state === 'failed' && article.summaryText) ? { ...payload, regenerate: true } : { id: article.id } })}>
        {state === 'draft' || state === 'failed' ? 'Gerar outra versão · novo pedido de IA' : 'Ler e adaptar notícia'}
      </button>}
      {article.summaryRecovered && <p className="text-sm text-sky-100">Resposta guardada para revisão. Podes editar e guardar este texto sem consumir outro pedido de IA.</p>}
      {!!article.summaryAttempts && <p className="text-xs text-white/55">{article.summaryAttempts} tentativa{article.summaryAttempts === 1 ? '' : 's'} nesta versão. Pedir outra versão consome quota; editar o texto guardado não consome.</p>}
      {!article.summaryText && <p className="text-sm text-white/65">{canRead
        ? 'O artigo original é lido antes de a IA escrever a notícia. O texto adaptado ficará aqui para revisão antes de ser publicado no Hub.'
        : contextReady ? 'O texto guardado da fonte será usado para preparar a notícia, que ficará aqui para revisão.'
          : article.source === 'O Jogo' ? 'O Jogo está a fornecer apenas títulos através do Google Notícias. O texto do artigo não foi recolhido. Para gerar a adaptação, acrescenta abaixo o texto original ou factos verificados na fonte.'
            : 'Esta fonte não disponibilizou o texto do artigo. Acrescenta abaixo o texto original ou factos verificados para preparar a adaptação.'}</p>}
      <details open={!canRead && !contextReady} className="rounded-lg border border-white/10 p-3">
      <summary className="cursor-pointer text-sm text-white/65">Texto original · {article.contextKind === 'article' ? 'Recolhido do artigo' : article.contextKind === 'manual' ? 'Revisto no backoffice' : article.contextKind === 'feed' ? 'Descrição RSS, artigo por ler' : 'Contexto guardado'}</summary>
      <label className="grid gap-2 text-sm">
        Texto e contexto da fonte
        <textarea value={context} onChange={(event) => setContext(event.target.value)} rows={4} maxLength={6000}
          className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm leading-relaxed"
          placeholder="Informação disponibilizada no feed ou factos verificados na publicação original." />
      </label>
      <p className="text-xs leading-relaxed text-white/55">A IA usa este texto e o título para escrever uma notícia com contexto, menções e detalhes presentes na fonte. Alterar o contexto retira a adaptação anterior para nova revisão.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={disabled || !dirtyContext}
          onClick={() => void onSubmit({ type: 'context', payload: { ...payload, context } })}>Guardar contexto</button>
      </div>
      </details>
      {state === 'approved' && <Link href={'/hub/noticias/' + article.id} className={button}>Ver notícia no Hub</Link>}
      {dirtyContext && <p className="text-xs text-amber-200">Guarda o contexto antes de gerar ou publicar o resumo.</p>}
      {article.summaryError && <p className="text-xs leading-relaxed text-amber-200" role="status">{summaryMessages[article.summaryIssue ?? article.summaryError] ?? 'Não foi possível concluir o resumo.'}</p>}
      {(article.summaryText || article.summaryTitle) && <div className="space-y-3 border-t border-white/10 pt-4">
        <label className="grid gap-1 text-sm">Título da notícia
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} className="rounded-lg border border-white/15 bg-black/25 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">Texto da notícia
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={10} maxLength={4500}
            className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm leading-relaxed" />
        </label>
        <p className="text-xs text-white/55">{wordCount} palavras · entre 90 e 350, em vários parágrafos. Confirma os nomes, factos, declarações e exemplos na fonte antes de publicar.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={disabled || dirtyContext || !copyReady}
            onClick={() => void onSubmit({ type: 'summary', payload: { ...payload, title, text, decision: 'draft' } })}>Guardar rascunho</button>
          <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-500 disabled:opacity-40"
            disabled={disabled || dirtyContext || !copyReady}
            onClick={() => void onSubmit({ type: 'summary', payload: { ...payload, title, text, decision: 'approved' } })}>Publicar notícia</button>
          {state !== 'rejected' && <button type="button" className={button} disabled={disabled}
            onClick={() => void onSubmit({ type: 'summary', payload: { ...payload, decision: 'rejected' } })}>{state === 'approved' ? 'Retirar resumo' : 'Rejeitar resumo'}</button>}
        </div>
      </div>}
    </div>
  </details>;
}
