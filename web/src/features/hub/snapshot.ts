import 'server-only';

import type { HubContent } from './types';

export const hubSnapshot = {
  standings: {
    liga: {
      name: 'Liga Portugal Betclic',
      asOf: '8 nov 2026 · Jornada 11 em curso',
      scope: 'Primeiros seis lugares',
      sourceUrl: 'https://quemjoga.pt/classificacao/liga-portugal',
      rows: [
        { position: 1, team: 'FC Porto', played: 10, points: 30, porto: true },
        { position: 2, team: 'SL Benfica', played: 10, points: 25 },
        { position: 3, team: 'Sporting CP', played: 11, points: 24 },
        { position: 4, team: 'Santa Clara', played: 10, points: 21 },
        { position: 5, team: 'FC Arouca', played: 11, points: 20 },
        { position: 6, team: 'Académico de Viseu', played: 10, points: 20 },
      ],
    },
    champions: {
      name: 'UEFA Champions League',
      asOf: '4 nov 2026 · Fim da jornada 4',
      scope: 'Primeiros cinco lugares e FC Porto',
      sourceUrl: 'https://pt.uefa.com/uefachampionsleague/standings/',
      rows: [
        { position: 1, team: 'Paris Saint-Germain', played: 4, points: 12 },
        { position: 2, team: 'Real Madrid', played: 4, points: 12 },
        { position: 3, team: 'Arsenal', played: 4, points: 10 },
        { position: 4, team: 'Como', played: 4, points: 9 },
        { position: 5, team: 'Barcelona', played: 4, points: 9 },
        { position: 26, team: 'FC Porto', played: 4, points: 3, porto: true },
      ],
    },
  },
  instagram: {
    profileUrl: 'https://www.instagram.com/maisfcporto/',
    summary: '9 publicações recentes e 1 do arquivo · Seleção de 8 nov 2026',
    posts: [
      {
        url: 'https://www.instagram.com/maisfcporto/p/DfebviqvhUC/',
        image: '/hub/ig-01.webp',
        caption: 'Azul e branco',
        date: '8 nov 2026',
        type: 'Publicação',
      },
      {
        url: 'https://www.instagram.com/maisfcporto/p/DfeRw6QF52A/',
        image: '/hub/ig-02.webp',
        caption: 'Dia de Porto',
        date: '8 nov 2026',
        type: 'Publicação',
      },
      {
        url: 'https://www.instagram.com/maisfcporto/p/Dfc9DG-F1lJ/',
        image: '/hub/ig-03.webp',
        caption: 'FC Porto 2–2 SC Braga',
        date: '7 nov 2026',
        type: 'Publicação',
      },
      {
        url: 'https://www.instagram.com/maisfcporto/p/Dfc6yHcl_TJ/',
        image: '/hub/ig-04.webp',
        caption: 'A antevisão de Farioli',
        date: '7 nov 2026',
        type: 'Carrossel',
      },
      {
        url: 'https://www.instagram.com/maisfcporto/p/Dfcwk-iCjbC/',
        image: '/hub/ig-05.webp',
        caption: 'Uma memória do Dragão',
        date: '7 nov 2026',
        type: 'Carrossel',
      },
      {
        url: 'https://www.instagram.com/maisfcporto/p/DfcdNjZF-Rm/',
        image: '/hub/ig-06.webp',
        caption: 'Vitória SC–FC Porto',
        date: '7 nov 2026',
        type: 'Publicação',
      },
      {
        url: 'https://www.instagram.com/maisfcporto/p/DfcGG6pF7zQ/',
        image: '/hub/ig-07.webp',
        caption: 'Dia de jogo no feminino',
        date: '7 nov 2026',
        type: 'Publicação',
      },
      {
        url: 'https://www.instagram.com/maisfcporto/p/DfaanTil_dC/',
        image: '/hub/ig-08.webp',
        caption: 'Daniel Chaves em antevisão',
        date: '6 nov 2026',
        type: 'Carrossel',
      },
      {
        url: 'https://www.instagram.com/maisfcporto/p/DfZ8y1xF166/',
        image: '/hub/ig-09.webp',
        caption: 'No relvado do Dragão',
        date: '6 nov 2026',
        type: 'Publicação',
      },
      {
        url: 'https://www.instagram.com/maisfcporto/p/DbgyYRuAAgO/',
        image: '/hub/ig-10.webp',
        caption: '88 títulos do FC Porto',
        date: '1 ago 2026',
        type: 'Arquivo',
      },
    ],
  },
} satisfies Pick<HubContent, 'standings' | 'instagram'>;
