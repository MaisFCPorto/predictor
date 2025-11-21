// web/src/app/rankings/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Row = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  points: number;
  exact: number;
  diff: number;
  winner: number;
  scorer_hits?: number; // NOVO: nº de vezes que acertou no marcador
};

type GameLite = {
  id: string;
  kickoff_at: string;               // ISO UTC
  home_team_name: string;
  away_team_name: string;
  competition_code?: string | null; // 'LP', 'LE', 'TP', 'TL'...
  round_label?: string | null;      // 'J1', 'QF', 'SF', 'F', ...
};

// --- helpers ---------------------------------------------------------------

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`(${res.status}) ${res.statusText}${txt ? ` — ${txt.slice(0, 160)}…` : ''}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Resposta não-JSON: ${txt.slice(0, 160)}…`);
  }
  return res.json();
}

function currentYM() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}
function formatYmLabel(ym: string) {
  // ym expected as YYYY-MM
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  const month = d.toLocaleDateString('pt-PT', { month: 'long' });
  const cap = month.charAt(0).toUpperCase() + month.slice(1);
  const yy = String(d.getFullYear()).slice(-2);
  return `${cap}'${yy}`;
}
function initials(name?: string | null) {
  if (!name) return '—';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
function fmtLocalDT(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
function gameLabel(g: GameLite) {
  const when = fmtLocalDT(g.kickoff_at);
  const comp = g.competition_code ? ` • ${g.competition_code}` : '';
  const rnd  = g.round_label ? ` ${g.round_label}` : '';
  return `${when} — ${g.home_team_name} vs ${g.away_team_name}${comp}${rnd}`;
}
function gameShort(g: GameLite) {
  const d = new Date(g.kickoff_at);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm} - ${g.home_team_name} vs ${g.away_team_name}`;
}
function gameHeaderLabel(g: GameLite) {
  const d = new Date(g.kickoff_at);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const weekday = d.toLocaleDateString('pt-PT', { weekday: 'long' }).toLowerCase();
  const compMap: Record<string, string> = {
    TP: 'Taça de Portugal',
    LP: 'Liga Portugal',
    LE: 'Liga Europa',
    TL: 'Taça da Liga',
  };
  const compName = g.competition_code ? compMap[g.competition_code] || g.competition_code : '';
  const comp = compName ? `  • ${compName}` : '';
  return `${weekday}, ${dd}/${mm}, ${hh}:${mi}${comp}`;
}

// --- component -------------------------------------------------------------

export default function RankingsPage() {
  const [mode, setMode] = useState<'general' | 'monthly' | 'bygame'>('general');

  // Mensal
  const [months, setMonths] = useState<string[]>([]);
  const [ym, setYm] = useState<string>(currentYM());

  // Por jogo
  const [games, setGames] = useState<GameLite[]>([]);
  const [fixtureId, setFixtureId] = useState<string>('');

  // tabela
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Carrega meses (para o modo mensal)
  useEffect(() => {
    fetchJson('/api/rankings/months')
      .then((list: string[]) => {
        const arr = Array.isArray(list) ? list : [];
        setMonths(arr);
        if (arr.length) {
          if (arr.includes(currentYM())) setYm(currentYM());
          else setYm(arr[0]); // mais recente
        }
      })
      .catch(() => setMonths([]));
  }, []);

  // Carrega lista de jogos (para o modo por jogo)
  useEffect(() => {
    if (mode !== 'bygame') return;
    setErr(null);
    fetchJson('/api/rankings/games')
      .then((list: GameLite[]) => {
        const arr = Array.isArray(list) ? list : [];
        setGames(arr);
        // default = mais recente (assumindo que a API devolve por kickoff desc)
        if (arr.length && !fixtureId) setFixtureId(arr[0].id);
      })
      .catch((e: any) => setErr(e?.message ?? 'Erro a carregar jogos'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Carrega ranking consoante o modo
  useEffect(() => {
    let url = '/api/rankings';
    if (mode === 'monthly') {
      url = `/api/rankings?ym=${encodeURIComponent(ym)}`;
    } else if (mode === 'bygame') {
      if (!fixtureId) return; // espera pelo fixtureId default
      url = `/api/rankings/game?fixtureId=${encodeURIComponent(fixtureId)}`;
    }

    setLoading(true);
    setErr(null);
    fetchJson(url)
      .then((data: Row[]) => setRows(Array.isArray(data) ? data : []))
      .catch((e: any) => setErr(e?.message ?? 'Erro a carregar ranking'))
      .finally(() => setLoading(false));
  }, [mode, ym, fixtureId]);

  const pageTitle = 'Rankings';
  const cardTitle = useMemo(() => {
    if (mode === 'general') return 'Ranking Geral';
    if (mode === 'monthly') return `Ranking Mensal - ${formatYmLabel(ym)}`;
    const g = games.find((x) => x.id === fixtureId);
    return g ? `Ranking Jogo — ${g.home_team_name} vs ${g.away_team_name}` : 'Ranking Jogo';
  }, [mode, ym, games, fixtureId]);

  const selectedGame = useMemo(
    () => games.find((x) => x.id === fixtureId) || null,
    [games, fixtureId]
  );

  return (
    <main className="mx-auto max-w-6xl p-6">
      <title>+Predictor - Rankings</title>
      <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>

      {/* Tabs + filtros */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
          <button
            onClick={() => setMode('general')}
            className={
              'rounded-full px-4 py-1.5 text-sm transition ' +
              (mode === 'general'
                ? 'bg-white/15 text-white'
                : 'text-white/80 hover:bg-white/10')
            }
          >
            Geral
          </button>
          <button
            onClick={() => setMode('monthly')}
            className={
              'rounded-full px-4 py-1.5 text-sm transition ' +
              (mode === 'monthly'
                ? 'bg-white/15 text-white'
                : 'text-white/80 hover:bg-white/10')
            }
          >
            Mensal
          </button>
          <button
            onClick={() => setMode('bygame')}
            className={
              'rounded-full px-4 py-1.5 text-sm transition ' +
              (mode === 'bygame'
                ? 'bg-white/15 text-white'
                : 'text-white/80 hover:bg-white/10')
            }
          >
            Jogo
          </button>
        </div>

        {mode === 'monthly' && (
          <label className="ml-1 inline-flex items-center gap-2 text-sm text-white/70">
            <span>Mês</span>
            <select
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
              value={ym}
              onChange={(e) => setYm(e.target.value)}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatYmLabel(m)}
                </option>
              ))}
            </select>
          </label>
        )}

        {mode === 'bygame' && (
          <label className="ml-1 inline-flex min-w-[280px] items-center gap-2 text-sm text-white/70">
            <span>Jogo</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
              value={fixtureId}
              onChange={(e) => setFixtureId(e.target.value)}
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {gameShort(g)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Card principal */}
      <section className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] shadow-[0_10px_50px_rgba(0,0,0,0.35)]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
            {cardTitle}
          </span>

          {mode === 'bygame' && fixtureId && (
            <div className="hidden items-center gap-2 text-xs text-white/80 md:flex">
              <span className="opacity-70">Detalhes:</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5">
                {selectedGame ? gameHeaderLabel(selectedGame) : '—'}
              </span>
            </div>
          )}
        </div>

        {/* Estados */}
        {err && <div className="px-5 py-3 text-sm text-red-300">{err}</div>}
        {loading && !err && (
          <div className="px-5 py-3 text-sm text-white/70">A carregar…</div>
        )}

        {/* Mobile list */}
        {!loading && !err && (
          <div className="block sm:hidden">
            {rows.length === 0 ? (
              <div className="px-5 py-8 text-center text-white/60">
                Sem resultados para mostrar.
              </div>
            ) : (
              <ul className="divide-y divide-white/10">
                {rows.map((r, i) => (
                  <li key={`${r.user_id}-${i}`} className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-6 shrink-0 text-right tabular-nums text-white/80">
                        {i + 1}
                      </div>
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-semibold text-white/90">
                        {r.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.avatar_url}
                            alt={r.name ?? 'avatar'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{initials(r.name)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {r.name ?? 'Jogador'}
                        </div>
                        <div className="mt-0.5 text-xs text-white/60">
                          Exatos {r.exact} • Dif. {r.diff} • Tend. {r.winner} • Marc.{' '}
                          {r.scorer_hits ?? 0}
                        </div>
                      </div>
                      <div className="ml-auto rounded-full bg-white/10 px-3 py-1 text-sm font-semibold tabular-nums">
                        {r.points}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Desktop table */}
        {!loading && !err && (
          <div className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <colgroup>
                  {/* #: narrow */}
                  <col style={{ width: '3rem' }} />
                  {/* Jogador: flexible */}
                  <col />
                  {/* Metrics: equal responsive width via clamp */}
                  <col style={{ width: 'clamp(6.5rem, 12vw, 8rem)' }} />
                  <col style={{ width: 'clamp(6.5rem, 12vw, 8rem)' }} />
                  <col style={{ width: 'clamp(6.5rem, 12vw, 8rem)' }} />
                  <col style={{ width: 'clamp(6.5rem, 12vw, 8rem)' }} />
                  <col style={{ width: 'clamp(6.5rem, 12vw, 8rem)' }} />
                </colgroup>

                <thead>
                  <tr className="bg-white/[0.05] text-left">
                    <th className="px-5 py-3 w-12">#</th>
                    <th className="px-5 py-3">Jogador</th>
                    <th className="px-5 py-3 text-right font-semibold whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {/* small medal icon */}
                        <svg
                          className="h-3.5 w-3.5 opacity-80"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 17l-5.5 3 1.5-6.5L3 8.5l6.5-.5L12 2l2.5 6 6.5.5-5 5 1.5 6.5z" />
                        </svg>
                        Pontos
                      </span>
                    </th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">
                      Marcadores
                    </th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">
                      Exatos
                    </th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">
                      Diferença
                    </th>
                    <th className="px-5 py-3 text-right whitespace-nowrap">
                      Tendência
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        className="px-5 py-6 text-center text-white/60"
                        colSpan={7}
                      >
                        Sem resultados para mostrar.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr
                        key={`${r.user_id}-${i}`}
                        className="border-t border-white/10 odd:bg-white/[0.02] hover:bg-white/[0.05]"
                      >
                        <td className="px-5 py-3 tabular-nums w-12">{i + 1}</td>
                        <td className="px-5 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/10 text-xs font-semibold text-white/90">
                              {r.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={r.avatar_url}
                                  alt={r.name ?? 'avatar'}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>{initials(r.name)}</span>
                              )}
                            </div>
                            <span className="font-medium truncate block max-w-[28ch]">
                              {r.name ?? 'Jogador'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <span className="inline-block rounded-full bg-white/10 px-2.5 py-1 text-white font-semibold tabular-nums">
                            {r.points}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap">
                          {r.scorer_hits ?? 0}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap">
                          {r.exact}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap">
                          {r.diff}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap">
                          {r.winner}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rodapé (legenda de pontuação) */}
        <div className="border-t border-white/10 px-5 py-3 text-center text-xs text-white/70">
          <span className="font-semibold text-white">
            Detalhes acerca da pontuação, poderão ser encontrados em{' '}
            <Link
              href="/regras#pontuacao"
              className="underline underline-offset-2 hover:text-white/90"
            >
              Regras - Pontuação
            </Link>
          </span>
          
        </div>
      </section>
    </main>
  );
}
