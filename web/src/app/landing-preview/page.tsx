'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';

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
  competition_accent_color?: string | null;
  round_label?: string | null;
};

type RankingRow = {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  points: number;
  exact?: number;
  scorer_hits?: number;
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
  if (remaining <= 0) return 'A fechar';

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

  const rankingLabel = useMemo(() => {
    if (loadingRanking) return 'Ranking em direto';
    if (ranking.length > 0) return `${ranking.length} jogadores no ranking`;
    return 'Uma época inteira para subir';
  }, [loadingRanking, ranking.length]);

  return (
    <div className="overflow-hidden">
      <title>+Predictor - Landing preview</title>

      <section className="relative isolate border-b border-white/[0.07]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[-12rem] top-[-16rem] h-[34rem] w-[34rem] rounded-full bg-blue-600/25 blur-[120px]" />
          <div className="absolute right-[-10rem] top-16 h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-[120px]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
        </div>

        <div className="mx-auto grid w-[calc(100%_-_2rem)] max-w-[1120px] gap-12 py-14 md:grid-cols-[1.05fr_.95fr] md:items-center md:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan-100">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(86,216,255,.9)]" />
              Mini-liga da comunidade +FCPorto
            </div>

            <h1 className="max-w-2xl text-[clamp(2.9rem,7vw,5.7rem)] font-black leading-[0.9] tracking-[-0.06em] text-white">
              Vê o jogo antes de ele acontecer.
            </h1>

            <p className="mt-7 max-w-xl text-base leading-7 text-white/68 md:text-lg md:leading-8">
              Prevê o resultado, escolhe um marcador e transforma cada jornada numa corrida pelo topo do ranking.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-extrabold text-[#06102b] shadow-[0_16px_45px_rgba(255,255,255,.12)] transition hover:-translate-y-0.5 hover:bg-cyan-50"
              >
                Fazer o meu palpite
                <span className="ml-2" aria-hidden="true">→</span>
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.045] px-6 text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/[0.08]"
              >
                Ver como funciona
              </a>
            </div>

            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/52">
              <span className="flex items-center gap-2"><CheckIcon /> Grátis para jogar</span>
              <span className="flex items-center gap-2"><CheckIcon /> Ranking da época</span>
              <span className="flex items-center gap-2"><CheckIcon /> Prémios reais</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-blue-500/10 blur-3xl" />
            <PublicFixtureCard
              fixture={nextFixture}
              loading={loadingFixture}
              kickoff={kickoff}
              countdown={countdown}
            />

            <div className="relative mx-4 -mt-3 flex items-center justify-between gap-4 rounded-2xl border border-orange-300/20 bg-[#1a1524]/95 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,.45)] backdrop-blur-xl">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-orange-300/75">Prémio do jogo</div>
                <div className="mt-0.5 text-sm font-extrabold text-white">Freebet de 10€</div>
              </div>
              <img
                src="/win-icons-02.svg"
                alt=""
                className="h-11 w-16 object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-[calc(100%_-_2rem)] max-w-[1120px] py-8 md:py-10">
        <div className="grid overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.035] sm:grid-cols-3">
          <LandingMetric value={rankingLabel} label="Comunidade em competição" />
          <LandingMetric value="Até 20 pontos" label="Num único palpite" />
          <LandingMetric value="Toda a época" label="Para chegar ao topo" />
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24 py-16 md:py-24">
        <div className="mx-auto w-[calc(100%_-_2rem)] max-w-[1120px]">
          <div className="grid gap-8 md:grid-cols-[.75fr_1.25fr] md:items-end">
            <div>
              <p className="eyebrow">Sem complicações</p>
              <h2 className="max-w-md text-[clamp(2.2rem,5vw,4rem)] font-black leading-[0.96] tracking-[-0.05em]">
                Três escolhas. Uma classificação.
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-white/60 md:justify-self-end md:text-base">
              Não precisas de acertar tudo para pontuar. Resultado, diferença de golos e marcador podem fazer-te subir em cada jornada.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <StepCard
              number="01"
              title="Prevê o resultado"
              copy="Escolhe os golos de cada equipa antes do apito inicial."
              icon={<ScoreIcon />}
            />
            <StepCard
              number="02"
              title="Escolhe um marcador"
              copy="Arrisca num jogador do FC Porto e soma um bónus extra."
              icon={<PlayerIcon />}
            />
            <StepCard
              number="03"
              title="Sobe no ranking"
              copy="Cada acerto conta no jogo, no mês e na classificação geral."
              icon={<ChartIcon />}
            />
          </div>
        </div>
      </section>

      <section id="premios" className="scroll-mt-24 border-y border-white/[0.07] bg-white/[0.018] py-16 md:py-24">
        <div className="mx-auto w-[calc(100%_-_2rem)] max-w-[1120px]">
          <div className="max-w-2xl">
            <p className="eyebrow">Há mais em jogo</p>
            <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-black leading-[0.96] tracking-[-0.05em]">
              Palpites com prémios à altura.
            </h2>
            <p className="mt-5 text-sm leading-7 text-white/60 md:text-base">
              Compete em cada jogo, todos os meses e até ao final da época.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <article className="relative min-h-[390px] overflow-hidden rounded-[1.75rem] border border-blue-300/15 bg-[linear-gradient(145deg,rgba(22,79,188,.45),rgba(5,17,48,.92))] p-6 md:p-9">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_30%,rgba(86,216,255,.19),transparent_35%)]" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="text-[11px] font-black uppercase tracking-[0.17em] text-cyan-200/75">Prémio da época</div>
                <h3 className="mt-3 max-w-md text-3xl font-black tracking-[-0.04em] md:text-5xl">
                  Camisola oficial do FC Porto
                </h3>
                <p className="mt-4 max-w-md text-sm leading-6 text-white/62">
                  O primeiro classificado do ranking geral termina a época de azul e branco.
                </p>
                <Link href="/premios" className="mt-7 inline-flex w-fit items-center gap-2 text-sm font-bold text-white hover:text-cyan-100">
                  Conhecer todos os prémios <span aria-hidden="true">→</span>
                </Link>
              </div>
              <img
                src="/win-icons-01.svg"
                alt="Camisola oficial do FC Porto"
                className="absolute bottom-[-1.5rem] right-[-1rem] h-64 w-64 object-contain opacity-95 md:bottom-[-2rem] md:right-6 md:h-80 md:w-80"
              />
            </article>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <PrizeCard
                eyebrow="Todos os meses"
                title="30€ · 20€ · 10€"
                copy="Freebets Betano para o pódio do ranking mensal."
                image="/win-icons-03.svg"
              />
              <PrizeCard
                eyebrow="Jornadas europeias"
                title="Bilhete duplo"
                copy="Uma Experiência Betano para o melhor palpite da jornada."
                image="/win-icons-04.svg"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="ranking" className="scroll-mt-24 py-16 md:py-24">
        <div className="mx-auto grid w-[calc(100%_-_2rem)] max-w-[1120px] gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow">A corrida já começou</p>
            <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-black leading-[0.96] tracking-[-0.05em]">
              Cada jornada mexe no topo.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/60 md:text-base">
              Acompanha a classificação geral, o ranking mensal e o desempenho em cada jogo.
            </p>
            <Link
              href="/auth"
              className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.055] px-5 text-sm font-bold text-white transition hover:bg-white/[0.1]"
            >
              Entrar na classificação
            </Link>
          </div>

          <RankingPreview rows={topFive} loading={loadingRanking} />
        </div>
      </section>

      <section className="pb-16 md:pb-24">
        <div className="relative mx-auto w-[calc(100%_-_2rem)] max-w-[1120px] overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-[linear-gradient(130deg,rgba(25,91,232,.7),rgba(8,25,65,.92))] px-6 py-12 text-center shadow-[0_35px_100px_rgba(0,0,0,.35)] md:px-12 md:py-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(86,216,255,.18),transparent_48%)]" />
          <div className="relative z-10 mx-auto max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/75">O próximo jogo já conta</p>
            <h2 className="mt-4 text-[clamp(2.35rem,6vw,4.8rem)] font-black leading-[0.93] tracking-[-0.055em]">
              Tens um palpite? Põe-no em jogo.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/68 md:text-base">
              Cria a tua conta, faz o primeiro palpite e começa já a disputar o ranking.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/auth"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-7 text-sm font-extrabold text-[#06102b] transition hover:-translate-y-0.5 hover:bg-cyan-50"
              >
                Criar conta grátis
              </Link>
              <Link
                href="/auth"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-black/10 px-7 text-sm font-bold text-white transition hover:bg-white/[0.08]"
              >
                Já tenho conta
              </Link>
            </div>
          </div>
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
      <div className="min-h-[430px] animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_32px_90px_rgba(0,0,0,.45)]">
        <div className="h-5 w-28 rounded-full bg-white/10" />
        <div className="mt-14 h-36 rounded-2xl bg-white/[0.055]" />
        <div className="mt-10 h-12 rounded-xl bg-white/10" />
      </div>
    );
  }

  if (!fixture || !kickoff) {
    return (
      <div className="flex min-h-[430px] flex-col justify-between rounded-[2rem] border border-white/10 bg-[linear-gradient(155deg,rgba(15,35,82,.94),rgba(5,15,43,.96))] p-6 shadow-[0_32px_90px_rgba(0,0,0,.45)] md:p-8">
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-white/65">Próximo desafio</span>
        </div>
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.05] text-3xl">⚽</div>
          <h2 className="mt-6 text-2xl font-black tracking-[-0.035em]">Novo jogo brevemente</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/55">Quando o próximo palpite abrir, vai aparecer aqui em destaque.</p>
        </div>
        <Link href="/auth" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-extrabold text-[#06102b]">Criar conta</Link>
      </div>
    );
  }

  const competition = fixture.competition_name || fixture.competition_code || 'Próximo jogo';
  const accent = fixture.competition_accent_color || '#2878ff';

  return (
    <article
      className="relative min-h-[430px] overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(155deg,rgba(15,35,82,.96),rgba(5,15,43,.98))] p-6 shadow-[0_32px_90px_rgba(0,0,0,.52)] md:p-8"
      style={{ '--fixture-accent': accent } as CSSProperties}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[var(--fixture-accent)] shadow-[0_0_24px_var(--fixture-accent)]" />
      <div className="absolute right-[-5rem] top-[-5rem] h-56 w-56 rounded-full bg-[var(--fixture-accent)] opacity-15 blur-3xl" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Palpites abertos</div>
          <div className="mt-1 text-sm font-extrabold text-white">{competition}</div>
          {fixture.round_label && <div className="mt-0.5 text-xs text-white/42">{fixture.round_label}</div>}
        </div>
        {countdown && (
          <div className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.08] px-3 py-1.5 text-right">
            <div className="text-[9px] font-black uppercase tracking-[0.13em] text-emerald-200/65">Fecha em</div>
            <div className="text-xs font-extrabold text-emerald-100">{countdown}</div>
          </div>
        )}
      </div>

      <div className="relative z-10 mt-8 text-center">
        <div className="text-xs font-bold text-white/48">{kickoff.weekday} · {kickoff.day}</div>
        <div className="mt-1 text-xl font-black tracking-[-0.025em] text-white">{kickoff.time}</div>
      </div>

      <div className="relative z-10 mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Team crest={fixture.home_crest} name={fixture.home_team_name} />
        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/32">vs</div>
          <div className="flex items-center gap-2">
            <span className="flex h-11 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-xl font-black text-white/48">-</span>
            <span className="text-white/20">:</span>
            <span className="flex h-11 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-xl font-black text-white/48">-</span>
          </div>
        </div>
        <Team crest={fixture.away_crest} name={fixture.away_team_name} />
      </div>

      <div className="relative z-10 mt-8 border-t border-white/[0.08] pt-5">
        <div className="mb-4 flex items-center justify-between text-xs text-white/45">
          <span>Resultado + marcador</span>
          <span>Até 20 pts</span>
        </div>
        <Link
          href="/auth"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-extrabold text-[#06102b] transition hover:-translate-y-0.5 hover:bg-cyan-50"
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
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.4rem] border border-white/10 bg-white/[0.055] p-3 shadow-inner">
        {crest ? (
          <img src={crest} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="text-xl font-black text-white/45">{initials(name)}</span>
        )}
      </div>
      <div className="mt-3 line-clamp-2 text-sm font-extrabold leading-4 text-white">{name}</div>
    </div>
  );
}

function LandingMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-white/[0.08] px-5 py-5 sm:border-r sm:last:border-r-0 md:px-7">
      <div className="text-base font-extrabold tracking-[-0.02em] text-white md:text-lg">{value}</div>
      <div className="mt-1 text-xs text-white/45">{label}</div>
    </div>
  );
}

function StepCard({
  number,
  title,
  copy,
  icon,
}: {
  number: string;
  title: string;
  copy: string;
  icon: ReactNode;
}) {
  return (
    <article className="group relative min-h-64 overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-white/[0.035] p-6 transition hover:-translate-y-1 hover:border-cyan-300/20 hover:bg-white/[0.05]">
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-blue-500/10 text-cyan-100">{icon}</div>
        <span className="text-xs font-black tracking-[0.16em] text-white/25">{number}</span>
      </div>
      <h3 className="mt-12 text-xl font-black tracking-[-0.03em]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/55">{copy}</p>
      <div className="absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-blue-400 to-cyan-300 transition group-hover:scale-x-100" />
    </article>
  );
}

function PrizeCard({
  eyebrow,
  title,
  copy,
  image,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  image: string;
}) {
  return (
    <article className="grid min-h-[187px] grid-cols-[1fr_112px] overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-white/[0.035] p-5 md:grid-cols-[1fr_145px] md:p-6">
      <div className="self-center">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-200/65">{eyebrow}</div>
        <h3 className="mt-2 text-2xl font-black tracking-[-0.035em]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-white/52">{copy}</p>
      </div>
      <div className="flex items-center justify-center">
        <img src={image} alt="" className="h-28 w-full object-contain" />
      </div>
    </article>
  );
}

