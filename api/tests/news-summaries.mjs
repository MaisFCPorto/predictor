import assert from 'node:assert/strict';
import { setup, start, day, minute } from './support.mjs';

const context = 'A Liga Portugal anunciou a escolha de Jan Bednarek para o prémio de melhor defesa referente a setembro e outubro. Os treinadores atribuíram ao jogador 27,19 por cento dos votos. Kiwior foi o segundo classificado. Durante o período avaliado, o FC Porto ganhou seis partidas do campeonato, com Bednarek no onze inicial em todas. O central também marcou frente ao Moreirense.';
const headline = 'Defesa portista ocupa os primeiros lugares na votação da Liga';
const copy = 'Bednarek recebeu a distinção de melhor defesa numa eleição em que Kiwior ficou na segunda posição. As escolhas foram feitas pelos treinadores da competição. O vencedor esteve no onze inicial em seis partidas do campeonato e contribuiu para as vitórias do FC Porto nesse período.';
const complete = (changes = {}) => ({ status: 'completed', usage: { input_tokens: 2000, output_tokens: 300 },
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ sufficient: true, headline, summary: copy, ...changes }) }] }] });
const base = '/api/internal/hub-news';
async function scenario(name, run, options = {}) {
  const env = await setup({ disabled: true, news: true, newsAI: () => complete(), ...options });
  const api = (path = '', init = {}) => env.request(base + path, { ...init, headers: env.hubHeaders });
  const list = async (status = 'pending') => (await api('?status=' + status)).body.items;
  const add = async (source = 'rtp', suffix = '1', extra = {}) => {
    const hosts = { rtp: 'www.rtp.pt', ojogo: 'www.ojogo.pt', jn: 'www.jn.pt', mais: 'maisfutebol.iol.pt' };
    assert.equal((await api('', { method: 'POST', body: { title: 'FC Porto em destaque na eleição dos defesas ' + suffix,
      url: 'https://' + hosts[source] + '/noticias/fc-porto/teste-' + suffix,
      publishedAt: new Date(start).toISOString(), sourceExcerpt: context, ...extra } })).status, 201);
    return (await list()).find((item) => item.url.endsWith('/teste-' + suffix));
  };
  try { await run({ ...env, api, list, add }); console.log('PASS ' + name); }
  finally { await env.worker.dispose(); }
}

await scenario('missing credentials and disabled summaries make no DB or model requests', async ({ request, newsCalls }) => {
  assert.equal((await request('/__rehearsal/summaries')).body.reason, 'missing_key');
  assert.equal(newsCalls.length, 0);
}, { newsMissingKey: true, noSchema: true });
await scenario('disabled summaries do not require the migration', async ({ request, newsCalls }) => {
  assert.equal((await request('/__rehearsal/summaries')).body.reason, 'disabled');
  assert.equal(newsCalls.length, 0);
}, { newsDisabled: true, noSchema: true });

await scenario('generate, edit, approve, read and revoke with one paid request and no public drafts', async ({ add, api, list, request, newsCalls }) => {
  const initial = await add();
  assert.equal((await request(base + '/article/' + initial.id)).status, 404, 'The internal key is required');
  assert.equal((await api('/article/' + initial.id)).status, 404);
  assert.equal((await api('/summaries', { method: 'POST', body: { id: initial.id } })).body.generated, 1);
  const draft = (await list())[0];
  assert.equal(draft.summaryState, 'draft');
  assert.equal((await api('/published')).body.length, 0);
  assert.equal((await api('/article/' + initial.id)).status, 404);
  const publishedTitle = 'Dois centrais do FC Porto destacados pelos treinadores';
  assert.equal((await api('/summary', { method: 'PATCH', body: { id: draft.id, revision: draft.revision,
    title: publishedTitle, text: draft.summaryText, decision: 'approved' } })).status, 200);
  const published = (await api('/published')).body[0];
  assert.equal(published.summaryId, initial.id);
  assert.equal(published.title, publishedTitle);
  assert.equal((await api('/article/' + initial.id)).body.sourceUrl, initial.url);
  for (let index = 0; index < 4; index++) await api('/article/' + initial.id);
  await api('/summaries', { method: 'POST', body: { id: initial.id } });
  assert.equal(newsCalls.length, 1, 'Reading or requesting an existing summary never generates it again');
  assert.equal(newsCalls[0].model, 'gpt-6-luna');
  assert.equal(newsCalls[0].reasoning.effort, 'none');
  assert.equal(newsCalls[0].store, false);
  assert.equal(newsCalls[0].max_output_tokens, 1000);
  assert.equal(newsCalls[0].text.format.strict, true);
  assert.equal(newsCalls[0].tools, undefined, 'No browsing or external actions by the model');
  const approved = (await list('approved'))[0];
  await api('', { method: 'PATCH', body: { id: approved.id, revision: approved.revision, status: 'rejected' } });
  assert.equal((await api('/article/' + initial.id)).status, 404);
  assert.equal((await api('/published')).body.length, 0);
  assert.equal(newsCalls.length, 1);
});

