'use client';

import { useMemo, useState, useEffect } from 'react';
import clsx from 'clsx';
import { compName, compAccent, compSubtle, roundText } from './competitions';

type PlayerOption = {
  id: string;
  name: string;
  position: string; // 'GR' | 'D' | 'M' | 'A'
};

type Trends = {
  total_predictions: number;
  most_common_score: {
    home: number;
    away: number;
    count: number;
  } | null;
  most_common_scorer: {
    player_id: string;
    name: string;
    count: number;
  } | null;
};

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
  final_home_score?: number | null;
  final_away_score?: number | null;
  pred_home?: number | null;
  pred_away?: number | null;
  points?: number | null;

  // lista de nomes dos marcadores reais do jogo (do BO)
  scorersNames?: string[];

  // palpite de marcador do utilizador
  pred_scorer_id?: string | null;
  players?: PlayerOption[];

  onSave: (
    id: string,
    h: number,
    a: number,
    scorerId?: string | null
  ) => Promise<void> | void;
  saving?: boolean;
  variant?: 'default' | 'past';
  canEdit?: boolean;

  // mostrar tendências da comunidade (resultado + marcador mais comum)
  showTrends?: boolean;
};

function formatLocalDate(isoUTC: string) {
  const d = new Date(isoUTC);
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function positionLabel(pos: string | undefined) {
  switch (pos) {
    case 'GR':
      return 'Guarda-redes';
    case 'D':
      return 'Defesa';
    case 'M':
      return 'Médio';
    case 'A':
      return 'Avançado';
    default:
      return 'Jogador';
  }
}

export default function FixtureCard({
  id,
  kickoff_at,
  status,
  home_team_name,
  away_team_name,
  home_crest,
  away_crest,
  competition_code,
  round_label,
  is_locked,
  lock_at_utc,
  final_home_score,
  final_away_score,
  pred_home,
  pred_away,
  points,
  pred_scorer_id,
  players,
  onSave,
  saving,
  variant = 'default',
  scorersNames = [],
  canEdit = true,
  showTrends = false,
}: Props) {
  // usado só para formatação de datas (mantive caso uses noutro lado)
  const dateTxt = useMemo(() => formatLocalDate(kickoff_at), [kickoff_at]);

  const comp = compName(competition_code);
  const rnd = roundText(round_label);

  const [compL1, compL2] = useMemo(() => {
    if (!comp) return [null, null] as [string | null, string | null];
    const name = comp.trim();
    const i = name.lastIndexOf(' ');
    if (i > 0) return [name.slice(0, i), name.slice(i + 1)];
    return [name, null];
  }, [comp]);

  const fullDateLabelShort = useMemo(() => {
    const d = new Date(kickoff_at);
    const weekdayRaw = d.toLocaleDateString('pt-PT', { weekday: 'long' });
    const weekdayNorm = weekdayRaw.replace('-', ' ');
    const weekdayCap =
      weekdayNorm.charAt(0).toUpperCase() + weekdayNorm.slice(1);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${weekdayCap}, ${dd}/${mm}`;
  }, [kickoff_at]);

  const fullDateLabelLong = useMemo(() => {
    const d = new Date(kickoff_at);
    return new Intl.DateTimeFormat('pt-PT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(d);
  }, [kickoff_at]);

  const timeLabel = useMemo(() => {
    const d = new Date(kickoff_at);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}h${mm}`;
  }, [kickoff_at]);

  const accent = compAccent(competition_code) ?? '#1e293b';
  const subtle = compSubtle(competition_code) ?? 'transparent';
  const lockedBase = !!is_locked || status === 'FINISHED';

  // countdown
  const [remaining, setRemaining] = useState<string | null>(null);
  const [remainMs, setRemainMs] = useState<number | null>(null);

  function formatRemaining(ms: number) {
    if (ms <= 0) return '0s';
    const total = Math.floor(ms / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    parts.push(`${h}h`, `${m}m`, `${s}s`);
    return parts.join(' ');
  }

  function formatCompactRemaining(ms: number) {
    if (ms <= 0) return '0s';
    const total = Math.floor(ms / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  }

  function urgencyClass(ms: number) {
    if (ms <= 3_600_000) return 'bg-red-400/15 text-red-100';
    if (ms <= 86_400_000) return 'bg-amber-400/15 text-amber-100';
    return 'bg-white/5 text-gray-200';
  }

  useEffect(() => {
    if (!lock_at_utc || variant === 'past' || lockedBase) {
      setRemaining(null);
      setRemainMs(null);
      return;
    }
    const update = () => {
      const ms = new Date(lock_at_utc).getTime() - Date.now();
      setRemainMs(ms);
      setRemaining(formatRemaining(ms));
    };
    update();
    const timerId = setInterval(update, 1000);
    return () => clearInterval(timerId);
  }, [lock_at_utc, variant, lockedBase]);

  const nowLocked =
    lockedBase || (variant !== 'past' && (remainMs ?? 1) <= 0) || !canEdit;

  // jogo é do Porto?
  const involvesPorto =
    home_team_name.toLowerCase().includes('porto') ||
    away_team_name.toLowerCase().includes('porto');

  // ---------- ESTADO DOS INPUTS DE RESULTADO ----------
  // inicializar com os valores das predictions se existirem
  const [home, setHome] = useState<number | ''>(() =>
    typeof pred_home === 'number' ? pred_home : ''
  );
  const [away, setAway] = useState<number | ''>(() =>
    typeof pred_away === 'number' ? pred_away : ''
  );

  // flag para saber se o user já mexeu nos resultados
  const [scoresTouched, setScoresTouched] = useState(false);

  // sempre que o fixture mudar, voltamos a considerar "não tocado"
  useEffect(() => {
    setScoresTouched(false);
  }, [id]);

  // sincronizar com props quando:
  // - é jogo passado (força sempre o resultado guardado), OU
  // - ainda não foi mexido nos inputs e chegam/alteram-se as predictions
  useEffect(() => {
    const ph = typeof pred_home === 'number' ? pred_home : null;
    const pa = typeof pred_away === 'number' ? pred_away : null;

    if (variant === 'past') {
      setHome(ph ?? '');
      setAway(pa ?? '');
      return;
    }

    if (!scoresTouched) {
      setHome(ph ?? '');
      setAway(pa ?? '');
    }
  }, [pred_home, pred_away, variant, scoresTouched]);

  // marcador escolhido (palpite)
  const [scorerId, setScorerId] = useState<string | null>(pred_scorer_id ?? null);
  const [scorerCleared, setScorerCleared] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'GR' | 'D' | 'M' | 'A'>('ALL');

  useEffect(() => {
    setScorerId(pred_scorer_id ?? null);
    setScorerCleared(false);
  }, [pred_scorer_id]);

  const scorerPlayer = useMemo(
    () => players?.find((p) => p.id === scorerId) ?? null,
    [players, scorerId],
  );

  // picker só ativo em jogos do Porto + com jogadores e jogo aberto
  const pickerEnabled =
    variant !== 'past' &&
    !nowLocked &&
    canEdit &&
    involvesPorto &&
    !!players &&
    players.length > 0;

  const filteredPlayers = useMemo(() => {
    if (!players) return [];
    const q = pickerSearch.trim().toLowerCase();

    const byPos =
      positionFilter === 'ALL'
        ? players
        : players.filter((p) => p.position === positionFilter);

    if (!q) return byPos;

    const normQ = q.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    return byPos.filter((p) =>
      p.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .includes(normQ),
    );
  }, [players, pickerSearch, positionFilter]);

  // pode guardar se mudou em relação aos props + não está bloqueado
  // e se o utilizador já escolheu um marcador (jogador) OU indicou explicitamente "ninguém"
  const hasValidScores = typeof home === 'number' && typeof away === 'number';
  const hasMarkerChoice = !!scorerPlayer || scorerCleared;
  const predictionChanged =
    home !== (pred_home ?? null) ||
    away !== (pred_away ?? null) ||
    (scorerId ?? null) !== (pred_scorer_id ?? null);

  const canSave =
    !nowLocked && canEdit && hasValidScores && hasMarkerChoice && predictionChanged;

  const pointsBadge = useMemo(() => {
    if (variant !== 'past') return null;

    const ph = typeof pred_home === 'number' ? pred_home : null;
    const pa = typeof pred_away === 'number' ? pred_away : null;
    const rh = typeof final_home_score === 'number' ? final_home_score : null;
    const ra = typeof final_away_score === 'number' ? final_away_score : null;

    if (ph == null || pa == null) {
      return {
        label: 'Sem participação',
        className: 'bg-red-500/25 text-red-100',
      };
    }
    if (rh == null || ra == null) {
      return {
        label: '+0 pontos',
        className: 'bg-white/5 text-gray-200',
      };
    }

    let pts: number;
    if (typeof points === 'number') {
      pts = points;
    } else {
      const sign = (d: number) => (d === 0 ? 0 : d > 0 ? 1 : -1);
      pts = 0;
      if (sign(ph - pa) === sign(rh - ra)) pts += 3;
      if (ph === rh) pts += 2;
      if (pa === ra) pts += 2;
      if (ph - pa === rh - ra) pts += 3;
    }

    const label = `+${pts} ${pts === 1 ? 'ponto' : 'pontos'}`;

    if (pts === 0) {
      return {
        label,
        className: 'bg-amber-400/25 text-amber-50',
      };
    }

    const greens = [
      'bg-green-500/[0.12] text-green-100',
      'bg-green-500/[0.16] text-green-100',
      'bg-green-500/[0.20] text-green-100',
      'bg-green-500/[0.24] text-green-100',
      'bg-green-500/[0.28] text-green-100',
      'bg-green-500/[0.32] text-green-50',
      'bg-green-600/[0.36] text-green-50',
      'bg-green-600/[0.40] text-green-50',
      'bg-green-700/[0.48] text-green-50',
      'bg-green-700/[0.56] text-green-50',
    ];
    const idx = Math.min(Math.max(pts, 1), 10) - 1;
    return { label, className: greens[idx] };
  }, [variant, pred_home, pred_away, final_home_score, final_away_score, points]);

  const finalScoreText = useMemo(() => {
    const h = typeof final_home_score === 'number' ? final_home_score : null;
    const a = typeof final_away_score === 'number' ? final_away_score : null;
    if (variant !== 'past') return null;
    if (h == null || a == null) return null;
    return `${h}-${a}`;
  }, [variant, final_home_score, final_away_score]);

  const lastPredText = useMemo(() => {
    const ph = typeof pred_home === 'number' ? pred_home : null;
    const pa = typeof pred_away === 'number' ? pred_away : null;
    if (variant === 'past') return null;
    if (ph == null || pa == null) return null;
    return `${ph}-${pa}`;
  }, [variant, pred_home, pred_away]);

  const lastPredScorerLabel = useMemo(() => {
    if (variant === 'past') return null;

    const hasScores =
      typeof pred_home === 'number' && typeof pred_away === 'number';
    if (!hasScores) return null;

    // pred_scorer_id === null significa "ninguém" explicitamente guardado
    if (pred_scorer_id == null) return 'ninguém';

    if (!players || players.length === 0) return null;
    const sid = String(pred_scorer_id);
    const p = players.find((pl) => pl.id === sid);
    return p ? p.name : null;
  }, [variant, pred_home, pred_away, pred_scorer_id, players]);

  const headerStatusLabel = useMemo(() => {
    if (variant === 'past')
      return status === 'FINISHED' ? 'Terminado' : 'Bloqueado';
    if (nowLocked) return 'Bloqueado';
    return null;
  }, [variant, status, nowLocked]);

  const watermarkUrl = useMemo(() => {
    switch (competition_code) {
      case 'TP':
        return 'https://r2.thesportsdb.com/images/media/league/badge/hyy7lq1593011553.png';
      case 'LE':
        return 'https://img.uefa.com/imgml/uefacom/uel/2024/logos/uel_logotype_fc_dark.svg';
      case 'LP':
        return 'https://upload.wikimedia.org/wikipedia/commons/5/5a/S%C3%ADmbolo_da_Liga_Portuguesa_de_Futebol_Profissional.png';
      case 'TL':
        return 'https://www.ligaportugal.pt/backoffice/assets/ic_allianzcup_cbcb5ca1e0.png';
      default:
        return null;
    }
  }, [competition_code]);

  // -------- Tendências (resultado + marcador mais comum) --------
  const [trends, setTrends] = useState<Trends | null>(null);

  useEffect(() => {
    if (!showTrends || variant === 'past') {
      setTrends(null);
      return;
    }

    let aborted = false;

    async function loadTrends() {
      try {
        const res = await fetch(`/api/fixtures/${id}/trends`, {
          headers: { 'cache-control': 'no-store' },
        });
        if (!res.ok) {
          console.warn('Falha a carregar trends', res.status);
          return;
        }
        const data = (await res.json()) as Trends;
        if (!aborted) setTrends(data);
      } catch (e) {
        console.warn('Erro trends:', e);
        if (!aborted) setTrends(null);
      }
    }

    void loadTrends();
    return () => {
      aborted = true;
    };
  }, [id, showTrends, variant]);

  // handler comum para guardar
  const handleSave = () => {
    if (!canEdit) return;
    if (typeof home !== 'number' || typeof away !== 'number') return;
    onSave(id, home, away, scorerId ?? null);
  };

  return (
    <div
      className={clsx(
        'group relative w-full',
        'rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:p-6 md:p-8 pb-8',
        'shadow-[0_10px_50px_rgba(0,0,0,0.35)] overflow-hidden',
        'transition-colors duration-200',
        'hover:border-white/20 hover:bg-white/[0.03]',
      )}
    >
      {/* Watermark */}
      {watermarkUrl && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 opacity-5 bg-center bg-contain bg-no-repeat"
          style={{
            backgroundImage: `url('${watermarkUrl}')`,
            filter: 'grayscale(1) brightness(0) invert(1)',
            transform: 'rotate(-8deg) scale(1.02)',
            transformOrigin: 'center',
          }}
        />
      )}

      {/* Cabeçalho mobile */}
      <div className="md:hidden relative flex items-center justify-center">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 pl-1">
          {comp && (
            <svg
              className="h-5 w-5 text-white/80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M6 4h12v2a4 4 0 01-4 4h-4a4 4 0 01-4-4V4z" />
              <path d="M18 6h2a2 2 0 01-2 2" />
              <path d="M6 6H4a2 2 0 002 2" />
              <path d="M8 10v2a4 4 0 004 4 4 4 0 004-4v-2" />
              <path d="M12 20v-2" />
            </svg>
          )}
        </div>

        <div className="text-center text-sm text-white/90 px-14">
          <div className="leading-tight">{fullDateLabelShort}</div>
          <div className="text-xs text-white/70">{timeLabel}</div>
        </div>

        <div className="absolute right-0 top-1/2 -translate-y-1/2 pr-1">
          <span
            className={clsx(
              'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] leading-none',
              headerStatusLabel
                ? 'bg-white/5 text-gray-200'
                : urgencyClass(remainMs ?? Number.MAX_SAFE_INTEGER),
            )}
          >
            {headerStatusLabel ? (
              headerStatusLabel
            ) : (
              <>
                <svg
                  className="inline h-3 w-3 mr-1 align-[-2px] opacity-80"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
                </svg>
                <span className="tabular-nums">
                  {remainMs != null ? formatCompactRemaining(remainMs) : '0s'}
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Cabeçalho desktop */}
      <div className="hidden md:grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <div className="min-w-0 justify-self-start">
          {comp && (
            <span
              className="inline-flex max-w-full items-center justify-center text-center gap-2 rounded-full px-3.5 py-1 text-[12px] font-medium leading-none"
              style={{
                background:
                  subtle === 'transparent'
                    ? `${accent}1A`
                    : `linear-gradient(90deg, ${accent} 0%, ${subtle} 100%)`,
                color: '#e9eef9',
                border: `1px solid ${accent}66`,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.15) inset',
              }}
              title={comp + (rnd ? ` — ${rnd}` : '')}
            >
              {comp}
              {rnd ? ` — ${rnd}` : ''}
            </span>
          )}
        </div>

        <div className="justify-self-center text-center">
          <div className="text-sm md:text-base text-white/90 leading-tight">
            <div>{fullDateLabelLong}</div>
            <div>{timeLabel}</div>
          </div>
        </div>

        <div className="justify-self-end hidden md:block">
          <span
            className={clsx(
              'rounded-full px-3 py-1 text-[12px] leading-none',
              headerStatusLabel
                ? 'bg-white/5 text-gray-200'
                : urgencyClass(remainMs ?? Number.MAX_SAFE_INTEGER),
            )}
          >
            {headerStatusLabel ? (
              headerStatusLabel
            ) : (
              <>
                <span className="mr-1">Fecha em</span>
                <svg
                  className="inline h-3.5 w-3.5 mr-1 align-[-2px] opacity-80"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
                </svg>
                <span className="tabular-nums" aria-live="polite">
                  {remaining}
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Layout principal */}
      <div className="mt-6 flex items-center justify-between gap-2 sm:gap-4 md:gap-6 flex-nowrap mb-4">
        {/* HOME */}
        <div className="flex flex-col items-center w-[25%] min-w-[60px]">
          <Crest src={home_crest} alt={home_team_name} />
          <div className="truncate text-center text-[14px] sm:text-base font-medium mt-1">
            {home_team_name}
          </div>
        </div>

        {/* SCORE */}
        <div className="flex items-center justify-center w-[45%]">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <ScoreBox
              disabled={nowLocked || !canEdit}
              value={home}
              onChange={(v) => {
                setScoresTouched(true);
                setHome(v);
              }}
            />
            <span className="opacity-60 text-white text-xl sm:text-2xl">–</span>
            <div className="relative flex items-center">
              <ScoreBox
                disabled={nowLocked || !canEdit}
                value={away}
                onChange={(v) => {
                  setScoresTouched(true);
                  setAway(v);
                }}
              />
              {variant !== 'past' && (
                <button
                  type="button"
                  disabled={!canSave || !!saving}
                  className={clsx(
                    'hidden md:flex absolute left-full top-1/2 -translate-y-1/2 items-center justify-center w-10 h-10 rounded-full transition ml-2',
                    !canSave ? 'md:hidden' : '',
                    saving
                      ? 'bg-white/5 text-white/40 cursor-not-allowed'
                      : 'bg-white/10 hover:bg-white/15 text-white',
                  )}
                  onClick={handleSave}
                  title="Guardar palpite"
                >
                  {saving ? (
                    <svg
                      className="animate-spin h-5 w-5 text-white/60"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-8 w-8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* AWAY */}
        <div className="flex flex-col items-center w-[25%] min-w-[60px]">
          <Crest src={away_crest} alt={away_team_name} />
          <div className="truncate text-center text-[14px] sm:text-base font-medium mt-1">
            {away_team_name}
          </div>
        </div>
      </div>

      {/* Marcador (palpite) */}
      <div className="mt-2 flex flex-col items-center gap-1">
        <button
          type="button"
          disabled={!pickerEnabled}
          className={clsx(
            'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs sm:text-sm border',
            pickerEnabled
              ? 'border-white/20 bg-white/5 hover:bg-white/10'
              : 'border-white/10 bg-white/5 text-white/50 cursor-not-allowed',
          )}
          onClick={() => {
            if (!pickerEnabled) return;
            setPickerSearch('');
            setPositionFilter('ALL');
            setPickerOpen(true);
          }}
        >
          <span>
            {scorerPlayer
              ? `Marcador: ${scorerPlayer.name}`
              : scorerCleared
              ? 'Marcador: ninguém'
              : 'Escolher marcador'}
          </span>
          {scorerPlayer && (
            <span className="text-[10px] uppercase opacity-70">
              {positionLabel(scorerPlayer.position)}
            </span>
          )}
        </button>
        {scorerPlayer && (
          <button
            type="button"
            className="text-[11px] text-white/60 underline mt-0.5"
            disabled={!pickerEnabled}
            onClick={() => {
              if (!pickerEnabled) return;
              setScorerId(null);
              setScorerCleared(true);
            }}
          >
            Limpar escolha
          </button>
        )}
      </div>

      {/* Badge de Resultado + Pontos (jogos passados) */}
      {pointsBadge && (
        <div className="flex flex-col items-center mt-3 gap-2">
          {finalScoreText && (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium leading-none bg-white/5 text-gray-200">
              Resultado Correto: {finalScoreText}
            </span>
          )}
          <span
            className={clsx(
              'inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium leading-none',
              pointsBadge.className,
            )}
          >
            {pointsBadge.label}
          </span>

          {/* Jogos passados: marcadores reais do jogo (do BO) */}
          {variant === 'past' && scorersNames.length > 0 && (
            <span className="mt-1 text-[12px] text-white/70">
              Marcadores: {scorersNames.join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Pill "Última previsão" para jogos em aberto */}
      {!pointsBadge && lastPredText && (
        <div className="flex justify-center mt-2">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium leading-none bg-white/5 text-gray-200">
            Última previsão: {lastPredText}
            {lastPredScorerLabel && ` | Marcador: ${lastPredScorerLabel}`}
          </span>
        </div>
      )}

      {/* Tendência da comunidade (resultado + marcador mais comum) */}
      {variant !== 'past' &&
        showTrends &&
        trends &&
        trends.total_predictions > 0 && (
          <div className="flex justify-center mt-1">
            <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] sm:text-[12px] font-medium leading-none bg-white/5 text-white/80">
              Tendência da comunidade:{' '}
              {trends.most_common_score ? (
                <>
                  {' '}
                  <span className="font-semibold">
                    {trends.most_common_score.home}–
                    {trends.most_common_score.away}
                  </span>{' '}
                  (
                  {trends.most_common_score.count}{' '}
                  {trends.most_common_score.count === 1
                    ? 'palpite'
                    : 'palpites'}
                  )
                </>
              ) : (
                ' sem tendência de resultado'
              )}
              {trends.most_common_scorer && (
                <>
                  {' · Marcador mais escolhido: '}
                  <span className="font-semibold">
                    {trends.most_common_scorer.name}
                  </span>{' '}
                  (
                  {trends.most_common_scorer.count}{' '}
                  {trends.most_common_scorer.count === 1
                    ? 'escolha'
                    : 'escolhas'}
                  )
                </>
              )}
            </span>
          </div>
        )}

      {/* Botão mobile Guardar */}
      {variant !== 'past' && (
        <div className="md:hidden flex justify-center mt-2">
          <button
            disabled={!canSave || !!saving || nowLocked || !canEdit}
            className={clsx(
              'rounded-full px-4 py-2 text-sm font-medium',
              !canSave || saving || nowLocked || !canEdit
                ? 'bg-white/5 text-white/50 cursor-not-allowed'
                : 'bg-white/10 hover:bg-white/15 text-white',
            )}
            onClick={handleSave}
          >
            {nowLocked ? 'Bloqueado' : saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      )}

      {/* Modal simples de escolha de jogador */}
      {pickerOpen && pickerEnabled && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md max-h-[80vh] rounded-t-3xl sm:rounded-3xl bg-[#02051a] border border-white/10 shadow-xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Escolher marcador</h3>
              <button
                className="text-xs text-white/60 hover:text-white"
                onClick={() => setPickerOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="mb-2 flex flex-wrap gap-1 text-[11px] text-white/70">
              <button
                type="button"
                className={clsx(
                  'rounded-full px-2.5 py-0.5 border text-xs',
                  positionFilter === 'ALL'
                    ? 'border-white/50 bg-white/10 text-white'
                    : 'border-white/15 bg-transparent hover:bg-white/5',
                )}
                onClick={() => setPositionFilter('ALL')}
              >
                Todos
              </button>
              <button
                type="button"
                className={clsx(
                  'rounded-full px-2.5 py-0.5 border text-xs',
                  positionFilter === 'GR'
                    ? 'border-white/50 bg-white/10 text-white'
                    : 'border-white/15 bg-transparent hover:bg-white/5',
                )}
                onClick={() => setPositionFilter('GR')}
              >
                Guarda-redes
              </button>
              <button
                type="button"
                className={clsx(
                  'rounded-full px-2.5 py-0.5 border text-xs',
                  positionFilter === 'D'
                    ? 'border-white/50 bg-white/10 text-white'
                    : 'border-white/15 bg-transparent hover:bg-white/5',
                )}
                onClick={() => setPositionFilter('D')}
              >
                Defesas
              </button>
              <button
                type="button"
                className={clsx(
                  'rounded-full px-2.5 py-0.5 border text-xs',
                  positionFilter === 'M'
                    ? 'border-white/50 bg-white/10 text-white'
                    : 'border-white/15 bg-transparent hover:bg-white/5',
                )}
                onClick={() => setPositionFilter('M')}
              >
                Médios
              </button>
              <button
                type="button"
                className={clsx(
                  'rounded-full px-2.5 py-0.5 border text-xs',
                  positionFilter === 'A'
                    ? 'border-white/50 bg-white/10 text-white'
                    : 'border-white/15 bg-transparent hover:bg-white/5',
                )}
                onClick={() => setPositionFilter('A')}
              >
                Avançados
              </button>
            </div>

            <input
              className="mb-3 rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-sm"
              placeholder="Procurar jogador..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredPlayers.length === 0 ? (
                <div className="text-xs text-white/60">
                  Nenhum jogador encontrado.
                </div>
              ) : (
                filteredPlayers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={clsx(
                      'w-full text-left rounded-xl px-3 py-2 text-sm flex items-center justify-between',
                      scorerId === p.id
                        ? 'bg-white/15 border border-white/30'
                        : 'bg-white/5 border border-white/5 hover:bg-white/10',
                    )}
                    onClick={() => {
                      setScorerId(p.id);
                      setScorerCleared(false);
                      setPickerOpen(false);
                    }}
                  >
                    <span>{p.name}</span>
                    <span className="text-[11px] uppercase text-white/60">
                      {positionLabel(p.position)}
                    </span>
                  </button>
                ))
              )}
            </div>

            <button
              type="button"
              className="mt-3 text-xs text-white/70 underline"
              onClick={() => {
                setScorerId(null);
                setScorerCleared(true);
                setPickerOpen(false);
              }}
            >
              Não escolher marcador
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Sub-componentes ---------- */

function Crest({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <div className="flex-shrink-0">
      <div className="relative h-12 sm:h-14 md:h-16 px-1.5 sm:px-2 flex items-center justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full opacity-0 scale-95
                     bg-white/5 blur-md transition-all duration-300 ease-out
                     md:group-hover:opacity-100 md:group-hover:scale-105"
        />
        {src ? (
          <img
            src={src}
            alt={alt}
            className={clsx(
              'relative block max-h-full w-auto max-w-[80px] sm:max-w-[96px] md:max-w-[112px] object-contain',
              'transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)]',
              'md:group-hover:scale-[1.06] md:group-hover:-translate-y-0.5 md:group-hover:-rotate-2',
            )}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="relative h-8 w-8 rounded bg-white/10" />
        )}
      </div>
    </div>
  );
}

function ScoreBox({
  disabled,
  value,
  onChange,
}: {
  disabled?: boolean;
  value: number | '';
  onChange: (v: number | '') => void;
}) {
  // garantir que o input recebe sempre uma string
  const displayValue =
    value === '' || value === null || value === undefined ? '' : String(value);

  return (
    <input
      type="tel"          // <- evitar bugs de iOS com type="number"
      inputMode="numeric" // <- teclado numérico
      min={0}
      max={99}
      value={displayValue}
      onChange={(e) => {
        // só dígitos
        const raw = e.target.value.replace(/\D/g, '');

        if (!raw) {
          onChange('');
          return;
        }

        // limitar a 2 dígitos
        const trimmed = raw.slice(0, 2);
        const n = Number(trimmed);

        if (Number.isFinite(n) && n >= 0 && n <= 99) {
          onChange(n);
        }
      }}
      className={clsx(
        'no-spinner text-center tabular-nums rounded-2xl border placeholder:text-white/70',
        'h-12 w-12 text-xl sm:h-14 sm:w-14 sm:text-2xl md:h-16 md:w-16 md:text-3xl',
        disabled
          ? 'border-white/10 bg-white/[0.09] text-white/40'
          : 'border-white/20 bg-[#010436] text-white hover:bg-[#010436] focus:outline-none focus:ring-2 focus:ring-white/20',
      )}
      disabled={disabled}
      placeholder=""
    />
  );
}
