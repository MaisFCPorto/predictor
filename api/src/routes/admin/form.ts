// predictor-porto/api/src/routes/admin/form.ts
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

type FDTeamMatchesResponse = {
  matches?: FDMatch[];
};

type FDCompetitionTeamsResponse = {
  teams?: Array<{
    id: number;
    name?: string;
    shortName?: string;
    tla?: string;
  }>;
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

function isFDTeamMatchesResponse(v: unknown): v is FDTeamMatchesResponse {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as { matches?: unknown };
  return obj.matches === undefined || Array.isArray(obj.matches);
}

function isFDCompetitionTeamsResponse(v: unknown): v is FDCompetitionTeamsResponse {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as { teams?: unknown };
  return obj.teams === undefined || Array.isArray(obj.teams);
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
// ✅ Resolver FD team id (cache em D1) + fetch matches por equipa
// ----------------------------------------------------

async function fetchCompetitionTeamsMap(env: Env, competitionCode: string) {
  // 1 request que nos dá IDs oficiais da football-data para as equipas da competição
  const token = env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("missing_token");

  const url = `https://api.football-data.org/v4/competitions/${competitionCode}/teams`;

  const res = await fetch(url, { headers: { "X-Auth-Token": token } });
  if (!res.ok) {
    throw new Error(`football_data_failed_${res.status}`);
  }

  const json: unknown = await res.json().catch(() => null);
  if (!isFDCompetitionTeamsResponse(json)) {
    throw new Error("football_data_bad_payload");
  }

  const teams = Array.isArray(json.teams) ? json.teams : [];

  // índice por (name/shortName/tla) normalizados
  const map = new Map<string, number>();
  for (const t of teams) {
    if (!t || typeof t.id !== "number") continue;
    const n1 = t.name ? normalize(t.name) : "";
    const n2 = t.shortName ? normalize(t.shortName) : "";
    const n3 = t.tla ? normalize(t.tla) : "";

    if (n1) map.set(n1, t.id);
    if (n2) map.set(n2, t.id);
    if (n3) map.set(n3, t.id);
  }

  return map;
}

/**
 * ✅ ATENÇÃO:
 *  - Esta versão mantém a tua estratégia: usa competition/teams como "catálogo" para resolver.
 *  - Para equipas internacionais, basta adicionares mais competições ao catálogo.
 *
 * Sugestão boa: ["PPL","CL","EL","EC"] (Liga PT + Champions + Europa + Conference)
 * Se quiseres também Taça/Ligas específicas, adicionamos depois.
 */
async function getOrResolveFdTeamId(env: Env, team: TeamRow): Promise<number | null> {
    // 1️⃣ Ver cache
    const cached = await env.DB.prepare(
      `SELECT fd_team_id FROM team_fd_map WHERE team_id = ? LIMIT 1`
    )
      .bind(team.id)
      .first<{ fd_team_id: number }>();
  
    if (cached?.fd_team_id != null) return Number(cached.fd_team_id);
  
    // 2️⃣ Tentar resolver por competições principais
    const competitions = ["PPL", "CL", "EL", "FL1"]; // Liga PT, Champions, Europa
  
    for (const comp of competitions) {
      try {
        const map = await fetchCompetitionTeamsMap(env, comp);
  
        const k1 = normalize(team.name);
        const k2 = normalize(team.short_name ?? "");
  
        const fdId = map.get(k1) ?? (k2 ? map.get(k2) : undefined) ?? null;
  
        if (fdId) {
          await env.DB.prepare(
            `INSERT INTO team_fd_map (team_id, fd_team_id, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(team_id) DO UPDATE SET
               fd_team_id = excluded.fd_team_id,
               updated_at = excluded.updated_at`
          )
            .bind(team.id, fdId, new Date().toISOString())
            .run();
  
          return fdId;
        }
      } catch {
        // ignora erro e tenta próxima competição
      }
    }
  
    // 3️⃣ Fallback global — procurar no catálogo geral
    const token = env.FOOTBALL_DATA_TOKEN;
    const target1 = normalize(team.name);
    const target2 = normalize(team.short_name ?? "");
  
    const LIMIT = 200;
    const MAX_PAGES = 15;
  
    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * LIMIT;
      const url = `https://api.football-data.org/v4/teams?limit=${LIMIT}&offset=${offset}`;
  
      const res = await fetch(url, { headers: { "X-Auth-Token": token } });
  
      if (res.status === 429) throw new Error("football_data_failed_429");
      if (!res.ok) break;
  
      const json: any = await res.json().catch(() => null);
      const teams = Array.isArray(json?.teams) ? json.teams : [];
  
      if (teams.length === 0) break;
  
      for (const t of teams) {
        const n1 = t.name ? normalize(t.name) : "";
        const n2 = t.shortName ? normalize(t.shortName) : "";
        const n3 = t.tla ? normalize(t.tla) : "";
  
        if (
          (n1 && (n1 === target1 || n1 === target2)) ||
          (n2 && (n2 === target1 || n2 === target2)) ||
          (n3 && (n3 === target1 || n3 === target2))
        ) {
          await env.DB.prepare(
            `INSERT INTO team_fd_map (team_id, fd_team_id, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(team_id) DO UPDATE SET
               fd_team_id = excluded.fd_team_id,
               updated_at = excluded.updated_at`
          )
            .bind(team.id, t.id, new Date().toISOString())
            .run();
  
          return t.id;
        }
      }
    }
  
    return null;
  }
  

async function fetchLast5MatchesAllCompetitions(env: Env, fdTeamId: number): Promise<FDMatch[]> {
  const token = env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("missing_token");

  // ⚠️ Pede mais do que 5 para teres buffer e garantires que tens 5 "FINISHED"
  const url = `https://api.football-data.org/v4/teams/${fdTeamId}/matches?status=FINISHED&limit=10`;

  const res = await fetch(url, { headers: { "X-Auth-Token": token } });

  if (res.status === 429) {
    throw new Error("football_data_failed_429");
  }
  if (!res.ok) {
    throw new Error(`football_data_failed_${res.status}`);
  }

  const json: unknown = await res.json().catch(() => null);
  if (!isFDTeamMatchesResponse(json)) {
    throw new Error("football_data_bad_payload");
  }

  const matches = Array.isArray(json.matches) ? json.matches : [];
  // garantimos ordem DESC e cortamos 5
  return matches
    .slice()
    .filter((m) => m && m.status === "FINISHED")
    .sort((a, b) => Date.parse(b.utcDate) - Date.parse(a.utcDate))
    .slice(0, 5);
}

function buildLast5FromTeamMatches(fdTeamId: number, matches: FDMatch[]) {
  const lastItems: LastMatchItem[] = matches.map((m) => {
    const isHome = Number(m.homeTeam?.id) === fdTeamId;

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

async function upsertTeamForm(env: Env, teamId: string, last5: string, lastItems: LastMatchItem[]) {
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

async function syncOneTeam(env: Env, teamId: string) {
  const team = await env.DB.prepare(
    "SELECT id, name, short_name FROM teams WHERE id = ?"
  )
    .bind(teamId)
    .first<TeamRow>();

  if (!team) return { ok: false as const, teamId, error: "unknown_team" };

  const fdTeamId = await getOrResolveFdTeamId(env, team);
  if (!fdTeamId) return { ok: false as const, teamId, error: "fd_team_not_found" };

  const matches = await fetchLast5MatchesAllCompetitions(env, fdTeamId);
  const { last5, lastItems } = buildLast5FromTeamMatches(fdTeamId, matches);
  const updatedAt = await upsertTeamForm(env, teamId, last5, lastItems);

  return { ok: true as const, teamId, fdTeamId, last5, updatedAt };
}

/**
 * ✅ ESTA É A FUNÇÃO QUE O CRON CHAMA
 * Processa N equipas por execução, usando cursor em D1.
 */
export async function syncTeamFormsBatch(env: Env, batchSize = 10) {
  const q = Number(batchSize);
  const size = Number.isFinite(q) ? Math.min(Math.max(q, 1), 25) : 10;

  const { results } = await env.DB.prepare(
    `SELECT id FROM teams ORDER BY id`
  ).all<{ id: string }>();

  const teamIds = (results ?? []).map((r) => r.id).filter(Boolean);
  const total = teamIds.length;

  if (total === 0) {
    return { ok: true, total: 0, updated: 0, cursorBefore: 0, cursorAfter: 0, results: [] as any[] };
  }

  const stateKey = "team_forms";

  // ✅ tabela do cursor (a mesma que já estás a usar)
  const state = await env.DB.prepare(
    `SELECT cursor FROM team_form_sync_state WHERE key = ? LIMIT 1`
  )
    .bind(stateKey)
    .first<{ cursor: number }>();

  const cursorBeforeRaw = Number(state?.cursor ?? 0);
  const start = ((cursorBeforeRaw % total) + total) % total;

  // slice circular
  const slice: string[] = [];
  for (let i = 0; i < size; i++) {
    slice.push(teamIds[(start + i) % total]);
  }

  const out: any[] = [];
  let updated = 0;

  // sequencial para respeitar rate limit
  for (let i = 0; i < slice.length; i++) {
    const teamId = slice[i];
    try {
      const r = await syncOneTeam(env, teamId);
      out.push(r);
      if (r.ok) updated++;

      // se apanhares 429, pára já para não piorar
      if (!r.ok && String(r.error ?? "").includes("429")) break;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      out.push({ ok: false, teamId, error: msg });
      if (msg.includes("429")) break;
    }
  }

  const cursorAfter = (start + out.length) % total;

  await env.DB.prepare(
    `INSERT INTO team_form_sync_state (key, cursor, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       cursor = excluded.cursor,
       updated_at = excluded.updated_at`
  )
    .bind(stateKey, cursorAfter, new Date().toISOString())
    .run();

  return { ok: true, total, updated, cursorBefore: start, cursorAfter, results: out };
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

  try {
    const r = await syncOneTeam(c.env, teamId);
    return c.json(r, r.ok ? 200 : 400);
  } catch (e: any) {
    return c.json({ ok: false, teamId, error: String(e?.message ?? e) }, 502);
  }
});

/**
 * ✅ POST /api/admin/form/sync-batch?batch=10
 * Sem body. Ideal para testar sem levar 429.
 */
adminForm.post("/sync-batch", async (c) => {
  const err = requireAdmin(c as unknown as BindingsCtx);
  if (err) return c.json({ error: err }, 403);

  const q = Number(c.req.query("batch") ?? "10");
  const batch = Number.isFinite(q) ? q : 10;

  try {
    const r = await syncTeamFormsBatch(c.env, batch);
    return c.json(r);
  } catch (e: any) {
    return c.json({ ok: false, error: String(e?.message ?? e) }, 502);
  }
});

/**
 * POST /api/admin/form/sync-all
 * Força tudo (pode dar 429, usa com cuidado).
 */
adminForm.post("/sync-all", async (c) => {
  const err = requireAdmin(c as unknown as BindingsCtx);
  if (err) return c.json({ error: err }, 403);

  const batchSize = 10;

  // conta equipas (D1 devolve objecto com results)
  const countRes = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM teams`).all<{ n: number }>();
  const totalTeams = Number((countRes.results?.[0] as any)?.n ?? 0);

  const maxRuns = Math.ceil(Math.max(totalTeams, 1) / batchSize);
  const out: any[] = [];

  for (let i = 0; i < maxRuns; i++) {
    const r = await syncTeamFormsBatch(c.env, batchSize);
    out.push({ run: i + 1, ...r });

    // se apanhou 429, pára
    const hit429 = (r.results ?? []).some((x: any) => String(x?.error ?? x?.err ?? "").includes("429"));
    if (hit429) break;
  }

  return c.json({ ok: true, runs: out.length, details: out });
});
