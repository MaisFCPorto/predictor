// components/FixtureCard.tsx
'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { compName, compAccent, compSubtle, roundText } from './competitions';

type Props = {
  id: string;
  kickoff_at: string;
  status: 'SCHEDULED' | 'FINISHED' | string;
  home_team_name: string;
  away_team_name: string;
  home_crest?: string | null;
  away_crest?: string | null;
  competition_code?: string | null;
  round_label?: string | null;
  is_locked?: boolean;
  lock_at_utc?: string | null;
  leg?: number | null;
  onSave: (id: string, h: number, a: number) => Promise<void> | void;
  saving?: boolean;
};

function formatLocalDate(isoUTC: string) {
  const d = new Date(isoUTC);
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function FixtureCard({
  id, kickoff_at, status,
  home_team_name, away_team_name,
  home_crest, away_crest,
  competition_code, round_label,
  is_locked, lock_at_utc,
  onSave, saving,
}: Props) {
  const dateTxt = useMemo(() => formatLocalDate(kickoff_at), [kickoff_at]);
  const comp = compName(competition_code);
  const rnd = roundText(round_label);
  const accent = compAccent(competition_code) ?? '#1e293b';
  const subtle = compSubtle(competition_code) ?? 'transparent';
  const locked = is_locked || status === 'FINISHED';

  return (
    <div
      className={clsx(
        // ⇩⇩⇩ AQUI: sem vw para não “ultrapassar” o viewport
        'relative -mx-5 w-[calc(100%+3.5rem)] sm:mx-auto sm:w-full max-w-[1100px]',
        'rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 md:p-6',
        'shadow-[0_10px_50px_rgba(0,0,0,0.35)] overflow-hidden'
      )}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {comp && (
            <span
              className="inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium leading-none"
              style={{
                background:
                  subtle === 'transparent'
                    ? `${accent}1A`
                    : `linear-gradient(90deg, ${accent} 0%, ${subtle} 100%)`,
                color: '#e9eef9',
                border: `1px solid ${accent}66`,
              }}
              title={comp + (rnd ? ` — ${rnd}` : '')}
            >
              {comp}{rnd ? ` — ${rnd}` : ''}
            </span>
          )}
        </div>

        <div className="shrink-0">
          <span className="rounded-full bg-white/5 px-3 py-1 text-[12px] leading-none text-gray-200">
            {locked ? 'Bloqueado' : lock_at_utc ? 'Fecha em' : 'Agendado'}
            {lock_at_utc && (
              <span className="ml-2 tabular-nums text-white/80">
                {new Date(lock_at_utc).toLocaleTimeString('pt-PT', { hour12: false })}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Data centrada */}
      <div className="mt-3 text-center text-sm md:text-base text-white/90 capitalize">
        {dateTxt}
      </div>

      {/* Layout principal */}
      <div className={clsx('mt-6 flex items-center justify-between gap-2 sm:gap-4 md:gap-6 flex-nowrap')}>
        {/* HOME */}
        <div className="flex flex-col items-center w-[25%] min-w-[60px]">
          <Crest src={home_crest} alt={home_team_name} />
          <div className="truncate text-center text-[14px] sm:text-base font-medium mt-1">
            {home_team_name}
          </div>
        </div>

        {/* SCORE */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 w-[45%]">
          <ScoreBox disabled={locked} />
          <span className="opacity-60 text-white text-xl sm:text-2xl">–</span>
          <ScoreBox disabled={locked} />
        </div>

        {/* AWAY */}
        <div className="flex flex-col items-center w-[25%] min-w-[60px]">
          <Crest src={away_crest} alt={away_team_name} />
          <div className="truncate text-center text-[14px] sm:text-base font-medium mt-1">
            {away_team_name}
          </div>
        </div>
      </div>

      {/* Botão */}
      <div className="mt-6 flex items-center gap-3 justify-start">
        <button
          disabled={locked || saving}
          className={clsx(
            'rounded-full px-4 py-2 text-sm font-medium',
            locked || saving
              ? 'bg-white/5 text-white/50 cursor-not-allowed'
              : 'bg-white/10 hover:bg-white/15 text-white'
          )}
          onClick={() => onSave(id, 0, 0)}
        >
          {locked ? 'Bloqueado' : saving ? 'A guardar…' : 'Guardar'}
        </button>
      </div>

      {/* Marca d’água Betano */}
      <img
        src="https://www.betano.pt/assets/images/header-logos/logo__betano.svg"
        alt="Betano"
        className="absolute bottom-3 left-1/2 -translate-x-1/2 w-20 sm:w-24  pointer-events-none select-none"
      />
    </div>
  );
}

/* ---------- Sub-componentes ---------- */

function Crest({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <div className="flex-shrink-0">
      <div className="h-10 sm:h-12 md:h-14 px-1.5 sm:px-2 flex items-center justify-center">
        {src ? (
          <img
            src={src}
            alt={alt}
            className="block max-h-full w-auto max-w-[64px] sm:max-w-[72px] md:max-w-[84px] object-contain"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="h-8 w-8 rounded bg-white/10" />
        )}
      </div>
    </div>
  );
}

function ScoreBox({ disabled }: { disabled?: boolean }) {
  return (
    <input
      type="number"
      min={0}
      step={1}
      className={clsx(
        'no-spinner text-center tabular-nums rounded-2xl border',
        'h-12 w-12 text-xl sm:h-14 sm:w-14 sm:text-2xl md:h-16 md:w-16 md:text-3xl',
        disabled
          ? 'border-white/10 bg-white/[0.09] text-white/40'
          : 'border-white/15 bg-white/[0.09] hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/20'
      )}
      disabled={disabled}
      placeholder="0"
      inputMode="numeric"
    />
  );
}