await scenario('a context change invalidates the published summary and stale edits cannot remove its replacement', async ({ add, api, list, newsCalls }) => {
  const initial = await add();
  await api('/summaries', { method: 'POST', body: { id: initial.id } });
  const draft = (await list())[0];
  await api('/summary', { method: 'PATCH', body: { id: draft.id, revision: draft.revision, title: headline, text: copy, decision: 'approved' } });
  const approved = (await list('approved'))[0];
  const change = { id: approved.id, revision: approved.revision, context: context + ' A publicação foi confirmada pela organização da prova.' };
  assert.equal((await api('/context', { method: 'PATCH', body: change })).status, 200);
  assert.equal((await api('/article/' + approved.id)).status, 404);
  assert.equal((await api('/published')).body[0].summaryId, null);
  await api('/summaries', { method: 'POST', body: { id: approved.id } });
  assert.equal((await list('approved'))[0].summaryState, 'draft');
  assert.equal((await api('/context', { method: 'PATCH', body: change })).status, 409);
  assert.equal((await list('approved'))[0].summaryState, 'draft');
  assert.equal(newsCalls.length, 2);
});

await scenario('simultaneous requests share the article lease and daily budget', async ({ add, api, newsCalls }) => {
  const item = await add();
  await Promise.all(Array.from({ length: 4 }, () => api('/summaries', { method: 'POST', body: { id: item.id } })));
  assert.equal(newsCalls.length, 1);
  assert.equal((await api('/summary-settings')).body.usage.requests, 1);
});

await scenario('source priority and the daily request limit are enforced atomically and reset next day', async ({ add, api, request, newsCalls }) => {
  await add('mais', 'mais'); await add('jn', 'jn'); const preferred = await add('ojogo', 'ojogo');
  await Promise.all(Array.from({ length: 3 }, () => api('/summaries', { method: 'POST', body: {} })));
  assert.equal(newsCalls.length, 1);
  assert.equal(JSON.parse(newsCalls[0].input).source, 'O Jogo');
  assert.equal((await api('/summary-settings')).body.usage.requests, 1);
  assert.equal((await api('/summaries', { method: 'POST', body: {} })).body.reason, 'daily_limit');
  await request('/__rehearsal/summaries', { now: start + day });
  assert.equal(newsCalls.length, 2);
  assert.equal(JSON.parse(newsCalls[1].input).source, 'Jornal de Notícias');
  assert.ok(preferred.id);
}, { newsDailyLimit: 1 });

await scenario('title-only news never reaches the model and added context is sanitized', async ({ add, api, list, newsCalls }) => {
  const item = await add('rtp', 'short', { sourceExcerpt: '' });
  assert.equal((await api('/summaries', { method: 'POST', body: { id: item.id } })).body.reason, 'insufficient_context');
  assert.equal(newsCalls.length, 0);
  await api('/context', { method: 'PATCH', body: { id: item.id, revision: item.revision, context: '<script>attack()</script><p>' + context + '</p>' } });
  assert.equal((await list())[0].sourceExcerpt.includes('attack'), false);
  await api('/summaries', { method: 'POST', body: { id: item.id } });
  assert.equal(newsCalls.length, 1);
});

