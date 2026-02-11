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

  // Match por qualquer combinação (name/shortName/tla) vs (name/short_name)
  return (
    (!!aName && (aName === tName || aName === tShort)) ||
    (!!aShort && (aShort === tName || aShort === tShort)) ||
    (!!aTla && (aTla === tName || aTla === tShort))
  );
}

function isFDResponse(v: unknown): v is FDResponse {
  if (typeof v !== "object" || v === null) return false;
  // matches pode não existir, mas se existir tem de ser array
  const obj = v as { matches?: unknown };
  return obj.matches === undefined || Array.isArray(obj.matches);
}

function computeResultLetter(
  winner: FDMatch["score"] extends infer S
    ? S extends { winner?: infer W }
      ? W
      : unknown
    : unknown,
  isHome: boolean
): "V" | "E" | "D" {
  if (winner === "DRAW") return "E";
  if (winner === "HOME_TEAM") return isHome ? "V" : "D";
  if (winner === "AWAY_TEAM") return isHome ? "D" : "V";
  return "E"; // fallback seguro
}

export const adminForm = new Hono<{ Bindings: Env }>();

/**
 * POST /api/admin/form
 * Body: { teamId, last5, last5Matches? }
 * Grava manualmente (mantém compatibilidade com o que já tinhas)
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
 * Vai ao football-data (PPL finished), faz match robusto por name/shortName/tla,
 * calcula last5 (V/E/D) e grava em team_form.
 */
adminForm.post("/sync", async (c) => {
  const err = requireAdmin(c as unknown as BindingsCtx);
  if (err) return c.json({ error: err }, 403);

  const raw: unknown = await c.req.json().catch(() => null);
  const body = (raw ?? {}) as SyncBody;

  const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
  if (!teamId) return c.json({ error: "missing_teamId" }, 400);

  // 1) Buscar equipa na BD
  const team = await c.env.DB.prepare(
    "SELECT id, name, short_name FROM teams WHERE id = ?"
  )
    .bind(teamId)
    .first<TeamRow>();

  if (!team) return c.json({ error: "unknown_team", teamId }, 400);

  const token = c.env.FOOTBALL_DATA_TOKEN;
  if (!token) return c.json({ error: "missing_token" }, 500);

  // 2) Buscar jogos terminados da PPL (Liga Portugal)
  //    Nota: football-data pode paginar/limitar; aqui pedimos um lote “grande”.
  const url =
    "https://api.football-data.org/v4/competitions/PPL/matches?status=FINISHED&limit=200";

  const res = await fetch(url, {
    headers: { "X-Auth-Token": token },
  });

  if (!res.ok) {
    return c.json(
      { error: "football_data_failed", status: res.status },
      502
    );
  }

  const json: unknown = await res.json().catch(() => null);
  if (!isFDResponse(json)) {
    return c.json({ error: "football_data_bad_payload" }, 502);
  }

  const matches = Array.isArray(json.matches) ? json.matches : [];

  // 3) Filtrar jogos da equipa (match robusto)
  const teamMatches = matches.filter((m) => {
    if (!m || m.status !== "FINISHED") return false;
    const homeOk = m.homeTeam ? teamMatchesApi(team, m.homeTeam) : false;
    const awayOk = m.awayTeam ? teamMatchesApi(team, m.awayTeam) : false;
    return homeOk || awayOk;
  });

  // 4) Ordenar por data DESC e pegar nos últimos 5
  const lastMatches = teamMatches
    .slice()
    .sort((a, b) => {
      const ta = Date.parse(a.utcDate);
      const tb = Date.parse(b.utcDate);
      return tb - ta;
    })
    .slice(0, 5);

  // 5) Construir last5 + JSON detalhado
  const lastItems: LastMatchItem[] = lastMatches.map((m) => {
    const isHome = teamMatchesApi(team, m.homeTeam);
    const opponent = isHome
      ? m.awayTeam?.shortName || m.awayTeam?.name || "Opponent"
      : m.homeTeam?.shortName || m.homeTeam?.name || "Opponent";

    const winner = m.score?.winner ?? null;
    const result = computeResultLetter(winner, isHome);

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

  // 6) Upsert na team_form
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
