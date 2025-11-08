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
  round_label: string | null;      // J1, QF, SF, F, M1…
  leg: number | null;
  is_locked: boolean;
  lock_at_utc?: string | null;
  // optional final result from API when available
  home_score?: number | null;
  away_score?: number | null;
};

type PredictionDTO = {
  fixture_id: string;
  home_goals: number;
  away_goals: number;
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

type LastPoints =
  | {
      points: number;
      exact: number;
      diff: number;
      winner: number;
      position: number | null;
      fixture?: { id: string; kickoff_at: string } | null;
    }
  | null;

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

/** Helper que garante JSON (evita erro quando o Worker devolve HTML) */
async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${url} → (${res.status}) ${res.statusText}${txt ? ` — ${txt.slice(0, 140)}…` : ''}`);
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

  // --- predictions for current user (by fixture id) ---
  const [predictions, setPredictions] = useState<Record<string, { home: number; away: number }>>({});

  // --- supabase user + SYNC NO WORKER ---
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabasePKCE.auth.getUser();

      if (user) {
        const friendly =
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Jogador';

        setUserId(user.id);
        setUserName(friendly);

        // 🔄 SINCRONIZAÇÃO NO WORKER (via proxy Next)
        // Não bloqueia o UI; erros são ignorados silenciosamente.
        fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            email: user.email ?? null,
            name: friendly,
            avatar_url: user.user_metadata?.avatar_url ?? null,
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
        if (!userId) { if (!abort) setPredictions({}); return; }
        const res = await fetch(`/api/predictions?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
        if (!res.ok) { if (!abort) setPredictions({}); return; }
        const list = (await res.json()) as PredictionDTO[] | any;
        const arr: PredictionDTO[] = Array.isArray(list) ? list : Array.isArray(list?.items) ? list.items : [];
        const map: Record<string, { home: number; away: number }> = {};
        for (const p of arr) {
          if (p && typeof p.fixture_id === 'string') {
            const h = (p as any).home_goals;
            const a = (p as any).away_goals;
            if (typeof h === 'number' && typeof a === 'number') map[p.fixture_id] = { home: h, away: a };
          }
        }
        if (!abort) setPredictions(map);
      } catch {
        if (!abort) setPredictions({});
      }
    })();
    return () => { abort = true; };
  }, [userId]);

  // --- carregar dashboard (geral / mensal / último) ---
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setSummaryErr(null);

        if (!userId) {
          if (!abort) {
            setGenPos(null); setGenPoints(null);
            setMonPos(null); setMonPoints(null);
            setLastPoints(null);
          }
          return;
        }

        const [general, monthly] = await Promise.all([
          fetchJson('/api/rankings') as Promise<RankRow[]>,
          fetchJson(`/api/rankings?ym=${encodeURIComponent(currentYM())}`) as Promise<RankRow[]>,
        ]);

        const pickMyRow = (rows: RankRow[]) => {
          const idx = rows.findIndex(r => r.user_id === userId);
          return idx >= 0 ? { pos: idx + 1, pts: rows[idx].points } : { pos: null, pts: 0 };
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
                `${API_BASE}/api/users/${encodeURIComponent(userId)}/last-points`
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
    return () => { abort = true; };
  }, [userId]);

  // --- carregar fixtures ---
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) novo endpoint via proxy do Next
        let list: FixtureDTO[] = await fetchJson('/api/fixtures/open');

        // 2) fallback para o endpoint antigo (se necessário)
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
    return () => { abort = true; };
  }, []);

  // --- carregar primeiros jogos fechados (terminado ou bloqueado) — apenas 3 ---
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setPastLoading(true);
        const res = await fetch(`/api/fixtures/closed?limit=3&offset=0`, { cache: 'no-store' });
        const list: FixtureDTO[] = (await res.json()) ?? [];
        if (!abort) {
          setPast(list);
          setPastOffset(list.length);
          setPastHasMore(list.length >= 3);
        }
      } catch {
        if (!abort) { setPast([]); setPastHasMore(false); }
      } finally {
        if (!abort) setPastLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  // --- observer para carregar mais ao scroll (jogos fechados) ---
  useEffect(() => {
    if (!enableAutoLoad || !pastHasMore || pastLoading) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(async (entries) => {
      const e = entries[0];
      if (!e.isIntersecting) return;
      obs.unobserve(el);
      try {
        setPastLoading(true);
        const res = await fetch(`/api/fixtures/closed?limit=3&offset=${pastOffset}`, { cache: 'no-store' });
        const more: FixtureDTO[] = (await res.json()) ?? [];
        setPast((prev) => [...prev, ...more]);
        setPastOffset((o) => o + more.length);
        setPastHasMore(more.length >= 3);
      } finally {
        setPastLoading(false);
      }
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [enableAutoLoad, pastHasMore, pastLoading, pastOffset]);

  // --- ativa auto-load quando o utilizador fizer scroll PARA BAIXO (rearma se for desativado), com cooldown
  useEffect(() => {
    if (enableAutoLoad) return;
    const onScroll = () => {
      const y = window.scrollY || 0;
      const last = lastScrollYRef.current;
      const directionDown = y > last + 4; // ignora pequenas oscilações
      lastScrollYRef.current = y;
      if (!directionDown) return;
      if (Date.now() < autoloadResumeAtRef.current) return;
      setEnableAutoLoad(true);
      window.removeEventListener('scroll', onScroll);
    };
    // inicializa referência
    lastScrollYRef.current = window.scrollY || 0;
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enableAutoLoad]);

  // permite "mostrar menos" — volta aos 3 iniciais e desarma o autoload
  function collapsePast() {
    setPast((prev) => prev.slice(0, 3));
    setPastOffset(3);
    setPastHasMore(true);
    setEnableAutoLoad(false);
    autoloadResumeAtRef.current = Date.now() + 1000; // 1s cooldown para evitar trigger imediato
  }

  // ordenar por kickoff asc (para abertos)
  const sortedAsc = useMemo(
    () => [...fixtures].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
    [fixtures]
  );

  const openFixtures = useMemo(
    () => sortedAsc.filter(f => f.status === 'SCHEDULED' && !f.is_locked),
    [sortedAsc]
  );

  // lockedRecent no longer used; we paginate finished fixtures via API

  // guardar palpite
  async function onSave(fixtureId: string, home: number, away: number) {
    try {
      setSavingId(fixtureId);
      setError(null);
      const { data: { user } } = await supabasePKCE.auth.getUser();
      if (!user) throw new Error('Sessão inválida. Faz login novamente.');
      await savePrediction({ userId: user.id, fixtureId, home, away });
      toast.success('Palpite guardado!', { duration: 1500 });
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro a guardar');
    } finally {
      setSavingId(null);
    }
  }

  // anchors
  const ym = currentYM();
  const linkGeneral = '/rankings?mode=general';
  const linkMonthly = `/rankings?mode=monthly&ym=${encodeURIComponent(ym)}`;
  const linkByGame =
    lastPoints?.fixture?.id
      ? `/rankings?mode=bygame&fixtureId=${encodeURIComponent(lastPoints.fixture.id)}`
      : null;

  // helper para tornar card clicável se tiver href
  const CardLink: React.FC<{ href?: string | null; children: React.ReactNode; aria?: string }> = ({ href, children, aria }) => {
    if (userId && href) {
      return (
        <Link
          href={href}
          aria-label={aria}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          {children}
        </Link>
      );
    }
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        {children}
      </div>
    );
  };

  return (
    <main className="px-2 sm:px-4 md:px-6 lg:px-10 py-10">
      <Toaster position="top-center" />

      <div className="mx-auto w-full max-w-6xl space-y-8">
        {/* Header + mini dashboard OU botão de login */}
        <header className="space-y-4">
          {authLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm opacity-80">
              A carregar utilizador…
            </div>
          ) : userId ? (
            <>
              <div className="text-sm opacity-80">Bem-vindo,</div>
              <h1 className="text-3xl font-bold tracking-tight">{userName}</h1>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <CardLink href={linkGeneral} aria="Ir para o ranking geral">
                  <div className="text-sm opacity-75">Classificação Geral</div>
                  <div className="mt-1 text-3xl font-bold">
                    {genPos == null ? '—' : `#${genPos}`}
                  </div>
                  <div className="mt-1 text-sm opacity-75">
                    Pontos: {genPoints == null ? '—' : genPoints}
                  </div>
                </CardLink>

                <CardLink href={linkMonthly} aria="Ir para o ranking mensal">
                  <div className="text-sm opacity-75">Classificação Mensal - {formatYmLabel(ym)}</div>
                  <div className="mt-1 text-3xl font-bold">
                    {monPos == null ? '—' : `#${monPos}`}
                  </div>
                  <div className="mt-1 text-sm opacity-75">
                    Pontos: {monPoints == null ? '—' : monPoints}
                  </div>
                </CardLink>

                <CardLink href={linkByGame} aria="Ir para o ranking do último jogo">
                  <div className="text-sm opacity-75">Último Jogo</div>
                  <div className="mt-1 text-3xl font-bold">
                    {lastPoints == null ? '—' : `${lastPoints.points ?? 0} pts`}
                  </div>
                  <div className="mt-1 text-sm opacity-75">
                    {lastPoints?.position ? `Posição: #${lastPoints.position}` : 'Sem palpite'}
                  </div>
                  {!!lastPoints?.fixture && (
                    <div className="mt-1 text-xs opacity-60">Jogo: {lastPoints.fixture.id}</div>
                  )}
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
              <h1 className="mb-2 text-3xl font-bold tracking-tight">Convidado</h1>
              <p className="mb-4 text-sm opacity-80">
                Entra para veres a tua classificação e começares a pontuar!
              </p>
              <button
                onClick={() => router.push('/auth')}
                className="rounded-2xl border border-white/10 bg-white/[0.10] px-6 py-3 text-base font-medium hover:bg-white/[0.15] transition"
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
            <h2 className="text-2xl font-bold mb-4">Jogos em aberto</h2>
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
                    is_locked={f.is_locked || f.status === 'FINISHED'}
                    lock_at_utc={f.lock_at_utc}
                    pred_home={predictions[f.id]?.home}
                    pred_away={predictions[f.id]?.away}
                    onSave={onSave}
                    saving={savingId === f.id}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Jogos passados (scroll infinito) */}
        {!loading && (
          <section>
            <h2 className="text-2xl font-bold mb-4">Jogos passados</h2>
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
                    onSave={onSave}
                    saving={false}
                    variant="past"
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
                {enableAutoLoad && <div ref={loadMoreRef} />}
                {pastLoading && <div className="opacity-70">A carregar…</div>}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