await scenario('refusals, insufficient information, invented numbers and copied text stay unpublished', async ({ add, api, list, newsProvider, newsCalls }) => {
  const cases = [
    [complete({ sufficient: false, headline: '', summary: '' }), 'insufficient'],
    [complete({ summary: copy + ' O jogador marcou 999 golos.' }), 'failed'],
    [complete({ summary: context }), 'failed'],
    [{ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }, 'failed'],
    [{ status: 'incomplete', output: [] }, 'failed'],
    [{ status: 'completed', output: [null] }, 'failed'],
  ];
  for (let index = 0; index < cases.length; index++) {
    const item = await add('rtp', String(index));
    newsProvider(() => cases[index][0]);
    await api('/summaries', { method: 'POST', body: { id: item.id } });
    assert.equal((await list()).find((row) => row.id === item.id).summaryState, cases[index][1]);
    assert.equal((await api('/article/' + item.id)).status, 404);
  }
  const before = newsCalls.length;
  await api('/summaries', { method: 'POST', body: {} });
  assert.equal(newsCalls.length, before, 'Failed content is not automatically regenerated');
});

await scenario('provider errors do not leak credentials or publish content', async ({ add, api, list, newsProvider }) => {
  const item = await add();
  newsProvider(() => Response.json({ error: { message: 'bad key local-test-openai' } }, { status: 401 }));
  const result = await api('/summaries', { method: 'POST', body: { id: item.id } });
  assert.equal(result.body.reason, 'invalid_key');
  assert.equal(JSON.stringify(result.body).includes('local-test-openai'), false);
  assert.equal(JSON.stringify(await list()).includes('local-test-openai'), false);
  assert.equal((await api('/published')).body.length, 0);
});

await scenario('a failed draft transaction reuses its saved model response without another charge', async ({ add, db, api, list, request, newsCalls }) => {
  const item = await add();
  await db.exec("CREATE TRIGGER fail_draft BEFORE UPDATE OF state ON hub_news_summaries WHEN NEW.state = 'draft' BEGIN SELECT RAISE(ABORT, 'test_failure'); END;");
  await api('/summaries', { method: 'POST', body: { id: item.id } });
  assert.equal((await list())[0].summaryError, 'storage_failed');
  assert.equal(newsCalls.length, 1);
  await db.exec('DROP TRIGGER fail_draft');
  await request('/__rehearsal/news', { method: 'POST' });
  assert.equal((await list())[0].summaryState, 'draft');
  assert.equal(newsCalls.length, 1);
  assert.equal((await api('/summary-settings')).body.usage.requests, 1);
});

await scenario('an interrupted model request requires an explicit retry', async ({ add, api, list, db, request, newsCalls }) => {
  const item = await add();
  await db.prepare("INSERT INTO hub_news_summaries (news_id, input_hash, state, lease_until) VALUES (?, '', 'queued', 0)").bind(item.id).run();
  // Fill the fingerprint through the real generator, then simulate a lost request after reservation.
  await api('/summaries', { method: 'POST', body: { id: item.id } });
  await db.prepare("UPDATE hub_news_summaries SET state='processing', response_json=NULL, headline=NULL, body=NULL, lease_until=? WHERE news_id=?")
    .bind(start + minute, item.id).run();
  await request('/__rehearsal/summaries', { now: start + 2 * minute });
  assert.equal(newsCalls.length, 1);
  assert.equal((await list())[0].summaryError, 'interrupted');
});

await scenario('news source outages do not stop generating already stored summaries', async ({ add, request, list, newsCalls }) => {
  await add();
  await request('/__rehearsal/news', { method: 'POST' });
  assert.equal(newsCalls.length, 1);
  assert.equal((await list())[0].summaryState, 'draft');
}, { newsFeeds: () => new Response('', { status: 503 }) });

