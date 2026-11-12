import { mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { articleUrl, exampleUrl, ReaderError } from './reader.mjs';
import { readInChrome } from './browser-reader.mjs';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('npm run check -- [ligação de O Jogo]\nSem ligação, testa o artigo 18147554. Abre o Chrome e guarda o resultado apenas neste computador.');
    return;
  }
  if (args.length > 1 || args.some((arg) => arg.startsWith('-'))) throw new ReaderError('invalid_arguments', 'Usa npm run check -- "ligação de O Jogo".');
  const target = articleUrl(args[0] ?? exampleUrl);
  console.log('A abrir uma janela separada do Chrome. Aguarda pela leitura.');
  const result = await readInChrome(target);
  const directory = new URL('./output/', import.meta.url);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = new URL('ojogo-' + target.split('/').at(-1) + '.json', directory);
  const temporary = new URL('ojogo-' + target.split('/').at(-1) + '.tmp', directory);
  await writeFile(temporary, JSON.stringify(result.article, null, 2) + '\n', { mode: 0o600 });
  await rename(temporary, destination);
  console.log(JSON.stringify({ resultado: 'Texto recolhido', titulo: result.article.title, publicadoEm: result.article.publishedAt,
    palavras: result.diagnostics.words, caracteres: result.diagnostics.characters, paragrafos: result.diagnostics.paragraphs,
    elegivelParaHub: result.diagnostics.eligibleForImport, limitadoA6000Caracteres: result.diagnostics.truncated,
    ficheiro: fileURLToPath(destination) }, null, 2));
  if (!result.diagnostics.eligibleForImport) console.log('A notícia já tem mais de 48 horas. A leitura foi testada, mas está fora da janela de importação do Hub.');
}

main().catch((error) => {
  console.error(JSON.stringify({ resultado: 'Não foi possível recolher o artigo', codigo: error.code ?? 'reader_failed',
    detalhe: error instanceof ReaderError ? error.message : 'A leitura não terminou. Envia apenas este código para diagnóstico.' }, null, 2));
  process.exitCode = 1;
});
