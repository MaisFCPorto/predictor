import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { articleUrl, sameArticle, exampleUrl, extractArticle, visibleDocumentSnapshot, retentionMs } from './reader.mjs';
import { clock, fixture, paragraphs } from './fixture.mjs';

function snapshot(html) {
  const dom = new JSDOM(html, { url: exampleUrl, runScripts: 'outside-only' });
  try { return dom.window.eval('(' + visibleDocumentSnapshot.toString() + ')()'); }
  finally { dom.window.close(); }
}
const read = (html, now = clock) => extractArticle(snapshot(html), exampleUrl, now);
const fails = (run, code) => assert.throws(run, (error) => error.code === code);

test('extracts developed visible article text, canonical identity and publication date', () => {
  const result = read(fixture());
  assert.equal(result.article.url, exampleUrl);
  assert.equal(result.article.publishedAt, new Date(clock).toISOString());
  for (const paragraph of paragraphs) assert.ok(result.article.sourceExcerpt.includes(paragraph));
  assert.ok(result.diagnostics.words >= 90);
  assert.equal(result.diagnostics.paragraphs, 3);
  assert.equal(result.diagnostics.eligibleForImport, true);
  assert.equal(result.diagnostics.truncated, false);
  for (const unwanted of ['NAVIGATION_ONLY', 'RELATED_ONLY', 'FOOTER_ONLY']) assert.ok(!result.article.sourceExcerpt.includes(unwanted));
});

test('removes hidden text and scripts from a clone without changing the original page', () => {
  const html = fixture({ body: paragraphs.map((text) => `<p>${text}</p>`).join('') +
    '<div hidden><p>HIDDEN_ONLY</p></div><div style="display:none"><p>CSS_ONLY</p></div><div aria-hidden="true"><p>ARIA_ONLY</p></div><script>window.INLINE_SCRIPT_RAN=true;</script>' });
  const dom = new JSDOM(html, { url: exampleUrl, runScripts: 'outside-only' });
  try {
    const current = dom.window.eval('(' + visibleDocumentSnapshot.toString() + ')()');
    const result = extractArticle(current, exampleUrl, clock);
    for (const unwanted of ['HIDDEN_ONLY', 'CSS_ONLY', 'ARIA_ONLY', 'INLINE_SCRIPT_RAN']) assert.ok(!current.html.includes(unwanted));
    assert.ok(result.article.sourceExcerpt.includes(paragraphs[0]));
    assert.ok(dom.window.document.body.textContent.includes('HIDDEN_ONLY'));
    assert.equal(dom.window.INLINE_SCRIPT_RAN, undefined);
  } finally { dom.window.close(); }
});

test('rejects restricted metadata even when the DOM contains long article text', () => {
  fails(() => read(fixture({ metadata: { isAccessibleForFree: false } })), 'restricted_article');
});
test('rejects visible subscription restrictions', () => {
  fails(() => read(fixture({ body: '<p>Subscreva para continuar a ler</p>' + paragraphs.map((text) => `<p>${text}</p>`).join('') })), 'restricted_article');
});
test('rejects a challenge or error document instead of saving it as an article', () => {
  fails(() => extractArticle({ url: exampleUrl, html: '<html></html>', screenText: '403 ERROR The request could not be satisfied' }, exampleUrl, clock), 'page_blocked');
});
test('a short teaser never counts as a successfully read article', () => {
  fails(() => read(fixture({ body: '<p>Uma pequena descrição do FC Porto.</p>' })), 'insufficient_text');
});
test('does not replace the visible body with hidden articleBody metadata', () => {
  fails(() => read(fixture({ metadata: { articleBody: paragraphs.join(' ') }, body: '<p>FC Porto em destaque.</p>' })), 'insufficient_text');
});
test('identity metadata in the body is preserved for validation without becoming source text', () => {
  const html = fixture();
  const metadata = html.match(/<script type="application\/ld\+json">.*?<\/script>/s)[0];
  const moved = html.replace(metadata, '').replace('<body>', '<body>' + metadata);
  assert.ok(read(moved).article.sourceExcerpt.includes(paragraphs[1]));
  const restricted = moved.replace('"isAccessibleForFree":true', '"isAccessibleForFree":false');
  fails(() => read(restricted), 'restricted_article');
});
test('rejects unrelated canonical identities and metadata for another article', () => {
  fails(() => read(fixture({ canonical: 'https://untrusted.invalid/futebol/artigo/outro/18147554' })), 'wrong_article');
  fails(() => read(fixture({ metadata: { mainEntityOfPage: { '@id': exampleUrl.replace('18147554', '99') } } })), 'missing_metadata');
});
test('limits URLs to public HTTPS article paths from O Jogo', () => {
  for (const value of ['http://www.ojogo.pt/futebol/artigo/x/1', 'https://user:pass@www.ojogo.pt/futebol/artigo/x/1', 'https://www.ojogo.pt:444/futebol/artigo/x/1', 'https://127.0.0.1/futebol/artigo/x/1', 'https://www.ojogo.pt/login']) fails(() => articleUrl(value), 'invalid_url');
  assert.equal(articleUrl(exampleUrl + '?utm_source=test#body'), exampleUrl);
  assert.equal(sameArticle(exampleUrl.replace('18147554', '88'), exampleUrl), false);
});
test('marks old articles as ineligible for import and rejects future publication dates', () => {
  assert.equal(read(fixture(), clock + retentionMs + 1).diagnostics.eligibleForImport, false);
  assert.equal(read(fixture(), clock + retentionMs).diagnostics.eligibleForImport, true);
  fails(() => read(fixture({ metadata: { datePublished: new Date(clock + 3_600_001).toISOString() } })), 'invalid_date');
});
test('rejects text without a relationship to FC Porto', () => {
  fails(() => read(fixture({ title: 'Ensaio sobre um assunto diferente', body: paragraphs.map((text) => `<p>${text.replaceAll('FC Porto', 'Outro Clube')}</p>`).join('') })), 'unrelated_article');
});
test('bounds the collected context to the Hub limit', () => {
  const result = read(fixture({ body: Array.from({ length: 18 }, (_, index) => `<p>${paragraphs[index % 3]}</p>`).join('') }));
  assert.ok(result.article.sourceExcerpt.length <= 6000);
  assert.equal(result.diagnostics.truncated, true);
});
