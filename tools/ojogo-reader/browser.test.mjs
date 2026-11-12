import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { readPage } from './browser-reader.mjs';
import { exampleUrl } from './reader.mjs';
import { clock, fixture, paragraphs } from './fixture.mjs';

test('browser collector reads only the public fixture and stops on errors and external redirects', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.OJOGO_TEST_CHROMIUM ? { executablePath: process.env.OJOGO_TEST_CHROMIUM } : { channel: 'chrome' }) });
  try {
    for (const scenario of ['public', 'blocked', 'redirect']) {
      const context = await browser.newContext();
      const contacted = [];
      await context.route('**/*', async (route) => {
        contacted.push(route.request().url());
        assert.equal(route.request().url(), exampleUrl, 'The fixture must never contact another website');
        if (scenario === 'blocked') return route.fulfill({ status: 403, contentType: 'text/html', body: '<h1>403 ERROR</h1>' });
        if (scenario === 'redirect') return route.fulfill({ status: 302, headers: { location: 'https://untrusted.invalid/private' } });
        return route.fulfill({ status: 200, contentType: 'text/html', body: fixture() });
      });
      const page = await context.newPage();
      if (scenario === 'public') {
        const result = await readPage(page, exampleUrl, clock);
        assert.ok(result.article.sourceExcerpt.includes(paragraphs[2]));
        assert.ok(!result.article.sourceExcerpt.includes('RELATED_ONLY'));
      } else await assert.rejects(() => readPage(page, exampleUrl, clock), (error) => error.code === (scenario === 'blocked' ? 'source_http_403' : 'redirect_blocked'));
      assert.equal(contacted.length, 1);
      await context.close();
    }
  } finally { await browser.close(); }
});
