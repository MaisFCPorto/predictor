const PORTO_KGMID = '/m/0177gl';
const PLAYER_ALIASES: Record<string, string> = {
  zaidusanusi: 'zaidu',
  samu: 'samuaghehowa',
};

type Entity = { kgmid?: string; name?: string; short_name?: string };
type ClubPlayer = { id: number; name: string; position: string };
type Clock = {
  in_game_time?: { minute?: number; stoppage_minute?: number };
  time_original?: string;
};
type Player = Entity & {
  jersey_number?: string;
  substitution_in?: Clock & { starter_player_index?: number; bench_player_index?: number };
};
type Goal = Clock & { extensions?: string[] };
type Team = Entity & {
  score?: number;
  penalty_score?: number;
  goal_summary?: { player?: Player; goals?: Goal[] }[];
};
type Fixture = {
  kgmid?: string;
  start_time?: string;
  status?: string;
  status_original?: string;
  league?: Entity;
  teams?: Team[];
};
type Lineup = { team_index: number; starters?: Player[]; bench?: Player[] };
type Event = Clock & {
  type: string;
  team_index?: number;
  player_in?: Player;
  player_out?: Player;
};
type SportsResponse = {
  error?: string;
  team_results?: { games?: Fixture[] };
  game_results?: {
    info?: Fixture;
    lineups?: { teams?: Lineup[] };
    timeline?: { events?: Event[] };
  };
};

export class PortoFixtureNotFound extends Error {}

export class SerpApiError extends Error {
  constructor(
    readonly code: string,
    readonly upstreamStatus?: number,
    readonly detail?: string,
  ) {
    super(code);
  }
}

export function isSportsKgmid(value: unknown): value is string {
  return typeof value === 'string' && /^\/[gm]\/[a-z0-9_]{1,64}$/.test(value);
}

async function searchSports(apiKey: string, params: Record<string, string>) {
  const query = new URLSearchParams({
    engine: 'google_sports',
    sp: 'ft',
    gl: 'pt',
    hl: 'en',
    ...params,
    api_key: apiKey,
  });
  let response: Response;
  try {
    response = await fetch('https://serpapi.com/search.json?' + query.toString(), {
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    throw new SerpApiError(timedOut ? 'serpapi_timeout' : 'serpapi_network_error');
  }

  const data = (await response.json().catch(() => null)) as SportsResponse | null;
  const detail = typeof data?.error === 'string'
    ? data.error
      .replaceAll(apiKey, '[ocultado]')
      .replaceAll(encodeURIComponent(apiKey), '[ocultado]')
      .slice(0, 240)
    : undefined;
  if (!response.ok || data?.error) {
    throw new SerpApiError('serpapi_request_failed', response.status, detail);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new SerpApiError('serpapi_invalid_response', response.status);
  }
  return data;
}

function fixtureSummary(fixture?: Fixture) {
  if (!fixture || !isSportsKgmid(fixture.kgmid) || fixture.teams?.length !== 2) return null;
  if (!fixture.teams.some((team) => team.kgmid === PORTO_KGMID)) return null;

  return {
    kgmid: fixture.kgmid,
    kickoffAt: fixture.start_time ?? null,
    status: fixture.status ?? null,
    statusOriginal: fixture.status_original ?? null,
    competition: fixture.league
      ? { kgmid: fixture.league.kgmid ?? null, name: fixture.league.name ?? null }
      : null,
    teams: fixture.teams.map((team) => ({
      kgmid: team.kgmid ?? null,
      name: team.name ?? team.short_name ?? null,
      score: team.score ?? null,
      penaltyScore: team.penalty_score ?? null,
    })),
  };
}

function normalizePlayerName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function playerSummary(player: Player | undefined, players: readonly ClubPlayer[]) {
  const name = player?.name?.trim() || player?.short_name?.trim();
  if (!name) return null;

  const normalizedName = normalizePlayerName(name);
  const alias = PLAYER_ALIASES[normalizedName];
  const matches = players.filter((candidate) => {
    const candidateName = normalizePlayerName(candidate.name);
    return candidateName === normalizedName || candidateName === alias;
  });

  return {
    name,
    kgmid: player?.kgmid ?? null,
    shirtNumber: player?.jersey_number ?? null,
    predictorPlayer: matches.length === 1 ? matches[0] : null,
  };
}

function eventTime(event: Clock) {
  return {
    minute: event.in_game_time?.minute ?? null,
    stoppageMinute: event.in_game_time?.stoppage_minute ?? null,
    original: event.time_original ?? null,
  };
}

function substitutionsFromLineup(lineup: Lineup | undefined, players: readonly ClubPlayer[]) {
  if (!lineup?.bench) return null;

  return lineup.bench.flatMap((player) => {
    const entry = player.substitution_in;
    if (!entry) return [];

    const out =
      entry.starter_player_index != null
        ? lineup.starters?.[entry.starter_player_index]
        : lineup.bench?.[entry.bench_player_index ?? -1];

    return [{
      playerIn: playerSummary(player, players),
      playerOut: playerSummary(out, players),
      ...eventTime(entry),
    }];
  });
}

export async function getPortoCalendar(apiKey: string) {
  const data = await searchSports(apiKey, { type: 'team', tab: 'gm', kgmid: PORTO_KGMID });
  const games = data.team_results?.games;
  if (!Array.isArray(games)) throw new SerpApiError('serpapi_calendar_missing');

  return { games: games.map(fixtureSummary).filter((game) => game !== null) };
}

export async function getPortoGame(apiKey: string, kgmid: string, players: readonly ClubPlayer[] = []) {
  const data = await searchSports(apiKey, { type: 'game', kgmid });
  const game = data.game_results;
  const info = game?.info;
  if (!game || !info || info.kgmid !== kgmid || !Array.isArray(info.teams)) {
    throw new SerpApiError('serpapi_game_missing');
  }

  const fixture = fixtureSummary(info);
  const portoIndex = info.teams.findIndex((team) => team.kgmid === PORTO_KGMID);
  if (portoIndex < 0) throw new PortoFixtureNotFound();
  if (!fixture) throw new SerpApiError('serpapi_game_missing');

  const porto = info.teams[portoIndex];
  const lineup = game.lineups?.teams?.find((team) => team.team_index === portoIndex);
  const fromLineup = substitutionsFromLineup(lineup, players);
  const fromTimeline = game.timeline?.events
    ?.filter((event) => event.type === 'substitution' && event.team_index === portoIndex)
    .map((event) => ({
      playerIn: playerSummary(event.player_in, players),
      playerOut: playerSummary(event.player_out, players),
      ...eventTime(event),
    }));
  const substitutions =
    (fromLineup?.length ?? 0) > (fromTimeline?.length ?? 0)
      ? fromLineup
      : (fromTimeline ?? fromLineup);

  const goalSummary = porto.goal_summary ?? (porto.score === 0 ? [] : null);
  return {
    fixture,
    porto: {
      scorers:
        goalSummary?.map((scorer) => ({
          player: playerSummary(scorer.player, players),
          goals: (scorer.goals ?? []).map((goal) => ({
            ...eventTime(goal),
            ownGoal: goal.extensions?.includes('OG') ?? false,
            penalty: goal.extensions?.includes('P') ?? false,
          })),
        })) ?? null,
      starters: lineup?.starters?.map((player) => playerSummary(player, players)) ?? null,
      substitutions: substitutions ?? null,
    },
  };
}
