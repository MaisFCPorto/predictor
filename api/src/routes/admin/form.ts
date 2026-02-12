import { Hono } from "hono";
import type { Context } from "hono";

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
  FOOTBALL_DATA_TOKEN: string;
};

type BindingsCtx = Context<{ Bindings: Env }>;

type TeamRow = {
  id: string;
  name: string;
  short_name: string | null;
};

type ManualBody = {
  teamId?: string;
  last5?: string;
  last5Matches?: unknown[];
};

type SyncBody = {
  teamId?: string;
};

type FDTeam = {
  id?: number;
  name?: string;
  shortName?: string;
  tla?: string;
};

type FDTeamsResponse = {
  teams?: FDTeam[];
};

type FDMatch = {
  utcDate: string;
  status: string;
  competition?: { code?: string; name?: string };
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score?: {
    winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime?: { home?: number | null; away?: number | null };
  };
};

type FDMatchesResponse = {
  matches?: FDMatch[];
};

type LastMatchItem = {
  utcDate: string;
  competition?: string;
  opponent: string;
  venue: "H" | "A";
  result: "V" | "E" | "D";
  score?: { home: number | null; away: number | null };
};

function requireAdmin(c: BindingsCtx): string | null {
  const key =
    c.req.header("x-admin-key") ??
    c.req.header("X-Admin-Key") ??
    c.req.header("X-ADMIN-KEY");
  if (!key || key !== c.env.ADMIN_KEY) return "unauthorized";
  return null;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function teamMatchesApi(team: TeamRow, apiTeam: FDTeam): boolean {
  const tName = normalize(team.name);
  const tShort = normalize(team.short_name ?? "");

  const aName = normalize(apiTeam.name ?? "");
  const aShort = normalize(apiTeam.shortName ?? "");
  const aTla = normalize(apiTeam.tla ?? "");

  // match por qualquer combinação
  return (
    (!!aName && (aName === tName || aName === tShort)) ||
    (!!aShort && (aShort === tName || aShort === tShort)) ||
    (!!aTla && (aTla === tName || aTla === tShort))
  );
}

function isFDTeamsResponse(v: unknown): v is FDTeamsResponse {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as { teams?: unknown };
  return obj.teams === undefined || Array.isArray(obj.teams);
}

function isFDMatchesResponse(v: unknown): v is FDMatchesResponse {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as { matches?: unknown };
  return obj.matches === undefined || Array.isArray(obj.matches);
}

function computeResultLetter(
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null | undefined,
  isHome: boolean
): "V" | "E" | "D" {
  if (winner === "DRAW") return "E";
  if (winner === "HOME_TEAM") return isHome ? "V" : "D";
  if (winner === "AWAY_TEAM") return isHome ? "D" : "V";
  return "E";
}

async function fetchPPLTeams(env: Env): Promise<FDTeam[]> {
  const token = env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("missing_token");

  const url = "https://api.football-data.org/v4/competitions/PPL/teams";
  const res = await fetch(url, { headers: { "X-Auth-Token": token } });
  if (!res.ok) throw new Error(`football_data_failed_${res.status}`);

  const json: unknown = await res.json().catch(() => null);
  if (!isFDTeamsResponse(json)) throw new Error("football_data_bad_payload");

  return Array.isArray(json.teams) ? json.teams : [];
}

function resolveFDTeamId(team: TeamRow, fdTeams: FDTeam[]): number | null {
  const t = fdTeams.find((x) => teamMatchesApi(team, x));
  const id = t?.id;
  return typeof id === "number" && Number.isFinite(id) ? id : null;
}

async function fetchTeamMatchesAllComps(
  env: Env,
  fdTeamId: number
): Promise<FDMatch[]> {
  const token = env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("missing_token");

  // 15 por segurança (às vezes há adiamentos/duplicados), e depois cortamos para 5
  const url = `https://api.football-data.org/v4/teams/${fdTeamId}/matches?status=FINISHED&limit=15`;
  const res = await fetch(url, { headers: { "X-Auth-Token": token } });
  if (!res.ok) throw new Error(`football_data_failed_${res.status}`);

  const json: unknown = await res.json().catch(() => null);
  if (!isFDMatchesResponse(json)) throw new Error("football_data_bad_payload");

  return Array.isArray(json.matches) ? json.matches : [];
}

function buildLast5FromTeamMatches(
  fdTeamId: number,
  matches: FDMatch[]
): { last5: string; lastItems: LastMatchItem[] } {
  const sorted = matches
    .slice()
    .filter((m) => m && m.status === "FINISHED" && !!m.utcDate)
    .sort((a, b) => Date.parse(b.utcDate) - Date.parse(a.utcDate))
    .slice(0, 5);

  const items: LastMatchItem[] = sorted.map((m) => {
    const isHome = (m.homeTeam?.id ?? null) === fdTeamId;

    const opponent = isHome
      ? m.awayTeam?.shortName || m.awayTeam?.name || "Opponent"
      : m.homeTeam?.shortName || m.homeTeam?.name || "Opponent";

    const result = computeResultLetter(m.score?.winner ?? null, isHome);

    const ftHome = m.score?.fullTime?.home ?? null;
    const ftAway = m.score?.fullTime?.away ?? null;

    return {
      utcDate: m.utcDate,
      competition: m.competition?.code || m.competition?.name,
      opponent,
      venue: isHome ? "H" : "A",
      result,
      score: { home: ftHome, away: ftAway },
    };
  });

  // ⚠️ aqui fica: mais recente -> esquerda (VVVDE como tu queres)
  const last5 = items.map((x) => x.result).join("");

  return { last5, lastItems: items };
}

async function upsertTeamForm(
  env: Env,
  teamId: string,
  last5: string,
  lastItems: LastMatchItem[]
) {
  const updatedAt = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO team_form (team_id, updated_at, last5, last5_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(team_id) DO UPDATE SET
       updated_at = excluded.updated_at,
       last5 = excluded.last5,
       last5_json = excluded.last5_json`
  )
    .bind(teamId, updatedAt, last5, JSON.stringify(lastItems))
    .run();

  return updatedAt;
}

// ✅ export para o CRON (sem admin key)
export async function syncAllTeamForms(env: Env) {
  const fdTeams = await fetchPPLTeams(env);

  const { results } = await env.DB.prepare(
    "SELECT id, name, short_name FROM teams ORDER BY name"
  ).all<TeamRow>();

  const teams = (results ?? []).filter(Boolean);

  let okCount = 0;
  const out: any[] = [];

  for (const t of teams) {
    try {
      const fdTeamId = resolveFDTeamId(t, fdTeams);
      if (!fdTeamId) {
        out.push({ ok: false, teamId: t.id, error: "fd_team_not_found" });
        continue;
      }

      const matches = await fetchTeamMatchesAllComps(env, fdTeamId);
      const { last5, lastItems } = buildLast5FromTeamMatches(fdTeamId, matches);

      const updatedAt = await upsertTeamForm(env, t.id, last5, lastItems);

      okCount++;
      out.push({ ok: true, teamId: t.id, fdTeamId, last5, updatedAt });
    } catch (e: any) {
      out.push({ ok: false, teamId: t.id, error: String(e?.message ?? e) });
    }
  }

  return {
    ok: true,
    total: teams.length,
    okCount,
    results: out,
  };
}

// ----------------------------------------------------
// Router
// ----------------------------------------------------
export const adminForm = new Hono<{ Bindings: Env }>();

/**
 * POST /api/admin/form
 * Body: { teamId, last5, last5Matches? }
 */
adminForm.post("/", async (c) => {
  const err = requireAdmin(c as unknown as BindingsCtx);
  if (err) return c.json({ error: err }, 403);

  const raw: unknown = await c.req.json().catch(() => null);
  const body = (raw ?? {}) as ManualBody;

  const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
  if (!teamId) return c.json({ error: "missing_teamId" }, 400);

  const last5 = typeof body.last5 === "string" ? body.last5.trim() : "";
  const last5Matches = Array.isArray(body.last5Matches) ? body.last5Matches : [];

  const updatedAt = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO team_form (team_id, updated_at, last5, last5_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(team_id) DO UPDATE SET
       updated_at = excluded.updated_at,
       last5 = excluded.last5,
       last5_json = excluded.last5_json`
  )
    .bind(teamId, updatedAt, last5, JSON.stringify(last5Matches))
    .run();

  return c.json({ ok: true, teamId, last5, updatedAt });
});

