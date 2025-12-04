'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FixtureCard from '@/components/FixtureCard';
import FixtureSkeleton from '@/components/FixtureSkeleton';
import { supabasePKCE } from '@/utils/supabase/client';
import { savePrediction } from '@/utils/api';
import toast, { Toaster } from 'react-hot-toast';

type FixtureDTO = {
  id: string;
  kickoff_at: string; // UTC
  status: 'SCHEDULED' | 'FINISHED' | string;
  home_team_name: string;
  away_team_name: string;
  home_crest: string | null;
  away_crest: string | null;
  competition_id: string | null;
  competition_code: string | null; // LP/LE/TP/TL…
  round_label: string | null; // J1, QF, SF, F, M1…
  leg: number | null;
  is_locked: boolean;
  lock_at_utc?: string | null;
  home_score?: number | null;
  away_score?: number | null;

  // NOVO: nomes dos marcadores reais, vindo da API
  scorers_names?: string[] | null;
};

type PlayerDTO = {
  id: string;
  name: string;
  position: string; // 'GR' | 'D' | 'M' | 'A'
};

type PredictionDTO = {
  fixture_id: string | number;
  home_goals: number;
  away_goals: number;
  points?: number | null;
  uefa_points?: number | null;
  scorer_player_id?: string | null;
};

type RankRow = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  points: number;
  exact: number;
  diff: number;
  winner: number;
};

type GameLite = {
  id: string;
  kickoff_at: string;
  home_team_name: string;
  away_team_name: string;
  competition_code?: string | null;
  round_label?: string | null;
};

type LastPoints =
  | {
      points: number;
      exact: number;
      diff: number;
      winner: number;
      position: number | null;
      fixture?: {
        id: string;
        kickoff_at: string;
        home_team_name?: string | null;
        away_team_name?: string | null;
      } | null;
    }
  | null;

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

