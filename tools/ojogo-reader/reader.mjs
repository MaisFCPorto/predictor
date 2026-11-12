import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export const exampleUrl = 'https://www.ojogo.pt/futebol/artigo/receitas-despesas-comissoes-e-clausulas-fc-porto-divulga-todos-os-detalhes-do-mercado-de-verao/18147554';
export const retentionMs = 48 * 60 * 60_000;

export class ReaderError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function articleUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new ReaderError('invalid_url', 'Indica uma ligação de artigo de O Jogo.'); }
  if (url.protocol !== 'https:' || !['www.ojogo.pt', 'ojogo.pt'].includes(url.hostname) || url.port || url.username || url.password ||
      !/^\/futebol\/artigo\/[^/]+\/\d+\/?$/.test(url.pathname)) {
    throw new ReaderError('invalid_url', 'A ligação tem de ser um artigo HTTPS de O Jogo.');
  }
  url.hostname = 'www.ojogo.pt';
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/$/, '');
  return url.href;
}

export function sameArticle(input, expected) {
  try { return articleUrl(input).split('/').at(-1) === articleUrl(expected).split('/').at(-1); }
  catch { return false; }
}

// This function runs in the browser. Only a clone is changed, never the page.
export function visibleDocumentSnapshot() {
  const copy = document.cloneNode(true);
  // Publishers may place identity/access metadata inside the body. Keep it in
  // the detached head for validation, never as a substitute for visible text.
  for (const script of document.body.querySelectorAll('script[type="application/ld+json"]')) {
    if (script.textContent.length <= 100_000) copy.head.appendChild(script.cloneNode(true));
  }
  const originals = [...document.body.querySelectorAll('*')];
  const copies = [...copy.body.querySelectorAll('*')];
  for (let index = originals.length - 1; index >= 0; index--) {
    const element = originals[index];
    const style = window.getComputedStyle(element);
    const script = element.tagName === 'SCRIPT';
    if (script ||
        ['STYLE', 'NOSCRIPT', 'IFRAME', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'FORM', 'BUTTON', 'SVG'].includes(element.tagName) ||
        element.hasAttribute('hidden') || element.hasAttribute('inert') || element.getAttribute('aria-hidden') === 'true' ||
        style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility) || style.opacity === '0') copies[index].remove();
  }
  for (const element of copy.head.querySelectorAll('script:not([type="application/ld+json"]), style, link:not([rel="canonical"])')) element.remove();
  return { url: location.href, html: copy.documentElement.outerHTML, screenText: (document.body.innerText ?? document.body.textContent ?? '').slice(0, 40_000) };
}

function metadataItems(document) {
  const items = [];
  for (const element of [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0, 12)) {
    if (element.textContent.length > 100_000) continue;
    try {
      const parsed = JSON.parse(element.textContent);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      items.push(...nodes);
      for (const node of nodes) if (Array.isArray(node?.['@graph'])) items.push(...node['@graph']);
    } catch { /* A malformed metadata block never becomes source text. */ }
  }
  return items;
}

const clean = (text) => (text ?? '').replace(/\s+/g, ' ').trim();
const wordCount = (text) => text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

export function extractArticle(snapshot, expectedUrl, now = Date.now()) {
  const expected = articleUrl(expectedUrl);
  if (!sameArticle(snapshot.url, expected)) throw new ReaderError('redirect_blocked', 'A página mudou para outra ligação.');
  if (typeof snapshot.html !== 'string' || snapshot.html.length > 1_200_000) throw new ReaderError('page_size', 'A página excede o limite de leitura.');
  const screen = clean(snapshot.screenText);
  if (/verify (?:that )?you are human|verifique que .{0,15}humano|checking your browser|just a moment|403 error|access denied|request could not be satisfied/i.test(screen)) {
    throw new ReaderError('page_blocked', 'O navegador recebeu uma página de bloqueio ou de verificação.');
  }
  if (/(?:conte[uú]do|artigo).{0,45}(?:exclusivo|reservado).{0,40}assinantes|subscreva para continuar a ler|assine para (?:continuar a )?ler/i.test(screen)) {
    throw new ReaderError('restricted_article', 'O artigo indica uma restrição de acesso.');
  }
  // No scripts or external resources are executed by JSDOM.
  const dom = new JSDOM(snapshot.html, { url: expected });
  try {
    const document = dom.window.document;
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
    if (canonical && !sameArticle(new URL(canonical, expected).href, expected)) throw new ReaderError('wrong_article', 'O endereço canónico identifica outra notícia.');
    const metadata = metadataItems(document).find((item) => {
      const types = Array.isArray(item?.['@type']) ? item['@type'] : [item?.['@type']];
      const identity = typeof item?.mainEntityOfPage === 'string' ? item.mainEntityOfPage : item?.mainEntityOfPage?.['@id'] ?? item?.url;
      return types.some((type) => typeof type === 'string' && (type === 'Article' || type.endsWith('NewsArticle'))) &&
        sameArticle(identity ?? canonical, expected);
    });
    if (!metadata) throw new ReaderError('missing_metadata', 'Não encontrei metadados que confirmem a identidade do artigo.');
    if (String(metadata.isAccessibleForFree).toLowerCase() === 'false') throw new ReaderError('restricted_article', 'Os metadados indicam um artigo restrito.');
    const published = Date.parse(metadata.datePublished ?? document.querySelector('meta[property="article:published_time"]')?.content);
    if (!Number.isFinite(published) || published > now + 3_600_000) throw new ReaderError('invalid_date', 'Não foi possível confirmar a data da notícia.');
    const result = new Readability(document, { charThreshold: 500, maxElemsToParse: 50_000 }).parse();
    if (!result?.content) throw new ReaderError('insufficient_text', 'A página não forneceu texto suficiente do artigo.');
    const content = new JSDOM(result.content);
    let paragraphs;
    try {
      paragraphs = [...content.window.document.querySelectorAll('p, h2, h3, li, blockquote')]
        .filter((element) => !element.parentElement.closest('p, li, blockquote'))
        .map((element) => clean(element.textContent)).filter(Boolean);
    } finally { content.window.close(); }
    const title = clean(metadata.headline ?? result.title);
    const fullText = paragraphs.join('\n\n');
    const normalized = (title + ' ' + fullText).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    if (!/\bf\.?\s*c\.?\s*porto\b|futebol clube do porto|\bportistas?\b/.test(normalized)) throw new ReaderError('unrelated_article', 'O texto recolhido não identifica o FC Porto.');
    const sourceExcerpt = fullText.slice(0, 6000).trim();
    if (title.length < 8 || title.length > 400 || sourceExcerpt.length < 500 || wordCount(sourceExcerpt) < 90) {
      throw new ReaderError('insufficient_text', 'Foi recolhido apenas um título, uma descrição curta ou texto insuficiente.');
    }
    return {
      article: { title, url: expected, publishedAt: new Date(published).toISOString(), imageUrl: null, sourceExcerpt },
      diagnostics: { words: wordCount(sourceExcerpt), characters: sourceExcerpt.length, paragraphs: paragraphs.length,
        eligibleForImport: published >= now - retentionMs, truncated: fullText.length > 6000 },
    };
  } finally { dom.window.close(); }
}