function RankingPreview({ rows, loading }: { rows: RankingRow[]; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/[0.1] bg-[linear-gradient(145deg,rgba(13,29,73,.92),rgba(5,15,43,.96))] shadow-[0_28px_80px_rgba(0,0,0,.35)]">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 md:px-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/65">Época atual</div>
          <div className="mt-1 text-base font-extrabold">Ranking geral</div>
        </div>
        <Link href="/rankings" className="text-xs font-bold text-white/55 hover:text-white">Ver completo →</Link>
      </div>

      <div className="p-3 md:p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-white/[0.045]" />
            ))}
          </div>
        ) : rows.length ? (
          <div className="space-y-1.5">
            {rows.map((row, index) => (
              <div
                key={row.user_id || `${row.name}-${index}`}
                className={
                  index === 0
                    ? 'grid grid-cols-[34px_38px_1fr_auto] items-center gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-3'
                    : 'grid grid-cols-[34px_38px_1fr_auto] items-center gap-3 rounded-xl px-3 py-3 hover:bg-white/[0.035]'
                }
              >
                <div className="text-center text-sm font-black text-white/40">{index + 1}</div>
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.07] text-[11px] font-black">
                  {row.avatar_url ? <img src={row.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(row.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{row.name}</div>
                  <div className="mt-0.5 text-[10px] text-white/38">{row.exact ?? 0} resultados exatos</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-white">{row.points}</div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/32">pts</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-72 items-center justify-center px-6 text-center">
            <div>
              <div className="text-3xl">🏁</div>
              <div className="mt-4 font-extrabold">A nova corrida começa no primeiro jogo.</div>
              <div className="mt-2 text-sm text-white/48">Cria a conta e garante o teu lugar na classificação.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/10 text-[9px] text-emerald-200">✓</span>
  );
}

function ScoreIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 9.5h-2.5v5H9M15 9.5h2.5v5H15M12 8v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19c.7-3.4 2.9-5.2 6.5-5.2s5.8 1.8 6.5 5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19V9M12 19V5M19 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3 19.5h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}
