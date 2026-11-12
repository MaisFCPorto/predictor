'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatHubNewsDate } from '@/features/hub/news-date';
import { NewsImage } from '@/features/hub/news-image';
import type { HubArticle, HubContent, StandingsSnapshot } from '@/features/hub/types';
import { useAdminBetaContent } from '@/utils/supabase/use-admin-beta-content';
import styles from './hub.module.css';

const readHub = (response: Response): Promise<HubContent> => response.json();

type StoryPlacement = 'lead' | 'highlight' | 'feed';

function HubNavigation({ cadernetaEnabled }: { cadernetaEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !bar.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div
      ref={bar}
      className={styles.navBar}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          closeMenu();
          toggle.current?.focus();
        }
      }}
    >
      <button
        ref={toggle}
        type="button"
        className={styles.menuToggle}
        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={open}
        aria-controls="hub-nav"
        onClick={() => setOpen((previous) => !previous)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 6h16M4 12h16M4 18h16'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        Menu
      </button>
      <nav id="hub-nav" aria-label="Secções do hub" className={styles.nav} data-open={open}>
        <ul>
          <li><a href="#noticias" className={styles.navHome} onClick={closeMenu}>Dragão</a></li>
          <li><a href="#mais-noticias" onClick={closeMenu}>Mais notícias</a></li>
          <li><a href="#classificacoes" onClick={closeMenu}>Classificações</a></li>
          <li><Link href="/jogos" onClick={closeMenu}>Predictor</Link></li>
          {cadernetaEnabled && <li><Link href="/caderneta" onClick={closeMenu}>Caderneta</Link></li>}
          <li><Link href="/hub/onze" onClick={closeMenu}>Faz o teu Onze</Link></li>
          <li><Link href="/hub/notas" onClick={closeMenu}>Avalia os jogadores</Link></li>
          <li><a href="#instagram" onClick={closeMenu}>Instagram</a></li>
        </ul>
      </nav>
    </div>
  );
}

function NewsStory({ article, placement }: { article: HubArticle; placement: StoryPlacement }) {
  const articleId = article.articleId ?? article.summaryId;
  const internal = Number.isSafeInteger(articleId) && (articleId ?? 0) > 0;
  return (
    <article className={styles[placement]}>
      <a className={styles.storyLink} href={internal ? `/hub/noticias/${articleId}` : article.url}
        target={internal ? undefined : '_blank'} rel={internal ? undefined : 'noreferrer'}>
        <NewsImage src={article.imageUrl} className={styles.newsPhoto} size={placement === 'lead' ? 'lead' : 'card'} />
        <div className={styles.newsCopy}>
          <p className={styles.articleSource}>{article.source}</p>
          <h3>{article.title}</h3>
          {placement === 'feed' && (
            <time className={styles.articleDate} dateTime={article.publishedAt}>
              {formatHubNewsDate(article.publishedAt)}
            </time>
          )}
        </div>
      </a>
    </article>
  );
}

function NewsFeed({ articles, available, edition }: {
  articles: HubArticle[];
  available: boolean;
  edition: HubContent['edition'];
}) {
  const featured = articles.slice(0, 3);
  const latest = articles.filter((article) => !featured.includes(article));

  return (
    <div id="noticias" className={styles.section}>
      <h1 className={styles.masthead}>O dia do Porto</h1>
      {featured.length > 0 && (
        <section aria-labelledby="featured-title" className={styles.frontPage} data-count={featured.length}>
          <h2 id="featured-title" className="sr-only">Em destaque</h2>
          {featured.map((article, index) => (
            <NewsStory article={article} placement={index === 0 ? 'lead' : 'highlight'} key={article.url} />
          ))}
        </section>
      )}
      <section id="mais-noticias" aria-labelledby="news-title" className={styles.newsPanel} tabIndex={-1}>
        <div className={styles.newsPanelHead}>
          <h2 id="news-title">Outras notícias</h2>
          <time dateTime={edition.date}>{edition.label}</time>
        </div>
        {latest.length > 0 ? (
          <div className={styles.newsGrid}>
            {latest.map((article) => <NewsStory article={article} placement="feed" key={article.url} />)}
          </div>
        ) : (
          <p className={styles.newsEmpty}>
            {available ? 'As próximas notícias aprovadas aparecem aqui.' : 'As notícias estão temporariamente indisponíveis.'}
          </p>
        )}
      </section>
    </div>
  );
}

const GAME_ROTATION_MS = 6_000;

const gamePromos = [
  {
    id: 'predictor',
    name: 'Predictor',
    title: 'O teu prognóstico dá prémios',
    description: 'A participação é gratuita',
    action: 'Jogar já',
    href: '/jogos',
    photo: '/hub/vitoria-fc-porto.webp',
  },
  {
    id: 'notas',
    name: 'Notas',
    title: 'Avalia os jogadores',
    description: 'Dá as tuas notas e vê a média dos adeptos',
    action: 'Dar notas',
    href: '/hub/notas',
    photo: '/hub/ig-01.webp',
  },
  {
    id: 'onze',
    name: 'Onze',
    title: 'Faz o teu onze',
    description: 'Escolhe a formação e partilha a tua equipa',
    action: 'Montar o onze',
    href: '/hub/onze',
    photo: '/hub/ig-09.webp',
  },
  {
    id: 'album',
    name: 'Álbum',
    title: 'A tua caderneta digital',
    description: 'Abre carteiras e coleciona cromos do FC Porto',
    action: 'Abrir álbum',
    href: '/caderneta',
    photo: '/hub/ig-05.webp',
  },
] as const;

