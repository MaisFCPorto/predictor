'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Fixture = {
  id: string;
  kickoff_at: string;
  status?: string;
  is_locked?: boolean;
  lock_at_utc?: string | null;
  home_team_name: string;
  away_team_name: string;
  home_crest?: string | null;
  away_crest?: string | null;
  competition_code?: string | null;
  competition_name?: string | null;
  round_label?: string | null;
};

type RankingRow = {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  points: number;
  exact?: number;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatKickoff(iso: string) {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat('pt-PT', { weekday: 'long' }).format(date);
  const day = new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'long',
  }).format(date);
  const time = new Intl.DateTimeFormat('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    day,
    time,
  };
}

function formatCountdown(targetIso: string | null | undefined, now: number) {
  if (!targetIso) return null;
  const remaining = new Date(targetIso).getTime() - now;
  if (remaining <= 0) return 'a fechar';

  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 1)}m`;
}

export default function LandingPreviewPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [loadingFixture, setLoadingFixture] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function loadFixture() {
      try {
        let data = await fetchJson<Fixture[] | { fixtures?: Fixture[] }>('/api/fixtures/open');
        let list = Array.isArray(data) ? data : data.fixtures ?? [];

        if (!list.length) {
          data = await fetchJson<Fixture[] | { fixtures?: Fixture[] }>(
            '/api/matchdays/active/fixtures',
          );
          list = Array.isArray(data) ? data : data.fixtures ?? [];
        }

        const ordered = list
          .filter((fixture) => fixture.status !== 'FINISHED' && !fixture.is_locked)
          .sort(
            (a, b) =>
              new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
          );

        if (!cancelled) setFixtures(ordered);
      } catch {
        if (!cancelled) setFixtures([]);
      } finally {
        if (!cancelled) setLoadingFixture(false);
      }
    }

    async function loadRanking() {
      try {
        const data = await fetchJson<RankingRow[] | { rows?: RankingRow[] }>('/api/rankings');
        const list = Array.isArray(data) ? data : data.rows ?? [];
        if (!cancelled) setRanking(list);
      } catch {
        if (!cancelled) setRanking([]);
      } finally {
        if (!cancelled) setLoadingRanking(false);
      }
    }

    void loadFixture();
    void loadRanking();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const nextFixture = fixtures[0] ?? null;
  const topFive = ranking.slice(0, 5);
  const kickoff = nextFixture ? formatKickoff(nextFixture.kickoff_at) : null;
  const countdown = nextFixture
    ? formatCountdown(nextFixture.lock_at_utc ?? nextFixture.kickoff_at, now)
    : null;

  const rankingCopy = useMemo(() => {
    if (loadingRanking) return 'A carregar a classificação';
    if (ranking.length === 1) return '1 participante no ranking desta época';
    if (ranking.length > 1) return `${ranking.length} participantes no ranking desta época`;
    return 'A classificação começa no primeiro jogo';
  }, [loadingRanking, ranking.length]);

  return (
    <div className="bg-[#061026] text-white">
      <title>+Predictor - Landing preview</title>

      <section className="border-b border-white/[0.08]">
        <div className="mx-auto grid w-[calc(100%_-_2rem)] max-w-[1120px] gap-12 py-12 md:grid-cols-[0.9fr_1.1fr] md:items-center md:py-20 lg:gap-16">
          <div className="max-w-xl">
            <h1 className="text-[clamp(2.65rem,5vw,4.25rem)] font-black leading-[0.98] tracking-[-0.045em]">
              {nextFixture
                ? `Qual é o teu palpite para ${nextFixture.home_team_name} x ${nextFixture.away_team_name}?`
                : 'Qual é o teu palpite para o próximo jogo?'}
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-white/66 md:text-lg md:leading-8">
              Prevê o resultado, escolhe um marcador e entra no ranking da comunidade +FCPorto.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/auth"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-6 text-sm font-extrabold text-[#061026] transition hover:bg-sky-50"
              >
                Criar conta grátis
              </Link>
              <Link
                href="/auth"
                className="inline-flex min-h-12 items-center justify-center px-2 text-sm font-bold text-white/72 transition hover:text-white"
              >
                Já tenho conta
                <span className="ml-2" aria-hidden="true">→</span>
              </Link>
            </div>

          </div>

          <PublicFixtureCard
            fixture={nextFixture}
            loading={loadingFixture}
            kickoff={kickoff}
            countdown={countdown}
          />
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24 py-16 md:py-20">
        <div className="mx-auto w-[calc(100%_-_2rem)] max-w-[1120px]">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black tracking-[-0.035em] md:text-4xl">Como se joga</h2>
            <p className="mt-3 text-base leading-7 text-white/58">
              Escolhes o resultado e um marcador antes de a bola começar a rolar.
            </p>
          </div>

          <div className="mt-10 grid border-y border-white/[0.1] md:grid-cols-3">
            <HowItWorksItem
              number="1"
              title="Prevê o resultado"
              copy="Indica quantos golos marca cada equipa antes do fecho dos palpites."
            />
            <HowItWorksItem
              number="2"
              title="Escolhe um marcador"
              copy="Seleciona um jogador do FC Porto para somar pontos extra."
            />
            <HowItWorksItem
              number="3"
              title="Sobe no ranking"
              copy="Acompanha a classificação geral, mensal e de cada jogo."
            />
          </div>
        </div>
      </section>

      <section id="premios" className="scroll-mt-24 border-y border-white/[0.08] bg-white/[0.018] py-16 md:py-20">
        <div className="mx-auto w-[calc(100%_-_2rem)] max-w-[1120px]">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-black tracking-[-0.035em] md:text-4xl">Há prémios em jogo</h2>
              <p className="mt-4 max-w-md text-base leading-7 text-white/58">
                A classificação conta durante toda a época, mas também existem prémios mensais e em jogos selecionados.
              </p>
              <Link
                href="/premios"
                className="mt-6 inline-flex items-center text-sm font-bold text-sky-300/85 transition hover:text-sky-200"
              >
                Ver todos os prémios
                <span className="ml-2" aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="border-t border-white/[0.1]">
              <PrizeRow
                image="/win-icons-01.svg"
                label="Ranking geral"
                title="Camisola oficial do FC Porto"
                copy="Para quem terminar a época no primeiro lugar."
              />
              <PrizeRow
                image="/win-icons-03.svg"
                label="Todos os meses"
                title="Freebets para o top 3"
                copy="30 €, 20 € e 10 € para os três primeiros do ranking mensal."
              />
              <PrizeRow
                image="/win-icons-04.svg"
                label="Jogos selecionados"
                title="Freebets e experiências Betano"
                copy="Prémios especiais associados a determinados jogos e jornadas."
              />
            </div>
          </div>
        </div>
      </section>

      <section id="ranking" className="scroll-mt-24 py-16 md:py-20">
        <div className="mx-auto grid w-[calc(100%_-_2rem)] max-w-[1120px] gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-black tracking-[-0.035em] md:text-4xl">Vê quem vai à frente</h2>
            <p className="mt-4 max-w-md text-base leading-7 text-white/58">
              Acompanha os pontos, os resultados exatos e a tua posição ao longo da época.
            </p>
            <p className="mt-5 text-sm font-semibold text-white/40">{rankingCopy}</p>
          </div>

          <RankingPreview rows={topFive} loading={loadingRanking} />
        </div>
      </section>

      <section className="border-t border-white/[0.08] py-12 md:py-16">
        <div className="mx-auto flex w-[calc(100%_-_2rem)] max-w-[1120px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.03em] md:text-3xl">O próximo jogo já conta.</h2>
            <p className="mt-2 text-sm leading-6 text-white/55 md:text-base">
              Cria a conta e faz o teu primeiro palpite.
            </p>
          </div>
          <Link
            href="/auth"
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-white px-6 text-sm font-extrabold text-[#061026] transition hover:bg-sky-50"
          >
            Entrar no +Predictor
          </Link>
        </div>
      </section>
    </div>
  );
}

function PublicFixtureCard({
  fixture,
  loading,
  kickoff,
  countdown,
}: {
  fixture: Fixture | null;
  loading: boolean;
  kickoff: ReturnType<typeof formatKickoff> | null;
  countdown: string | null;
}) {
  if (loading) {
    return (
      <div className="min-h-[430px] animate-pulse rounded-xl border border-white/10 bg-[#0a1733] p-6 md:p-7">
        <div className="h-4 w-28 rounded bg-white/10" />
        <div className="mt-12 h-36 rounded-xl bg-white/[0.05]" />
        <div className="mt-10 h-12 rounded-lg bg-white/10" />
      </div>
    );
  }

  if (!fixture || !kickoff) {
    return (
      <article className="flex min-h-[430px] flex-col justify-between rounded-xl border border-white/10 bg-[#0a1733] p-6 md:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/42">Próximo jogo</p>
        </div>
        <div className="text-center">
          <div className="text-4xl" aria-hidden="true">⚽</div>
          <h2 className="mt-5 text-2xl font-black tracking-[-0.03em]">Novo palpite brevemente</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/52">
            Quando o próximo jogo abrir, aparece aqui com a data e o prazo para participar.
          </p>
        </div>
        <Link
          href="/auth"
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-5 text-sm font-extrabold text-[#061026]"
        >
          Criar conta
        </Link>
      </article>
    );
  }

  const competition = fixture.competition_name || fixture.competition_code || 'Próximo jogo';

  return (
    <article className="rounded-xl border border-white/12 bg-[#0a1733] p-6 md:p-7">
      <div className="flex items-start justify-between gap-5 border-b border-white/[0.08] pb-5">
        <div>
          <div className="text-sm font-extrabold text-white">{competition}</div>
          {fixture.round_label && <div className="mt-1 text-xs text-white/40">{fixture.round_label}</div>}
        </div>
        <div className="max-w-[150px] text-right text-xs leading-5 text-white/45">
          {countdown ? `Palpites fecham em ${countdown}` : 'Palpites abertos'}
        </div>
      </div>

      <div className="pt-6 text-center">
        <div className="text-sm font-semibold text-white/48">{kickoff.weekday}, {kickoff.day}</div>
        <div className="mt-1 text-xl font-black text-white">{kickoff.time}</div>
      </div>

      <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Team crest={fixture.home_crest} name={fixture.home_team_name} />
        <div className="flex flex-col items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/28">vs</span>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/15 text-lg font-black text-white/42">-</span>
            <span className="text-white/18">:</span>
            <span className="flex h-10 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/15 text-lg font-black text-white/42">-</span>
          </div>
        </div>
        <Team crest={fixture.away_crest} name={fixture.away_team_name} />
      </div>

      <div className="mt-7 border-t border-white/[0.08] pt-5">
        <div className="mb-4 flex items-center justify-between gap-4 text-xs text-white/42">
          <span>Resultado + marcador</span>
          <span>Até 20 pontos</span>
        </div>
        <Link
          href="/auth"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-white px-5 text-sm font-extrabold text-[#061026] transition hover:bg-sky-50"
        >
          Fazer este palpite
        </Link>
      </div>
    </article>
  );
}

function Team({ crest, name }: { crest?: string | null; name: string }) {
  return (
    <div className="min-w-0 text-center">
      <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center p-1">
        {crest ? (
          <img src={crest} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg font-black text-white/45">
            {initials(name)}
          </span>
        )}
      </div>
      <div className="mt-3 line-clamp-2 text-sm font-extrabold leading-4 text-white">{name}</div>
    </div>
  );
}

function HowItWorksItem({
  number,
  title,
  copy,
}: {
  number: string;
  title: string;
  copy: string;
}) {
  return (
    <article className="border-b border-white/[0.08] py-7 last:border-b-0 md:border-b-0 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
      <div className="text-sm font-black text-sky-300/75">{number}</div>
      <h3 className="mt-5 text-xl font-black tracking-[-0.025em]">{title}</h3>
      <p className="mt-3 max-w-sm text-sm leading-6 text-white/52">{copy}</p>
    </article>
  );
}

function PrizeRow({
  image,
  label,
  title,
  copy,
}: {
  image: string;
  label: string;
  title: string;
  copy: string;
}) {
  return (
    <article className="grid grid-cols-[64px_1fr] gap-4 border-b border-white/[0.1] py-6 last:border-b-0 md:grid-cols-[76px_1fr] md:gap-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/[0.035] p-2 md:h-[76px] md:w-[76px]">
        <img src={image} alt="" className="h-full w-full object-contain" />
      </div>
      <div>
        <div className="text-xs font-bold text-white/38">{label}</div>
        <h3 className="mt-1 text-lg font-black tracking-[-0.02em] md:text-xl">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-white/52">{copy}</p>
      </div>
    </article>
  );
}

function RankingPreview({ rows, loading }: { rows: RankingRow[]; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a1733]">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 md:px-6">
        <div>
          <div className="text-xs font-bold text-white/38">Época atual</div>
          <div className="mt-1 text-base font-extrabold">Ranking geral</div>
        </div>
        <Link href="/rankings" className="text-xs font-bold text-sky-300/75 hover:text-sky-200">
          Ver completo
        </Link>
      </div>

      <div className="p-3 md:p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-white/[0.045]" />
            ))}
          </div>
        ) : rows.length ? (
          <div>
            {rows.map((row, index) => (
              <div
                key={row.user_id || `${row.name}-${index}`}
                className="grid grid-cols-[32px_38px_1fr_auto] items-center gap-3 border-b border-white/[0.07] px-2 py-3.5 last:border-b-0"
              >
                <div className="text-center text-sm font-black text-white/38">{index + 1}</div>
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-[11px] font-black">
                  {row.avatar_url ? <img src={row.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(row.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{row.name}</div>
                  <div className="mt-0.5 text-[10px] text-white/34">{row.exact ?? 0} resultados exatos</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-white">{row.points}</div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">pts</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 items-center justify-center px-6 text-center">
            <div>
              <div className="font-extrabold">O ranking começa no primeiro jogo.</div>
              <div className="mt-2 text-sm text-white/46">Cria a conta e garante o teu lugar.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
