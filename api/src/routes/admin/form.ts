import { Hono } from "hono";

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
  FOOTBALL_DATA_TOKEN: string;
};

function requireAdmin(c: { req: { header: (name: string) => string | undefined }; env: Env }): string | null {
    const key = c.req.header("x-admin-key") || c.req.header("X-Admin-Key");
    if (!key || key !== c.env.ADMIN_KEY) return "unauthorized";
    return null;
  }

export const adminForm = new Hono<{ Bindings: Env }>();

adminForm.post("/sync", async (c) => {
  const err = requireAdmin(c);
  if (err) return c.json({ error: err }, 403);

  type SyncBody = { teamId?: string };

function isSyncBody(v: unknown): v is SyncBody {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return obj.teamId === undefined || typeof obj.teamId === "string";
}

const raw: unknown = await c.req.json().catch(() => null);
const body: SyncBody = isSyncBody(raw) ? raw : {};
const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
if (!teamId) return c.json({ error: "missing_teamId" }, 400);

  // 1) equipa
  const team = await c.env.DB.prepare(
    "SELECT id, name FROM teams WHERE id = ?"
  )
    .bind(teamId)
    .first<{ id: string; name: string }>();

  if (!team) return c.json({ error: "unknown_team", teamId }, 400);

  // 2) Football-Data
  const token = c.env.FOOTBALL_DATA_TOKEN;
  if (!token) return c.json({ error: "missing_token" }, 500);

  // PPL (Liga Portugal). devolve lista de jogos terminados.
  const res = await fetch(
    "https://api.football-data.org/v4/competitions/PPL/matches?status=FINISHED&limit=100",
    { headers: { "X-Auth-Token": token } }
  );

  if (!res.ok) {
    return c.json(
      { error: "football_data_failed", status: res.status },
      502
    );
  }

  const data = await res.json();
  const matches = Array.isArray((data as any)?.matches) ? (data as any).matches : [];

  // 3) filtrar jogos da equipa por NOME (porque na tua tabela tens só name)
  const lastMatches = matches
    .filter((m: any) => m?.homeTeam?.name === team.name || m?.awayTeam?.name === team.name)
    .sort(
      (a: any, b: any) =>
        new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
    )
    .slice(0, 5);

  // 4) calcular forma (V/E/D)
  const last5Arr = lastMatches.map((m: any) => {
    const isHome = m.homeTeam?.name === team.name;
    const winner = m.score?.winner as
      | "HOME_TEAM"
      | "AWAY_TEAM"
      | "DRAW"
      | undefined
      | null;

    if (!winner || winner === "DRAW") return "E";

    const win =
      (winner === "HOME_TEAM" && isHome) ||
      (winner === "AWAY_TEAM" && !isHome);

    return win ? "V" : "D";
  });

  const last5 = last5Arr.join("");
  const updatedAt = new Date().toISOString();

  // 5) gravar no teu schema real
  await c.env.DB.prepare(
    `
      INSERT INTO team_form (team_id, last5, last5_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(team_id) DO UPDATE SET
        last5 = excluded.last5,
        last5_json = excluded.last5_json,
        updated_at = excluded.updated_at
    `
  )
    .bind(teamId, last5, JSON.stringify(lastMatches), updatedAt)
    .run();

  return c.json({
    ok: true,
    teamId,
    teamName: team.name,
    last5,
    updatedAt,
    count: lastMatches.length,
  });
});