function GameCarousel({ cadernetaEnabled }: { cadernetaEnabled: boolean }) {
  const [active, setActive] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [hovering, setHovering] = useState(false);
  const rotationControl = useRef<HTMLButtonElement>(null);
  const game = gamePromos[active];
  const canOpen = game.id !== 'album' || cadernetaEnabled;
  const rotationAction = autoRotate ? 'Pausar rotação automática' : 'Retomar rotação automática';

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    setAutoRotate(!preference.matches);

    function respectReducedMotion() {
      if (preference.matches) setAutoRotate(false);
    }

    preference.addEventListener('change', respectReducedMotion);
    return () => preference.removeEventListener('change', respectReducedMotion);
  }, []);

  useEffect(() => {
    if (!autoRotate || hovering) return;

    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((index) => (index + 1) % gamePromos.length);
    }, GAME_ROTATION_MS);

    return () => window.clearInterval(timer);
  }, [autoRotate, hovering]);

  function move(step: -1 | 1) {
    setAutoRotate(false);
    setActive((index) => (index + step + gamePromos.length) % gamePromos.length);
  }

  return (
    <section
      aria-label="Jogos e apps do +FCPorto"
      aria-roledescription="carrossel"
      className={styles.promo}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovering(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setHovering(false);
      }}
      onFocusCapture={(event) => {
        if (event.target !== rotationControl.current || event.target.matches(':focus-visible')) {
          setAutoRotate(false);
        }
      }}
    >
      <button
        ref={rotationControl}
        type="button"
        className={styles.promoRotation}
        aria-label={rotationAction}
        aria-controls="hub-jogo-destaque"
        title={rotationAction}
        onClick={() => setAutoRotate((previous) => !previous)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d={autoRotate ? 'M9 5v14M15 5v14' : 'M9 5l11 7-11 7z'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div id="hub-jogo-destaque" aria-live={autoRotate ? 'off' : 'polite'} aria-atomic="true">
        <div className={styles.promoSlide} data-game={game.id} key={game.id}>
          <div className={styles.promoCopy}>
            <div className={styles.promoBrand}>
              {game.id === 'predictor'
                ? <Image src="/logos/predictor-02.svg" alt="+Predictor" width={210} height={58} />
                : <strong>{game.name}</strong>}
            </div>
            <h2>{game.title}</h2>
            <p>{game.description}</p>
            {canOpen ? (
              <Link href={game.href} className={styles.promoLink}>
                {game.action} <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <span className={styles.promoUnavailable}>Em breve</span>
            )}
          </div>
          <div className={styles.promoPhoto}>
            <Image
              src={game.photo}
              alt=""
              fill
              sizes="(max-width: 560px) calc(100vw - 28px), (max-width: 1000px) 35vw, 465px"
            />
          </div>
        </div>
      </div>
      <div className={styles.promoControls}>
        <button type="button" aria-label="Destaque anterior" aria-controls="hub-jogo-destaque" onClick={() => move(-1)}>
          <span aria-hidden="true">←</span>
        </button>
        <div className={styles.promoChoices} role="group" aria-label="Escolher jogo">
          {gamePromos.map((promo, index) => (
            <button
              type="button"
              key={promo.id}
              aria-label={`Mostrar ${promo.name}`}
              aria-pressed={index === active}
              aria-controls="hub-jogo-destaque"
              onClick={() => {
                setAutoRotate(false);
                setActive(index);
              }}
            >
              <span>{promo.name}</span>
            </button>
          ))}
        </div>
        <button type="button" aria-label="Destaque seguinte" aria-controls="hub-jogo-destaque" onClick={() => move(1)}>
          <span aria-hidden="true">→</span>
        </button>
      </div>
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
    <section id="instagram" className={styles.section} aria-labelledby="instagram-title">
      <div className={styles.socialHead}>
        <div>
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
        <div className={styles.headerInner}>
          <Link href="/hub" className={styles.brand}>
            <Image src="/logobranco.png" alt="+FCPorto" width={168} height={54} priority />
          </Link>
          <div className={styles.headerActions}>
            <span>Beta admin</span>
            <Link href="/admin/hub-news">Gerir notícias</Link>
          </div>
        </div>
      </header>
      <HubNavigation cadernetaEnabled={cadernetaEnabled} />

      <main id="hub-conteudo" className={`${styles.width} ${styles.main}`} tabIndex={-1}>
        <NewsFeed articles={articles} available={newsAvailable} edition={edition} />
        <GameCarousel cadernetaEnabled={cadernetaEnabled} />
        <div className={styles.bottomGrid}>
          <Classifications standings={standings} />
          <InstagramCarousel {...instagram} />
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.width}>
          <span>+FCPorto</span>
          <span>Beta admin</span>
        </div>
      </footer>
    </div>
  );
}