/** Helper que garante JSON (evita erro quando o Worker devolve HTML) */
async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(
      `${url} → (${res.status}) ${res.statusText}${
        txt ? ` — ${txt.slice(0, 140)}…` : ''
      }`,
    );
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${url} → resposta não-JSON: ${txt.slice(0, 140)}…`);
  }
  return res.json();
}

function currentYM() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}
function formatYmLabel(ym: string) {
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  const month = d.toLocaleDateString('pt-PT', { month: 'long' });
  const cap = month.charAt(0).toUpperCase() + month.slice(1);
  return cap;
}

type CardLinkProps = {
  href?: string | null;
  children: React.ReactNode;
  aria?: string;
};

export default function JogosPage() {
  const router = useRouter();

  // --- fixtures ---
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<FixtureDTO[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // past fixtures infinite list
  const [past, setPast] = useState<FixtureDTO[]>([]);
  const [pastOffset, setPastOffset] = useState(0);
  const [pastHasMore, setPastHasMore] = useState(true);
  const [pastLoading, setPastLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [enableAutoLoad, setEnableAutoLoad] = useState(false);
  const autoloadResumeAtRef = useRef<number>(0);
  const lastScrollYRef = useRef<number>(0);
  const [manualLoad, setManualLoad] = useState(false);

  // --- user + dashboard summaries ---
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('Jogador');

  const [genPoints, setGenPoints] = useState<number | null>(null);
  const [genPos, setGenPos] = useState<number | null>(null);

  const [monPoints, setMonPoints] = useState<number | null>(null);
  const [monPos, setMonPos] = useState<number | null>(null);

  const [lastPoints, setLastPoints] = useState<LastPoints>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [lastGameLabel, setLastGameLabel] = useState<string | null>(null);

  // --- predictions for current user (by fixture id) ---
  const [predictions, setPredictions] = useState<
    Record<
      string,
      {
        home: number;
        away: number;
        points: number | null;
        scorer_player_id: string | null;
      }
    >
  >({});

  // --- lista de jogadores (FCP ou plantel relevante) ---
  const [players, setPlayers] = useState<PlayerDTO[]>([]);

  // --- supabase user + SYNC NO WORKER ---
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabasePKCE.auth.getUser();

      if (user) {
        const friendly =
          (user.user_metadata as any)?.name ||
          user.email?.split('@')[0] ||
          'Jogador';

        setUserId(user.id);
        setUserName(friendly);

        fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            email: user.email ?? null,
            name: friendly,
            avatar_url: (user.user_metadata as any)?.avatar_url ?? null,
          }),
        }).catch(() => {});
      } else {
        setUserId(null);
        setUserName('Convidado');
      }

      setAuthLoading(false);
    })();
  }, []);

  // --- carregar predictions do utilizador ---
  useEffect(() => {
    let abort = false;

    (async () => {
      try {
        // ⚠️ sem user → limpa e sai
        if (!userId) {
          if (!abort) setPredictions({});
          return;
        }

        const base =
          API_BASE && API_BASE.length > 0
            ? API_BASE.replace(/\/+$/, '')
            : '';
        const url = base
          ? `${base}/api/predictions?userId=${encodeURIComponent(userId)}`
          : `/api/predictions?userId=${encodeURIComponent(userId)}`;

        const res = await fetch(url, { cache: 'no-store' });

        const text = await res.text();

        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status} ${res.statusText} em /api/predictions`,
          );
        }

        let list: any;
        try {
          const start = text.indexOf('[');
          const end = text.lastIndexOf(']');
          if (start === -1 || end === -1 || end <= start) {
            throw new Error('Formato inesperado da resposta');
          }
          const jsonSlice = text.slice(start, end + 1);
          list = JSON.parse(jsonSlice);
        } catch (e) {
          console.error('Falha a extrair JSON de /api/predictions', e);
          throw new Error(
            'Resposta não-JSON de /api/predictions (ver RAW no console)',
          );
        }

        const arr: PredictionDTO[] = Array.isArray(list)
          ? list
          : Array.isArray(list?.items)
          ? list.items
          : [];

        const map: Record<
          string,
          {
            home: number;
            away: number;
            points: number | null;
            scorer_player_id: string | null;
          }
        > = {};

        for (const p of arr) {
          if (!p || typeof (p as any).fixture_id === 'undefined') continue;

          const fixtureKey = String((p as any).fixture_id);
          const h = (p as any).home_goals;
          const a = (p as any).away_goals;
          const pts = (p as any).points ?? (p as any).uefa_points ?? null;
          const scorerRaw = (p as any).scorer_player_id;

          let scorerId: string | null = null;
          if (typeof scorerRaw === 'string') {
            const t = scorerRaw.trim();
            scorerId = t || null;
          } else if (
            typeof scorerRaw === 'number' &&
            Number.isFinite(scorerRaw)
          ) {
            scorerId = String(scorerRaw);
          }

          if (typeof h === 'number' && typeof a === 'number') {
            map[fixtureKey] = {
              home: h,
              away: a,
              points: typeof pts === 'number' ? pts : null,
              scorer_player_id: scorerId,
            };
          }
        }

        if (!abort) {
          setPredictions(map);
        }
      } catch (err) {
        console.error('Erro a carregar predictions', err);
        if (!abort) setPredictions({});
      }
    })();

    return () => {
      abort = true;
    };
  }, [userId]);

  // --- carregar info do último jogo para label (Home x Away) ---
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const fixtureId = lastPoints?.fixture?.id;
        if (!fixtureId) {
          if (!abort) setLastGameLabel(null);
          return;
        }

        const list = (await fetchJson('/api/rankings/games')) as GameLite[];
        if (abort) return;

        const arr = Array.isArray(list) ? list : [];
        const g = arr.find((x) => x.id === fixtureId) || null;

        if (!abort) {
          setLastGameLabel(
            g ? `${g.home_team_name} x ${g.away_team_name}` : null,
          );
        }
      } catch {
        if (!abort) setLastGameLabel(null);
      }
    })();

    return () => {
      abort = true;
    };
  }, [lastPoints?.fixture?.id]);

  // --- carregar lista de jogadores (com fallback admin) ---
  async function loadPlayers() {
    try {
      const base =
        API_BASE && API_BASE.length > 0 ? API_BASE.replace(/\/+$/, '') : '';
      const publicUrl = base ? `${base}/api/players` : '/api/players';
      const adminUrl = base
        ? `${base}/api/admin/players?team_id=fcp`
        : '/api/admin/players?team_id=fcp';

      // 1) tenta rota pública
      let res = await fetch(publicUrl, { cache: 'no-store' });

      // se der 404/401/403, tenta rota admin (backoffice)
      if (res.status === 404 || res.status === 401 || res.status === 403) {
        console.warn(
          'Rota /api/players indisponível, a cair para /api/admin/players…',
        );
        res = await fetch(adminUrl, { cache: 'no-store' });
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('Falha a carregar jogadores:', res.status, txt);
        setPlayers([]);
        return;
      }

      const json = await res.json();
      const raw: any[] = Array.isArray(json) ? json : [];

      // 🔑 aqui garantimos que o ID é SEMPRE string
      const list: PlayerDTO[] = raw.map((p) => ({
        id: String(p.id),
        name: String(p.name ?? ''),
        position: String(p.position ?? ''),
      }));

      setPlayers(list);
    } catch (err) {
      console.error('Erro a carregar jogadores', err);
      setPlayers([]);
    }
  }

  useEffect(() => {
    void loadPlayers();
  }, []);

  // --- carregar dashboard (geral / mensal / último) ---
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setSummaryErr(null);

        if (!userId) {
          if (!abort) {
            setGenPos(null);
            setGenPoints(null);
            setMonPos(null);
            setMonPoints(null);
            setLastPoints(null);
          }
          return;
        }

        const [general, monthly] = await Promise.all([
          fetchJson('/api/rankings') as Promise<RankRow[]>,
          fetchJson(
            `/api/rankings?ym=${encodeURIComponent(currentYM())}`,
          ) as Promise<RankRow[]>,
        ]);

        const pickMyRow = (rows: RankRow[]) => {
          const idx = rows.findIndex((r) => r.user_id === userId);
          return idx >= 0
            ? { pos: idx + 1, pts: rows[idx].points }
            : { pos: null, pts: 0 };
        };

        const g = pickMyRow(general);
        const m = pickMyRow(monthly);

        if (!abort) {
          setGenPos(g.pos);
          setGenPoints(g.pts);
          setMonPos(m.pos);
          setMonPoints(m.pts);
        }

        if (!abort) {
          if (API_BASE) {
            try {
              const lp = await fetchJson(
                `${API_BASE}/api/users/${encodeURIComponent(
                  userId,
                )}/last-points`,
              );
              setLastPoints(lp as LastPoints);
            } catch {
              setLastPoints(null);
            }
          } else {
            setLastPoints(null);
          }
        }
      } catch (e: any) {
        if (!abort) setSummaryErr(e?.message ?? 'Erro a carregar resumo');
      }
    })();
    return () => {
      abort = true;
    };
  }, [userId]);

  // --- carregar fixtures ---
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        let list: FixtureDTO[] = await fetchJson('/api/fixtures/open');

        if (!Array.isArray(list) || list.length === 0) {
          list = await fetchJson('/api/matchdays/md1/fixtures');
        }

        if (!abort) setFixtures(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (!abort) setError(e?.message ?? 'Erro a carregar jogos');
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, []);

  // --- carregar primeiros jogos fechados ---
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setPastLoading(true);
        const res = await fetch(`/api/fixtures/closed?limit=3&offset=0`, {
          cache: 'no-store',
        });
        const json = await res.json();
        const list: FixtureDTO[] = Array.isArray(json) ? json : [];
        if (!abort) {
          setPast(list);
          setPastOffset(list.length);
          setPastHasMore(list.length >= 3);
        }
      } catch {
        if (!abort) {
          setPast([]);
          setPastHasMore(false);
        }
      } finally {
        if (!abort) setPastLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, []);

  // --- observer para carregar mais ao scroll (jogos fechados) ---
  useEffect(() => {
    if (!enableAutoLoad || !pastHasMore || pastLoading) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      async (entries) => {
        const e = entries[0];
        if (!e.isIntersecting) return;
        obs.unobserve(el);
        try {
          setPastLoading(true);
          const res = await fetch(
            `/api/fixtures/closed?limit=3&offset=${pastOffset}`,
            { cache: 'no-store' },
          );
          const more: FixtureDTO[] = (await res.json()) ?? [];
          setPast((prev) => [...prev, ...more]);
          setPastOffset((o) => o + more.length);
          setPastHasMore(more.length >= 3);
        } finally {
          setPastLoading(false);
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enableAutoLoad, pastHasMore, pastLoading, pastOffset]);

  // --- ativa auto-load quando o utilizador fizer scroll PARA BAIXO ---
  useEffect(() => {
    if (enableAutoLoad || manualLoad) return;
    const onScroll = () => {
      const y = window.scrollY || 0;
      const last = lastScrollYRef.current;
      const directionDown = y > last + 4;
      lastScrollYRef.current = y;
      if (!directionDown) return;
      if (Date.now() < autoloadResumeAtRef.current) return;
      setEnableAutoLoad(true);
      window.removeEventListener('scroll', onScroll);
    };
    lastScrollYRef.current = window.scrollY || 0;
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enableAutoLoad, manualLoad]);

  function collapsePast() {
    setPast((prev) => prev.slice(0, 3));
    setPastOffset(3);
    setPastHasMore(true);
    setEnableAutoLoad(false);
    autoloadResumeAtRef.current = Date.now() + 1000;
    setManualLoad(true);
  }

  async function loadMoreManual() {
    if (pastLoading || !pastHasMore) return;
    try {
      setPastLoading(true);
      const res = await fetch(
        `/api/fixtures/closed?limit=3&offset=${pastOffset}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      const more: FixtureDTO[] = Array.isArray(json) ? json : [];
      setPast((prev) => [...prev, ...more]);
      setPastOffset((o) => o + more.length);
      setPastHasMore(more.length >= 3);
    } finally {
      setPastLoading(false);
    }
  }

  const sortedAsc = useMemo(
    () =>
      [...fixtures].sort(
        (a, b) =>
          new Date(a.kickoff_at).getTime() -
          new Date(b.kickoff_at).getTime(),
      ),
    [fixtures],
  );

  const openFixtures = useMemo(
    () =>
      sortedAsc.filter(
        (f) => f.status === 'SCHEDULED' && !f.is_locked,
      ),
    [sortedAsc],
  );

  // guardar palpite (agora com scorerId)
  async function onSave(
    fixtureId: string,
    home: number,
    away: number,
    scorerId?: string | null,
  ) {
    try {
      setSavingId(fixtureId);
      setError(null);
      const {
        data: { user },
      } = await supabasePKCE.auth.getUser();
      if (!user) throw new Error('Sessão inválida. Faz login novamente.');

      await savePrediction({
        userId: user.id,
        fixtureId,
        home,
        away,
        scorer_player_id: scorerId ?? null,
      });

      // atualiza estado local para refletir de imediato
      setPredictions((prev) => ({
        ...prev,
        [fixtureId]: {
          home,
          away,
          points: prev[fixtureId]?.points ?? null,
          scorer_player_id: scorerId ?? null,
        },
      }));

      toast.success('Palpite guardado!', { duration: 1500 });
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro a guardar');
    } finally {
      setSavingId(null);
    }
  }

  const ym = currentYM();
  const linkGeneral = '/rankings?mode=general';
  const linkMonthly = `/rankings?mode=monthly&ym=${encodeURIComponent(ym)}`;
  const linkByGame = lastPoints?.fixture?.id
    ? `/rankings?mode=bygame&fixtureId=${encodeURIComponent(
        lastPoints.fixture.id,
      )}`
    : null;

  const CardLink = ({ href, children, aria }: CardLinkProps) => {
    const base =
      'group rounded-2xl border border-white/10 bg-white/[0.04] p-4 ' +
      'transition-all duration-200 hover:bg-white/[0.07] ' +
      'hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.45)]';

    if (userId && href) {
      return (
        <Link href={href} aria-label={aria ?? undefined} className={base}>
          {children}
        </Link>
      );
    }
    return <div className={base}>{children}</div>;
  };

  return (
    <main className="px-2 sm:px-4 md:px-6 lg:px-10 py-6 sm:py-8">
      <title>+Predictor - Jogos</title>
      <Toaster position="top-center" />

      <div className="mx-auto w-full max-w-6xl space-y-8">
        {/* Header + mini dashboard OU botão de login */}
        <header className="space-y-4">
          {authLoading ? (
            <div className="bg-card shadow-card rounded-2xl border border-white/10 p-4 text-sm opacity-80">
              A carregar utilizador…
            </div>
          ) : userId ? (
            <>
              <div className="text-sm opacity-80">Bem-vind@,</div>
              <h1 className="text-3xl font-bold tracking-tight text-gradient">
                {userName}
              </h1>

              <div className="grid grid-cols-3 gap-3">
                <CardLink
                  href={linkGeneral}
                  aria="Ir para o ranking geral"
                >
                  <div className="text-xs opacity-75">
                    Classificação Geral
                  </div>
                  {/* linha extra invisível para alinhar cards em mobile */}
                  <div className="mt-1 text-xs opacity-0 select-none md:hidden">
                    placeholder
                  </div>
                  <div className="mt-1 text-2xl sm:text-3xl font-bold">
                    {genPos == null ? '—' : `#${genPos}`}
                  </div>
                  <div className="mt-1 text-xs opacity-75">
                    {genPoints == null ? '—' : genPoints} Pontos
                  </div>
                </CardLink>

                <CardLink
                  href={linkMonthly}
                  aria="Ir para o ranking mensal"
                >
                  <div className="text-xs opacity-75">
                    Classificação Mensal: {formatYmLabel(ym)}
                  </div>
                  <div className="mt-1 text-2xl sm:text-3xl font-bold">
                    {monPos == null ? '—' : `#${monPos}`}
                  </div>
                  <div className="mt-1 text-xs opacity-75">
                    {monPoints == null ? '—' : monPoints} Pontos
                  </div>
                </CardLink>

                <CardLink
                  href={linkByGame}
                  aria="Ir para o ranking do último jogo"
                >
                  <div className="text-xs opacity-75">
                    {lastGameLabel
                      ? `Último Jogo: ${lastGameLabel}`
                      : 'Último Jogo'}
                  </div>
                  <div className="mt-1 text-2xl sm:text-3xl font-bold">
                    {lastPoints == null || lastPoints.position == null
                      ? '—'
                      : `#${lastPoints.position}`}
                  </div>
                  <div className="mt-1 text-xs opacity-75">
                    {lastPoints == null
                      ? 'Sem palpite'
                      : `${lastPoints.points ?? 0} Pontos`}
                  </div>
                </CardLink>
              </div>

              {summaryErr && (
                <div className="rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
                  {summaryErr}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6">
              <h1 className="mb-2 text-3xl font-bold tracking-tight text-gradient">
                Convidado
              </h1>
              <p className="mb-4 text-sm opacity-80">
                Entra para veres a tua classificação e começares a
                pontuar!
              </p>
              <button
                onClick={() => router.push('/auth')}
                className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.10] px-6 py-3 text-base font-medium hover:bg-white/[0.15] transition shadow-card"
              >
                🔐 Entrar / Criar Conta
              </button>
            </div>
          )}
        </header>

        {/* Erro geral (fixtures) */}
        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm break-words">
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <FixtureSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Jogos em aberto */}
        {!loading && (
          <section>
            <h2 className="text-2xl font-bold mb-4 text-gradient">
              Jogos em aberto
            </h2>
            {openFixtures.length === 0 ? (
              <div className="opacity-70">Sem jogos abertos.</div>
            ) : (
              <div className="space-y-4">
                {openFixtures.map((f) => (
                  <FixtureCard
                    key={f.id}
                    id={f.id}
                    kickoff_at={f.kickoff_at}
                    status={f.status}
                    home_team_name={f.home_team_name}
                    away_team_name={f.away_team_name}
                    home_crest={f.home_crest}
                    away_crest={f.away_crest}
                    competition_code={f.competition_code}
                    round_label={f.round_label}
                    leg={f.leg}
                    is_locked={f.is_locked}
                    lock_at_utc={f.lock_at_utc ?? null}
                    final_home_score={f.home_score ?? null}
                    final_away_score={f.away_score ?? null}
                    pred_home={predictions[f.id]?.home}
                    pred_away={predictions[f.id]?.away}
                    pred_scorer_id={
                      predictions[f.id]?.scorer_player_id ?? null
                    }
                    points={predictions[f.id]?.points ?? null}
                    players={players}
                    onSave={onSave}
                    saving={savingId === f.id}
                    canEdit={!!userId}
                    variant="default"
                    // 👇 NOVO: mostrar tendências para todos os jogos em aberto
                    showTrends={true}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Jogos passados (scroll infinito) */}
        {!loading && (
          <section>
            <h2 className="text-2xl font-bold mb-4 text-gradient">
              Jogos passados
            </h2>
            {past.length === 0 && pastLoading ? (
              <div className="opacity-70">A carregar…</div>
            ) : past.length === 0 ? (
              <div className="opacity-70">Sem jogos passados.</div>
            ) : (
              <div className="space-y-4">
                {past.map((f) => (
                  <FixtureCard
                    key={f.id}
                    id={f.id}
                    kickoff_at={f.kickoff_at}
                    status={f.status}
                    home_team_name={f.home_team_name}
                    away_team_name={f.away_team_name}
                    home_crest={f.home_crest}
                    away_crest={f.away_crest}
                    competition_code={f.competition_code}
                    round_label={f.round_label}
                    leg={f.leg}
                    is_locked={true}
                    lock_at_utc={null}
                    final_home_score={f.home_score ?? null}
                    final_away_score={f.away_score ?? null}
                    pred_home={predictions[f.id]?.home}
                    pred_away={predictions[f.id]?.away}
                    pred_scorer_id={
                      predictions[f.id]?.scorer_player_id ?? null
                    }
                    points={predictions[f.id]?.points ?? null}
                    players={players}
                    onSave={onSave}
                    saving={false}
                    variant="past"
                    // 👇 marcadores reais
                    scorersNames={f.scorers_names ?? []}
                  />
                ))}

                {past.length > 3 && (
                  <div className="flex justify-center">
                    <button
                      className="rounded bg-white/10 px-3 py-1 hover:bg-white/15"
                      onClick={collapsePast}
                      title="Ocultar jogos carregados e voltar aos 3 mais recentes"
                    >
                      Mostrar menos
                    </button>
                  </div>
                )}

                {!manualLoad && enableAutoLoad && (
                  <div ref={loadMoreRef} />
                )}

                {manualLoad && pastHasMore && past.length <= 3 && (
                  <div className="flex justify-center">
                    <button
                      className="mt-2 rounded bg-white/10 px-3 py-1 hover:bg-white/15 disabled:opacity-50"
                      onClick={loadMoreManual}
                      disabled={pastLoading}
                    >
                      {pastLoading ? 'A carregar…' : 'Mostrar mais'}
                    </button>
                  </div>
                )}

                {pastLoading && (
                  <div className="opacity-70">A carregar…</div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