/**
 * POST /api/admin/form/sync
 * Body: { teamId }
 * Últimos 5 jogos independentemente da competição
 */
adminForm.post("/sync", async (c) => {
  const err = requireAdmin(c as unknown as BindingsCtx);
  if (err) return c.json({ error: err }, 403);

  const raw: unknown = await c.req.json().catch(() => null);
  const body = (raw ?? {}) as SyncBody;

  const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
  if (!teamId) return c.json({ error: "missing_teamId" }, 400);

  const team = await c.env.DB.prepare(
    "SELECT id, name, short_name FROM teams WHERE id = ?"
  )
    .bind(teamId)
    .first<TeamRow>();

  if (!team) return c.json({ error: "unknown_team", teamId }, 400);

  const fdTeams = await fetchPPLTeams(c.env);
  const fdTeamId = resolveFDTeamId(team, fdTeams);
  if (!fdTeamId) return c.json({ error: "fd_team_not_found", teamId }, 404);

  const matches = await fetchTeamMatchesAllComps(c.env, fdTeamId);
  const { last5, lastItems } = buildLast5FromTeamMatches(fdTeamId, matches);
  const updatedAt = await upsertTeamForm(c.env, teamId, last5, lastItems);

  return c.json({
    ok: true,
    teamId,
    teamName: team.name,
    fdTeamId,
    last5,
    updatedAt,
    count: lastItems.length,
  });
});

/**
 * POST /api/admin/form/sync-all
 * Sem body.
 * Últimos 5 jogos independentemente da competição (para todas as equipas)
 */
adminForm.post("/sync-all", async (c) => {
  const err = requireAdmin(c as unknown as BindingsCtx);
  if (err) return c.json({ error: err }, 403);

  const result = await syncAllTeamForms(c.env);
  return c.json(result);
});
