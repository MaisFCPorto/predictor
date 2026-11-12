import assert from 'node:assert/strict';
import { setup, start, day, minute } from './support.mjs';

const context = "A Liga Portugal anunciou a escolha de Jan Bednarek para o prémio de melhor defesa referente a setembro e outubro. Os treinadores atribuíram ao jogador 27,19 por cento dos votos. Kiwior foi o segundo classificado. Durante o período avaliado, o FC Porto ganhou seis partidas do campeonato, com Bednarek no onze inicial em todas. O central também marcou frente ao Moreirense. A distinção foi atribuída com base na participação dos treinadores da competição, que escolheram os jogadores destacados neste período. O resultado colocou dois elementos da defesa portista nas primeiras posições da eleição. A organização explicou que a votação incidiu sobre os desempenhos individuais ao longo dos meses em análise, sem alterar os resultados alcançados pelas equipas no campeonato.";
const headline = "Defesa portista ocupa os primeiros lugares na votação da Liga";
const copy = "Jan Bednarek foi o jogador escolhido pelos treinadores para receber a distinção de melhor defesa da Liga. Na votação relativa a setembro e outubro, o central recolheu 27,19 por cento das preferências. Kiwior terminou imediatamente atrás, colocando a defesa portista em evidência nesta eleição.\n\nA escolha acompanhou um período de resultados positivos para os dragões. O FC Porto venceu seis encontros do campeonato e Bednarek começou todos como titular. O contributo do defesa também se fez sentir na frente de ataque, onde marcou no encontro com o Moreirense.\n\nO galardão resulta das escolhas feitas pelos técnicos da competição sobre os desempenhos individuais durante o período analisado. Os resultados da votação destacam, assim, dois companheiros da mesma equipa nas posições cimeiras.";
const complete = (changes = {}) => ({ status: 'completed', usage: { input_tokens: 2000, output_tokens: 300 },
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ sufficient: true, headline, summary: copy, ...changes }) }] }] });
const base = '/api/internal/hub-news';
async function scenario(name, run, options = {}) {
  const env = await setup({ disabled: true, news: true, newsAI: () => complete(), ...options });
  const api = (path = '', init = {}) => env.request(base + path, { ...init, headers: env.hubHeaders });
  const list = async (status = 'pending') => (await api('?status=' + status)).body.items;
  const add = async (source = 'rtp', suffix = '1', extra = {}) => {
    const hosts = { rtp: 'www.rtp.pt', ojogo: 'www.ojogo.pt', mais: 'maisfutebol.iol.pt' };
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
  assert.equal(newsCalls[0].max_output_tokens, 2000);
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
  const page = (await api('/article/' + approved.id)).body;
  assert.equal(page.title, approved.title);
  assert.equal(page.summary, null, 'The approved story keeps its own page without exposing the withdrawn summary');
  assert.equal(page.generatedAt, null);
  assert.equal(JSON.stringify(page).includes(context), false);
  assert.equal((await api('/published')).body[0].summaryId, null);
  await api('/summaries', { method: 'POST', body: { id: approved.id } });
  assert.equal((await list('approved'))[0].summaryState, 'draft');
  assert.equal((await api('/context', { method: 'PATCH', body: change })).status, 409);
  assert.equal((await list('approved'))[0].summaryState, 'draft');
  assert.equal(newsCalls.length, 2);
});

await scenario('all approved stories have an internal page while draft summaries and source context stay private', async ({ add, api, list, newsCalls }) => {
  const item = await add('ojogo', 'headline-only', { sourceExcerpt: '' });
  assert.equal((await api('/article/' + item.id)).status, 404, 'Pending stories remain private');
  assert.equal((await api('', { method: 'PATCH', body: { id: item.id, revision: item.revision, status: 'approved' } })).status, 200);
  const page = await api('/article/' + item.id);
  assert.equal(page.status, 200);
  assert.equal(page.body.title, item.title);
  assert.equal(page.body.summary, null);
  assert.equal(page.body.sourceUrl, item.url);
  assert.equal(page.body.generatedAt, null);
  assert.equal(page.body.sourceExcerpt, undefined);
  assert.equal((await api('/published')).body[0].articleId, item.id);
  assert.equal((await api('/published')).body[0].summaryId, null);
  assert.equal(newsCalls.length, 0, 'Opening a story does not request or charge a summary');
  let current = (await list('approved'))[0];
  await api('/context', { method: 'PATCH', body: { id: item.id, revision: current.revision, context } });
  await api('/summaries', { method: 'POST', body: { id: item.id } });
  const draftPage = (await api('/article/' + item.id)).body;
  assert.equal(draftPage.summary, null);
  assert.equal(draftPage.title, item.title);
  assert.equal(draftPage.generatedAt, null);
  assert.equal(JSON.stringify(draftPage).includes(headline), false);
  assert.equal(JSON.stringify(draftPage).includes(context), false);
  current = (await list('approved'))[0];
  await api('', { method: 'PATCH', body: { id: item.id, revision: current.revision, status: 'rejected' } });
  assert.equal((await api('/article/' + item.id)).status, 404, 'Withdrawing the story also withdraws its internal page');
});