await scenario('automatic runs generate at most four drafts and preserve reviewed summaries', async ({ add, request, list, newsCalls }) => {
  for (let index = 0; index < 6; index++) await add('rtp', String(index));
  await request('/__rehearsal/news', { method: 'POST' });
  assert.equal(newsCalls.length, 4);
  assert.equal((await list()).filter((row) => row.summaryState === 'draft').length, 4);
  await request('/__rehearsal/news', { method: 'POST' });
  assert.equal(newsCalls.length, 6);
  await request('/__rehearsal/news', { method: 'POST' });
  assert.equal(newsCalls.length, 6);
});

await scenario('manual retries remain bounded and invalid changes cannot expose drafts', async ({ add, api, list, newsProvider, newsCalls }) => {
  const item = await add();
  newsProvider(() => ({ status: 'incomplete', output: [] }));
  for (let index = 0; index < 4; index++) await api('/summaries', { method: 'POST', body: { id: item.id } });
  assert.equal(newsCalls.length, 3);
  const current = (await list())[0];
  assert.equal((await api('/summary', { method: 'PATCH', body: { id: current.id, revision: current.revision, title: '<script>x</script>', text: copy, decision: 'approved' } })).status, 400);
  assert.equal((await api('/summaries', { method: 'POST', body: null })).status, 400);
  assert.equal((await api('/article/' + item.id)).status, 404);
});

const rss = (title, link, publisher, description = '', date = start) => `<rss><channel><item><title><![CDATA[${title}]]></title><link>${link}</link><pubDate>${new Date(date).toUTCString()}</pubDate><description><![CDATA[${description}]]></description>${publisher ? `<source url="https://${publisher}">source</source>` : ''}</item></channel></rss>`;
await scenario('O Jogo and JN public metadata are authenticated by publisher and Maisfutebol keeps its factual excerpt', async ({ api, list, newsCalls }) => {
  const result = await api('/sync', { method: 'POST' });
  assert.equal(result.body.added, 3);
  const items = await list();
  assert.deepEqual(items.map((row) => row.source), ['O Jogo', 'Jornal de Notícias', 'Maisfutebol']);
  assert.equal(items[0].sourceExcerpt, null);
  assert.equal(items[1].sourceExcerpt, null);
  assert.ok(items[2].sourceExcerpt.length >= 160);
  await api('/sync', { method: 'POST' });
  assert.equal((await list()).length, 3);
  assert.equal(newsCalls.length, 0);
}, { newsFeeds: (url) => {
  let xml = '<rss><channel></channel></rss>';
  if (url.hostname === 'news.google.com') {
    const ojogo = url.searchParams.get('q').includes('ojogo.pt');
    xml = rss('FC Porto vence o clássico - ' + (ojogo ? 'O Jogo' : 'Jornal de Notícias'),
      'https://news.google.com/rss/articles/' + (ojogo ? 'testOJ' : 'testJN'), ojogo ? 'www.ojogo.pt' : 'www.jn.pt', context);
  }
  if (url.hostname === 'maisfutebol.iol.pt') xml = rss('FC Porto em destaque', 'https://maisfutebol.iol.pt/fc-porto/test', '', context);
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml' } });
} });

await scenario('a Google feed cannot impersonate a different publisher', async ({ api, list }) => {
  assert.equal((await api('/sync', { method: 'POST' })).body.added, 0);
  assert.equal((await list()).length, 0);
}, { newsFeeds: (url) => new Response(url.hostname === 'news.google.com'
  ? rss('FC Porto - O Jogo', 'https://news.google.com/rss/articles/fake', 'untrusted.example')
  : '<rss><channel></channel></rss>', { headers: { 'Content-Type': 'application/rss+xml' } }) });

await scenario('older articles are generated only on explicit request and stay inside the daily quota', async ({ add, request, api, newsCalls }) => {
  const item = await add('rtp', 'older', { publishedAt: new Date(start - 10 * day).toISOString() });
  await request('/__rehearsal/summaries');
  assert.equal(newsCalls.length, 0);
  assert.equal((await api('/summaries', { method: 'POST', body: { id: item.id } })).body.generated, 1);
  assert.equal(newsCalls.length, 1);
  assert.equal((await api('/summary-settings')).body.usage.requests, 1);
});

console.log('\nNotícias verificadas em D1 descartável, com respostas simuladas da IA e sem pedidos pagos.');
