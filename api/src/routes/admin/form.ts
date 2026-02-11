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

function buildLast5ForTeam(team: TeamRow, matches: FDMatch[]) {
  // filtra jogos terminados onde a equipa aparece (match robusto)
  const teamMatches = matches.filter((m) => {
    if (!m || m.status !== "FINISHED") return false;
    const homeOk = m.homeTeam ? teamMatchesApi(team, m.homeTeam) : false;
    const awayOk = m.awayTeam ? teamMatchesApi(team, m.awayTeam) : false;
    return homeOk || awayOk;
  });

  // ordena por data DESC e pega nos últimos 5
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

  const token = c.env.FOOTBALL_DATA_TOKEN;
  if (!token) return c.json({ error: "missing_token" }, 500);

  const url =
    "https://api.football-data.org/v4/competitions/PPL/matches?status=FINISHED&limit=200";

  const res = await fetch(url, { headers: { "X-Auth-Token": token } });
  if (!res.ok) {
    return c.json({ error: "football_data_failed", status: res.status }, 502);
  }

  const json: unknown = await res.json().catch(() => null);
  if (!isFDResponse(json)) {
    return c.json({ error: "football_data_bad_payload" }, 502);
  }

  const matches = Array.isArray(json.matches) ? json.matches : [];
  const { last5, lastItems } = buildLast5ForTeam(team, matches);

  const updatedAt = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO team_form (team_id, updated_at, last5, last5_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(team_id) DO UPDATE SET
       updated_at = excluded.updated_at,
       last5 = excluded.last5,
       last5_json = excluded.last5_json`
  )
    .bind(teamId, updatedAt, last5, JSON.stringify(lastItems))
    .run();

  return c.json({
    ok: true,
    teamId,
    teamName: team.name,
    last5,
    updatedAt,
    count: lastItems.length,
  });
});

/**
 * ✅ POST /api/admin/form/sync-all
 * Sem body. Vai buscar todos os teams da BD, faz 1 fetch ao football-data,
 * calcula last5 para cada equipa e faz upsert.
 */
adminForm.post("/sync-all", async (c) => {
  const err = requireAdmin(c as unknown as BindingsCtx);
  if (err) return c.json({ error: err }, 403);

  const token = c.env.FOOTBALL_DATA_TOKEN;
  if (!token) return c.json({ error: "missing_token" }, 500);

  // 1) buscar equipas locais
  const teamsRes = await c.env.DB.prepare(
    "SELECT id, name, short_name FROM teams"
  ).all<TeamRow>();
  const teams = (teamsRes.results ?? []).filter(Boolean);

  if (teams.length === 0) {
    return c.json({ ok: true, updated: 0, skipped: 0, teams: [] });
  }

  // 2) buscar jogos terminados uma vez
  const url =
    "https://api.football-data.org/v4/competitions/PPL/matches?status=FINISHED&limit=200";
  const res = await fetch(url, { headers: { "X-Auth-Token": token } });

  if (!res.ok) {
    return c.json({ error: "football_data_failed", status: res.status }, 502);
  }

  const json: unknown = await res.json().catch(() => null);
  if (!isFDResponse(json)) {
    return c.json({ error: "football_data_bad_payload" }, 502);
  }

  const matches = Array.isArray(json.matches) ? json.matches : [];
  const updatedAt = new Date().toISOString();

  let updated = 0;
  let skipped = 0;

  // 3) para cada equipa, calcula e grava
  for (const t of teams) {
    const { last5, lastItems } = buildLast5ForTeam(t, matches);

    // se não houver jogos suficientes, ainda assim gravamos (fica "" ou menor)
    // se quiseres mesmo "não gravar" quando não tem jogos, troca para if (lastItems.length===0) { skipped++; continue; }
    await c.env.DB.prepare(
      `INSERT INTO team_form (team_id, updated_at, last5, last5_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(team_id) DO UPDATE SET
         updated_at = excluded.updated_at,
         last5 = excluded.last5,
         last5_json = excluded.last5_json`
    )
      .bind(t.id, updatedAt, last5, JSON.stringify(lastItems))
      .run();

    updated++;
  }

  return c.json({
    ok: true,
    updatedAt,
    updated,
    skipped,
    totalTeams: teams.length,
  });
});

async function fetchFinishedPPL(env: Env) {
    const token = env.FOOTBALL_DATA_TOKEN;
    if (!token) throw new Error("missing_token");
  
    const url =
      "https://api.football-data.org/v4/competitions/PPL/matches?status=FINISHED&limit=200";
  
    const res = await fetch(url, { headers: { "X-Auth-Token": token } });
    if (!res.ok) throw new Error(`football_data_failed_${res.status}`);
  
    const json: unknown = await res.json().catch(() => null);
    if (!isFDResponse(json)) throw new Error("football_data_bad_payload");
  
    return Array.isArray(json.matches) ? json.matches : [];
  }
  
  async function syncTeamForm(env: Env, teamId: string, matches: FDMatch[]) {
    const team = await env.DB.prepare(
      "SELECT id, name, short_name FROM teams WHERE id = ?"
    )
      .bind(teamId)
      .first<TeamRow>();
  
    if (!team) return { ok: false as const, teamId, error: "unknown_team" };
  
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
  
      const winner = m.score?.winner ?? null;
      const result = computeResultLetter(winner as any, isHome);
  
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
  
    return { ok: true as const, teamId, teamName: team.name, last5 };
  }
  
  // ✅ export para o cron conseguir chamar
  export async function syncAllTeamForms(env: Env) {
    const matches = await fetchFinishedPPL(env);
  
    const { results } = await env.DB.prepare(
      `SELECT id FROM teams ORDER BY id`
    ).all<{ id: string }>();
  
    const teamIds = (results ?? []).map((r) => r.id).filter(Boolean);
  
    const out: Array<any> = [];
    for (const teamId of teamIds) {
      try {
        const r = await syncTeamForm(env, teamId, matches);
        out.push(r);
      } catch (e: any) {
        out.push({ ok: false, teamId, error: String(e?.message ?? e) });
      }
    }
  
    const okCount = out.filter((x) => x.ok).length;
    return { ok: true, total: teamIds.length, okCount, results: out };
  }
  