await scenario('simultaneous requests share the article lease and daily budget', async ({ add, api, newsCalls }) => {
  const item = await add();
  await Promise.all(Array.from({ length: 4 }, () => api('/summaries', { method: 'POST', body: { id: item.id } })));
  assert.equal(newsCalls.length, 1);
  assert.equal((await api('/summary-settings')).body.usage.requests, 1);
});

await scenario('source priority and the daily request limit are enforced atomically and reset next day', async ({ add, api, request, newsCalls }) => {
  await add('rtp', 'rtp'); await add('mais', 'mais'); const preferred = await add('ojogo', 'ojogo');
  await Promise.all(Array.from({ length: 3 }, () => api('/summaries', { method: 'POST', body: {} })));
  assert.equal(newsCalls.length, 1);
  assert.equal(JSON.parse(newsCalls[0].input).source, 'O Jogo');
  assert.equal((await api('/summary-settings')).body.usage.requests, 1);
  assert.equal((await api('/summaries', { method: 'POST', body: {} })).body.reason, 'daily_limit');
  await request('/__rehearsal/summaries', { now: start + day });
  assert.equal(newsCalls.length, 2);
  assert.equal(JSON.parse(newsCalls[1].input).source, 'Maisfutebol');
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
    [complete({ summary: context.replace('. ', '.\n\n') }), 'failed'],
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
await scenario('O Jogo metadata is authenticated by publisher and Maisfutebol keeps its factual excerpt', async ({ api, list, newsCalls }) => {
  const result = await api('/sync', { method: 'POST' });
  assert.equal(result.body.added, 2);
  const items = await list();
  assert.deepEqual(items.map((row) => row.source), ['O Jogo', 'Maisfutebol']);
  assert.equal(items[0].sourceExcerpt, null);
  assert.ok(items[1].sourceExcerpt.length >= 160);
  await api('/sync', { method: 'POST' });
  assert.equal((await list()).length, 2);
  assert.equal(newsCalls.length, 0);
}, { newsFeeds: (url) => {
  let xml = '<rss><channel></channel></rss>';
  if (url.hostname === 'news.google.com') {
    assert.ok(url.searchParams.get('q').includes('"FC Porto"'));
    assert.ok(url.searchParams.get('q').includes('site:ojogo.pt'));
    xml = rss('FC Porto vence o clássico - O Jogo', 'https://news.google.com/rss/articles/testOJ', 'www.ojogo.pt', context);
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

const maisOrigin = 'https://maisfutebol.iol.pt';
const maisPath = '/fc-porto/defesas/eleicao-dos-centrais';
const htmlResponse = (html) => new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const emptyFeed = () => new Response('<rss><channel></channel></rss>', { headers: { 'Content-Type': 'application/rss+xml' } });
const section = (paths = [maisPath]) => `<div class="newsList"><ul>${paths.map((path) => `<li><div class="itemListaNoticias"><a href="${path}"><img data-src="https://img.iol.pt/image/id/test/300"></a><div class="newsTitle"><h2><a href="${path}">A eleição dos centrais</a></h2></div></div></li>`).join('')}</ul></div>`;
const publicArticle = (path = maisPath, metadata = {}, body = context) => `<html><head><script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', mainEntityOfPage: { '@id': maisOrigin + path },
  headline, datePublished: new Date(start).toISOString(), ...metadata })}</script></head><body><div class="articleBody"><body><p>${body}</p><div hidden><p>SECRET_HIDDEN factos privados 9999</p></div><div style="display: none"><p>SECRET_STYLE</p></div><div class="mcd-hidden-block"><p>SECRET_CSS</p></div><div class="pub-outer-wrapper"><p>ADVERTISING_TEXT</p></div><p><script>UNTRUSTED_SCRIPT</script></p></body></div><aside><p>RELATED_NEWS</p></aside></body></html>`;

await scenario('Maisfutebol section discovers public articles, extracts their text and reuses it for one automatic draft', async ({ api, list, request, newsCalls, sourceCalls }) => {
  const sync = await api('/sync', { method: 'POST' });
  assert.equal(sync.status, 200);
  assert.equal(sync.body.added, 1);
  assert.equal(sync.body.articlesRead, 1);
  const item = (await list())[0];
  assert.equal(item.title, headline, 'The publisher metadata supplies the actual article title');
  assert.equal(item.imageUrl, 'https://img.iol.pt/image/id/test/300');
  assert.equal(item.sourceExcerpt, context);
  await request('/__rehearsal/news', { method: 'POST' });
  assert.equal((await list())[0].summaryState, 'draft');
  assert.equal(newsCalls.length, 1);
  assert.equal(JSON.parse(newsCalls[0].input).context, context);
  await request('/__rehearsal/news', { method: 'POST' });
  assert.equal(newsCalls.length, 1);
  assert.equal(sourceCalls.filter((url) => url === maisOrigin + maisPath).length, 1, 'Stored context avoids another article read');
}, { newsFeeds: (url) => url.pathname === '/fc-porto' ? htmlResponse(section())
  : url.pathname === maisPath ? htmlResponse(publicArticle()) : emptyFeed() });

await scenario('the Maisfutebol section remains usable when the RSS feeds are unavailable', async ({ api, list }) => {
  const result = await api('/sync', { method: 'POST' });
  assert.equal(result.status, 200);
  assert.equal(result.body.added, 1);
  assert.equal(result.body.failedSources.includes('Maisfutebol'), false);
  assert.equal(result.body.failedSources.length, 5);
  assert.equal((await list())[0].sourceExcerpt, context);
}, { newsFeeds: (url) => url.hostname === 'maisfutebol.iol.pt' && url.pathname === '/fc-porto' ? htmlResponse(section())
  : url.hostname === 'maisfutebol.iol.pt' && url.pathname === maisPath ? htmlResponse(publicArticle()) : new Response('', { status: 503 }) });

await scenario('public article reads fill short RSS context and keep the saved text on the next sync', async ({ add, db, api, list, sourceCalls, newsCalls }) => {
  const path = '/noticias/fc-porto/teste-short-rss';
  await add('mais', 'short-rss', { sourceExcerpt: 'Uma breve informação disponibilizada no RSS.' });
  await db.prepare("UPDATE hub_news SET context_kind = 'feed'").run();
  await api('/sync', { method: 'POST' });
  assert.equal((await list())[0].sourceExcerpt, context);
  await api('/sync', { method: 'POST' });
  assert.equal(sourceCalls.filter((url) => url === maisOrigin + path).length, 1);
  assert.equal(newsCalls.length, 0, 'Collecting factual context does not call the model');
}, { newsFeeds: (url) => url.hostname === 'maisfutebol.iol.pt' && url.pathname === '/rss.xml'
  ? new Response(rss('FC Porto em destaque', maisOrigin + '/noticias/fc-porto/teste-short-rss', '', 'Uma breve informação disponibilizada no RSS.'), { headers: { 'Content-Type': 'application/rss+xml' } })
  : url.pathname === '/noticias/fc-porto/teste-short-rss' ? htmlResponse(publicArticle(url.pathname)) : emptyFeed() });

let editingDb;
await scenario('an editor change during a public article read is never overwritten', async ({ add, api, list, db }) => {
  const item = await add('mais', 'concurrent', { sourceExcerpt: 'Breve informação inicial.' });
  await db.prepare("UPDATE hub_news SET context_kind = 'feed'").run();
  editingDb = db;
  await api('/sync', { method: 'POST' });
  assert.equal((await list())[0].id, item.id);
  assert.equal((await list())[0].sourceExcerpt, context + ' Contexto confirmado pelo editor.');
}, { newsFeeds: async (url) => {
  if (url.hostname === 'maisfutebol.iol.pt' && url.pathname === '/rss.xml') return new Response(rss('FC Porto em destaque', maisOrigin + '/noticias/fc-porto/teste-concurrent', '', 'Breve informação inicial.'), { headers: { 'Content-Type': 'application/rss+xml' } });
  if (url.pathname === '/noticias/fc-porto/teste-concurrent') {
    await editingDb.prepare('UPDATE hub_news SET source_excerpt = ?, revision = revision + 1 WHERE url = ?').bind(context + ' Contexto confirmado pelo editor.', url.href).run();
    return htmlResponse(publicArticle(url.pathname));
  }
  return emptyFeed();
} });

await scenario('article collection is limited to four reads per sync and does not revisit saved stories', async ({ api, list, sourceCalls }) => {
  const first = await api('/sync', { method: 'POST' });
  assert.equal(first.body.articlesRead, 4);
  assert.equal((await list()).length, 4);
  const second = await api('/sync', { method: 'POST' });
  assert.equal(second.body.articlesRead, 3);
  assert.equal((await list()).length, 7);
  await api('/sync', { method: 'POST' });
  assert.equal(sourceCalls.filter((url) => url.startsWith(maisOrigin + '/fc-porto/defesas/')).length, 7);
}, { newsFeeds: (url) => url.pathname === '/fc-porto' ? htmlResponse(section(Array.from({ length: 7 }, (_, index) => '/fc-porto/defesas/artigo-' + index)))
  : url.pathname.startsWith('/fc-porto/defesas/') ? htmlResponse(publicArticle(url.pathname)) : emptyFeed() });

await scenario('external links and redirects cannot make the article reader contact another service', async ({ api, list, sourceCalls }) => {
  await api('/sync', { method: 'POST' });
  assert.equal((await list()).length, 0);
  assert.equal(sourceCalls.some((url) => url.startsWith('https://untrusted.example') || url.includes('127.0.0.1')), false);
}, { newsFeeds: (url) => url.pathname === '/fc-porto' ? htmlResponse(section(['https://untrusted.example/fc-porto/news/1', 'http://127.0.0.1/private/a', maisPath]))
  : url.pathname === maisPath ? new Response(null, { status: 302, headers: { Location: 'https://untrusted.example/article' } }) : emptyFeed() });

await scenario('restricted articles, unrelated canonical metadata and old or future stories are not imported as factual context', async ({ api, list, newsCalls }) => {
  await api('/sync', { method: 'POST' });
  assert.equal((await list()).length, 0);
  assert.equal(newsCalls.length, 0);
}, { newsFeeds: (url) => {
  if (url.pathname === '/fc-porto') return htmlResponse(section(['restricted', 'unrelated', 'old', 'future'].map((name) => '/fc-porto/defesas/' + name)));
  if (url.pathname.endsWith('/restricted')) return htmlResponse(publicArticle(url.pathname, { isAccessibleForFree: false }));
  if (url.pathname.endsWith('/unrelated')) return htmlResponse(publicArticle(url.pathname, { mainEntityOfPage: { '@id': maisOrigin + '/outro/artigo/diferente' } }));
  if (url.pathname.endsWith('/old')) return htmlResponse(publicArticle(url.pathname, { datePublished: new Date(start - 8 * day).toISOString() }));
  if (url.pathname.endsWith('/future')) return htmlResponse(publicArticle(url.pathname, { datePublished: new Date(start + day).toISOString() }));
  return emptyFeed();
} });

await scenario('an unavailable publisher or a title-only public article never triggers a paid summary', async ({ request, list, newsCalls }) => {
  await request('/__rehearsal/news', { method: 'POST' });
  assert.equal((await list()).length, 1);
  assert.equal((await list())[0].sourceExcerpt, null);
  assert.equal(newsCalls.length, 0);
}, { newsFeeds: (url) => url.pathname === '/fc-porto' ? htmlResponse(section([maisPath, '/fc-porto/defesas/unavailable']))
  : url.pathname === maisPath ? htmlResponse(publicArticle(maisPath, {}, ''))
    : url.pathname.endsWith('/unavailable') ? new Response('', { status: 403 }) : emptyFeed() });

await scenario('unreadable articles back off so they cannot starve the remaining section stories', async ({ api, list, sourceCalls }) => {
  await api('/sync', { method: 'POST' });
  assert.equal((await list()).length, 0);
  await api('/sync', { method: 'POST' });
  assert.equal((await list()).length, 1);
  for (let index = 0; index < 4; index++) assert.equal(sourceCalls.filter((url) => url === maisOrigin + '/fc-porto/defesas/blocked-' + index).length, 1);
}, { newsFeeds: (url) => url.pathname === '/fc-porto' ? htmlResponse(section([...Array.from({ length: 4 }, (_, index) => '/fc-porto/defesas/blocked-' + index), maisPath]))
  : url.pathname.includes('/blocked-') ? new Response('', { status: 403 })
    : url.pathname === maisPath ? htmlResponse(publicArticle()) : emptyFeed() });

await scenario('the section headline is collected even when its title does not mention FC Porto', async ({ api, list }) => {
  await api('/sync', { method: 'POST' });
  const item = (await list())[0];
  assert.equal(item.url, maisOrigin + maisPath);
  assert.equal(item.sourceExcerpt, context);
  assert.equal(item.imageUrl, 'https://img.iol.pt/image/id/lead/800');
}, { newsFeeds: (url) => url.pathname === '/fc-porto'
  ? htmlResponse(`<div class="newsList"><div class="fistTitle"><a href="${maisPath}"><div data-src="https://img.iol.pt/image/id/lead/800"></div><h1>Um destaque dos centrais</h1><h2>Descrição curta</h2></a></div></div>`)
  : url.pathname === maisPath ? htmlResponse(publicArticle()) : emptyFeed() });

const recordPath = '/futebol/fc-porto/detalhe/exemplo-do-comunicado';
const recordPage = () => `<html><script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', mainEntityOfPage: { '@id': 'https://www.record.pt' + recordPath }, headline, datePublished: new Date(start).toISOString(), isAccessibleForFree: true })}</script><div class="news-content"><p class="news-content__paragraph">${context}</p></div></html>`;
await scenario('a Record RSS teaser is replaced by the original article before model generation', async ({ api, list, newsCalls }) => {
  await api('/sync', { method: 'POST' });
  const item = (await list())[0];
  assert.equal(item.contextKind, 'article');
  assert.equal(item.sourceExcerpt, context);
  await api('/summaries', { method: 'POST', body: { id: item.id } });
  assert.equal(newsCalls.length, 1);
  assert.equal(JSON.parse(newsCalls[0].input).context, context);
  assert.ok(newsCalls[0].instructions.includes('menções'));
  assert.ok(newsCalls[0].instructions.includes('exemplos'));
}, { newsFeeds: (url) => url.hostname === 'www.record.pt' && url.pathname === '/rss/'
  ? new Response(rss('FC Porto: os defesas em destaque', 'https://www.record.pt' + recordPath, '', 'Médio do FC Porto subscreveu comunicado'), { headers: { 'Content-Type': 'application/rss+xml' } })
  : url.hostname === 'www.record.pt' && url.pathname === recordPath ? htmlResponse(recordPage()) : emptyFeed() });

await scenario('opening an article on demand reads its source before generating and stores the provenance', async ({ api, db, newsCalls }) => {
  await db.prepare("INSERT INTO hub_news(title,url,source,published_at,source_excerpt,context_kind) VALUES(?,?,?,?,?,'feed')")
    .bind(headline, 'https://www.record.pt' + recordPath, 'Record', new Date(start).toISOString(), 'Médio do FC Porto subscreveu comunicado').run();
  const item = (await api()).body.items[0];
  const result = await api('/summaries', { method: 'POST', body: { id: item.id } });
  assert.equal(result.body.generated, 1);
  assert.equal(newsCalls.length, 1);
  assert.equal((await api()).body.items[0].contextKind, 'article');
}, { newsFeeds: (url) => url.hostname === 'www.record.pt' && url.pathname === recordPath ? htmlResponse(recordPage()) : emptyFeed() });

await scenario('feed descriptions alone never become article bodies, even when long enough', async ({ db, request, newsCalls }) => {
  await db.prepare("INSERT INTO hub_news(title,url,source,published_at,source_excerpt,context_kind) VALUES(?,?,?,?,?,'feed')")
    .bind(headline, 'https://www.rtp.pt/noticias/teste/long-feed', 'RTP Notícias', new Date(start).toISOString(), context).run();
  await request('/__rehearsal/summaries');
  assert.equal(newsCalls.length, 0);
});

await scenario('one-line teasers and single-paragraph responses fail article validation', async ({ add, api, newsProvider, list }) => {
  const item = await add();
  for (const body of ['Médio do FC Porto subscreveu comunicado', copy.replace(/\n/g, ' ')]) {
    newsProvider(() => complete({ summary: body }));
    const result = await api('/summaries', { method: 'POST', body: { id: item.id } });
    assert.equal(result.body.generated, 0);
    assert.equal((await list())[0].summaryState, 'failed');
  }
});

await scenario('a draft can be regenerated explicitly without rewriting approved articles or escaping the daily ceiling', async ({ add, api, list, newsCalls }) => {
  const item = await add();
  await api('/summaries', { method: 'POST', body: { id: item.id } });
  let draft = (await list())[0];
  assert.equal((await api('/summaries', { method: 'POST', body: { id: item.id, regenerate: true, revision: draft.revision - 1 } })).status, 409);
  await api('/summaries', { method: 'POST', body: { id: item.id, regenerate: true, revision: draft.revision } });
  assert.equal(newsCalls.length, 2);
  draft = (await list())[0];
  await api('/summary', { method: 'PATCH', body: { id: item.id, revision: draft.revision, title: headline, text: copy, decision: 'approved' } });
  const approved = (await list('approved'))[0];
  assert.equal((await api('/summaries', { method: 'POST', body: { id: item.id, regenerate: true, revision: approved.revision } })).status, 409);
  assert.equal(newsCalls.length, 2);
});

await scenario('Google metadata has a fixed authenticated fallback and still validates each publisher', async ({ api, list, sourceCalls }) => {
  const result = await api('/sync', { method: 'POST' });
  assert.equal(result.body.failedSources.includes('O Jogo'), false);
  assert.deepEqual((await list()).map((item) => item.source), ['O Jogo']);
  assert.equal(sourceCalls.filter((url) => url.startsWith('https://maispredictor.app/')).length, 1);
  const filtered = await api('?status=pending&source=O%20Jogo');
  assert.equal(filtered.body.items.length, 1);
  assert.equal(filtered.body.sources.find((item) => item.source === 'O Jogo').count, 1);
  assert.equal((await api('?source=not-a-source')).status, 400);
}, { newsProxyOrigin: 'https://maispredictor.app', newsFeeds: (url, request) => {
  if (url.hostname === 'news.google.com') { assert.equal(request.headers.get('x-hub-news-key'), null); return new Response('', { status: 403 }); }
  if (url.hostname === 'maispredictor.app') {
    assert.equal(request.headers.get('x-hub-news-key'), 'local-test-hub');
    assert.ok(url.pathname.endsWith('/ojogo'));
    return new Response(rss('FC Porto em destaque - O Jogo', 'https://news.google.com/rss/articles/ojogo-test', 'www.ojogo.pt'), { headers: { 'Content-Type': 'application/rss+xml' } });
  }
  return emptyFeed();
} });

await scenario('a configured foreign feed fallback never receives credentials', async ({ api, sourceCalls }) => {
  const result = await api('/sync', { method: 'POST' });
  assert.ok(result.body.failedSources.includes('O Jogo'));
  assert.equal(sourceCalls.some((url) => url.includes('untrusted.example')), false);
}, { newsProxyOrigin: 'https://untrusted.example', newsFeeds: (url) => url.hostname === 'news.google.com' ? new Response('', { status: 403 }) : emptyFeed() });

await scenario('A BOLA article bodies include named headings and work with self-closing SVG icons', async ({ api, list }) => {
  await api('/sync', { method: 'POST' });
  const item = (await list())[0];
  assert.equal(item.contextKind, 'article');
  assert.ok(item.sourceExcerpt.includes('Jan Bednarek'));
  assert.ok(item.sourceExcerpt.includes('Kiwior'));
}, { newsFeeds: (url) => {
  const articleUrl = 'https://www.abola.pt/noticias/fc-porto-exemplo';
  if (url.hostname === 'www.abola.pt' && url.pathname === '/rss-articles.xml') return new Response(rss('FC Porto: a votação', articleUrl, '', 'Descrição curta'), { headers: { 'Content-Type': 'application/rss+xml' } });
  if (url.href === articleUrl) return htmlResponse(`<html><svg aria-hidden="true"><path d="M0 0"/></svg><script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'NewsArticle', headline, mainEntityOfPage: { '@id': articleUrl }, datePublished: new Date(start).toISOString(), isAccessibleForFree: 'true' }] })}</script><section id="article_body"><h2>Jan Bednarek e Kiwior</h2><p>${context}</p></section></html>`);
  return emptyFeed();
} });

await scenario('a developed adaptation keeps the allegations attributed and preserves the named signatories', async ({ add, api, list, newsProvider }) => {
  const facts = 'A seleção da Coreia do Sul foi tema de notícias sobre alegados problemas internos. Alguns relatos apontaram que jogadores mais experientes, associados à chamada geração 96, teriam ameaçado abandonar a equipa nacional se certas questões não fossem resolvidas. Os pormenores desses problemas não foram divulgados. Os jogadores envolvidos divulgaram depois uma posição conjunta para esclarecer o assunto e negar a intenção de abandonar a seleção. Assinam Heung-min Son, Jae-sung Lee, Min-jae Kim, Inbeom Hwang e Hee-chan Hwang. Inbeom Hwang joga no FC Porto. Os signatários lamentaram a preocupação criada entre a população e os adeptos. Explicaram que aproveitaram esta convocatória para conversar, ouvir os diferentes pontos de vista e esclarecer temas que ainda não tinham discutido suficientemente. O objetivo partilhado é a evolução do futebol sul-coreano, da federação e da seleção. Querem corresponder ao apoio recebido através de melhores exibições e resultados.';
  const developed = 'Inbeom Hwang juntou-se a outras referências da Coreia do Sul num esclarecimento público sobre a situação vivida na seleção. Num comunicado conjunto, os internacionais negam ter colocado a possibilidade de abandonar a equipa nacional como forma de pressionar a resolução de problemas internos.\n\nA reação surgiu depois de notícias que associavam jogadores experientes, identificados como a geração 96, a uma alegada ameaça de saída. Os detalhes das questões referidas não foram tornados públicos. A posição dos jogadores é que houve uma discussão destinada a melhorar o funcionamento e o futuro do futebol sul-coreano.\n\nAssinam Heung-min Son, Jae-sung Lee, Min-jae Kim, Inbeom Hwang e Hee-chan Hwang. Os subscritores lamentam a preocupação causada aos adeptos e explicam que a conversa durante a convocatória serviu para ouvir e esclarecer posições. Defendem a evolução da federação e da seleção, com exibições e resultados que correspondam ao apoio do público.';
  const item = await add('rtp', 'hwang-developed', { title: 'Hwang e colegas esclarecem polémica na seleção', sourceExcerpt: facts });
  newsProvider(() => complete({ headline: 'Hwang junta-se ao desmentido dos internacionais sul-coreanos', summary: developed }));
  const result = await api('/summaries', { method: 'POST', body: { id: item.id } });
  assert.equal(result.body.generated, 1);
  const draft = (await list())[0];
  assert.equal(draft.summaryText.split(/\n\s*\n/).length, 3);
  for (const name of ['Inbeom Hwang', 'Heung-min Son', 'Jae-sung Lee', 'Min-jae Kim', 'Hee-chan Hwang']) assert.ok(draft.summaryText.includes(name));
  assert.ok(draft.summaryText.includes('alegada'));
});

await scenario('48-hour retention removes only expired pending/rejected news and cascades drafts without resetting usage', async ({ add, api, db, list, newsCalls }) => {
  const oldPending = await add('rtp', 'expired-pending', { publishedAt: new Date(start - 2 * day - minute).toISOString() });
  const oldRejected = await add('rtp', 'expired-rejected', { publishedAt: new Date(start - 3 * day).toISOString() });
  await api('', { method: 'PATCH', body: { id: oldRejected.id, revision: oldRejected.revision, status: 'rejected' } });
  // Legacy SQLite timestamp formatting must have the same age as ISO timestamps.
  await db.prepare('UPDATE hub_news SET published_at = ? WHERE id = ?')
    .bind(new Date(start - 3 * day).toISOString().replace('T', ' ').replace('.000Z', ''), oldRejected.id).run();
  const boundary = await add('rtp', 'exactly-48h', { publishedAt: new Date(start - 2 * day).toISOString() });
  const recentRejected = await add('rtp', 'recent-rejected', { publishedAt: new Date(start - 2 * day + minute).toISOString() });
  await api('', { method: 'PATCH', body: { id: recentRejected.id, revision: recentRejected.revision, status: 'rejected' } });
  const approved = await add('rtp', 'old-approved', { publishedAt: new Date(start - 10 * day).toISOString() });
  await api('', { method: 'PATCH', body: { id: approved.id, revision: approved.revision, status: 'approved' } });
  for (const item of [oldPending, oldRejected, approved]) await db.prepare("INSERT INTO hub_news_summaries(news_id,input_hash,state) VALUES(?,'saved','draft')").bind(item.id).run();
  const usageDay = new Date(start).toISOString().slice(0, 10);
  await db.prepare('INSERT INTO hub_news_summary_usage(day,requests,input_tokens,output_tokens) VALUES(?,11,100,200)').bind(usageDay).run();
  const result = await api('/sync', { method: 'POST' });
  assert.equal(result.status, 200);
  assert.equal(result.body.removed, 2);
  assert.deepEqual((await list()).map((item) => item.id), [boundary.id]);
  assert.deepEqual((await list('rejected')).map((item) => item.id), [recentRejected.id]);
  assert.deepEqual((await list('approved')).map((item) => item.id), [approved.id]);
  assert.equal((await api('/article/' + approved.id)).status, 200);
  assert.deepEqual((await db.prepare('SELECT news_id FROM hub_news_summaries').all()).results.map((item) => item.news_id), [approved.id]);
  assert.deepEqual(await db.prepare('SELECT requests,input_tokens,output_tokens FROM hub_news_summary_usage WHERE day=?').bind(usageDay).first(), { requests: 11, input_tokens: 100, output_tokens: 200 });
  assert.equal((await api('/sync', { method: 'POST' })).body.removed, 0, 'Cleanup is idempotent');
  assert.equal(newsCalls.length, 0);
});

await scenario('expired feed items cannot reappear after cleanup or on a later sync', async ({ add, api, list, newsCalls }) => {
  const expired = await add('rtp', 'expired-feed', { publishedAt: new Date(start - 3 * day).toISOString() });
  const result = await api('/sync', { method: 'POST' });
  assert.equal(result.body.removed, 1);
  assert.equal(result.body.added, 1);
  const current = await list();
  assert.equal(current.length, 1);
  assert.notEqual(current[0].url, expired.url);
  assert.ok(current[0].url.endsWith('/retained-feed'));
  assert.equal((await api('/sync', { method: 'POST' })).body.added, 0);
  assert.equal((await list()).length, 1);
  assert.equal(newsCalls.length, 0);
}, { newsFeeds: (url) => url.hostname === 'www.rtp.pt'
  ? new Response('<rss><channel>' + [
    rss('FC Porto: notícia antiga', 'https://www.rtp.pt/noticias/fc-porto/teste-expired-feed', '', '', start - 3 * day),
    rss('FC Porto: notícia recente', 'https://www.rtp.pt/noticias/fc-porto/retained-feed', '', '', start - day),
  ].map((xml) => xml.replace(/^<rss><channel>|<\/channel><\/rss>$/g, '')).join('') + '</channel></rss>', { headers: { 'Content-Type': 'application/rss+xml' } })
  : emptyFeed() });

await scenario('scheduled cleanup still runs when all publishers are unavailable and generation is disabled', async ({ add, api, list, request, newsCalls }) => {
  await add('rtp', 'outage-expired', { publishedAt: new Date(start - 3 * day).toISOString() });
  const approved = await add('rtp', 'outage-approved', { publishedAt: new Date(start - 3 * day).toISOString() });
  await api('', { method: 'PATCH', body: { id: approved.id, revision: approved.revision, status: 'approved' } });
  assert.equal((await request('/__rehearsal/news', { method: 'POST' })).status, 200);
  assert.equal((await list()).length, 0);
  assert.equal((await list('approved'))[0].id, approved.id);
  assert.equal(newsCalls.length, 0);
}, { newsDisabled: true, newsFeeds: () => new Response('', { status: 503 }) });

await scenario('retention waits for an active generation lease and removes the expired story once the lease ends', async ({ add, api, db, list, newsCalls }) => {
  const item = await add('rtp', 'active-lease', { publishedAt: new Date(start - 3 * day).toISOString() });
  await db.prepare("INSERT INTO hub_news_summaries(news_id,input_hash,state,lease_until) VALUES(?,'saved','processing',?)")
    .bind(item.id, start + minute).run();
  assert.equal((await api('/sync', { method: 'POST' })).body.removed, 0);
  assert.equal((await list()).length, 1);
  assert.equal((await api('/sync', { method: 'POST', now: start + 2 * minute })).body.removed, 1);
  assert.equal((await list()).length, 0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM hub_news_summaries').first()).count, 0);
  assert.equal(newsCalls.length, 0);
});

await scenario('the direct publisher section cannot reimport stories older than the 48-hour window', async ({ api, list, newsCalls }) => {
  const result = await api('/sync', { method: 'POST' });
  assert.equal(result.body.added, 0);
  assert.equal((await list()).length, 0);
  assert.equal(newsCalls.length, 0);
}, { newsFeeds: (url) => url.pathname === '/fc-porto' ? htmlResponse(section())
  : url.pathname === maisPath ? htmlResponse(publicArticle(maisPath, { datePublished: new Date(start - 3 * day).toISOString() })) : emptyFeed() });

await scenario('purged story IDs cannot be reused by a new article or a stale moderation request', async ({ add, api, list }) => {
  const expired = await add('rtp', 'deleted-last-id', { publishedAt: new Date(start - 3 * day).toISOString() });
  assert.equal((await api('/sync', { method: 'POST' })).body.removed, 1);
  const fresh = await add('rtp', 'after-deletion');
  assert.ok(fresh.id > expired.id);
  assert.equal((await api('', { method: 'PATCH', body: { id: expired.id, revision: expired.revision, status: 'approved' } })).status, 404);
  assert.equal((await list())[0].id, fresh.id);
  assert.equal((await list('approved')).length, 0);
});

await scenario('O Jogo search results must explicitly identify Porto and JN is no longer fetched', async ({ api, list, sourceCalls, newsCalls }) => {
  await api('/sync', { method: 'POST' });
  assert.deepEqual((await list()).map((item) => item.title).sort(), ['FC Porto prepara jogo', 'Portistas em destaque']);
  assert.equal(sourceCalls.some((value) => value.includes('jn.pt') || value.endsWith('/jn')), false);
  assert.equal((await api()).body.sources.some((item) => item.source === 'Jornal de Notícias'), false);
  assert.equal((await api('', { method: 'POST', body: { title: 'FC Porto', url: 'https://www.jn.pt/desporto/noticia', publishedAt: new Date(start).toISOString() } })).status, 400);
  assert.equal(newsCalls.length, 0);
}, { newsFeeds: (url) => url.hostname === 'news.google.com'
  ? new Response('<rss><channel>' + ['Dois homens iranianos culpados de espionagem no Reino Unido', 'Quatro tendências de calças de ganga', 'Estádio do Bessa vendido', 'Porto tem novo hotel', 'FC Porto prepara jogo', 'Portistas em destaque']
    .map((title, index) => rss(title + ' - O Jogo', 'https://news.google.com/rss/articles/relevance-' + index, 'www.ojogo.pt').replace(/^<rss><channel>|<\/channel><\/rss>$/g, '')).join('') + '</channel></rss>', { headers: { 'Content-Type': 'application/rss+xml' } })
  : emptyFeed() });

await scenario('cleanup removes imported JN and unrelated O Jogo metadata while preserving approvals and manual context', async ({ db, api, list, newsCalls }) => {
  const examples = [
    ['Jornal de Notícias', 'Dois homens iranianos culpados de espionagem', 'pending', 'feed'],
    ['Jornal de Notícias', 'Uma notícia rejeitada', 'rejected', 'feed'],
    ['O Jogo', 'Quatro tendências de calças de ganga', 'pending', 'feed'],
    ['O Jogo', 'Estádio do Bessa vendido', 'rejected', 'feed'],
    ['O Jogo', 'FC Porto prepara jogo', 'pending', 'feed'],
    ['O Jogo', 'Um título revisto pelo editor', 'pending', 'manual'],
    ['Jornal de Notícias', 'Notícia já aprovada', 'approved', 'feed'],
  ];
  for (const [index, [source, title, status, kind]] of examples.entries()) await db.prepare('INSERT INTO hub_news(title,url,source,published_at,status,context_kind) VALUES(?,?,?,?,?,?)')
    .bind(title, 'https://news.google.com/rss/articles/cleanup-' + index, source, new Date(start).toISOString(), status, kind).run();
  assert.equal((await api('/sync', { method: 'POST' })).body.removed, 4);
  assert.deepEqual((await list()).map((item) => item.title).sort(), ['FC Porto prepara jogo', 'Um título revisto pelo editor']);
  assert.equal((await list('rejected')).length, 0);
  assert.equal((await list('approved'))[0].title, 'Notícia já aprovada');
  assert.equal(newsCalls.length, 0);
});

await scenario('bulk imports allocate unique increasing IDs across batches and retain the sequence after all rows expire', async ({ api, db, add }) => {
  assert.equal((await api('/sync', { method: 'POST' })).body.added, 35);
  const ids = (await db.prepare('SELECT id FROM hub_news ORDER BY id').all()).results.map((item) => item.id);
  assert.equal(ids.length, 35);
  assert.equal(new Set(ids).size, 35);
  assert.equal((await api('/sync', { method: 'POST' })).body.added, 0);
  const expired = await api('/sync', { method: 'POST', now: start + 3 * day });
  assert.equal(expired.body.removed, 35);
  assert.equal(expired.body.added, 0);
  assert.ok((await add('rtp', 'after-bulk-expiration')).id > Math.max(...ids));
}, { newsFeeds: (url) => url.hostname === 'www.rtp.pt'
  ? new Response('<rss><channel>' + Array.from({ length: 35 }, (_, index) =>
    rss('FC Porto: notícia ' + index, 'https://www.rtp.pt/noticias/fc-porto/bulk-' + index, '').replace(/^<rss><channel>|<\/channel><\/rss>$/g, '')).join('') + '</channel></rss>', { headers: { 'Content-Type': 'application/rss+xml' } })
  : emptyFeed() });

console.log('\nNotícias verificadas em D1 descartável, com respostas simuladas da IA e sem pedidos pagos.');
