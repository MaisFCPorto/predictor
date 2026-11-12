import { exampleUrl } from './reader.mjs';

export const clock = Date.parse('2026-11-12T18:00:00Z');
export const headline = 'FC Porto apresenta atividades num ensaio sintético';
export const paragraphs = [
  'Este é um texto sintético para testar a leitura de notícias do FC Porto. O clube apresentou um conjunto de atividades num cenário criado apenas para validação de software. A informação deste exemplo não descreve acontecimentos reais nem deve ser publicada como notícia. Os participantes da demonstração receberam um calendário com várias sessões, distribuídas por diferentes horários durante a mesma semana.',
  'A organização do ensaio explicou que cada sessão teria um objetivo distinto, com tempo reservado para a apresentação, para perguntas dos participantes e para a recolha de sugestões. O documento de demonstração inclui também uma descrição das tarefas de preparação e indica quem acompanha cada parte do programa. Todos os nomes e factos usados nos testes pertencem a este exemplo artificial.',
  'No final, o relatório simulado reúne as observações dos participantes e aponta os temas que poderão ser analisados numa sessão seguinte. Este parágrafo permite confirmar que o leitor recolhe o desenvolvimento do artigo, em vez de guardar apenas o título ou a descrição inicial. A verificação não envolve resultados desportivos, valores financeiros nem declarações de pessoas reais.',
];

export function fixture({ metadata = {}, body = paragraphs.map((text) => `<p>${text}</p>`).join(''), title = headline, canonical = exampleUrl } = {}) {
  const data = { '@type': 'NewsArticle', headline: title, mainEntityOfPage: { '@id': exampleUrl },
    datePublished: new Date(clock).toISOString(), isAccessibleForFree: true, ...metadata };
  return `<!doctype html><html><head><title>${title}</title><link rel="canonical" href="${canonical}"><script type="application/ld+json">${JSON.stringify(data)}</script></head><body>
    <header><p>NAVIGATION_ONLY Liga Futebol Notícias</p></header><main><article><h1>${title}</h1>${body}</article></main>
    <aside><p>RELATED_ONLY Uma notícia diferente sem ligação ao artigo.</p></aside><footer><p>FOOTER_ONLY Contactos e outros conteúdos.</p></footer></body></html>`;
}
