import { supabasePKCE } from '@/utils/supabase/client';
import { formatHubNewsDate } from './news-date';

export type FanPlayer = { id: number; name: string; position: string };
export type FanFixture = {
  id: string;
  kickoffAt: string | null;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  competition: string | null;
};

export type SquadData = { players: FanPlayer[]; next: FanFixture | null };
export type RatingRank = FanPlayer & { matches: number; votes: number; average: number; adjusted: number };
export type RatingsData = {
  season: string;
  fixtures: (FanFixture & { opened: number })[];
  ranking: RatingRank[];
};
export type MatchBallot = {
  fixture: FanFixture;
  roster: FanPlayer[];
  eligible: (FanPlayer & { average: number | null; votes: number; mine: number | null })[];
};

const positions: Record<string, string> = { GR: 'Guarda-redes', D: 'Defesa', M: 'Médio', A: 'Avançado' };
export const positionName = (position: string) => positions[position] ?? position;

export function fixtureTitle(fixture: FanFixture) {
  const score = fixture.homeScore === null || fixture.awayScore === null
    ? '–'
    : `${fixture.homeScore}–${fixture.awayScore}`;
  return `${fixture.home} ${score} ${fixture.away}`;
}

export function fixtureMeta(fixture: FanFixture) {
  return [fixture.competition, fixture.kickoffAt && formatHubNewsDate(fixture.kickoffAt)].filter(Boolean).join(' · ');
}

export async function fanRequest<T>(suffix: string, init?: { method?: 'POST' | 'PUT'; body?: unknown; signal?: AbortSignal }) {
  const { data } = await supabasePKCE.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('not_signed_in');

  const response = await fetch(`/api/adeptos${suffix}`, {
    method: init?.method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init?.signal,
    cache: 'no-store',
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result === null) throw new Error(result?.error ?? 'fans_unavailable');
  return result as T;
}
