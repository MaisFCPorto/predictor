import { chromium } from 'playwright';
import { articleUrl, sameArticle, extractArticle, visibleDocumentSnapshot, ReaderError } from './reader.mjs';

export async function readPage(page, input, now = Date.now()) {
  const target = articleUrl(input);
  let redirected = false;
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.isNavigationRequest() && request.frame() === page.mainFrame() && !sameArticle(request.url(), target)) {
      redirected = true;
      return route.abort();
    }
    return route.fallback();
  });
  let response;
  try { response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 25_000 }); }
  catch { throw new ReaderError(redirected ? 'redirect_blocked' : 'navigation_failed', redirected ? 'A página tentou abrir outra ligação.' : 'A página não terminou de carregar.'); }
  if (!response || response.status() >= 400) throw new ReaderError('source_http_' + (response?.status() ?? 0), 'O navegador recebeu um erro HTTP da fonte.');
  await page.waitForFunction(() => document.querySelector('script[type="application/ld+json"]') &&
    document.querySelectorAll('p').length >= 2 && (document.body.innerText ?? '').length >= 500,
  undefined, { timeout: 10_000 }).catch(() => undefined);
  return extractArticle(await page.evaluate(visibleDocumentSnapshot), target, now);
}

export async function readInChrome(input) {
  const target = articleUrl(input);
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: false, chromiumSandbox: true, timeout: 20_000 }); }
  catch { throw new ReaderError('chrome_unavailable', 'Não consegui iniciar o Google Chrome. Confirma que tens o Chrome instalado e o Node 20 ou superior.'); }
  const timer = setTimeout(() => { void browser.close(); }, 60_000);
  try { return await readPage(await browser.newPage(), target); }
  finally { clearTimeout(timer); await browser.close(); }
}
