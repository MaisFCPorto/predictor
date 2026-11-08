'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatHubNewsDate } from '@/features/hub/news-date';
import type { HubArticle, HubContent, StandingsSnapshot } from '@/features/hub/types';
import { useAdminBetaContent } from '@/utils/supabase/use-admin-beta-content';
import styles from './hub.module.css';

const readHub = (response: Response): Promise<HubContent> => response.json();

function NewsLink({ article }: { article: HubArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className={styles.textLink}
      aria-label={`${article.title} · ${article.source}`}
    >
      Ler notícia <span aria-hidden="true">↗</span>
    </a>
  );
}

function ArticleLabel({ article }: { article: HubArticle }) {
  return (
    <div className={styles.articleLabel}>
      <span>{article.source}</span>
      <time dateTime={article.publishedAt}>{formatHubNewsDate(article.publishedAt)}</time>
    </div>
  );
}

function NewsFeed({ articles, available }: { articles: HubArticle[]; available: boolean }) {
  const [lead, ...latest] = articles;

  return (
    <section id="noticias" aria-labelledby="news-title" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id="news-title">Notícias</h2>
        <Link href="/admin/hub-news" className={styles.textLink}>Gerir notícias</Link>
      </div>
      {lead ? (
        <article className={styles.lead}>
          <div className={styles.leadBody}>
            <ArticleLabel article={lead} />
            <h3>{lead.title}</h3>
            <NewsLink article={lead} />
          </div>
        </article>
      ) : (
        <p className={styles.newsEmpty}>
          {available ? 'Ainda não há notícias aprovadas.' : 'As notícias estão temporariamente indisponíveis.'}
        </p>
      )}
      {latest.map((article) => (
        <article className={styles.newsRow} key={article.url}>
          <div className={styles.newsCopy}>
            <ArticleLabel article={article} />
            <h3>{article.title}</h3>
            <NewsLink article={article} />
          </div>
        </article>
      ))}
    </section>
  );
}

