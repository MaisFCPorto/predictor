// src/routes/admin/form.ts
import { Hono } from "hono";

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
  FOOTBALL_DATA_TOKEN: string;
};

export const adminForm = new Hono<{ Bindings: Env }>();

function requireAdmin(c: any): string | null {
  const key = c.req.header("x-admin-key") || c.req.header("X-Admin-Key");
  if (!key || key !== c.env.ADMIN_KEY) return "unauthorized";
  return null;
}

type SyncBody = { teamId?: string };

type DBTeam = {
  id: string;
  name: string;
  short_name: string | null;
};

type FDTeam = { name?: string | null; shortName?: string | null };
type FDScore = { winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null };
type FDMatch = {
  utcDate?: string;
  status?: string;
  homeTeam?: FDTeam;
  awayTeam?: FDTeam;
  score?: FDScore;
};

type FDResponse = { matches?: FDMatch[] };

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function pickBestTeamName(team: DBTeam): string {
  // usa name; se for curto tipo "FCP" preferimos name mesmo
  return team.name?.trim() || team.id;
}

function matchIsTeam(m: FDMatch, teamNameN: string, teamShortN: string | null) {
  const homeN = normalize(m.homeTeam?.name || "");
  const awayN = normalize(m.awayTeam?.name || "");
  const homeSN = normalize(m.homeTeam?.shortName || "");
  const awaySN = normalize(m.awayTeam?.shortName || "");

  const shortN = teamShortN ? normalize(teamShortN) : "";

  const isByName = homeN === teamNameN || awayN === teamNameN;
  const isByShort = shortN
    ? homeSN === shortN || awaySN === shortN
    : false;

  return isByName || isByShort;
}

function resultLetter(m: FDMatch, teamNameN: string, teamShortN: string | null): "W" | "D" | "L" {
  const homeNameN = normalize(m.homeTeam?.name || "");
  const awayNameN = normalize(m.awayTeam?.name || "");

  const teamShortN2 = teamShortN ? normalize(teamShortN) : "";
  const homeShortN = normalize(m.homeTeam?.shortName || "");
  const awayShortN = normalize(m.awayTeam?.shortName || "");

  const isHome =
    homeNameN === teamNameN ||
    (teamShortN2 && homeShortN === teamShortN2);

  const isAway =
    awayNameN === teamNameN ||
    (teamShortN2 && awayShortN === teamShortN2);

  const winner = m.score?.winner ?? null;

  // Se não conseguimos identificar lado, devolve empate para não “inventar”
  if (!isHome && !isAway) return "D";

  if (winner === "DRAW" || winner === null) return "D";
  if (winner === "HOME_TEAM") return isHome ? "W" : "L";
  if (winner === "AWAY_TEAM") return isAway ? "W" : "L";
  return "D";
}

adminForm.post("/sync", async (c) => {
  const err = requireAdmin(c);
  if (err) return c.json({ error: err }, 403);

  const raw: unknown = await c.req.json().catch(() => null);
  const body: SyncBody =
    raw && typeof raw === "object" ? (raw as SyncBody) : {};

  const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
  if (!teamId) return c.json({ error: "missing_teamId" }, 400);

  // 1) equipa na BD
  const team = await c.env.DB.prepare(
    "SELECT id, name, short_name FROM teams WHERE id = ?"
  )
    .bind(teamId)
    .first<DBTeam>();

  if (!team) return c.json({ error: "unknown_team", teamId }, 400);

  // 2) Football-Data
  const token = c.env.FOOTBALL_DATA_TOKEN;
  if (!token) return c.json({ error: "missing_token" }, 500);

  // Liga Portugal: PPL
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

  const rawJson: unknown = await res.json().catch(() => null);
  const data: FDResponse =
    rawJson && typeof rawJson === "object"
      ? (rawJson as FDResponse)
      : { matches: [] };

  const matchesAll = Array.isArray(data.matches) ? data.matches : [];

  // 3) filtrar jogos da equipa
  const teamNameN = normalize(pickBestTeamName(team));
  const teamShortN = team.short_name;

  const teamMatches = matchesAll
    .filter((m) => matchIsTeam(m, teamNameN, teamShortN))
    .sort((a, b) => {
      const ta = new Date(a.utcDate || 0).getTime();
      const tb = new Date(b.utcDate || 0).getTime();
      return tb - ta; // mais recente primeiro
    });

  const last5Matches = teamMatches.slice(0, 5);

  // 4) calcular forma (últimos 5, do mais antigo para o mais recente)
  const lettersNewestFirst = last5Matches.map((m) =>
    resultLetter(m, teamNameN, teamShortN)
  );
  const last5 = lettersNewestFirst.slice().reverse().join("");

  // guardar também uma versão compacta do detalhe dos 5 jogos
  const last5Json = last5Matches
    .slice()
    .reverse()
    .map((m) => ({
      utcDate: m.utcDate ?? null,
      home: m.homeTeam?.name ?? null,
      away: m.awayTeam?.name ?? null,
      winner: m.score?.winner ?? null,
    }));

  const now = new Date().toISOString();

  // 5) upsert na team_form
  await c.env.DB.prepare(
    `
    INSERT INTO team_form (team_id, updated_at, last5, last5_json)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(team_id)
    DO UPDATE SET
      updated_at = excluded.updated_at,
      last5 = excluded.last5,
      last5_json = excluded.last5_json
    `
  )
    .bind(teamId, now, last5, JSON.stringify(last5Json))
    .run();

  return c.json({
    ok: true,
    teamId,
    teamName: team.name,
    last5,
    updatedAt: now,
    count: last5Matches.length,
  });
});
