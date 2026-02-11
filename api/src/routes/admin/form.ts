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

type FDTeam = {
  id?: number;
  name?: string;
  shortName?: string;
  tla?: string;
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

type FDResponse = {
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

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------

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

  return (
    (!!aName && (aName === tName || aName === tShort)) ||
    (!!aShort && (aShort === tName || aShort === tShort)) ||
    (!!aTla && (aTla === tName || aTla === tShort))
  );
}

function isFDResponse(v: unknown): v is FDResponse {
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

// ----------------------------------------------------
// Core logic
// ----------------------------------------------------

async function fetchFinishedPPL(env: Env): Promise<FDMatch[]> {
  const token = env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("missing_token");

  const url =
    "https://api.football-data.org/v4/competitions/PPL/matches?status=FINISHED&limit=200";

  const res = await fetch(url, {
    headers: { "X-Auth-Token": token },
  });

  if (!res.ok) {
    throw new Error(`football_data_failed_${res.status}`);
  }

  const json: unknown = await res.json().catch(() => null);
  if (!isFDResponse(json)) {
    throw new Error("football_data_bad_payload");
  }

  return Array.isArray(json.matches) ? json.matches : [];
}

function buildLast5ForTeam(team: TeamRow, matches: FDMatch[]) {
  const teamMatches = matches.filter((m) => {
    if (!m || m.status !== "FINISHED") return false;
    const homeOk = m.homeTeam ? teamMatchesApi(team, m.homeTeam) : false;
    const awayOk = m.awayTeam ? teamMatchesApi(team, m.awayTeam) : false;
    return homeOk || awayOk;
  });

  const lastMatches = teamMatches
    .slice()
    .sort((a, b) => Date.parse(b.utcDate) - Date.parse(a.utcDate))
    .slice(0, 5);

  const lastItems: LastMatchItem[] = lastMatches.map((m) => {
    const isHome = teamMatchesApi(team, m.homeTeam);

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

  const last5 = lastItems.map((x) => x.result).join("");

  return { last5, lastItems };
}

async function syncTeamForm(
  env: Env,
  teamId: string,
  matches: FDMatch[]
) {
  const team = await env.DB.prepare(
    "SELECT id, name, short_name FROM teams WHERE id = ?"
  )
    .bind(teamId)
    .first<TeamRow>();

  if (!team) return { ok: false, teamId };

  const { last5, lastItems } = buildLast5ForTeam(team, matches);

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

  return { ok: true, teamId, teamName: team.name, last5 };
}

// ----------------------------------------------------
// Hono Router
// ----------------------------------------------------

export const adminForm = new Hono<{ Bindings: Env }>();

// Manual update
adminForm.post("/", async (c) => {
  const err = requireAdmin(c as unknown as BindingsCtx);
  if (err) return c.json({ error: err }, 403);

  const body = await c.req.json().catch(() => null);
  const teamId = body?.teamId?.trim();

  if (!teamId) return c.json({ error: "missing_teamId" }, 400);

  const updatedAt = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO team_form (team_id, updated_at, last5)
     VALUES (?, ?, ?)
     ON CONFLICT(team_id) DO UPDATE SET
       updated_at = excluded.updated_at,
       last5 = excluded.last5`
  )
    .bind(teamId, updatedAt, body?.last5 ?? "")
    .run();

  return c.json({ ok: true });
});

// Sync single team
adminForm.post("/sync", async (c) => {
  const err = requireAdmin(c as unknown as BindingsCtx);
  if (err) return c.json({ error: err }, 403);

  const body = await c.req.json().catch(() => null);
  const teamId = body?.teamId?.trim();
  if (!teamId) return c.json({ error: "missing_teamId" }, 400);

  const matches = await fetchFinishedPPL(c.env);
  const result = await syncTeamForm(c.env, teamId, matches);

  return c.json(result);
});

// Sync ALL teams
adminForm.post("/sync-all", async (c) => {
  const err = requireAdmin(c as unknown as BindingsCtx);
  if (err) return c.json({ error: err }, 403);

  const result = await syncAllTeamForms(c.env);
  return c.json(result);
});

// ----------------------------------------------------
// Export para CRON
// ----------------------------------------------------

export async function syncAllTeamForms(env: Env) {
  const matches = await fetchFinishedPPL(env);

  const { results } = await env.DB.prepare(
    "SELECT id FROM teams ORDER BY id"
  ).all<{ id: string }>();

  const teamIds = (results ?? []).map((r) => r.id);

  const out = [];
  for (const teamId of teamIds) {
    try {
      const r = await syncTeamForm(env, teamId, matches);
      out.push(r);
    } catch (e: any) {
      out.push({ ok: false, teamId, error: String(e) });
    }
  }

  return {
    ok: true,
    total: teamIds.length,
    okCount: out.filter((x) => x.ok).length,
    results: out,
  };
}