function StandingsTable({ snapshot }: { snapshot: StandingsSnapshot }) {
  return (
    <div id="tabela-competicao" className={styles.tableContent}>
      <div className={styles.tableTitle}>
        <h3>{snapshot.name}</h3>
        <p>{snapshot.asOf}</p>
      </div>
      <table className={styles.standings}>
        <caption className="sr-only">{snapshot.scope}</caption>
        <thead>
          <tr>
            <th scope="col" aria-label="Posição">#</th>
            <th scope="col">Equipa</th>
            <th scope="col" aria-label="Jogos">J</th>
            <th scope="col" aria-label="Pontos">Pts</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.rows.map((row) => (
            <tr key={row.position} data-porto={row.porto ? 'true' : undefined}>
              <td>{row.position}</td>
              <th scope="row">{row.team}</th>
              <td>{row.played}</td>
              <td>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.tableFooter}>
        <span>{snapshot.scope}</span>
        <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer" className={styles.textLink}>
          Tabela completa <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}

function Classifications({ standings }: { standings: HubContent['standings'] }) {
  const [competition, setCompetition] = useState<keyof HubContent['standings']>('liga');

  return (
    <section id="classificacoes" aria-labelledby="standings-title" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id="standings-title">Classificações</h2>
        <span>2026/27</span>
      </div>
      <div className={styles.tableCard}>
        <div className={styles.competitionControls} role="group" aria-label="Competição">
          <button
            type="button"
            aria-pressed={competition === 'liga'}
            aria-controls="tabela-competicao"
            onClick={() => setCompetition('liga')}
          >
            Primeira Liga
          </button>
          <button
            type="button"
            aria-pressed={competition === 'champions'}
            aria-controls="tabela-competicao"
            onClick={() => setCompetition('champions')}
          >
            Champions
          </button>
        </div>
        <StandingsTable snapshot={standings[competition]} />
      </div>
    </section>
  );
}

function InstagramCarousel({ profileUrl, summary, posts }: HubContent['instagram']) {
  const rail = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const element = rail.current;
    if (!element) return;

    const updateEdges = () => {
      const start = element.scrollLeft <= 2;
      const end = element.scrollLeft + element.clientWidth >= element.scrollWidth - 2;
      setEdges((previous) => previous.start === start && previous.end === end ? previous : { start, end });
    };

    const resize = new ResizeObserver(updateEdges);
    resize.observe(element);
    element.addEventListener('scroll', updateEdges, { passive: true });
    updateEdges();
    return () => {
      resize.disconnect();
      element.removeEventListener('scroll', updateEdges);
    };
  }, []);

  function move(direction: -1 | 1) {
    const element = rail.current;
    const firstCard = element?.firstElementChild;
    if (!element || !firstCard) return;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    const step = firstCard.getBoundingClientRect().width + gap;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({ left: direction * step, behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  return (
    <section id="instagram" className={`${styles.section} ${styles.social}`} aria-labelledby="instagram-title">
      <div className={styles.socialHead}>
        <div>
          <p className={styles.kicker}>@MAISFCPORTO</p>
          <h2 id="instagram-title">Do nosso Instagram</h2>
          <p className={styles.socialMeta}>{summary}</p>
        </div>
        <div className={styles.socialActions}>
          <a className={styles.textLink} href={profileUrl} target="_blank" rel="noreferrer">
            Ver perfil <span aria-hidden="true">↗</span>
          </a>
          <button
            type="button"
            aria-label="Publicações anteriores"
            aria-controls="instagram-publicacoes"
            disabled={edges.start}
            onClick={() => move(-1)}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Publicações seguintes"
            aria-controls="instagram-publicacoes"
            disabled={edges.end}
            onClick={() => move(1)}
          >
            →
          </button>
        </div>
      </div>
      <ul id="instagram-publicacoes" ref={rail} className={styles.postRail} aria-label="Publicações do Instagram">
        {posts.map((post) => (
          <li key={post.url}>
            <a className={styles.post} href={post.url} target="_blank" rel="noreferrer">
              <div className={styles.postImage}>
                <Image src={post.image} alt="" fill sizes="(max-width: 690px) 230px, 260px" />
                {post.type !== 'Publicação' && <span>{post.type}</span>}
              </div>
              <div className={styles.postCopy}>
                <strong>{post.caption}</strong>
                <span>{post.date} <span aria-hidden="true">↗</span></span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function HubPreview() {
  const content = useAdminBetaContent('/api/hub', readHub);

  if (content.status === 'denied') {
    return (
      <main className={styles.access}>
        <h1>404</h1>
        <p>Página indisponível.</p>
        <Link href="/jogos" className={styles.textLink}>Voltar ao Predictor</Link>
      </main>
    );
  }

  if (content.status !== 'ready') {
    return <main className={styles.access}><p role="status">A verificar acesso…</p></main>;
  }

  const { edition, articles, newsAvailable, standings, instagram, cadernetaEnabled } = content.data;

  return (
    <div className={styles.hub}>
      <a href="#hub-conteudo" className={styles.skip}>Saltar para o conteúdo</a>
      <header className={styles.header}>
        <div className={`${styles.width} ${styles.headerInner}`}>
          <Link href="/hub" className={styles.brand}>
            <Image src="/logobranco.png" alt="+FCPorto" width={118} height={38} priority />
            <span>HUB</span>
          </Link>
          <nav aria-label="Secções do hub" className={styles.nav}>
            <a href="#noticias">Notícias</a>
            <a href="#classificacoes">Classificações</a>
            <a href="#instagram">Instagram</a>
          </nav>
          <span className={styles.beta}>Beta admin</span>
        </div>
      </header>

      <main id="hub-conteudo" className={styles.width}>
        <div className={styles.masthead}>
          <div>
            <p className={styles.kicker}><time dateTime={edition.date}>{edition.label}</time></p>
            <h1>O dia do Porto<span>.</span></h1>
            <p>A atualidade do clube e os espaços da comunidade.</p>
          </div>
          <div className={styles.shortcuts} aria-label="Espaços +FCPorto">
            <Link href="/jogos" className={styles.shortcut}>
              <span className={styles.shortcutMark} aria-hidden="true">P</span>
              <span><small>PALPITES</small><strong>Predictor</strong></span>
              <span className={styles.shortcutArrow} aria-hidden="true">↗</span>
            </Link>
            {cadernetaEnabled && (
              <Link href="/caderneta" className={styles.shortcut}>
                <span className={styles.shortcutMark} aria-hidden="true">C</span>
                <span><small>COLEÇÃO</small><strong>Caderneta</strong></span>
                <span className={styles.shortcutArrow} aria-hidden="true">↗</span>
              </Link>
            )}
          </div>
        </div>

        <div className={styles.editorialGrid}>
          <NewsFeed articles={articles} available={newsAvailable} />
          <Classifications standings={standings} />
        </div>
        <InstagramCarousel {...instagram} />
      </main>

      <footer className={styles.footer}>
        <div className={styles.width}>
          <span>+FCPorto</span>
          <span>Hub editorial</span>
        </div>
      </footer>
    </div>
  );
}
