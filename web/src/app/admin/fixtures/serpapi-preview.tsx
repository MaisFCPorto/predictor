'use client';

import { useState } from 'react';
import axios from 'axios';
import { formatDbDateTimePT } from '@/utils/dates';
import { adm } from '../_utils/adminClients';

type Team = { name: string | null; score: number | null; penaltyScore: number | null };
type Player = {
  name: string;
  kgmid: string | null;
  predictorPlayer: { id: number; name: string; position: string } | null;
};
type Match = {
  kgmid: string;
  kickoffAt: string | null;
  competition: { name: string | null } | null;
  teams: [Team, Team];
};
type MatchTime = { minute: number | null; stoppageMinute: number | null };
type Preview = {
  fixture: Match;
  porto: {
    scorers: { player: Player | null; goals: (MatchTime & { ownGoal: boolean; penalty: boolean })[] }[] | null;
    starters: (Player | null)[] | null;
    substitutions: (MatchTime & { playerIn: Player | null; playerOut: Player | null })[] | null;
  };
};

const endpoint = '/api/admin/serpapi/porto';
const buttonClass =
  'rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50';

function matchTitle({ teams: [home, away] }: Match) {
  const score = home.score !== null && away.score !== null ? home.score + '–' + away.score : 'vs';
  return [home.name ?? 'Equipa por confirmar', score, away.name ?? 'Equipa por confirmar'].join(' ');
}

function minuteLabel({ minute, stoppageMinute }: MatchTime) {
  if (minute === null) return '';
  return String(minute) + (stoppageMinute ? '+' + stoppageMinute : '') + '′';
}

function playerLabel(player: Player | null) {
  if (!player) return 'Jogador por identificar';
  const match = player.predictorPlayer;
  return match ? `${player.name} (${match.position} · ID ${match.id})` : `${player.name} (por associar)`;
}

function errorLabel(error: unknown) {
  const code = axios.isAxiosError<{ error?: string }>(error) ? error.response?.data?.error : undefined;
  if (code === 'serpapi_not_configured') return 'Falta configurar a chave SerpApi no Worker.';
  if (code === 'serpapi_proxy_not_configured') return 'Falta configurar o acesso ao Worker do Hub.';
  return 'Não foi possível consultar a SerpApi. Tenta novamente.';
}

export default function SerpApiPreview() {
  const [games, setGames] = useState<Match[] | null>(null);
  const [kgmid, setKgmid] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState<'calendar' | 'match' | null>(null);
  const [error, setError] = useState('');

  async function loadCalendar() {
    setLoading('calendar');
    setError('');
    setKgmid('');
    setPreview(null);
    try {
      const { data } = await adm.get<{ games: Match[] }>(endpoint);
      setGames(data.games);
    } catch (e) {
      setError(errorLabel(e));
    } finally {
      setLoading(null);
    }
  }

  async function loadMatch(id: string) {
    setKgmid(id);
    setPreview(null);
    setError('');
    if (!id) return;

    setLoading('match');
    try {
      const { data } = await adm.get<Preview>(endpoint, { params: { kgmid: id } });
      setPreview(data);
    } catch (e) {
      setError(errorLabel(e));
    } finally {
      setLoading(null);
    }
  }

  const [home, away] = preview?.fixture.teams ?? [];
  const penalties = home?.penaltyScore != null && away?.penaltyScore != null
    ? home.penaltyScore + '–' + away.penaltyScore
    : null;

  return (
    <div className="space-y-4 text-sm text-white/70">
      <button type="button" className={buttonClass} disabled={loading !== null} onClick={() => void loadCalendar()}>
        {games === null ? 'Carregar calendário' : 'Atualizar calendário'}
      </button>

      {games?.length ? (
        <label className="block space-y-1.5">
          <span className="font-medium text-white">Jogo do FC Porto</span>
          <select
            value={kgmid}
            disabled={loading !== null}
            onChange={(event) => void loadMatch(event.target.value)}
            className="w-full rounded-xl border border-white/12 bg-slate-900 px-3 py-2.5 text-white"
          >
            <option value="">Escolhe um jogo</option>
            {games.map((game) => (
              <option key={game.kgmid} value={game.kgmid}>
                {matchTitle(game)} · {game.kickoffAt ? formatDbDateTimePT(game.kickoffAt) : 'Hora por marcar'}
              </option>
            ))}
          </select>
        </label>
      ) : games !== null ? <p>Sem jogos disponíveis no calendário da SerpApi.</p> : null}

      {loading && <p role="status">{loading === 'calendar' ? 'A carregar calendário…' : 'A carregar ficha do jogo…'}</p>}
      {error && <p role="alert" className="text-rose-300">{error}</p>}

      {preview && (
        <section className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <div>
            <h3 className="text-base font-semibold text-white">{matchTitle(preview.fixture)}</h3>
            <p>{preview.fixture.competition?.name ?? 'Competição por confirmar'} · {preview.fixture.kgmid}</p>
            {penalties && <p>Penáltis {penalties}</p>}
            <p className="mt-2 text-xs">Os IDs e as posições vêm do plantel do Predictor. Confirma os jogadores por associar.</p>
          </div>

          <div>
            <h4 className="font-semibold text-white">Marcadores do FC Porto</h4>
            {preview.porto.scorers === null ? <p>Dados indisponíveis.</p> : preview.porto.scorers.length === 0 ? (
              <p>Sem golos do FC Porto.</p>
            ) : (
              <ul className="space-y-1">
                {preview.porto.scorers.map(({ player, goals }, index) => (
                  <li key={player?.kgmid ?? index}>
                    {playerLabel(player)}{' '}
                    {goals.map((goal) => [minuteLabel(goal), goal.ownGoal ? '(AG)' : goal.penalty ? '(P)' : '']
                      .filter(Boolean).join(' ')).join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-white">Titulares</h4>
            <p>{preview.porto.starters?.length
              ? preview.porto.starters.map(playerLabel).join(', ')
              : 'Dados indisponíveis.'}</p>
          </div>

          <div>
            <h4 className="font-semibold text-white">Substituições</h4>
            {preview.porto.substitutions === null ? <p>Dados indisponíveis.</p> : preview.porto.substitutions.length === 0 ? (
              <p>Sem substituições registadas.</p>
            ) : (
              <ul className="space-y-1">
                {preview.porto.substitutions.map((substitution, index) => (
                  <li key={substitution.playerIn?.kgmid ?? index}>
                    {minuteLabel(substitution)} {substitution.playerIn ? playerLabel(substitution.playerIn) : 'Entrada por identificar'} por{' '}
                    {substitution.playerOut ? playerLabel(substitution.playerOut) : 'saída por identificar'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
