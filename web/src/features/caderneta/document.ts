import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = join(process.cwd(), 'src', 'features', 'caderneta');

export async function readCadernetaDocument() {
  const [template, styles, font, fontLicense, pageFlip, pageFlipLicense, pack, album] = await Promise.all([
    readFile(join(directory, 'index.html'), 'utf8'),
    readFile(join(directory, 'album.css'), 'utf8'),
    readFile(join(directory, 'manrope.woff2')),
    readFile(join(directory, 'manrope-LICENSE.txt'), 'utf8'),
    readFile(join(directory, 'page-flip.js'), 'utf8'),
    readFile(join(directory, 'page-flip-LICENSE.txt'), 'utf8'),
    readFile(join(directory, 'pack.js'), 'utf8'),
    readFile(join(directory, 'album.js'), 'utf8'),
  ]);

  const css = `/*\n${fontLicense}\n*/\n` +
    styles.replace('manrope.woff2', `data:font/woff2;base64,${font.toString('base64')}`);
  const scripts = [`/*\n${pageFlipLicense}\n*/\n${pageFlip}`, pack, album]
    .map((script) => `<script>${script.replace(/<\/script/gi, '<\\/script')}</script>`)
    .join('\n');

  return template
    .replace('<!-- ALBUM_STYLES -->', () => `<style>${css}</style>`)
    .replace('<!-- ALBUM_SCRIPTS -->', () => scripts);
}
