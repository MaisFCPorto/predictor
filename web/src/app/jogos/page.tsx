'use client';

import { useEffect, useMemo, useState } from 'react';
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

export default function JogosPage() {
  const router = useRouter();

  // --- fixtures ---
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<FixtureDTO[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // --- supabase user ---
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabasePKCE.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserName(user.user_metadata?.name || user.email?.split('@')[0] || 'Jogador');
      } else {
        setUserId(null);
        setUserName('Convidado');
      }
      setAuthLoading(false);
    })();
  }, []);

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

  // ordenar por kickoff asc (para abertos)
  const sortedAsc = useMemo(
    () => [...fixtures].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
    [fixtures]
  );

  const openFixtures = useMemo(
    () => sortedAsc.filter(f => f.status === 'SCHEDULED' && !f.is_locked),
    [sortedAsc]
  );

  // passados/bloqueados: ordenar DESC e limitar a 3
  const lockedRecent = useMemo(
    () =>
      [...fixtures]
        .filter(f => f.is_locked || f.status === 'FINISHED')
        .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime())
        .slice(0, 3),
    [fixtures]
  );

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
                  <div className="text-sm opacity-75">Classificação Mensal</div>
                  <div className="mt-1 text-3xl font-bold">
                    {monPos == null ? '—' : `#${monPos}`}
                  </div>
                  <div className="mt-1 text-sm opacity-75">
                    Pontos: {monPoints == null ? '—' : monPoints}
                  </div>
                  <div className="mt-1 text-xs opacity-60">Mês: {ym}</div>
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
                    onSave={onSave}
                    saving={savingId === f.id}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Jogos passados (máx 3) */}
        {!loading && (
          <section>
            <h2 className="text-2xl font-bold mb-4">Jogos passados</h2>
            {lockedRecent.length === 0 ? (
              <div className="opacity-70">Sem jogos passados.</div>
            ) : (
              <div className="space-y-4">
                {lockedRecent.map((f) => (
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
                    onSave={onSave}
                    saving={savingId === f.id}
                    variant="past"
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
